'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/nav/BottomNav'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['전체', '정비후기', 'Q&A', '정보공유', '자유']
const WRITE_CATEGORIES = ['정비후기', 'Q&A', '정보공유', '자유']

interface Post {
  id: string
  user_id: string
  category: string
  title: string
  content: string
  like_count: number
  view_count: number
  created_at: string
  author_name?: string
}

function fmtTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}시간 전`
  return `${Math.floor(hrs / 24)}일 전`
}

const CATEGORY_COLORS: Record<string, string> = {
  '정비후기': 'bg-blue-100 text-blue-700',
  'Q&A': 'bg-orange-100 text-orange-700',
  '정보공유': 'bg-green-100 text-green-700',
  '자유': 'bg-gray-100 text-gray-600',
}

export default function BoardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('전체')
  const [showWrite, setShowWrite] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // 글쓰기 폼 상태
  const [writeCategory, setWriteCategory] = useState('자유')
  const [writeTitle, setWriteTitle] = useState('')
  const [writeContent, setWriteContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 유저 확인
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      setUserId(user.id)
    })
  }, [])

  // 게시글 불러오기
  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (activeTab !== '전체') {
        query = query.eq('category', activeTab)
      }

      const { data, error } = await query
      if (error) {
        // 테이블이 없으면 빈 배열
        setPosts([])
      } else {
        // 작성자 이름 조회
        const userIds = Array.from(new Set((data ?? []).map((p: Post) => p.user_id)))
        let nameMap: Record<string, string> = {}
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, display_name')
            .in('id', userIds)
          users?.forEach((u: { id: string; display_name: string }) => {
            nameMap[u.id] = u.display_name ?? '익명'
          })
        }
        setPosts((data ?? []).map((p: Post) => ({ ...p, author_name: nameMap[p.user_id] ?? '익명' })))
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { loadPosts() }, [loadPosts])

  // 글쓰기 제출
  const handleSubmit = async () => {
    if (!writeTitle.trim() || !writeContent.trim() || !userId) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: userId,
        category: writeCategory,
        title: writeTitle.trim(),
        content: writeContent.trim(),
      })
      if (!error) {
        setShowWrite(false)
        setWriteTitle('')
        setWriteContent('')
        setWriteCategory('자유')
        await loadPosts()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-surface-50 max-w-[480px] mx-auto">
      {/* 헤더 */}
      <header className="bg-white px-5 pt-12 pb-3 border-b border-gray-100 flex-shrink-0">
        <h1 className="text-xl font-black text-gray-900">게시판</h1>
        <p className="text-sm text-gray-400 mt-0.5">정비 정보와 후기를 공유해요</p>

        {/* 카테고리 탭 */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* 게시글 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
            <span className="text-5xl">💬</span>
            <p className="text-base font-bold text-gray-700">아직 게시글이 없어요</p>
            <p className="text-sm text-gray-400">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {posts.map(post => (
              <div key={post.id} className="bg-white px-5 py-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-400">{fmtTimeAgo(post.created_at)}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">{post.title}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{post.content}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-gray-400">{post.author_name}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">👍 {post.like_count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 글쓰기 FAB */}
      <button
        onClick={() => setShowWrite(true)}
        className="fixed bottom-20 right-4 max-w-[480px] w-12 h-12 bg-primary-600 text-white rounded-full shadow-lg shadow-primary-200 flex items-center justify-center text-xl hover:bg-primary-700 active:scale-95 transition-all z-10"
        style={{ right: 'calc(50% - 220px)' }}
      >
        ✏️
      </button>

      <BottomNav />

      {/* 글쓰기 모달 */}
      {showWrite && (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setShowWrite(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white rounded-t-3xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-900">글쓰기</h2>
              <button
                onClick={() => setShowWrite(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
              >✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 카테고리 선택 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">카테고리</label>
                <div className="flex gap-2 flex-wrap">
                  {WRITE_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setWriteCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        writeCategory === cat
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">제목 <span className="text-red-500">*</span></label>
                <input
                  value={writeTitle}
                  onChange={e => setWriteTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  maxLength={100}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">내용 <span className="text-red-500">*</span></label>
                <textarea
                  value={writeContent}
                  onChange={e => setWriteContent(e.target.value)}
                  placeholder="내용을 입력하세요"
                  rows={6}
                  maxLength={2000}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 resize-none"
                />
                <p className="text-right text-xs text-gray-400 mt-1">{writeContent.length}/2000</p>
              </div>
            </div>

            {/* 등록 버튼 */}
            <div className="px-5 pb-8 pt-3 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={!writeTitle.trim() || !writeContent.trim() || submitting}
                className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl text-sm hover:bg-primary-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <span className="animate-spin">⟳</span> : null}
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

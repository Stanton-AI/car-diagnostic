'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/nav/BottomNav'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['전체', '정비후기', 'Q&A', '정보공유', '자유', '내 글']
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
  vehicle_nickname?: string | null
  vehicle_model?: string | null
  images?: string[] | null
}

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  parent_id?: string | null
  vehicle_nickname?: string | null
  vehicle_model?: string | null
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const CATEGORY_COLORS: Record<string, string> = {
  '정비후기': 'bg-blue-100 text-blue-700',
  'Q&A':    'bg-orange-100 text-orange-700',
  '정보공유': 'bg-green-100 text-green-700',
  '자유':    'bg-gray-100 text-gray-600',
}

function authorLabel(nick?: string | null, model?: string | null) {
  if (nick && model) return `${nick} (${model})`
  if (nick) return nick
  if (model) return model
  return '익명'
}

function BoardPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('전체')
  const [showWrite, setShowWrite] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  // 글쓰기 / 수정 폼
  const [editingPost, setEditingPost] = useState<Post | null>(null)   // null = 새 글, Post = 수정
  const [writeCategory, setWriteCategory] = useState('자유')
  const [writeTitle, setWriteTitle] = useState('')
  const [writeContent, setWriteContent] = useState('')
  const [writeImages, setWriteImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 차량 정보
  const [vehicleNickname, setVehicleNickname] = useState<string | null>(null)
  const [vehicleModel, setVehicleModel] = useState<string | null>(null)

  // 댓글
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  // 댓글 수정
  const [editingComment, setEditingComment] = useState<Comment | null>(null)
  const [editCommentText, setEditCommentText] = useState('')

  // 좋아요
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})

  // ── 유저 + 차량 확인 ─────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      setUserId(user.id)
      const { data: vehicles } = await supabase
        .from('vehicles').select('nickname, model')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
      if (vehicles && vehicles.length > 0) {
        setVehicleNickname(vehicles[0].nickname ?? null)
        setVehicleModel(vehicles[0].model ?? null)
      }
      const { data: likes } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id)
      if (likes) setLikedPosts(new Set(likes.map((l: { post_id: string }) => l.post_id)))
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── URL 파라미터로 글쓰기 자동 열기 ─────────────────────────────────
  useEffect(() => {
    if (searchParams.get('openWrite') === '1') {
      setWriteTitle(searchParams.get('title') ?? '')
      setWriteContent(searchParams.get('content') ?? '')
      setWriteCategory(searchParams.get('category') ?? '정비후기')
      const img = searchParams.get('imageUrl') ?? ''
      if (img) setWriteImages([img])
      setEditingPost(null)
      setShowWrite(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 게시글 불러오기 ─────────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50)
      if (activeTab === '내 글') {
        if (!userId) { setPosts([]); return }
        query = supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      } else if (activeTab !== '전체') {
        query = query.eq('category', activeTab)
      }
      const { data, error } = await query
      if (error) { setPosts([]); return }
      const list = data ?? []
      setPosts(list)
      const counts: Record<string, number> = {}
      list.forEach((p: Post) => { counts[p.id] = p.like_count })
      setLikeCounts(prev => ({ ...prev, ...counts }))
    } finally { setLoading(false) }
  }, [activeTab, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadPosts() }, [loadPosts])

  // ── 댓글 불러오기 ───────────────────────────────────────────────────
  const loadComments = useCallback(async (postId: string) => {
    setCommentsLoading(true)
    try {
      const { data } = await supabase.from('post_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
      setComments(data ?? [])
    } finally { setCommentsLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedPost) { loadComments(selectedPost.id); setCommentText(''); setReplyTo(null); setReplyText('') }
  }, [selectedPost, loadComments])

  // ── 이미지 업로드 ───────────────────────────────────────────────────
  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !userId) return
    setImageUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `board-images/${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { data, error } = await supabase.storage.from('repair-files').upload(path, file, { contentType: file.type, upsert: true })
        if (!error && data) {
          const { data: url } = supabase.storage.from('repair-files').getPublicUrl(path)
          uploaded.push(url.publicUrl)
        }
      }
      if (uploaded.length > 0) setWriteImages(prev => [...prev, ...uploaded])
    } finally { setImageUploading(false) }
  }

  // ── 글쓰기 / 수정 모달 열기 헬퍼 ────────────────────────────────────
  const openWrite = (post?: Post) => {
    if (post) {
      setEditingPost(post)
      setWriteCategory(post.category)
      setWriteTitle(post.title)
      setWriteContent(post.content)
      setWriteImages(post.images ?? [])
    } else {
      setEditingPost(null)
      setWriteCategory('자유')
      setWriteTitle('')
      setWriteContent('')
      setWriteImages([])
    }
    setShowWrite(true)
  }

  const closeWrite = () => {
    setShowWrite(false)
    setEditingPost(null)
    setWriteTitle('')
    setWriteContent('')
    setWriteCategory('자유')
    setWriteImages([])
  }

  // ── 글 등록 / 수정 제출 ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!writeTitle.trim() || !writeContent.trim() || !userId) return
    setSubmitting(true)
    try {
      if (editingPost) {
        // 수정
        const { error } = await supabase.from('posts').update({
          category: writeCategory, title: writeTitle.trim(),
          content: writeContent.trim(), images: writeImages,
          updated_at: new Date().toISOString(),
        }).eq('id', editingPost.id).eq('user_id', userId)
        if (!error) {
          // selectedPost도 동기화
          setSelectedPost(prev => prev ? { ...prev, category: writeCategory, title: writeTitle.trim(), content: writeContent.trim(), images: writeImages } : null)
          closeWrite()
          await loadPosts()
        }
      } else {
        // 새 글
        const { error } = await supabase.from('posts').insert({
          user_id: userId, category: writeCategory,
          title: writeTitle.trim(), content: writeContent.trim(),
          vehicle_nickname: vehicleNickname, vehicle_model: vehicleModel,
          images: writeImages.length > 0 ? writeImages : [],
        })
        if (!error) { closeWrite(); await loadPosts() }
      }
    } finally { setSubmitting(false) }
  }

  // ── 글 삭제 ─────────────────────────────────────────────────────────
  const handleDeletePost = async (post: Post) => {
    if (!confirm('정말 삭제하시겠어요?')) return
    await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId!)
    setSelectedPost(null)
    await loadPosts()
  }

  // ── 좋아요 토글 ─────────────────────────────────────────────────────
  const handleLike = async (post: Post) => {
    if (!userId) return
    const liked = likedPosts.has(post.id)
    setLikedPosts(prev => { const n = new Set(prev); liked ? n.delete(post.id) : n.add(post.id); return n })
    setLikeCounts(prev => ({ ...prev, [post.id]: (prev[post.id] ?? post.like_count) + (liked ? -1 : 1) }))
    if (liked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', userId)
      await supabase.from('posts').update({ like_count: Math.max(0, (likeCounts[post.id] ?? post.like_count) - 1) }).eq('id', post.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: userId })
      await supabase.from('posts').update({ like_count: (likeCounts[post.id] ?? post.like_count) + 1 }).eq('id', post.id)
    }
  }

  // ── 댓글 등록 ────────────────────────────────────────────────────────
  const handleCommentSubmit = async () => {
    if (!commentText.trim() || !userId || !selectedPost) return
    setSubmittingComment(true)
    try {
      await supabase.from('post_comments').insert({
        post_id: selectedPost.id, user_id: userId,
        content: commentText.trim(), parent_id: null,
        vehicle_nickname: vehicleNickname, vehicle_model: vehicleModel,
      })
      setCommentText('')
      await loadComments(selectedPost.id)
    } finally { setSubmittingComment(false) }
  }

  // ── 대댓글 등록 ──────────────────────────────────────────────────────
  const handleReplySubmit = async () => {
    if (!replyText.trim() || !userId || !selectedPost || !replyTo) return
    setSubmittingComment(true)
    try {
      await supabase.from('post_comments').insert({
        post_id: selectedPost.id, user_id: userId,
        content: replyText.trim(), parent_id: replyTo.id,
        vehicle_nickname: vehicleNickname, vehicle_model: vehicleModel,
      })
      setReplyText(''); setReplyTo(null)
      await loadComments(selectedPost.id)
    } finally { setSubmittingComment(false) }
  }

  // ── 댓글 수정 ────────────────────────────────────────────────────────
  const handleEditComment = async () => {
    if (!editingComment || !editCommentText.trim() || !userId) return
    setSubmittingComment(true)
    try {
      await supabase.from('post_comments').update({ content: editCommentText.trim() })
        .eq('id', editingComment.id).eq('user_id', userId)
      setEditingComment(null); setEditCommentText('')
      if (selectedPost) await loadComments(selectedPost.id)
    } finally { setSubmittingComment(false) }
  }

  // ── 댓글 삭제 ────────────────────────────────────────────────────────
  const handleDeleteComment = async (comment: Comment) => {
    if (!confirm('댓글을 삭제하시겠어요?')) return
    await supabase.from('post_comments').delete().eq('id', comment.id).eq('user_id', userId!)
    if (selectedPost) await loadComments(selectedPost.id)
  }

  // ── 댓글 트리 구조 ────────────────────────────────────────────────────
  const rootComments = comments.filter(c => !c.parent_id)
  const repliesMap: Record<string, Comment[]> = {}
  comments.forEach(c => { if (c.parent_id) { if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = []; repliesMap[c.parent_id].push(c) } })

  const isMyPost = selectedPost?.user_id === userId

  return (
    <div className="flex flex-col h-screen max-w-[480px] mx-auto" style={{ background: '#ffffff' }}>
      {/* 헤더 */}
      <header className="px-5 pt-12 pb-3 flex-shrink-0 sticky top-0 z-20"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        <h1 className="text-xl font-black text-gray-900">게시판</h1>
        <p className="text-sm text-gray-400 mt-0.5">정비 정보와 후기를 공유해요</p>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.96] ${
                activeTab === cat ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
              style={activeTab === cat ? {
                background: '#4C4DDC',
                boxShadow: '0 2px 8px rgba(76,77,220,0.25)',
              } : {
                background: 'rgba(0, 0, 0, 0.04)',
              }}
            >{cat}</button>
          ))}
        </div>
      </header>

      {/* 게시글 목록 */}
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
            <span className="text-5xl">💬</span>
            <p className="text-base font-bold text-gray-700">{activeTab === '내 글' ? '아직 작성한 글이 없어요' : '아직 게시글이 없어요'}</p>
            <p className="text-sm text-gray-400">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2.5">
            {posts.map(post => (
              <button key={post.id} onClick={() => setSelectedPost(post)}
                className="w-full text-left rounded-2xl px-4 py-3.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-400">{fmtTimeAgo(post.created_at)}</span>
                  {post.user_id === userId && (
                    <span className="text-[10px] font-bold ml-auto px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: '#4C4DDC' }}>내 글</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">{post.title}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{post.content}</p>
                {post.images && post.images.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {post.images.slice(0, 3).map((url, i) => (
                      <img key={i} src={url} alt="" className="w-14 h-14 object-cover rounded-xl border border-gray-100 shadow-sm" />
                    ))}
                    {post.images.length > 3 && <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xs text-gray-500 font-bold" style={{ background: 'rgba(0,0,0,0.03)' }}>+{post.images.length - 3}</div>}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">🚗 {authorLabel(post.vehicle_nickname, post.vehicle_model)}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">👍 {likeCounts[post.id] ?? post.like_count}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 글쓰기 FAB */}
      {!showWrite && !selectedPost && (
        <button onClick={() => openWrite()}
          className="fixed z-10 w-14 h-14 text-white rounded-2xl flex items-center justify-center text-xl active:scale-90 transition-all"
          style={{
            bottom: '88px',
            right: 'max(16px, calc(50% - 224px))',
            background: '#4C4DDC',
            boxShadow: '0 4px 20px rgba(76,77,220,0.35)',
          }}
        >✏️</button>
      )}

      <BottomNav />

      {/* ── 게시글 상세보기 ── */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setSelectedPost(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto rounded-t-3xl max-h-[92vh] flex flex-col"
            style={{
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 -4px 32px rgba(0, 0, 0, 0.08)',
            }}
            onClick={e => e.stopPropagation()}>

            {/* 상세 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[selectedPost.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {selectedPost.category}
              </span>
              <div className="flex items-center gap-2">
                {isMyPost && (
                  <>
                    <button onClick={() => { setSelectedPost(null); openWrite(selectedPost) }}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg transition-colors" style={{ color: '#4C4DDC', background: 'rgba(76,77,220,0.06)' }}>수정</button>
                    <button onClick={() => handleDeletePost(selectedPost)}
                      className="text-xs text-red-400 font-bold px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors">삭제</button>
                  </>
                )}
                <button onClick={() => setSelectedPost(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 text-sm transition-colors" style={{ background: 'rgba(0, 0, 0, 0.04)' }}>✕</button>
              </div>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <h2 className="text-lg font-black text-gray-900 leading-snug mb-2">{selectedPost.title}</h2>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-gray-500">🚗 {authorLabel(selectedPost.vehicle_nickname, selectedPost.vehicle_model)}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">{fmtDate(selectedPost.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{selectedPost.content}</p>

              {/* 첨부 이미지 */}
              {selectedPost.images && selectedPost.images.length > 0 && (
                <div className="mt-4 space-y-2">
                  {selectedPost.images.map((url, i) => (
                    <img key={i} src={url} alt="첨부 이미지" className="w-full rounded-xl border border-gray-100" />
                  ))}
                </div>
              )}

              {/* 좋아요 */}
              <div className="mt-5">
                <button onClick={() => handleLike(selectedPost)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
                  style={likedPosts.has(selectedPost.id) ? {
                    background: '#4C4DDC',
                    color: '#fff',
                    boxShadow: '0 2px 12px rgba(76,77,220,0.3)',
                  } : {
                    background: 'rgba(0, 0, 0, 0.03)',
                    color: '#6b7280',
                  }}>
                  👍 {likeCounts[selectedPost.id] ?? selectedPost.like_count}
                </button>
              </div>

              {/* 댓글 섹션 */}
              <div className="mt-6">
                <p className="text-sm font-bold text-gray-800 mb-3">댓글 {comments.length}개</p>
                {commentsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  </div>
                ) : rootComments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">아직 댓글이 없어요</p>
                ) : (
                  <div className="space-y-3">
                    {rootComments.map(comment => (
                      <div key={comment.id}>
                        {/* 댓글 */}
                        <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">
                              🚗 {authorLabel(comment.vehicle_nickname, comment.vehicle_model)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400">{fmtTimeAgo(comment.created_at)}</span>
                              {comment.user_id === userId && (
                                <div className="flex gap-1">
                                  <button onClick={() => { setEditingComment(comment); setEditCommentText(comment.content) }}
                                    className="text-[10px] text-primary-400 font-bold">수정</button>
                                  <button onClick={() => handleDeleteComment(comment)}
                                    className="text-[10px] text-red-400 font-bold">삭제</button>
                                </div>
                              )}
                            </div>
                          </div>
                          {editingComment?.id === comment.id ? (
                            <div className="flex gap-2 items-end mt-1">
                              <textarea value={editCommentText} onChange={e => setEditCommentText(e.target.value)}
                                rows={2} className="flex-1 px-2 py-1.5 rounded-lg border border-primary-200 text-xs resize-none focus:outline-none" />
                              <div className="flex flex-col gap-1">
                                <button onClick={handleEditComment} disabled={submittingComment}
                                  className="px-2 py-1 bg-primary-600 text-white text-[10px] font-bold rounded-lg disabled:opacity-40">저장</button>
                                <button onClick={() => { setEditingComment(null); setEditCommentText('') }}
                                  className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg">취소</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                          )}
                          <button
                            onClick={() => { setReplyTo(replyTo?.id === comment.id ? null : comment); setReplyText(''); setTimeout(() => commentInputRef.current?.focus(), 100) }}
                            className="mt-1 text-[11px] text-primary-500 font-semibold">답글 달기</button>
                        </div>

                        {/* 대댓글 */}
                        {(repliesMap[comment.id] ?? []).map(reply => (
                          <div key={reply.id} className="ml-4 mt-1.5 rounded-xl px-3 py-2.5 border-l-2" style={{ background: 'rgba(76,77,220,0.03)', borderColor: 'rgba(76,77,220,0.15)' }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-700">
                                ↩ 🚗 {authorLabel(reply.vehicle_nickname, reply.vehicle_model)}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">{fmtTimeAgo(reply.created_at)}</span>
                                {reply.user_id === userId && (
                                  <div className="flex gap-1">
                                    <button onClick={() => { setEditingComment(reply); setEditCommentText(reply.content) }}
                                      className="text-[10px] text-primary-400 font-bold">수정</button>
                                    <button onClick={() => handleDeleteComment(reply)}
                                      className="text-[10px] text-red-400 font-bold">삭제</button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {editingComment?.id === reply.id ? (
                              <div className="flex gap-2 items-end mt-1">
                                <textarea value={editCommentText} onChange={e => setEditCommentText(e.target.value)}
                                  rows={2} className="flex-1 px-2 py-1.5 rounded-lg border border-primary-200 text-xs resize-none focus:outline-none" />
                                <div className="flex flex-col gap-1">
                                  <button onClick={handleEditComment} disabled={submittingComment}
                                    className="px-2 py-1 bg-primary-600 text-white text-[10px] font-bold rounded-lg disabled:opacity-40">저장</button>
                                  <button onClick={() => { setEditingComment(null); setEditCommentText('') }}
                                    className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg">취소</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-700 leading-relaxed">{reply.content}</p>
                            )}
                          </div>
                        ))}

                        {/* 대댓글 입력 */}
                        {replyTo?.id === comment.id && (
                          <div className="ml-4 mt-1.5 flex gap-2 items-end">
                            <textarea ref={commentInputRef} value={replyText} onChange={e => setReplyText(e.target.value)}
                              placeholder={`${authorLabel(comment.vehicle_nickname, comment.vehicle_model)}에게 답글...`}
                              rows={2} className="flex-1 px-3 py-2 rounded-xl border border-primary-200 text-xs focus:outline-none focus:border-primary-400 resize-none bg-blue-50" />
                            <button onClick={handleReplySubmit} disabled={!replyText.trim() || submittingComment}
                              className="px-3 py-2 bg-primary-600 text-white text-xs font-bold rounded-xl disabled:opacity-40">등록</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 댓글 입력 */}
            <div className="px-4 pb-8 pt-3 flex-shrink-0 flex gap-2 items-end"
              style={{
                borderTop: '1px solid rgba(0, 0, 0, 0.04)',
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                placeholder="댓글을 입력하세요..." rows={2}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none resize-none transition-all"
                style={{ border: '1px solid rgba(0, 0, 0, 0.06)', background: 'rgba(0, 0, 0, 0.02)' }} />
              <button onClick={handleCommentSubmit} disabled={!commentText.trim() || submittingComment}
                className="px-4 py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all"
                style={{
                  background: (!commentText.trim() || submittingComment) ? '#d1d5db' : '#4C4DDC',
                  boxShadow: (!commentText.trim() || submittingComment) ? 'none' : '0 2px 8px rgba(76,77,220,0.3)',
                }}>
                {submittingComment ? '...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 글쓰기 / 수정 모달 ── */}
      {showWrite && (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={closeWrite}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto rounded-t-3xl max-h-[90vh] flex flex-col"
            style={{
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 -4px 32px rgba(0, 0, 0, 0.08)',
            }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
              <h2 className="text-lg font-black text-gray-900">{editingPost ? '글 수정' : '글쓰기'}</h2>
              <button onClick={closeWrite} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 text-sm transition-colors" style={{ background: 'rgba(0, 0, 0, 0.04)' }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 작성자 */}
              <div className="rounded-xl px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(76,77,220,0.04)', border: '1px solid rgba(76,77,220,0.08)' }}>
                <span className="text-xs text-gray-400">작성자</span>
                <span className="text-xs font-semibold text-gray-700">🚗 {authorLabel(vehicleNickname, vehicleModel)}</span>
              </div>
              {/* 카테고리 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">카테고리</label>
                <div className="flex gap-2 flex-wrap">
                  {WRITE_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setWriteCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-[0.96] ${
                        writeCategory === cat ? 'text-white' : 'text-gray-500'
                      }`}
                      style={writeCategory === cat ? {
                        background: '#4C4DDC',
                        boxShadow: '0 2px 8px rgba(76,77,220,0.25)',
                      } : {
                        background: 'rgba(0, 0, 0, 0.04)',
                      }}>{cat}</button>
                  ))}
                </div>
              </div>
              {/* 제목 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">제목 <span className="text-red-500">*</span></label>
                <input value={writeTitle} onChange={e => setWriteTitle(e.target.value)}
                  placeholder="제목을 입력하세요" maxLength={100}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400" />
              </div>
              {/* 내용 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">내용 <span className="text-red-500">*</span></label>
                <textarea value={writeContent} onChange={e => setWriteContent(e.target.value)}
                  placeholder="내용을 입력하세요" rows={6} maxLength={2000}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 resize-none" />
                <p className="text-right text-xs text-gray-400 mt-1">{writeContent.length}/2000</p>
              </div>
              {/* 이미지 첨부 */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">이미지 첨부</label>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => handleImageUpload(e.target.files)} />
                <button onClick={() => fileInputRef.current?.click()} disabled={imageUploading}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-primary-300 hover:text-primary-500 transition-colors disabled:opacity-50 w-full justify-center">
                  {imageUploading ? (
                    <><span className="animate-spin">⟳</span> 업로드 중...</>
                  ) : (
                    <>📷 사진 추가하기</>
                  )}
                </button>
                {/* 이미지 미리보기 */}
                {writeImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {writeImages.map((url, i) => (
                      <div key={i} className="relative aspect-square">
                        <img src={url} alt="첨부" className="w-full h-full object-cover rounded-xl border border-gray-100" />
                        <button onClick={() => setWriteImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-[10px] flex items-center justify-center">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 pb-8 pt-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.04)' }}>
              <button onClick={handleSubmit} disabled={!writeTitle.trim() || !writeContent.trim() || submitting}
                className="w-full py-4 text-white font-bold rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                style={{
                  background: (!writeTitle.trim() || !writeContent.trim() || submitting) ? '#d1d5db' : '#4C4DDC',
                  boxShadow: (!writeTitle.trim() || !writeContent.trim() || submitting) ? 'none' : '0 4px 16px rgba(76,77,220,0.3)',
                }}>
                {submitting ? <span className="animate-spin">⟳</span> : null}
                {editingPost ? '수정 완료' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BoardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    }>
      <BoardPageInner />
    </Suspense>
  )
}

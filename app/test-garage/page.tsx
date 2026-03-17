'use client'
import { useState, useRef, useCallback } from 'react'
import BottomNav from '@/components/nav/BottomNav'

export default function TestGaragePage() {
  const [garageOpen, setGarageOpen] = useState(true)
  const touchStartY = useRef(0)

  const handleGarageTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleGarageTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (garageOpen && deltaY > 50) setGarageOpen(false)
    else if (!garageOpen && deltaY < -50) setGarageOpen(true)
  }, [garageOpen])

  const vehicle = { nickname: '활발한드라이버', model: '테슬라 모델3', year: 2022, mileage: 45000, fuel_type: 'electric' }

  return (
    <div className="flex flex-col h-screen bg-surface-50 max-w-[480px] mx-auto">
      {/* 헤더 */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-start justify-between flex-shrink-0 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="정비톡" className="w-7 h-7 rounded-lg object-contain" />
            <h1 className="text-xl font-black text-gray-900">정비톡</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">"내 차 증상, 3분이면 알 수 있어요"</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-primary-600 font-bold text-sm">A</span>
        </div>
      </header>

      {/* 차량 카드 (드래그 차고) */}
      <div className="flex-shrink-0">
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${garageOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-4 pt-4">
            <div className="w-full text-left relative bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-5 text-white overflow-hidden shadow-lg shadow-primary-200">
              <div className="absolute top-4 right-4 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">전기</div>
              <div className="absolute bottom-4 right-4 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="text-[10px]">✏️</span><span className="text-[11px] font-semibold">수정</span>
              </div>
              <p className="text-white/70 text-xs mb-1 font-medium">🚗 {vehicle.nickname}의 차고</p>
              <h2 className="text-2xl font-black mb-1">{vehicle.model}</h2>
              <p className="text-white/70 text-sm">{vehicle.year}년식 · {vehicle.mileage.toLocaleString()}km</p>
            </div>
          </div>
        </div>

        {/* 드래그 핸들 */}
        <div
          onTouchStart={handleGarageTouchStart}
          onTouchEnd={handleGarageTouchEnd}
          onClick={() => setGarageOpen(v => !v)}
          className="flex flex-col items-center justify-center gap-1 py-2 cursor-pointer select-none"
        >
          {!garageOpen && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-gray-600">🚗 {vehicle.nickname}</span>
              <span className="text-xs text-gray-400">{vehicle.year}년식 · {vehicle.mileage.toLocaleString()}km</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-1 bg-gray-300 rounded-full" />
            <span className="text-[10px] text-gray-400">{garageOpen ? '▲ 차고 숨기기' : '▼ 차고 열기'}</span>
            <div className="w-8 h-1 bg-gray-300 rounded-full" />
          </div>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-primary-600">✦</span>
          <h3 className="font-bold text-gray-900 text-sm">정비톡 AI와 상담하기</h3>
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-xl flex-shrink-0 overflow-hidden">
            <img src="/miky.png" alt="정비톡 AI" className="w-full h-full object-cover" />
          </div>
          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 max-w-[80%]">
            <p className="text-sm text-gray-800 leading-relaxed">안녕하세요! 저는 정비톡 AI예요. 🔧<br/><br/>진단할 차량이 내 차인가요, 아니면 다른 분의 차인가요?</p>
          </div>
        </div>
        <div className="flex gap-3 ml-10">
          <button className="flex-1 py-3 px-4 bg-white border-2 border-primary-200 rounded-2xl text-sm font-semibold text-primary-700 shadow-sm">🚗 내 차</button>
          <button className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 rounded-2xl text-sm font-semibold text-gray-600 shadow-sm">🔍 앱에 등록되지 않은 차</button>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

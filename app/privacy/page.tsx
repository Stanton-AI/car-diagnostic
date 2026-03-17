import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '개인정보처리방침 — 정비톡',
  description: '정비톡 AI 자동차 진단 서비스 개인정보처리방침',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-[480px] mx-auto">
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← 홈으로</Link>
      </div>

      <h1 className="text-2xl font-black text-gray-900 mb-2">개인정보처리방침</h1>
      <p className="text-sm text-gray-500 mb-8">최종 수정일: 2025년 1월 1일</p>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

        <section>
          <h2 className="font-bold text-gray-900 mb-3">1. 개인정보 수집 항목 및 목적</h2>
          <p>정비톡(이하 "서비스")는 다음과 같은 개인정보를 수집합니다.</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-gray-600">
            <li>이메일 주소: 로그인 계정 식별 및 고객 응대</li>
            <li>이름(닉네임): 서비스 내 사용자 표시</li>
            <li>프로필 사진: 계정 프로필 표시 (선택 사항)</li>
            <li>차량 정보: AI 진단 서비스 제공</li>
            <li>진단 대화 내용: AI 분석 결과 제공 및 이력 관리</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-3">2. 개인정보 수집 방법</h2>
          <ul className="space-y-2 list-disc list-inside text-gray-600">
            <li>Google, 카카오 OAuth를 통한 소셜 로그인</li>
            <li>서비스 이용 과정에서 사용자가 직접 입력한 정보</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-3">3. 개인정보 보유 및 이용 기간</h2>
          <p>수집된 개인정보는 서비스 탈퇴 시까지 보유합니다. 관련 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관 후 삭제합니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-3">4. 개인정보 제3자 제공</h2>
          <p>서비스는 사용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, AI 진단 기능 제공을 위해 OpenAI API에 대화 내용이 전달될 수 있으며, 이는 서비스 제공 목적으로만 사용됩니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-3">5. 개인정보 처리 위탁</h2>
          <p>서비스는 안정적인 서비스 운영을 위해 다음 업체에 개인정보 처리를 위탁합니다.</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-gray-600">
            <li>Supabase Inc.: 데이터 저장 및 인증 관리</li>
            <li>Vercel Inc.: 서버 호스팅</li>
            <li>OpenAI Inc.: AI 진단 분석 처리</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-3">6. 이용자의 권리</h2>
          <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-gray-600">
            <li>개인정보 조회 및 수정</li>
            <li>개인정보 삭제 요청 (서비스 탈퇴)</li>
            <li>개인정보 처리 정지 요청</li>
          </ul>
          <p className="mt-3">위 권리 행사는 이메일(아래 연락처)로 요청하실 수 있습니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-3">7. 쿠키 및 자동 수집 항목</h2>
          <p>서비스는 로그인 상태 유지를 위해 쿠키 및 로컬 스토리지를 사용합니다. 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 제한이 있을 수 있습니다.</p>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-3">8. 개인정보 보호책임자</h2>
          <p>개인정보 처리에 관한 문의, 불만, 피해 구제 등은 아래로 연락해 주세요.</p>
          <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-1 text-gray-600">
            <p>서비스명: 정비톡</p>
            <p>이메일: <a href="mailto:superteshyeong@gmail.com" className="text-blue-600 underline">superteshyeong@gmail.com</a></p>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-gray-900 mb-3">9. 개인정보처리방침 변경</h2>
          <p>본 방침은 법령 또는 서비스 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.</p>
        </section>

      </div>

      <div className="mt-12 pt-6 border-t border-gray-100">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← 정비톡 홈으로 돌아가기</Link>
      </div>
    </div>
  )
}

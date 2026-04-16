'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          background: '#f9fafb',
        }}>
          <div style={{
            maxWidth: '400px',
            width: '100%',
            background: 'white',
            borderRadius: '16px',
            padding: '32px 24px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</p>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111', marginBottom: '8px' }}>
              오류가 발생했습니다
            </h2>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.6 }}>
              {error.message || '알 수 없는 오류'}
            </p>
            <pre style={{
              fontSize: '11px',
              color: '#999',
              background: '#f3f4f6',
              padding: '12px',
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '120px',
              textAlign: 'left',
              marginBottom: '16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {error.stack?.slice(0, 500) || 'No stack trace'}
            </pre>
            <button
              onClick={reset}
              style={{
                padding: '12px 32px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

import { useToastStore } from '../state/toastStore'

const ICON = { success: '✓', error: '✕', info: 'ℹ' } as const

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)}>
          <span className="toast__icon" aria-hidden="true">
            {ICON[t.kind]}
          </span>
          <span className="toast__msg">{t.message}</span>
        </button>
      ))}
    </div>
  )
}

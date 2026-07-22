import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { openCashSession, closeCashSession } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'

export function CashSessionPage() {
  const auth = useAppStore((s) => s.auth)
  const setActiveCashSessionId = useAppStore((s) => s.setActiveCashSessionId)
  const [openingAmount, setOpeningAmount] = useState('')
  const [countedAmount, setCountedAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const openSession = useLiveQuery(
    () => (auth.storeId ? db.cashSessions.where({ storeId: auth.storeId, status: 'open' }).first() : undefined),
    [auth.storeId],
  )

  const history = useLiveQuery(async () => {
    if (!auth.storeId) return []
    const closed = await db.cashSessions.where({ storeId: auth.storeId, status: 'closed' }).toArray()
    return closed.sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 10)
  }, [auth.storeId])

  async function handleOpen(e: FormEvent) {
    e.preventDefault()
    if (!auth.storeId) return
    setError(null)
    try {
      const session = await openCashSession(auth.storeId, auth.userId, Number(openingAmount))
      setActiveCashSessionId(session.id)
      setOpeningAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open session')
    }
  }

  async function handleClose(e: FormEvent) {
    e.preventDefault()
    if (!openSession) return
    const closed = await closeCashSession(openSession.id, Number(countedAmount), notes || null)
    setActiveCashSessionId(null)
    setCountedAmount('')
    setNotes('')
    alert(
      `Session closed. Expected ${formatNpr(closed.expectedAmount ?? 0)}, counted ${formatNpr(
        closed.closingCountedAmount ?? 0,
      )}, discrepancy ${formatNpr(closed.discrepancy ?? 0)}.`,
    )
  }

  return (
    <div className="page">
      <h1>Cash session</h1>

      {!openSession && (
        <form className="cash-form" onSubmit={handleOpen}>
          <h2>Start of day — opening cash</h2>
          <label>
            Opening cash amount (NPR)
            <input
              type="number"
              step="0.01"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit">Open session</button>
        </form>
      )}

      {openSession && (
        <form className="cash-form" onSubmit={handleClose}>
          <h2>End of day — closing cash</h2>
          <p>Opened {new Date(openSession.openedAt).toLocaleString()} with {formatNpr(openSession.openingAmount)}</p>
          <label>
            Counted cash amount (NPR)
            <input
              type="number"
              step="0.01"
              value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Notes (optional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button type="submit">Close session</button>
        </form>
      )}

      <h2>Recent sessions</h2>
      <table className="cash-history">
        <thead>
          <tr>
            <th>Opened</th>
            <th>Opening</th>
            <th>Expected</th>
            <th>Counted</th>
            <th>Discrepancy</th>
          </tr>
        </thead>
        <tbody>
          {(history ?? []).map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.openedAt).toLocaleDateString()}</td>
              <td>{formatNpr(s.openingAmount)}</td>
              <td>{formatNpr(s.expectedAmount ?? 0)}</td>
              <td>{formatNpr(s.closingCountedAmount ?? 0)}</td>
              <td className={(s.discrepancy ?? 0) !== 0 ? 'discrepancy' : ''}>{formatNpr(s.discrepancy ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

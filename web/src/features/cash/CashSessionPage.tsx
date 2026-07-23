import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { openCashSession, closeCashSession, updateCashSessionDetails } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'
import { toast } from '../../state/toastStore'
import { CashSessionsTable } from './CashSessionsTable'

export function CashSessionPage() {
  const auth = useAppStore((s) => s.auth)
  const setActiveCashSessionId = useAppStore((s) => s.setActiveCashSessionId)
  const [openingAmount, setOpeningAmount] = useState('')
  const [countedAmount, setCountedAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [closeSummary, setCloseSummary] = useState<{ expected: number; counted: number; discrepancy: number } | null>(
    null,
  )
  const [editingOpeningAmount, setEditingOpeningAmount] = useState(false)
  const [openingAmountDraft, setOpeningAmountDraft] = useState('')

  const openSession = useLiveQuery(
    () => (auth.storeId ? db.cashSessions.where({ storeId: auth.storeId, status: 'open' }).first() : undefined),
    [auth.storeId],
  )

  const recent = useLiveQuery(async () => {
    if (!auth.storeId) return []
    const closed = await db.cashSessions.where({ storeId: auth.storeId, status: 'closed' }).toArray()
    return closed.sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 6)
  }, [auth.storeId])

  async function handleOpen(e: FormEvent) {
    e.preventDefault()
    if (!auth.storeId) return
    setError(null)
    setBusy(true)
    try {
      const session = await openCashSession(auth.storeId, auth.userId, Number(openingAmount))
      setActiveCashSessionId(session.id)
      setOpeningAmount('')
      toast.success('Cash session opened')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open session')
    } finally {
      setBusy(false)
    }
  }

  async function handleClose(e: FormEvent) {
    e.preventDefault()
    if (!openSession) return
    setError(null)
    setBusy(true)
    try {
      const closed = await closeCashSession(openSession.id, Number(countedAmount), notes || null)
      setActiveCashSessionId(null)
      setCountedAmount('')
      setNotes('')
      setCloseSummary({
        expected: closed.expectedAmount ?? 0,
        counted: closed.closingCountedAmount ?? 0,
        discrepancy: closed.discrepancy ?? 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close session')
    } finally {
      setBusy(false)
    }
  }

  function startEditOpeningAmount() {
    if (!openSession) return
    setOpeningAmountDraft(openSession.openingAmount.toString())
    setEditingOpeningAmount(true)
  }

  async function handleSaveOpeningAmount() {
    if (!openSession) return
    setBusy(true)
    try {
      await updateCashSessionDetails(openSession.id, { openingAmount: Number(openingAmountDraft) })
      setEditingOpeningAmount(false)
      toast.success('Opening amount updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update opening amount')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Cash session</h1>

      {closeSummary && (
        <div className={closeSummary.discrepancy === 0 ? 'receipt' : 'form-error'}>
          Session closed — expected {formatNpr(closeSummary.expected)}, counted {formatNpr(closeSummary.counted)},
          discrepancy {formatNpr(closeSummary.discrepancy)}.
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {!openSession && (
        <form className="cash-form" onSubmit={handleOpen}>
          <h2>Start of day — opening cash</h2>
          <label>
            Opening cash amount (NPR)
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              required
              autoFocus
            />
          </label>
          <button type="submit" className="button-primary button-large" disabled={busy}>
            {busy ? 'Opening…' : 'Open session'}
          </button>
        </form>
      )}

      {openSession && (
        <form className="cash-form" onSubmit={handleClose}>
          <h2>End of day — closing cash</h2>
          {!editingOpeningAmount ? (
            <p className="cash-form__meta">
              Opened {new Date(openSession.openedAt).toLocaleString()} with {formatNpr(openSession.openingAmount)}{' '}
              <button type="button" className="link-button" onClick={startEditOpeningAmount}>
                Edit
              </button>{' '}
              · <Link to={`/cash/${openSession.id}`}>View sales →</Link>
            </p>
          ) : (
            <div className="inline-add" style={{ marginBottom: '0.85rem' }}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={openingAmountDraft}
                onChange={(e) => setOpeningAmountDraft(e.target.value)}
                autoFocus
              />
              <button type="button" className="button-primary" onClick={handleSaveOpeningAmount} disabled={busy}>
                Save
              </button>
              <button type="button" className="button-secondary" onClick={() => setEditingOpeningAmount(false)}>
                Cancel
              </button>
            </div>
          )}
          <label>
            Counted cash amount (NPR)
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Notes (optional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button type="submit" className="button-primary button-large" disabled={busy}>
            {busy ? 'Closing…' : 'Close session'}
          </button>
        </form>
      )}

      <div className="section-head">
        <h2>Recent sessions</h2>
        <Link to="/cash/history" className="link-button">
          View all by date →
        </Link>
      </div>
      <CashSessionsTable sessions={recent ?? []} />
    </div>
  )
}

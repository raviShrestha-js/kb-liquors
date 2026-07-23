import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updateCashSessionDetails, deleteCashSession } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'
import { toast } from '../../state/toastStore'
import type { CashSession } from '../../db/types'

interface Props {
  sessions: CashSession[]
}

export function CashSessionsTable({ sessions }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ counted: '', notes: '' })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function startEdit(s: CashSession) {
    setEditingId(s.id)
    setDraft({ counted: (s.closingCountedAmount ?? 0).toString(), notes: s.notes ?? '' })
  }

  async function save(id: string) {
    setBusy(true)
    try {
      await updateCashSessionDetails(id, { closingCountedAmount: Number(draft.counted), notes: draft.notes || null })
      setEditingId(null)
      toast.success('Session updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update session')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await deleteCashSession(id)
      setConfirmDeleteId(null)
      toast.success('Session deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete session')
    } finally {
      setBusy(false)
    }
  }

  if (sessions.length === 0) return <p className="empty-hint">No sessions in this period.</p>

  return (
    <div className="table-scroll">
      <table className="cash-history">
        <thead>
          <tr>
            <th>Opened</th>
            <th>Opening</th>
            <th>Expected</th>
            <th>Counted</th>
            <th>Discrepancy</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) =>
            editingId === s.id ? (
              <tr key={s.id}>
                <td>{new Date(s.openedAt).toLocaleDateString()}</td>
                <td>{formatNpr(s.openingAmount)}</td>
                <td>{formatNpr(s.expectedAmount ?? 0)}</td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.counted}
                    onChange={(e) => setDraft((d) => ({ ...d, counted: e.target.value }))}
                    style={{ minWidth: 90 }}
                  />
                </td>
                <td>—</td>
                <td>
                  <input
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    style={{ minWidth: 100 }}
                  />
                </td>
                <td className="row-actions">
                  <button type="button" className="button-primary" onClick={() => save(s.id)} disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={s.id}>
                <td>
                  {new Date(s.openedAt).toLocaleDateString()}
                  {s.status === 'open' && <span className="pill-tag">Open</span>}
                </td>
                <td>{formatNpr(s.openingAmount)}</td>
                <td>{formatNpr(s.expectedAmount ?? 0)}</td>
                <td>{formatNpr(s.closingCountedAmount ?? 0)}</td>
                <td className={(s.discrepancy ?? 0) !== 0 ? 'discrepancy' : ''}>{formatNpr(s.discrepancy ?? 0)}</td>
                <td>{s.notes ?? '—'}</td>
                <td className="row-actions">
                  {confirmDeleteId === s.id ? (
                    <>
                      <span className="confirm-text">Delete?</span>
                      <button type="button" className="button-danger" onClick={() => remove(s.id)} disabled={busy}>
                        Yes
                      </button>
                      <button type="button" className="button-secondary" onClick={() => setConfirmDeleteId(null)}>
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <Link to={`/cash/${s.id}`} className="button-secondary">
                        View
                      </Link>
                      {s.status === 'closed' && (
                        <button type="button" className="button-secondary" onClick={() => startEdit(s)}>
                          Edit
                        </button>
                      )}
                      <button type="button" className="button-danger-ghost" onClick={() => setConfirmDeleteId(s.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

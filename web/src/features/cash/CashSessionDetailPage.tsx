import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { voidSale, updateCashExpense, deleteCashExpense } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'
import { toast } from '../../state/toastStore'

export function CashSessionDetailPage() {
  const { id } = useParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingVoidId, setConfirmingVoidId] = useState<string | null>(null)

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ amount: '', category: '', notes: '' })
  const [confirmingDeleteExpenseId, setConfirmingDeleteExpenseId] = useState<string | null>(null)

  const session = useLiveQuery(() => (id ? db.cashSessions.get(id) : undefined), [id])

  const sales = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.sales.where({ cashSessionId: id }).toArray()
    return rows.sort((a, b) => b.soldAt.localeCompare(a.soldAt))
  }, [id])

  const saleItemCounts = useLiveQuery(async () => {
    if (!sales || sales.length === 0) return new Map<string, number>()
    const counts = new Map<string, number>()
    for (const sale of sales) {
      const items = await db.saleItems.where({ saleId: sale.id }).toArray()
      counts.set(sale.id, items.reduce((sum, i) => sum + i.quantity, 0))
    }
    return counts
  }, [sales])

  const expenses = useLiveQuery(async () => {
    if (!id) return []
    const rows = await db.cashExpenses.where({ cashSessionId: id }).toArray()
    return rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }, [id])

  async function handleVoid(saleId: string) {
    setError(null)
    setBusy(true)
    try {
      await voidSale(saleId)
      setConfirmingVoidId(null)
      toast.success('Sale voided — stock restored')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void this sale.')
    } finally {
      setBusy(false)
    }
  }

  function startEditExpense(expenseId: string, amount: number, category: string, notes: string | null) {
    setEditingExpenseId(expenseId)
    setEditDraft({ amount: amount.toString(), category, notes: notes ?? '' })
  }

  async function handleSaveExpense(expenseId: string) {
    setError(null)
    setBusy(true)
    try {
      await updateCashExpense(expenseId, {
        amount: Number(editDraft.amount),
        category: editDraft.category,
        notes: editDraft.notes || null,
      })
      setEditingExpenseId(null)
      toast.success('Expense updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update expense.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    setError(null)
    setBusy(true)
    try {
      await deleteCashExpense(expenseId)
      setConfirmingDeleteExpenseId(null)
      toast.success('Expense deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete expense.')
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <div className="page">
        <div className="page-header">
          <Link to="/cash" className="back-link">
            ‹ Cash
          </Link>
        </div>
        <p className="empty-hint">Loading…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/cash" className="back-link">
          ‹ Cash
        </Link>
      </div>
      <h1>Session — {new Date(session.openedAt).toLocaleDateString()}</h1>

      {error && <p className="form-error">{error}</p>}

      <div className="stat-tiles">
        <div className="stat-tile">
          <span>Opening</span>
          <strong>{formatNpr(session.openingAmount)}</strong>
        </div>
        <div className="stat-tile">
          <span>Expected</span>
          <strong>{formatNpr(session.expectedAmount ?? 0)}</strong>
        </div>
        <div className="stat-tile">
          <span>Counted</span>
          <strong>{formatNpr(session.closingCountedAmount ?? 0)}</strong>
        </div>
        <div className="stat-tile">
          <span>Discrepancy</span>
          <strong className={(session.discrepancy ?? 0) !== 0 ? 'discrepancy' : ''}>
            {formatNpr(session.discrepancy ?? 0)}
          </strong>
        </div>
      </div>

      <h2>Sales ({sales?.length ?? 0})</h2>
      {sales && sales.length === 0 ? (
        <p className="empty-hint">No sales in this session.</p>
      ) : (
        <div className="table-scroll">
          <table className="cash-history">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(sales ?? []).map((sale) => (
                <tr key={sale.id}>
                  <td>{new Date(sale.soldAt).toLocaleTimeString()}</td>
                  <td>{sale.paymentMethod === 'cash' ? 'Cash' : 'Bank'}</td>
                  <td>{saleItemCounts?.get(sale.id) ?? '—'}</td>
                  <td>{formatNpr(sale.total)}</td>
                  <td>{sale.status === 'voided' ? <span className="pill-tag">Voided</span> : 'Completed'}</td>
                  <td className="row-actions">
                    {sale.status === 'voided' ? null : confirmingVoidId === sale.id ? (
                      <>
                        <span className="confirm-text">Void?</span>
                        <button type="button" className="button-danger" onClick={() => handleVoid(sale.id)} disabled={busy}>
                          Yes
                        </button>
                        <button type="button" className="button-secondary" onClick={() => setConfirmingVoidId(null)}>
                          No
                        </button>
                      </>
                    ) : (
                      <button type="button" className="button-danger-ghost" onClick={() => setConfirmingVoidId(sale.id)}>
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Cash expenses ({expenses?.length ?? 0})</h2>
      {expenses && expenses.length === 0 ? (
        <p className="empty-hint">No cash expenses in this session.</p>
      ) : (
        <div className="table-scroll">
          <table className="cash-history">
            <thead>
              <tr>
                <th>Time</th>
                <th>Category</th>
                <th>Notes</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(expenses ?? []).map((exp) =>
                editingExpenseId === exp.id ? (
                  <tr key={exp.id}>
                    <td>{new Date(exp.occurredAt).toLocaleTimeString()}</td>
                    <td>
                      <input
                        value={editDraft.category}
                        onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                        style={{ minWidth: 100 }}
                      />
                    </td>
                    <td>
                      <input
                        value={editDraft.notes}
                        onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
                        style={{ minWidth: 100 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={editDraft.amount}
                        onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                        style={{ minWidth: 90 }}
                      />
                    </td>
                    <td className="row-actions">
                      <button type="button" className="button-primary" onClick={() => handleSaveExpense(exp.id)} disabled={busy}>
                        Save
                      </button>
                      <button type="button" className="button-secondary" onClick={() => setEditingExpenseId(null)}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={exp.id}>
                    <td>{new Date(exp.occurredAt).toLocaleTimeString()}</td>
                    <td>{exp.category}</td>
                    <td>{exp.notes ?? '—'}</td>
                    <td className="discrepancy">−{formatNpr(exp.amount)}</td>
                    <td className="row-actions">
                      {confirmingDeleteExpenseId === exp.id ? (
                        <>
                          <span className="confirm-text">Delete?</span>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() => handleDeleteExpense(exp.id)}
                            disabled={busy}
                          >
                            Yes
                          </button>
                          <button type="button" className="button-secondary" onClick={() => setConfirmingDeleteExpenseId(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => startEditExpense(exp.id, exp.amount, exp.category, exp.notes)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button-danger-ghost"
                            onClick={() => setConfirmingDeleteExpenseId(exp.id)}
                          >
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
      )}
    </div>
  )
}

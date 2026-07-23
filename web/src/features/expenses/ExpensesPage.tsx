import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import {
  createCashExpense,
  updateCashExpense,
  deleteCashExpense,
  createBankTransaction,
  updateBankTransaction,
  deleteBankTransaction,
} from '../../db/mutations'
import { formatNpr } from '../../lib/currency'
import { toast } from '../../state/toastStore'
import type { PaymentMethod } from '../../db/types'

const CATEGORIES = ['Supplier Payment', 'Rent', 'Utilities', 'Wages', 'Other']

interface ExpenseRow {
  id: string
  method: PaymentMethod
  occurredAt: string
  amount: number
  category: string
  notes: string | null
}

export function ExpensesPage() {
  const auth = useAppStore((s) => s.auth)
  const activeCashSessionId = useAppStore((s) => s.activeCashSessionId)

  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [editDraft, setEditDraft] = useState({ amount: '', category: '', notes: '' })
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cashExpenses = useLiveQuery(
    () => (auth.storeId ? db.cashExpenses.where({ storeId: auth.storeId }).toArray() : []),
    [auth.storeId],
  )
  const bankOut = useLiveQuery(async () => {
    if (!auth.storeId) return []
    const all = await db.bankTransactions.where({ storeId: auth.storeId }).toArray()
    return all.filter((t) => t.direction === 'out')
  }, [auth.storeId])

  const rows: ExpenseRow[] = useMemo(() => {
    const cash = (cashExpenses ?? []).map((e) => ({
      id: e.id,
      method: 'cash' as const,
      occurredAt: e.occurredAt,
      amount: e.amount,
      category: e.category,
      notes: e.notes,
    }))
    const bank = (bankOut ?? []).map((t) => ({
      id: t.id,
      method: 'bank' as const,
      occurredAt: t.occurredAt,
      amount: t.amount,
      category: t.category,
      notes: t.notes,
    }))
    return [...cash, ...bank].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }, [cashExpenses, bankOut])

  const totals = useMemo(() => {
    const cashTotal = (cashExpenses ?? []).reduce((sum, e) => sum + e.amount, 0)
    const bankTotal = (bankOut ?? []).reduce((sum, t) => sum + t.amount, 0)
    return { cashTotal, bankTotal, total: cashTotal + bankTotal }
  }, [cashExpenses, bankOut])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!auth.storeId) return
    if (method === 'cash' && !activeCashSessionId) return
    setError(null)
    setSaving(true)
    try {
      if (method === 'cash' && activeCashSessionId) {
        await createCashExpense({
          storeId: auth.storeId,
          cashSessionId: activeCashSessionId,
          occurredAt: new Date().toISOString(),
          amount: Number(amount),
          category,
          notes: notes || null,
          createdBy: auth.userId,
        })
      } else {
        await createBankTransaction({
          storeId: auth.storeId,
          occurredAt: new Date().toISOString(),
          direction: 'out',
          amount: Number(amount),
          category,
          notes: notes || null,
          createdBy: auth.userId,
        })
      }
      setAmount('')
      setNotes('')
      toast.success(`${method === 'cash' ? 'Cash' : 'Bank'} expense recorded`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this expense.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(row: ExpenseRow) {
    setEditing(row)
    setEditDraft({ amount: row.amount.toString(), category: row.category, notes: row.notes ?? '' })
  }

  async function handleSaveEdit() {
    if (!editing) return
    setError(null)
    setBusy(true)
    try {
      const patch = { amount: Number(editDraft.amount), category: editDraft.category, notes: editDraft.notes || null }
      if (editing.method === 'cash') {
        await updateCashExpense(editing.id, patch)
      } else {
        await updateBankTransaction(editing.id, patch)
      }
      setEditing(null)
      toast.success('Expense updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update expense.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(row: ExpenseRow) {
    setError(null)
    setBusy(true)
    try {
      if (row.method === 'cash') {
        await deleteCashExpense(row.id)
      } else {
        await deleteBankTransaction(row.id)
      }
      setConfirmingDeleteId(null)
      toast.success('Expense deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete expense.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Expenses</h1>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span>Cash expenses</span>
          <strong>{formatNpr(totals.cashTotal)}</strong>
        </div>
        <div className="stat-tile">
          <span>Bank expenses</span>
          <strong>{formatNpr(totals.bankTotal)}</strong>
        </div>
        <div className="stat-tile">
          <span>Total</span>
          <strong>{formatNpr(totals.total)}</strong>
        </div>
      </div>

      <form className="cash-form" onSubmit={handleSubmit}>
        <h2>Record an expense</h2>

        <div className="payment-method-toggle">
          <button type="button" className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}>
            💵 Cash
          </button>
          <button type="button" className={method === 'bank' ? 'active' : ''} onClick={() => setMethod('bank')}>
            🏦 Bank
          </button>
        </div>

        {method === 'cash' && !activeCashSessionId && (
          <p className="form-error">
            No cash session is open — <Link to="/cash">open one</Link> before recording a cash expense.
          </p>
        )}

        <label>
          Amount (NPR)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes (optional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Himalayan Distillers" />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button
          type="submit"
          className="button-primary button-large"
          disabled={saving || (method === 'cash' && !activeCashSessionId)}
        >
          {saving ? 'Saving…' : 'Add expense'}
        </button>
      </form>

      <h2>Recent expenses</h2>
      {rows.length === 0 ? (
        <p className="empty-hint">No expenses recorded yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="cash-history">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Category</th>
                <th>Notes</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                editing?.id === row.id ? (
                  <tr key={row.id}>
                    <td>{new Date(row.occurredAt).toLocaleDateString()}</td>
                    <td>{row.method === 'cash' ? 'Cash' : 'Bank'}</td>
                    <td>
                      <select
                        value={editDraft.category}
                        onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                        style={{ minWidth: 110 }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
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
                      <button type="button" className="button-primary" onClick={handleSaveEdit} disabled={busy}>
                        Save
                      </button>
                      <button type="button" className="button-secondary" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id}>
                    <td>{new Date(row.occurredAt).toLocaleDateString()}</td>
                    <td>{row.method === 'cash' ? 'Cash' : 'Bank'}</td>
                    <td>{row.category}</td>
                    <td>{row.notes ?? '—'}</td>
                    <td className="discrepancy">−{formatNpr(row.amount)}</td>
                    <td className="row-actions">
                      {confirmingDeleteId === row.id ? (
                        <>
                          <span className="confirm-text">Delete?</span>
                          <button type="button" className="button-danger" onClick={() => handleDelete(row)} disabled={busy}>
                            Yes
                          </button>
                          <button type="button" className="button-secondary" onClick={() => setConfirmingDeleteId(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="button-secondary" onClick={() => startEdit(row)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button-danger-ghost"
                            onClick={() => setConfirmingDeleteId(row.id)}
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

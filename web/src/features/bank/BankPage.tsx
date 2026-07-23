import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { createBankTransaction } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'
import { toast } from '../../state/toastStore'
import { BankTransactionsTable } from './BankTransactionsTable'

const INCOME_CATEGORIES = ['Deposit', 'Other']

export function BankPage() {
  const auth = useAppStore((s) => s.auth)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(INCOME_CATEGORIES[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const transactions = useLiveQuery(async () => {
    if (!auth.storeId) return []
    const all = await db.bankTransactions.where({ storeId: auth.storeId }).toArray()
    return all.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }, [auth.storeId])

  const totals = useMemo(() => {
    const rows = transactions ?? []
    const totalIn = rows.filter((t) => t.direction === 'in').reduce((sum, t) => sum + t.amount, 0)
    const totalOut = rows.filter((t) => t.direction === 'out').reduce((sum, t) => sum + t.amount, 0)
    return { totalIn, totalOut, net: totalIn - totalOut }
  }, [transactions])

  const recent = (transactions ?? []).slice(0, 8)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!auth.storeId) return
    setError(null)
    setSaving(true)
    try {
      await createBankTransaction({
        storeId: auth.storeId,
        occurredAt: new Date().toISOString(),
        direction: 'in',
        amount: Number(amount),
        category,
        notes: notes || null,
        createdBy: auth.userId,
      })
      setAmount('')
      setNotes('')
      toast.success('Deposit recorded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this transaction.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h1>Bank</h1>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span>Bank in</span>
          <strong>{formatNpr(totals.totalIn)}</strong>
        </div>
        <div className="stat-tile">
          <span>Bank out</span>
          <strong>{formatNpr(totals.totalOut)}</strong>
        </div>
        <div className="stat-tile">
          <span>Net</span>
          <strong className={totals.net < 0 ? 'low-stock' : ''}>{formatNpr(totals.net)}</strong>
        </div>
      </div>

      <form className="cash-form" onSubmit={handleSubmit}>
        <h2>Record a deposit</h2>
        <p className="cash-form__meta">
          Bank sales from the POS land here automatically. For supplier payments, rent, or any other bank
          expense, use <Link to="/expenses">Expenses</Link> instead — this form is just for money coming in.
        </p>

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
            {INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes (optional)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Owner deposit" />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="button-primary button-large" disabled={saving}>
          {saving ? 'Saving…' : 'Add deposit'}
        </button>
      </form>

      <div className="section-head">
        <h2>Recent transactions</h2>
        <Link to="/bank/history" className="link-button">
          View all by date →
        </Link>
      </div>
      <BankTransactionsTable transactions={recent} />
    </div>
  )
}

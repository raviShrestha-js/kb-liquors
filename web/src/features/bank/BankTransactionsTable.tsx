import { useState } from 'react'
import { updateBankTransaction, deleteBankTransaction, voidSale } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'
import { toast } from '../../state/toastStore'
import type { BankTransaction } from '../../db/types'

const CATEGORIES = ['Supplier Payment', 'Rent', 'Utilities', 'Wages', 'Deposit', 'Other']

interface Props {
  transactions: BankTransaction[]
}

export function BankTransactionsTable({ transactions }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ amount: '', category: '', notes: '' })
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function startEdit(t: BankTransaction) {
    setEditingId(t.id)
    setDraft({ amount: t.amount.toString(), category: t.category, notes: t.notes ?? '' })
  }

  async function save(id: string) {
    setBusy(true)
    try {
      await updateBankTransaction(id, {
        amount: Number(draft.amount),
        category: draft.category,
        notes: draft.notes || null,
      })
      setEditingId(null)
      toast.success('Transaction updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await deleteBankTransaction(id)
      setConfirmId(null)
      toast.success('Transaction deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete')
    } finally {
      setBusy(false)
    }
  }

  async function void_(saleId: string) {
    setBusy(true)
    try {
      await voidSale(saleId)
      setConfirmId(null)
      toast.success('Sale voided — entry removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not void sale')
    } finally {
      setBusy(false)
    }
  }

  if (transactions.length === 0) return <p className="empty-hint">No bank transactions in this period.</p>

  return (
    <div className="table-scroll">
      <table className="cash-history">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Notes</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) =>
            editingId === t.id ? (
              <tr key={t.id}>
                <td>{new Date(t.occurredAt).toLocaleDateString()}</td>
                <td>
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
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
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    style={{ minWidth: 100 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.amount}
                    onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                    style={{ minWidth: 90 }}
                  />
                </td>
                <td className="row-actions">
                  <button type="button" className="button-primary" onClick={() => save(t.id)} disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={t.id}>
                <td>{new Date(t.occurredAt).toLocaleDateString()}</td>
                <td>
                  {t.category}
                  {t.relatedSaleId && <span className="pill-tag">POS</span>}
                </td>
                <td>{t.notes ?? '—'}</td>
                <td className={t.direction === 'out' ? 'discrepancy' : ''}>
                  {t.direction === 'out' ? '−' : '+'}
                  {formatNpr(t.amount)}
                </td>
                <td className="row-actions">
                  {confirmId === t.id ? (
                    <>
                      <span className="confirm-text">{t.relatedSaleId ? 'Void sale?' : 'Delete?'}</span>
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => (t.relatedSaleId ? void_(t.relatedSaleId) : remove(t.id))}
                        disabled={busy}
                      >
                        Yes
                      </button>
                      <button type="button" className="button-secondary" onClick={() => setConfirmId(null)}>
                        No
                      </button>
                    </>
                  ) : t.relatedSaleId ? (
                    <button type="button" className="button-danger-ghost" onClick={() => setConfirmId(t.id)}>
                      Void sale
                    </button>
                  ) : (
                    <>
                      <button type="button" className="button-secondary" onClick={() => startEdit(t)}>
                        Edit
                      </button>
                      <button type="button" className="button-danger-ghost" onClick={() => setConfirmId(t.id)}>
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

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, Ban } from 'lucide-react'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { voidSale } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'
import { toast } from '../../state/toastStore'
import { RangeSelect } from '../../components/RangeSelect'
import { rangeBounds, inRange, type RangeKey } from '../../lib/dateRanges'
import type { SaleItem } from '../../db/types'

export function SalesPage() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const [range, setRange] = useState<RangeKey>('today')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmVoid, setConfirmVoid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useMemo(() => new Date(), [])
  const { from, to } = useMemo(() => rangeBounds(range, now), [range, now])

  const sales = useLiveQuery(async () => {
    if (!storeId) return []
    const all = await db.sales.where({ storeId }).toArray()
    return all.filter((s) => inRange(s.soldAt, from, to)).sort((a, b) => b.soldAt.localeCompare(a.soldAt))
  }, [storeId, from, to])

  const itemsBySale = useLiveQuery(async () => {
    const map = new Map<string, SaleItem[]>()
    const ids = (sales ?? []).map((s) => s.id)
    if (ids.length === 0) return map
    const rows = await db.saleItems.where('saleId').anyOf(ids).toArray()
    for (const r of rows) {
      const arr = map.get(r.saleId) ?? []
      arr.push(r)
      map.set(r.saleId, arr)
    }
    return map
  }, [sales])

  const summary = useMemo(() => {
    const rows = (sales ?? []).filter((s) => s.status === 'completed')
    return {
      total: rows.reduce((sum, s) => sum + s.total, 0),
      count: rows.length,
      discounts: rows.reduce((sum, s) => sum + Math.max(0, s.discount), 0),
    }
  }, [sales])

  const grouped = useMemo(() => {
    const byDay = new Map<string, typeof sales>()
    for (const sale of sales ?? []) {
      const key = format(new Date(sale.soldAt), 'EEE, d MMM yyyy')
      const arr = byDay.get(key) ?? []
      arr!.push(sale)
      byDay.set(key, arr)
    }
    return Array.from(byDay.entries())
  }, [sales])

  async function handleVoid(saleId: string) {
    setBusy(true)
    try {
      await voidSale(saleId)
      setConfirmVoid(null)
      toast.success('Sale voided — stock restored')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not void sale')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="dash-header">
        <h1>Sales</h1>
        <RangeSelect value={range} onChange={setRange} />
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span>Total sales</span>
          <strong>{formatNpr(summary.total)}</strong>
        </div>
        <div className="stat-tile">
          <span>Transactions</span>
          <strong>{summary.count}</strong>
        </div>
        <div className="stat-tile">
          <span>Discounts given</span>
          <strong>{formatNpr(summary.discounts)}</strong>
        </div>
      </div>

      {sales && sales.length === 0 && <p className="empty-hint">No sales in this period.</p>}

      {grouped.map(([day, daySales]) => (
        <section key={day} className="dash-section">
          <h2>{day}</h2>
          <ul className="sale-list">
            {(daySales ?? []).map((sale) => {
              const items = itemsBySale?.get(sale.id) ?? []
              const isOpen = expanded === sale.id
              const voided = sale.status === 'voided'
              return (
                <li key={sale.id} className={`sale-item${voided ? ' sale-item--voided' : ''}`}>
                  <button type="button" className="sale-item__head" onClick={() => setExpanded(isOpen ? null : sale.id)}>
                    <span className="sale-item__chev">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                    <span className="sale-item__time">{format(new Date(sale.soldAt), 'h:mm a')}</span>
                    <span className={`pill-tag ${sale.paymentMethod === 'cash' ? 'pill-cash' : 'pill-bank'}`}>
                      {sale.paymentMethod === 'cash' ? 'Cash' : 'Bank'}
                    </span>
                    {voided && <span className="pill-tag pill-void">Voided</span>}
                    {sale.discount > 0 && <span className="pill-tag pill-disc">−{formatNpr(sale.discount)}</span>}
                    {sale.discount < 0 && <span className="pill-tag pill-disc">+{formatNpr(-sale.discount)}</span>}
                    <span className="sale-item__total">{formatNpr(sale.total)}</span>
                  </button>

                  {isOpen && (
                    <div className="sale-item__detail">
                      <table className="mini-table">
                        <tbody>
                          {items.map((it) => (
                            <tr key={it.id}>
                              <td>{it.itemNameSnapshot}</td>
                              <td className="num">
                                {it.quantity} × {formatNpr(it.unitPrice)}
                              </td>
                              <td className="num">{formatNpr(it.lineTotal)}</td>
                            </tr>
                          ))}
                          <tr className="mini-table__sep">
                            <td>Subtotal</td>
                            <td></td>
                            <td className="num">{formatNpr(sale.subtotal)}</td>
                          </tr>
                          {sale.discount !== 0 && (
                            <tr>
                              <td>{sale.discount > 0 ? 'Discount' : 'Extra charge'}</td>
                              <td></td>
                              <td className="num">
                                {sale.discount > 0 ? '−' : '+'}
                                {formatNpr(Math.abs(sale.discount))}
                              </td>
                            </tr>
                          )}
                          <tr className="mini-table__total">
                            <td>Total</td>
                            <td></td>
                            <td className="num">{formatNpr(sale.total)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {!voided &&
                        (confirmVoid === sale.id ? (
                          <div className="row-actions" style={{ marginTop: '0.5rem' }}>
                            <span className="confirm-text">Void this sale?</span>
                            <button type="button" className="button-danger" onClick={() => handleVoid(sale.id)} disabled={busy}>
                              Yes, void
                            </button>
                            <button type="button" className="button-secondary" onClick={() => setConfirmVoid(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="button-danger-ghost btn-icon"
                            style={{ marginTop: '0.5rem' }}
                            onClick={() => setConfirmVoid(sale.id)}
                          >
                            <Ban size={15} /> Void sale
                          </button>
                        ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

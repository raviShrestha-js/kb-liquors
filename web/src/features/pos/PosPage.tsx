import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Banknote, Landmark, Wallet } from 'lucide-react'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { checkout, type CartLine } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'
import { toast } from '../../state/toastStore'
import type { PaymentMethod } from '../../db/types'

type AdjustType = 'discount' | 'surcharge'

export function PosPage() {
  const auth = useAppStore((s) => s.auth)
  const activeCashSessionId = useAppStore((s) => s.activeCashSessionId)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [adjustType, setAdjustType] = useState<AdjustType>('discount')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<{ total: number; count: number; method: PaymentMethod } | null>(
    null,
  )
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const items = useLiveQuery(async () => {
    if (!auth.storeId) return []
    return db.stockItems.where({ storeId: auth.storeId }).filter((item) => item.isActive).toArray()
  }, [auth.storeId])

  const results = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return (items ?? []).filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8)
  }, [items, search])

  const availableQty = (stockItemId: string) => {
    const item = items?.find((i) => i.id === stockItemId)
    const inCart = cart.find((l) => l.stockItemId === stockItemId)?.quantity ?? 0
    return (item?.quantityOnHand ?? 0) - inCart
  }

  function addToCart(stockItemId: string) {
    const item = items?.find((i) => i.id === stockItemId)
    if (!item || availableQty(stockItemId) <= 0) return

    setCart((prev) => {
      const existing = prev.find((l) => l.stockItemId === stockItemId)
      if (existing) {
        return prev.map((l) => (l.stockItemId === stockItemId ? { ...l, quantity: l.quantity + 1 } : l))
      }
      const displayName = item.sizeMl ? `${item.name} (${item.sizeMl}ml)` : item.name
      return [...prev, { stockItemId, name: displayName, quantity: 1, unitPrice: item.salePrice, unitCost: item.costPrice }]
    })
    setSearch('')
    setLastReceipt(null)
    searchRef.current?.focus()
  }

  function changeQty(stockItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.stockItemId === stockItemId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  // Positive discount reduces the total; a surcharge is stored as a negative
  // discount so the same `discount` column carries both cases.
  const adjust = Number(adjustAmount) || 0
  const discount = adjustType === 'discount' ? adjust : -adjust
  const total = Math.max(0, subtotal - discount)

  async function handleCheckout() {
    if (!auth.storeId || !activeCashSessionId || cart.length === 0) return
    setCheckingOut(true)
    setCheckoutError(null)
    try {
      const sale = await checkout({
        storeId: auth.storeId,
        cashSessionId: activeCashSessionId,
        createdBy: auth.userId,
        lines: cart,
        paymentMethod,
        discount,
      })
      setLastReceipt({ total: sale.total, count: cart.length, method: paymentMethod })
      setCart([])
      setPaymentMethod('cash')
      setAdjustAmount('')
      setAdjustType('discount')
      toast.success('Sale recorded')
    } catch (err) {
      console.error('Checkout failed:', err)
      setCheckoutError(err instanceof Error ? err.message : 'Checkout failed. Please try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  if (!activeCashSessionId) {
    return (
      <div className="page">
        <h1>Point of Sale</h1>
        <div className="empty-state">
          <div className="empty-state__icon">
            <Wallet size={30} />
          </div>
          <h2>No cash session open</h2>
          <p>Open a cash session with your starting float before ringing up sales.</p>
          <button className="button-primary button-large" onClick={() => navigate('/cash')}>
            Open cash session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page pos-page">
      <h1>Point of Sale</h1>

      <div className="search-wrap">
        <Search size={18} />
        <input
          ref={searchRef}
          className="search-input"
          placeholder="Search item to add…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      {results.length > 0 && (
        <ul className="pos-results">
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => addToCart(item.id)} disabled={availableQty(item.id) <= 0}>
                {item.name}
                {item.sizeMl && ` (${item.sizeMl}ml)`} — {formatNpr(item.salePrice)} (stock: {item.quantityOnHand})
              </button>
            </li>
          ))}
        </ul>
      )}

      {cart.length === 0 ? (
        <p className="empty-hint">Search for an item above to start a sale.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="cart-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.stockItemId}>
                    <td>{line.name}</td>
                    <td>
                      <button type="button" onClick={() => changeQty(line.stockItemId, -1)}>
                        −
                      </button>
                      {line.quantity}
                      <button
                        type="button"
                        onClick={() => changeQty(line.stockItemId, 1)}
                        disabled={availableQty(line.stockItemId) <= 0}
                      >
                        +
                      </button>
                    </td>
                    <td>{formatNpr(line.unitPrice)}</td>
                    <td>{formatNpr(line.unitPrice * line.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adjust-box">
            <div className="adjust-box__toggle">
              <button
                type="button"
                className={adjustType === 'discount' ? 'active' : ''}
                onClick={() => setAdjustType('discount')}
              >
                Discount
              </button>
              <button
                type="button"
                className={adjustType === 'surcharge' ? 'active' : ''}
                onClick={() => setAdjustType('surcharge')}
              >
                Extra charge
              </button>
            </div>
            <label className="adjust-box__field">
              {adjustType === 'discount' ? 'Discount amount (NPR)' : 'Extra charge (NPR)'}
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </label>
          </div>
        </>
      )}

      {checkoutError && <p className="form-error">{checkoutError}</p>}

      <div className="payment-method-toggle">
        <button
          type="button"
          className={`btn-icon${paymentMethod === 'cash' ? ' active' : ''}`}
          onClick={() => setPaymentMethod('cash')}
        >
          <Banknote size={18} /> Cash
        </button>
        <button
          type="button"
          className={`btn-icon${paymentMethod === 'bank' ? ' active' : ''}`}
          onClick={() => setPaymentMethod('bank')}
        >
          <Landmark size={17} /> Bank
        </button>
      </div>

      <div className="pos-total">
        <div className="pos-total__amounts">
          {adjust !== 0 && cart.length > 0 && (
            <span className="pos-total__line">
              Subtotal {formatNpr(subtotal)}
              {adjustType === 'discount' ? ' − ' : ' + '}
              {formatNpr(adjust)}
            </span>
          )}
          <span className="pos-total__label">Total to pay</span>
          <strong>{formatNpr(total)}</strong>
        </div>
        <button
          className="button-primary"
          onClick={handleCheckout}
          disabled={cart.length === 0 || checkingOut}
        >
          {checkingOut ? 'Processing…' : `Charge ${paymentMethod === 'cash' ? 'Cash' : 'Bank'}`}
        </button>
      </div>

      {lastReceipt && (
        <div className="receipt">
          <Banknote size={18} />
          Sale complete ({lastReceipt.method === 'cash' ? 'Cash' : 'Bank'}) — {lastReceipt.count} item(s), total{' '}
          {formatNpr(lastReceipt.total)}
        </div>
      )}
    </div>
  )
}

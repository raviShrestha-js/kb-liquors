import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { checkout, type CartLine } from '../../db/mutations'
import { formatNpr } from '../../lib/currency'

export function PosPage() {
  const auth = useAppStore((s) => s.auth)
  const activeCashSessionId = useAppStore((s) => s.activeCashSessionId)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [checkingOut, setCheckingOut] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<{ total: number; count: number } | null>(null)

  const items = useLiveQuery(async () => {
    if (!auth.storeId) return []
    return db.stockItems.where({ storeId: auth.storeId, isActive: true }).toArray()
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
      return [...prev, { stockItemId, name: item.name, quantity: 1, unitPrice: item.salePrice, unitCost: item.costPrice }]
    })
    setSearch('')
  }

  function changeQty(stockItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.stockItemId === stockItemId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  async function handleCheckout() {
    if (!auth.storeId || !activeCashSessionId || cart.length === 0) return
    setCheckingOut(true)
    try {
      const sale = await checkout({
        storeId: auth.storeId,
        cashSessionId: activeCashSessionId,
        createdBy: auth.userId,
        lines: cart,
      })
      setLastReceipt({ total: sale.total, count: cart.length })
      setCart([])
    } finally {
      setCheckingOut(false)
    }
  }

  if (!activeCashSessionId) {
    return (
      <div className="page">
        <h1>Point of Sale</h1>
        <p>You need to open a cash session before ringing up sales.</p>
        <button onClick={() => navigate('/cash')}>Go to cash session</button>
      </div>
    )
  }

  return (
    <div className="page pos-page">
      <h1>Point of Sale</h1>

      <input
        className="search-input"
        placeholder="Search item to add…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {results.length > 0 && (
        <ul className="pos-results">
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => addToCart(item.id)} disabled={availableQty(item.id) <= 0}>
                {item.name} — {formatNpr(item.salePrice)} (stock: {item.quantityOnHand})
              </button>
            </li>
          ))}
        </ul>
      )}

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
                <button type="button" onClick={() => changeQty(line.stockItemId, 1)} disabled={availableQty(line.stockItemId) <= 0}>
                  +
                </button>
              </td>
              <td>{formatNpr(line.unitPrice)}</td>
              <td>{formatNpr(line.unitPrice * line.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pos-total">
        <strong>Total: {formatNpr(subtotal)}</strong>
        <button onClick={handleCheckout} disabled={cart.length === 0 || checkingOut}>
          {checkingOut ? 'Processing…' : 'Checkout (Cash)'}
        </button>
      </div>

      {lastReceipt && (
        <div className="receipt">
          Sale complete — {lastReceipt.count} item(s), total {formatNpr(lastReceipt.total)}
        </div>
      )}
    </div>
  )
}

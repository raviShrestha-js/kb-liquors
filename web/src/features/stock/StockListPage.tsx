import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { StockPhoto } from '../../components/StockPhoto'
import { formatNpr } from '../../lib/currency'

export function StockListPage() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const [search, setSearch] = useState('')

  const items = useLiveQuery(async () => {
    if (!storeId) return []
    const all = await db.stockItems.where({ storeId, isActive: true }).toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }, [storeId])

  const filtered = (items ?? []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.brand ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1>Stock</h1>
        <Link className="button" to="/stock/new">
          + Add item
        </Link>
      </div>

      <input
        className="search-input"
        placeholder="Search by name or brand…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="stock-grid">
        {filtered.map((item) => (
          <Link key={item.id} to={`/stock/${item.id}`} className="stock-card">
            <StockPhoto stockItemId={item.id} photoPath={item.photoPath} alt={item.name} />
            <div className="stock-card__body">
              <strong>{item.name}</strong>
              <span>{item.brand}</span>
              <span>{formatNpr(item.salePrice)}</span>
              <span className={item.quantityOnHand <= item.reorderLevel ? 'low-stock' : ''}>
                Qty: {item.quantityOnHand}
                {item.quantityOnHand <= item.reorderLevel && ' (low)'}
              </span>
            </div>
          </Link>
        ))}
        {items && filtered.length === 0 && <p>No stock items found.</p>}
      </div>
    </div>
  )
}

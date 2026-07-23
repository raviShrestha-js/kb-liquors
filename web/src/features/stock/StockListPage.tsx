import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Plus, Tags, Package } from 'lucide-react'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { StockPhoto } from '../../components/StockPhoto'
import { formatNpr } from '../../lib/currency'

const UNCATEGORIZED = 'Uncategorized'

export function StockListPage() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const [search, setSearch] = useState('')

  const items = useLiveQuery(async () => {
    if (!storeId) return []
    // isActive is a boolean — IndexedDB can't index booleans, so it's filtered
    // in JS rather than via .where(), which would silently match nothing.
    const all = await db.stockItems.where({ storeId }).filter((item) => item.isActive).toArray()
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }, [storeId])

  const categories = useLiveQuery(
    () => (storeId ? db.categories.where({ storeId }).toArray() : []),
    [storeId],
  )

  const filtered = (items ?? []).filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.brand ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const groups = useMemo(() => {
    const nameById = new Map((categories ?? []).map((c) => [c.id, c.name]))
    const byCategory = new Map<string, typeof filtered>()
    for (const item of filtered) {
      const label = item.categoryId ? nameById.get(item.categoryId) ?? UNCATEGORIZED : UNCATEGORIZED
      const existing = byCategory.get(label) ?? []
      existing.push(item)
      byCategory.set(label, existing)
    }
    return Array.from(byCategory.entries()).sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1
      if (b === UNCATEGORIZED) return -1
      return a.localeCompare(b)
    })
  }, [filtered, categories])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Stock</h1>
        <div className="page-header__actions">
          <Link className="button-secondary btn-icon" to="/stock/categories">
            <Tags size={16} /> Categories
          </Link>
          <Link className="button btn-icon" to="/stock/new">
            <Plus size={18} /> Add item
          </Link>
        </div>
      </div>

      <div className="search-wrap">
        <Search size={18} />
        <input
          className="search-input"
          placeholder="Search by name or brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {groups.map(([categoryName, groupItems]) => (
        <section key={categoryName} className="dash-section">
          <h2>
            {categoryName} <span className="section-count">· {groupItems.length}</span>
          </h2>
          <div className="stock-grid">
            {groupItems.map((item) => {
              const low = item.quantityOnHand <= item.reorderLevel
              return (
                <Link key={item.id} to={`/stock/${item.id}`} className="stock-card">
                  <div className="stock-card__media">
                    <StockPhoto stockItemId={item.id} photoPath={item.photoPath} alt={item.name} />
                    <span className={`qty-chip qty-chip--overlay${low ? ' qty-chip--low' : ''}`}>
                      {item.quantityOnHand} left
                    </span>
                  </div>
                  <div className="stock-card__body">
                    <span className="stock-card__name">
                      {item.name}
                      {item.sizeMl && <span className="stock-card__size"> · {item.sizeMl}ml</span>}
                    </span>
                    {item.brand && <span className="stock-card__brand">{item.brand}</span>}
                    <span className="stock-card__price">{formatNpr(item.salePrice)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
      {items && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Package size={30} />
          </div>
          <h2>No items yet</h2>
          <p>Add your first bottle to start tracking stock and ringing up sales.</p>
          <Link className="button btn-icon" to="/stock/new">
            <Plus size={18} /> Add item
          </Link>
        </div>
      )}
    </div>
  )
}

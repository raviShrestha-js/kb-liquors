import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfDay,
  eachDayOfInterval,
  format,
} from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { formatNpr } from '../../lib/currency'

type RangeKey = 'day' | 'week' | 'month' | 'year'

const RANGE_LABELS: Record<RangeKey, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
}

function rangeStart(key: RangeKey, now: Date): Date {
  switch (key) {
    case 'day':
      return startOfDay(now)
    case 'week':
      return startOfWeek(now, { weekStartsOn: 1 })
    case 'month':
      return startOfMonth(now)
    case 'year':
      return startOfYear(now)
  }
}

export function DashboardPage() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const [range, setRange] = useState<RangeKey>('day')

  const now = useMemo(() => new Date(), [])
  const from = rangeStart(range, now)
  const to = endOfDay(now)

  const sales = useLiveQuery(async () => {
    if (!storeId) return []
    const all = await db.sales.where({ storeId, status: 'completed' }).toArray()
    return all.filter((s) => {
      const soldAt = new Date(s.soldAt)
      return soldAt >= from && soldAt <= to
    })
  }, [storeId, range])

  const stockItems = useLiveQuery(
    () => (storeId ? db.stockItems.where({ storeId, isActive: true }).toArray() : []),
    [storeId],
  )

  const totals = useMemo(() => {
    const rows = sales ?? []
    const totalSales = rows.reduce((sum, s) => sum + s.total, 0)
    const totalCost = rows.reduce((sum, s) => sum + s.costTotal, 0)
    return { totalSales, totalCost, profit: totalSales - totalCost, count: rows.length }
  }, [sales])

  const chartData = useMemo(() => {
    const rows = sales ?? []
    const days = eachDayOfInterval({ start: from, end: to })
    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const dayTotal = rows
        .filter((s) => format(new Date(s.soldAt), 'yyyy-MM-dd') === key)
        .reduce((sum, s) => sum + s.total, 0)
      return { label: format(day, 'MMM d'), total: dayTotal }
    })
  }, [sales, from, to])

  const lowStock = (stockItems ?? []).filter((i) => i.quantityOnHand <= i.reorderLevel)

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="range-tabs">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button key={key} className={range === key ? 'active' : ''} onClick={() => setRange(key)}>
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span>Sales</span>
          <strong>{formatNpr(totals.totalSales)}</strong>
        </div>
        <div className="stat-tile">
          <span>Cost</span>
          <strong>{formatNpr(totals.totalCost)}</strong>
        </div>
        <div className="stat-tile">
          <span>Profit</span>
          <strong>{formatNpr(totals.profit)}</strong>
        </div>
        <div className="stat-tile">
          <span>Transactions</span>
          <strong>{totals.count}</strong>
        </div>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip formatter={(value) => formatNpr(Number(value))} />
            <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h2>Low stock ({lowStock.length})</h2>
      <ul className="low-stock-list">
        {lowStock.map((item) => (
          <li key={item.id}>
            {item.name} — {item.quantityOnHand} left (reorder at {item.reorderLevel})
          </li>
        ))}
        {lowStock.length === 0 && <li>Nothing is low on stock.</li>}
      </ul>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfDay,
  subDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  differenceInCalendarDays,
  format,
} from 'date-fns'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, Wallet, Receipt, ShoppingBag, PackageX, AlertTriangle, Trophy } from 'lucide-react'

const CAT_COLORS = [
  '#c9a227',
  '#2f9e6f',
  '#3d84c6',
  '#e0774a',
  '#b8517e',
  '#5aa9a0',
  '#d4a12c',
  '#7b6cae',
]
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { formatNpr } from '../../lib/currency'
import type { Sale } from '../../db/types'

type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'last7' | 'last30' | 'last90' | 'all'

const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  month: 'This month',
  year: 'This year',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  last90: 'Last 90 days',
  all: 'All time',
}

const EPOCH = new Date(0)

function rangeBounds(key: RangeKey, now: Date): { from: Date; to: Date } {
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const y = subDays(now, 1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) }
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now) }
    case 'year':
      return { from: startOfYear(now), to: endOfDay(now) }
    case 'last7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }
    case 'last30':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
    case 'last90':
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) }
    case 'all':
      return { from: EPOCH, to: endOfDay(now) }
  }
}

function inRange(dateStr: string, from: Date, to: Date): boolean {
  const d = new Date(dateStr)
  return d >= from && d <= to
}

function profitOf(sales: Sale[]): number {
  return sales.reduce((sum, s) => sum + s.total - s.costTotal, 0)
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  boxShadow: 'var(--shadow-md)',
  fontSize: 13,
}

export function DashboardPage() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const [range, setRange] = useState<RangeKey>('today')
  const now = useMemo(() => new Date(), [])

  const allSales = useLiveQuery(async () => {
    if (!storeId) return []
    return db.sales.where({ storeId, status: 'completed' }).toArray()
  }, [storeId])

  const allBankTx = useLiveQuery(async () => {
    if (!storeId) return []
    return db.bankTransactions.where({ storeId }).toArray()
  }, [storeId])

  const allCashExpenses = useLiveQuery(async () => {
    if (!storeId) return []
    return db.cashExpenses.where({ storeId }).toArray()
  }, [storeId])

  const stockItems = useLiveQuery(
    () => (storeId ? db.stockItems.where({ storeId }).filter((item) => item.isActive).toArray() : []),
    [storeId],
  )

  const categories = useLiveQuery(() => (storeId ? db.categories.where({ storeId }).toArray() : []), [storeId])

  const { from, to } = useMemo(() => rangeBounds(range, now), [range, now])

  const rangeSales = useMemo(
    () => (allSales ?? []).filter((s) => inRange(s.soldAt, from, to)),
    [allSales, from, to],
  )

  const rangeSaleItems = useLiveQuery(async () => {
    const ids = rangeSales.map((s) => s.id)
    if (ids.length === 0) return []
    return db.saleItems.where('saleId').anyOf(ids).toArray()
  }, [rangeSales])

  const rangeExpenses = useMemo(() => {
    const bankOut = (allBankTx ?? [])
      .filter((t) => t.direction === 'out' && inRange(t.occurredAt, from, to))
      .reduce((sum, t) => sum + t.amount, 0)
    const cashOut = (allCashExpenses ?? [])
      .filter((e) => inRange(e.occurredAt, from, to))
      .reduce((sum, e) => sum + e.amount, 0)
    return { bankOut, cashOut, total: bankOut + cashOut }
  }, [allBankTx, allCashExpenses, from, to])

  const kpi = useMemo(() => {
    const totalSales = rangeSales.reduce((sum, s) => sum + s.total, 0)
    const grossProfit = profitOf(rangeSales)
    const count = rangeSales.length
    const margin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0
    const avgSale = count > 0 ? totalSales / count : 0
    return {
      totalSales,
      grossProfit,
      netProfit: grossProfit - rangeExpenses.total,
      count,
      margin,
      avgSale,
    }
  }, [rangeSales, rangeExpenses])

  const salesProfitTrend = useMemo(() => {
    const spanDays = Math.max(1, differenceInCalendarDays(to, from))
    const bucket = (rows: Sale[]) => ({
      sales: rows.reduce((sum, s) => sum + s.total, 0),
      profit: profitOf(rows),
    })
    if (spanDays > 62) {
      const months = eachMonthOfInterval({ start: from, end: to })
      return months.map((m) => {
        const key = format(m, 'yyyy-MM')
        return {
          label: format(m, 'MMM yyyy'),
          ...bucket(rangeSales.filter((s) => format(new Date(s.soldAt), 'yyyy-MM') === key)),
        }
      })
    }
    const days = eachDayOfInterval({ start: from, end: to })
    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      return {
        label: format(day, 'MMM d'),
        ...bucket(rangeSales.filter((s) => format(new Date(s.soldAt), 'yyyy-MM-dd') === key)),
      }
    })
  }, [rangeSales, from, to])

  const cashBankSplit = useMemo(() => {
    const cash = rangeSales.filter((s) => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0)
    const bank = rangeSales.filter((s) => s.paymentMethod === 'bank').reduce((sum, s) => sum + s.total, 0)
    const total = cash + bank || 1
    return { cash, bank, cashPct: Math.round((cash / total) * 100), bankPct: Math.round((bank / total) * 100) }
  }, [rangeSales])

  const discountsTrend = useMemo(() => {
    const spanDays = Math.max(1, differenceInCalendarDays(to, from))
    const sumDisc = (rows: Sale[]) => rows.reduce((s, r) => s + Math.max(0, r.discount), 0)
    if (spanDays > 62) {
      const months = eachMonthOfInterval({ start: from, end: to })
      return months.map((m) => {
        const key = format(m, 'yyyy-MM')
        return {
          label: format(m, 'MMM yyyy'),
          discount: sumDisc(rangeSales.filter((s) => format(new Date(s.soldAt), 'yyyy-MM') === key)),
        }
      })
    }
    const days = eachDayOfInterval({ start: from, end: to })
    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      return {
        label: format(day, 'MMM d'),
        discount: sumDisc(rangeSales.filter((s) => format(new Date(s.soldAt), 'yyyy-MM-dd') === key)),
      }
    })
  }, [rangeSales, from, to])

  const totalDiscounts = useMemo(
    () => rangeSales.reduce((s, r) => s + Math.max(0, r.discount), 0),
    [rangeSales],
  )

  const topItems = useMemo(() => {
    const rows = rangeSaleItems ?? []
    const agg = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const it of rows) {
      const key = it.itemNameSnapshot
      const cur = agg.get(key) ?? { name: key, qty: 0, revenue: 0 }
      cur.qty += it.quantity
      cur.revenue += it.lineTotal
      agg.set(key, cur)
    }
    return Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [rangeSaleItems])

  const salesByCategory = useMemo(() => {
    const items = rangeSaleItems ?? []
    const catByStockId = new Map((stockItems ?? []).map((s) => [s.id, s.categoryId]))
    const nameById = new Map((categories ?? []).map((c) => [c.id, c.name]))
    const totals = new Map<string, number>()
    for (const it of items) {
      const catId = it.stockItemId ? catByStockId.get(it.stockItemId) ?? null : null
      const label = catId ? nameById.get(catId) ?? 'Other' : 'Uncategorized'
      totals.set(label, (totals.get(label) ?? 0) + it.lineTotal)
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [rangeSaleItems, stockItems, categories])

  const expenseBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of allCashExpenses ?? []) {
      if (!inRange(e.occurredAt, from, to)) continue
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
    }
    for (const t of allBankTx ?? []) {
      if (t.direction !== 'out' || !inRange(t.occurredAt, from, to)) continue
      totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [allCashExpenses, allBankTx, from, to])

  const stockByCategory = useMemo(() => {
    const items = stockItems ?? []
    const nameById = new Map((categories ?? []).map((c) => [c.id, c.name]))
    const totals = new Map<string, number>()
    for (const item of items) {
      const label = item.categoryId ? nameById.get(item.categoryId) ?? 'Other' : 'Uncategorized'
      totals.set(label, (totals.get(label) ?? 0) + item.quantityOnHand)
    }
    return Array.from(totals.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8)
  }, [stockItems, categories])

  const stockSummary = useMemo(() => {
    const items = stockItems ?? []
    return { distinctItems: items.length, totalUnits: items.reduce((sum, i) => sum + i.quantityOnHand, 0) }
  }, [stockItems])

  const lowStock = (stockItems ?? [])
    .filter((i) => i.quantityOnHand <= i.reorderLevel)
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand)

  const maxTopRevenue = Math.max(1, ...topItems.map((t) => t.revenue))

  return (
    <div className="page">
      <div className="dash-header">
        <h1>Dashboard</h1>
        <select
          className="range-select"
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          aria-label="Date range"
        >
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <option key={key} value={key}>
              {RANGE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__icon">
            <TrendingUp size={20} />
          </span>
          <div>
            <div className="kpi__label">Sales</div>
            <div className="kpi__value">{formatNpr(kpi.totalSales)}</div>
            <div className="kpi__sub">{kpi.count} transactions</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon">
            <Wallet size={20} />
          </span>
          <div>
            <div className="kpi__label">Net profit</div>
            <div className="kpi__value">{formatNpr(kpi.netProfit)}</div>
            <div className="kpi__sub">{kpi.margin}% gross margin</div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon">
            <Receipt size={20} />
          </span>
          <div>
            <div className="kpi__label">Expenses</div>
            <div className="kpi__value">{formatNpr(rangeExpenses.total)}</div>
            <div className="kpi__sub">
              cash {formatNpr(rangeExpenses.cashOut)} · bank {formatNpr(rangeExpenses.bankOut)}
            </div>
          </div>
        </div>
        <div className="kpi">
          <span className="kpi__icon">
            <ShoppingBag size={20} />
          </span>
          <div>
            <div className="kpi__label">Avg sale</div>
            <div className="kpi__value">{formatNpr(kpi.avgSale)}</div>
            <div className="kpi__sub">gross profit {formatNpr(kpi.grossProfit)}</div>
          </div>
        </div>
      </div>

      <section className="dash-section">
        <div className="chart-wrap">
          <div className="chart-card__head">
            <span className="chart-card__title">Sales &amp; profit — {RANGE_LABELS[range]}</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={salesProfitTrend} margin={{ top: 6, right: 10, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-series-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-series-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-series-2)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-series-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--chart-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: 'var(--chart-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              />
              <Tooltip formatter={(value) => formatNpr(Number(value))} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)', paddingTop: 8 }} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="var(--chart-series-1)"
                strokeWidth={2.5}
                fill="url(#gSales)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="var(--chart-series-2)"
                strokeWidth={2.5}
                fill="url(#gProfit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="dash-section">
        <div className="chart-wrap">
          <div className="chart-card__head">
            <span className="chart-card__title">Cash vs Bank sales</span>
          </div>
          <div className="split-bar">
            <div
              className="split-bar__segment"
              style={{ width: `${cashBankSplit.cashPct}%`, background: '#c9a227' }}
            />
            <div
              className="split-bar__segment"
              style={{ width: `${cashBankSplit.bankPct}%`, background: '#2f9e6f' }}
            />
          </div>
          <div className="split-legend">
            <div className="split-legend__item">
              <span className="split-legend__swatch" style={{ background: '#c9a227' }} />
              <span className="split-legend__label">Cash</span>
              <span className="split-legend__value">
                {formatNpr(cashBankSplit.cash)} ({cashBankSplit.cashPct}%)
              </span>
            </div>
            <div className="split-legend__item">
              <span className="split-legend__swatch" style={{ background: '#2f9e6f' }} />
              <span className="split-legend__label">Bank</span>
              <span className="split-legend__value">
                {formatNpr(cashBankSplit.bank)} ({cashBankSplit.bankPct}%)
              </span>
            </div>
          </div>
        </div>
      </section>

      {salesByCategory.length > 0 && (
        <section className="dash-section">
          <div className="chart-wrap">
            <div className="chart-card__head">
              <span className="chart-card__title">Sales by category</span>
            </div>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={salesByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  >
                    {salesByCategory.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatNpr(Number(value))} contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }}
                    iconType="circle"
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {expenseBreakdown.length > 0 && (
        <section className="dash-section">
          <div className="chart-wrap">
            <div className="chart-card__head">
              <span className="chart-card__title">Expenses breakdown</span>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(120, expenseBreakdown.length * 40)}>
              <BarChart data={expenseBreakdown} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--chart-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--chart-axis)' }}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: 'var(--text)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={116}
                />
                <Tooltip formatter={(value) => formatNpr(Number(value))} contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-3)' }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={26}>
                  {expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {totalDiscounts > 0 && (
        <section className="dash-section">
          <div className="chart-wrap">
            <div className="chart-card__head">
              <span className="chart-card__title">Discounts given</span>
              <span className="chart-card__value">{formatNpr(totalDiscounts)}</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={discountsTrend} margin={{ top: 6, right: 10, left: 6, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--chart-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--chart-axis)' }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: 'var(--chart-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                />
                <Tooltip formatter={(value) => formatNpr(Number(value))} contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-3)' }} />
                <Bar dataKey="discount" name="Discount" fill="#3d84c6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="dash-section">
        <h2>
          <Trophy size={18} style={{ verticalAlign: '-3px', marginRight: 6, color: 'var(--accent)' }} />
          Top sellers — {RANGE_LABELS[range]}
        </h2>
        {topItems.length === 0 ? (
          <p className="empty-hint">No sales in this period yet.</p>
        ) : (
          <ul className="alert-list">
            {topItems.map((item, i) => (
              <li key={item.name} className="top-row">
                <span className="top-row__rank">{i + 1}</span>
                <div className="top-row__main">
                  <div className="top-row__name">{item.name}</div>
                  <div className="top-row__bar">
                    <span style={{ width: `${(item.revenue / maxTopRevenue) * 100}%` }} />
                  </div>
                </div>
                <div className="top-row__stats">
                  <div className="top-row__rev">{formatNpr(item.revenue)}</div>
                  <div className="top-row__qty">{item.qty} sold</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-section">
        <h2>Stock overview</h2>
        <div className="stat-tiles">
          <div className="stat-tile">
            <span>Distinct items</span>
            <strong>{stockSummary.distinctItems}</strong>
          </div>
          <div className="stat-tile">
            <span>Total units</span>
            <strong>{stockSummary.totalUnits}</strong>
          </div>
          <div className="stat-tile">
            <span>Low stock alerts</span>
            <strong className={lowStock.length > 0 ? 'low-stock' : ''}>{lowStock.length}</strong>
          </div>
        </div>

        {stockByCategory.length > 0 && (
          <div className="chart-wrap">
            <div className="chart-card__head">
              <span className="chart-card__title">Units by category</span>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(120, stockByCategory.length * 38)}>
              <BarChart data={stockByCategory} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--chart-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--chart-axis)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: 'var(--text)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={104}
                />
                <Tooltip formatter={(value) => `${value} units`} contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-3)' }} />
                <Bar dataKey="quantity" radius={[0, 8, 8, 0]} maxBarSize={26}>
                  {stockByCategory.map((_, i) => (
                    <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {lowStock.length > 0 && (
          <ul className="alert-list">
            {lowStock.map((item) => {
              const critical = item.quantityOnHand <= 0
              return (
                <li key={item.id} className={`alert-row ${critical ? 'alert-row--critical' : 'alert-row--warning'}`}>
                  <span className="alert-row__icon">
                    {critical ? <PackageX size={17} /> : <AlertTriangle size={17} />}
                  </span>
                  <span className="alert-row__name">{item.name}</span>
                  <span className="alert-row__meta">
                    {critical ? 'Out of stock' : `${item.quantityOnHand} left · reorder at ${item.reorderLevel}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

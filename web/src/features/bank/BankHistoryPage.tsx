import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { RangeSelect } from '../../components/RangeSelect'
import { rangeBounds, inRange, type RangeKey } from '../../lib/dateRanges'
import { BankTransactionsTable } from './BankTransactionsTable'

export function BankHistoryPage() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const [range, setRange] = useState<RangeKey>('last30')
  const now = useMemo(() => new Date(), [])
  const { from, to } = useMemo(() => rangeBounds(range, now), [range, now])

  const transactions = useLiveQuery(async () => {
    if (!storeId) return []
    const all = await db.bankTransactions.where({ storeId }).toArray()
    return all.filter((t) => inRange(t.occurredAt, from, to)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }, [storeId, from, to])

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/bank" className="back-link">
          ‹ Bank
        </Link>
      </div>
      <div className="dash-header">
        <h1>Bank transactions</h1>
        <RangeSelect value={range} onChange={setRange} />
      </div>

      <BankTransactionsTable transactions={transactions ?? []} />
    </div>
  )
}

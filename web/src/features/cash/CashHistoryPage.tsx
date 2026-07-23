import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useAppStore } from '../../state/appStore'
import { RangeSelect } from '../../components/RangeSelect'
import { rangeBounds, inRange, type RangeKey } from '../../lib/dateRanges'
import { CashSessionsTable } from './CashSessionsTable'

export function CashHistoryPage() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const [range, setRange] = useState<RangeKey>('last30')
  const now = useMemo(() => new Date(), [])
  const { from, to } = useMemo(() => rangeBounds(range, now), [range, now])

  const sessions = useLiveQuery(async () => {
    if (!storeId) return []
    const all = await db.cashSessions.where({ storeId }).toArray()
    return all.filter((s) => inRange(s.openedAt, from, to)).sort((a, b) => b.openedAt.localeCompare(a.openedAt))
  }, [storeId, from, to])

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/cash" className="back-link">
          ‹ Cash
        </Link>
      </div>
      <div className="dash-header">
        <h1>Cash sessions</h1>
        <RangeSelect value={range} onChange={setRange} />
      </div>

      <CashSessionsTable sessions={sessions ?? []} />
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { manualSync } from '../../sync/SyncManager'

export function SyncStatusPage() {
  const entries = useLiveQuery(() => db.syncOutbox.orderBy('id').reverse().toArray(), [])

  async function retry(id: number) {
    await db.syncOutbox.update(id, { status: 'pending', attempts: 0, lastError: null })
    manualSync()
  }

  async function retryAll() {
    const all = await db.syncOutbox.toArray()
    await Promise.all(
      all.map((e) => db.syncOutbox.update(e.id!, { status: 'pending', attempts: 0, lastError: null })),
    )
    manualSync()
  }

  async function discard(id: number) {
    await db.syncOutbox.delete(id)
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/dashboard" className="back-link">
          ‹ Dashboard
        </Link>
      </div>
      <h1>Sync status</h1>
      <p className="dash-section__hint">
        Items waiting to sync to the server, and anything that failed. "Discard" abandons that change —
        only use it if you don't need it saved to the server.
      </p>

      <button type="button" className="button-primary" onClick={retryAll} style={{ marginBottom: '1rem' }}>
        Retry all
      </button>

      {entries && entries.length === 0 && <p className="empty-hint">Nothing pending — everything is synced.</p>}

      <ul className="alert-list">
        {(entries ?? []).map((e) => (
          <li key={e.id} className={`sync-entry sync-entry--${e.status}`}>
            <div className="sync-entry__row">
              <span className="pill-tag">{e.entity}</span>
              <span className="sync-entry__op">{e.operation}</span>
              <span className="sync-entry__status">{e.status}</span>
              <span className="confirm-text">{e.attempts} attempt(s)</span>
            </div>
            {e.lastError && <p className="sync-entry__error">{e.lastError}</p>}
            <div className="row-actions">
              <button type="button" className="button-secondary" onClick={() => retry(e.id!)}>
                Retry
              </button>
              <button type="button" className="button-danger-ghost" onClick={() => discard(e.id!)}>
                Discard
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAppStore } from '../state/appStore'
import { manualSync } from '../sync/SyncManager'

export function SyncStatusBadge() {
  const online = useAppStore((s) => s.online)
  const sync = useAppStore((s) => s.sync)
  const pendingCount = useLiveQuery(() => db.syncOutbox.count(), []) ?? 0
  const navigate = useNavigate()

  let label = online ? 'Synced' : 'Offline'
  let className = online ? 'sync-badge sync-badge--online' : 'sync-badge sync-badge--offline'

  if (sync.syncing) {
    label = 'Syncing…'
  } else if (pendingCount > 0) {
    label = `${pendingCount} pending`
    className += ' sync-badge--pending'
  } else if (sync.lastError) {
    label = 'Sync error'
    className += ' sync-badge--error'
  }

  function handleClick() {
    if (pendingCount > 0 || sync.lastError) {
      navigate('/sync-status')
    } else {
      manualSync()
    }
  }

  return (
    <button
      type="button"
      className={className}
      title={sync.lastError ?? 'Tap to sync now'}
      onClick={handleClick}
    >
      {label}
    </button>
  )
}

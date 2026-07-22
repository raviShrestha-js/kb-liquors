import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAppStore } from '../state/appStore'

export function SyncStatusBadge() {
  const online = useAppStore((s) => s.online)
  const sync = useAppStore((s) => s.sync)
  const pendingCount = useLiveQuery(() => db.syncOutbox.count(), []) ?? 0

  let label = online ? 'Online' : 'Offline'
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

  return (
    <span className={className} title={sync.lastError ?? undefined}>
      {label}
    </span>
  )
}

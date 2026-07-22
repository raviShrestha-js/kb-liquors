import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../state/appStore'
import { pushOutbox, pendingOutboxCount } from './push'
import { pullAll } from './pull'
import { pushPhotoUploads } from './photos'

const SYNC_INTERVAL_MS = 30_000

async function runSync(storeId: string) {
  const { setSync } = useAppStore.getState()
  setSync({ syncing: true, lastError: null })
  try {
    // Push first so anything created offline reaches the server before we
    // pull — otherwise a stale local read could momentarily look "reverted."
    let result = await pushOutbox()
    while (result.pushed > 0) {
      result = await pushOutbox()
    }
    await pushPhotoUploads()
    await pullAll(storeId)
    const pendingCount = await pendingOutboxCount()
    setSync({ syncing: false, pendingCount, lastSyncedAt: new Date().toISOString() })
  } catch (err) {
    const pendingCount = await pendingOutboxCount()
    setSync({
      syncing: false,
      pendingCount,
      lastError: err instanceof Error ? err.message : 'Sync failed',
    })
  }
}

export function useSyncEngine(storeId: string | null) {
  const syncingRef = useRef(false)

  const triggerSync = useCallback(() => {
    if (!storeId || syncingRef.current) return
    syncingRef.current = true
    runSync(storeId).finally(() => {
      syncingRef.current = false
    })
  }, [storeId])

  useEffect(() => {
    if (!storeId) return

    triggerSync()
    window.addEventListener('online', triggerSync)
    const interval = setInterval(triggerSync, SYNC_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', triggerSync)
      clearInterval(interval)
    }
  }, [storeId, triggerSync])

  return { triggerSync }
}

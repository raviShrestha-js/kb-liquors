import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../state/appStore'
import { pushOutbox, pendingOutboxCount } from './push'
import { pullAll } from './pull'
import { pushPhotoUploads, pushPhotoDeletions } from './photos'

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
    await pushPhotoDeletions()
    await pullAll(storeId)
    const pendingCount = await pendingOutboxCount()
    setSync({ syncing: false, pendingCount, lastSyncedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Sync failed:', err)
    const pendingCount = await pendingOutboxCount()
    setSync({
      syncing: false,
      pendingCount,
      lastError: err instanceof Error ? err.message : 'Sync failed',
    })
  }
}

// Lets any component (e.g. tapping the sync badge) force a resync without
// threading the trigger function through props/context.
let activeTrigger: (() => void) | null = null

export function manualSync() {
  activeTrigger?.()
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

    activeTrigger = triggerSync
    triggerSync()
    window.addEventListener('online', triggerSync)
    const interval = setInterval(triggerSync, SYNC_INTERVAL_MS)

    return () => {
      if (activeTrigger === triggerSync) activeTrigger = null
      window.removeEventListener('online', triggerSync)
      clearInterval(interval)
    }
  }, [storeId, triggerSync])

  return { triggerSync }
}

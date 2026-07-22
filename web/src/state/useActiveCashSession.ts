import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAppStore } from './appStore'

/** Keeps activeCashSessionId in sync with whatever open session exists locally —
 *  covers both a fresh app load and a session opened/closed on another synced device. */
export function useActiveCashSession() {
  const storeId = useAppStore((s) => s.auth.storeId)
  const setActiveCashSessionId = useAppStore((s) => s.setActiveCashSessionId)

  const openSession = useLiveQuery(
    () => (storeId ? db.cashSessions.where({ storeId, status: 'open' }).first() : undefined),
    [storeId],
  )

  useEffect(() => {
    setActiveCashSessionId(openSession?.id ?? null)
  }, [openSession, setActiveCashSessionId])
}

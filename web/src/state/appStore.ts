import { create } from 'zustand'

export interface AuthState {
  userId: string | null
  storeId: string | null
  role: 'owner' | 'staff' | null
  fullName: string | null
}

interface SyncState {
  pendingCount: number
  syncing: boolean
  lastError: string | null
  lastSyncedAt: string | null
}

interface AppState {
  auth: AuthState
  online: boolean
  sync: SyncState
  activeCashSessionId: string | null
  setAuth: (auth: AuthState) => void
  clearAuth: () => void
  setOnline: (online: boolean) => void
  setSync: (sync: Partial<SyncState>) => void
  setActiveCashSessionId: (id: string | null) => void
}

const AUTH_CACHE_KEY = 'kb-liquors-auth-cache'

function loadCachedAuth(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt cache
  }
  return { userId: null, storeId: null, role: null, fullName: null }
}

export const useAppStore = create<AppState>((set) => ({
  auth: loadCachedAuth(),
  online: navigator.onLine,
  sync: { pendingCount: 0, syncing: false, lastError: null, lastSyncedAt: null },
  activeCashSessionId: null,
  setAuth: (auth) => {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(auth))
    set({ auth })
  },
  clearAuth: () => {
    localStorage.removeItem(AUTH_CACHE_KEY)
    set({ auth: { userId: null, storeId: null, role: null, fullName: null } })
  },
  setOnline: (online) => set({ online }),
  setSync: (sync) => set((state) => ({ sync: { ...state.sync, ...sync } })),
  setActiveCashSessionId: (id) => set({ activeCashSessionId: id }),
}))

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../state/appStore'

interface AuthContextValue {
  ready: boolean
}

const AuthContext = createContext<AuthContextValue>({ ready: false })

export function useAuthReady() {
  return useContext(AuthContext).ready
}

async function loadProfileIntoStore(userId: string) {
  const { setAuth } = useAppStore.getState()
  const { data, error } = await supabase
    .from('profiles')
    .select('store_id, role, full_name')
    .eq('id', userId)
    .single()

  if (error || !data) return
  setAuth({ userId, storeId: data.store_id, role: data.role, fullName: data.full_name })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const clearAuth = useAppStore((s) => s.clearAuth)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await loadProfileIntoStore(session.user.id)
      setReady(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadProfileIntoStore(session.user.id)
      } else {
        clearAuth()
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [clearAuth])

  return <AuthContext.Provider value={{ ready }}>{children}</AuthContext.Provider>
}

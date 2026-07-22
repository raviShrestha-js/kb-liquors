import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuthReady } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { Layout } from './components/Layout'
import { StockListPage } from './features/stock/StockListPage'
import { StockFormPage } from './features/stock/StockFormPage'
import { PosPage } from './features/pos/PosPage'
import { CashSessionPage } from './features/cash/CashSessionPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { useAppStore } from './state/appStore'
import { useSyncEngine } from './sync/SyncManager'
import { useOnlineStatus } from './sync/useOnlineStatus'
import { useActiveCashSession } from './state/useActiveCashSession'

function AuthedApp() {
  const storeId = useAppStore((s) => s.auth.storeId)
  useSyncEngine(storeId)
  useOnlineStatus()
  useActiveCashSession()

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="pos" element={<PosPage />} />
        <Route path="stock" element={<StockListPage />} />
        <Route path="stock/new" element={<StockFormPage />} />
        <Route path="stock/:id" element={<StockFormPage />} />
        <Route path="cash" element={<CashSessionPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  )
}

function Gate() {
  const ready = useAuthReady()
  const userId = useAppStore((s) => s.auth.userId)

  if (!ready) return <div className="loading-screen">Loading…</div>
  if (!userId) return <LoginPage />
  return <AuthedApp />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}

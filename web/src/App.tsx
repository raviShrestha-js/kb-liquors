import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuthReady } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { Layout } from './components/Layout'
import { StockListPage } from './features/stock/StockListPage'
import { StockFormPage } from './features/stock/StockFormPage'
import { CategoriesPage } from './features/stock/CategoriesPage'
import { PosPage } from './features/pos/PosPage'
import { SalesPage } from './features/sales/SalesPage'
import { CashSessionPage } from './features/cash/CashSessionPage'
import { CashSessionDetailPage } from './features/cash/CashSessionDetailPage'
import { CashHistoryPage } from './features/cash/CashHistoryPage'
import { BankPage } from './features/bank/BankPage'
import { BankHistoryPage } from './features/bank/BankHistoryPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { SyncStatusPage } from './features/sync/SyncStatusPage'
import { ToastHost } from './components/ToastHost'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAppStore } from './state/appStore'
import { useSyncEngine } from './sync/SyncManager'
import { useOnlineStatus } from './sync/useOnlineStatus'
import { useActiveCashSession } from './state/useActiveCashSession'

// The dashboard pulls in the charting library (recharts) — lazy-load it so the
// POS and other daily screens aren't held up by ~300KB they never need.
const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

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
        <Route path="sales" element={<SalesPage />} />
        <Route path="stock" element={<StockListPage />} />
        <Route path="stock/new" element={<StockFormPage />} />
        <Route path="stock/categories" element={<CategoriesPage />} />
        <Route path="stock/:id" element={<StockFormPage />} />
        <Route path="cash" element={<CashSessionPage />} />
        <Route path="cash/history" element={<CashHistoryPage />} />
        <Route path="cash/:id" element={<CashSessionDetailPage />} />
        <Route path="bank" element={<BankPage />} />
        <Route path="bank/history" element={<BankHistoryPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="dashboard"
          element={
            <Suspense fallback={<div className="loading-screen">Loading dashboard…</div>}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route path="sync-status" element={<SyncStatusPage />} />
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
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Gate />
          <ToastHost />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

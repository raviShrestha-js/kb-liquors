import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SyncStatusBadge } from './SyncStatusBadge'

export function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>KB Liquors</h1>
        <SyncStatusBadge />
        <button className="signout" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      <nav className="app-nav">
        <NavLink to="/pos">POS</NavLink>
        <NavLink to="/stock">Stock</NavLink>
        <NavLink to="/cash">Cash</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  ReceiptText,
  Package,
  Banknote,
  Landmark,
  Receipt,
  LayoutDashboard,
  User,
  LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SyncStatusBadge } from './SyncStatusBadge'
import { Logo } from './Logo'

const NAV_ITEMS = [
  { to: '/pos', label: 'POS', Icon: ShoppingCart },
  { to: '/sales', label: 'Sales', Icon: ReceiptText },
  { to: '/stock', label: 'Stock', Icon: Package },
  { to: '/cash', label: 'Cash', Icon: Banknote },
  { to: '/bank', label: 'Bank', Icon: Landmark },
  { to: '/expenses', label: 'Expenses', Icon: Receipt },
  { to: '/dashboard', label: 'Reports', Icon: LayoutDashboard },
]

export function Layout() {
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <Logo size={34} />
          <span className="app-title">KB Liquors</span>
        </div>
        <div className="header-actions">
          <SyncStatusBadge />
          <button className="icon-btn" onClick={() => navigate('/profile')} aria-label="Profile" title="Profile">
            <User size={19} />
          </button>
          <button
            className="icon-btn"
            onClick={() => supabase.auth.signOut()}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <nav className="app-nav app-nav--desktop">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="app-nav app-nav--mobile">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to}>
            <span className="tab-icon">
              <Icon size={20} />
            </span>
            <span className="tab-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

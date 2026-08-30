import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, List, Building2, Upload, BarChart3, MessageCircle, PiggyBank } from 'lucide-react'
import CategorizationProgress from './CategorizationProgress'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/transactions', icon: List, label: 'Transactions' },
  { to: '/accounts', icon: Building2, label: 'Accounts' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/budget', icon: PiggyBank, label: 'Budget' },
  { to: '/chat', icon: MessageCircle, label: 'Ask AI' },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-surface">
      {/* Sidebar — fixed 280px */}
      <aside className="w-[280px] shrink-0 bg-surface-lowest border-r border-outline-variant/40 flex flex-col">
        <div className="px-6 py-7">
          <h1 className="text-xl font-bold text-primary tracking-tight">Aurelian</h1>
          <p className="label-caps text-content-variant mt-1">Finance</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-on shadow-level-1'
                    : 'text-content-variant hover:text-content hover:bg-surface-container'
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span className="text-sm font-semibold">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-5 border-t border-outline-variant/30">
          <p className="text-xs text-content-variant">Local-first · Private</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-content mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>

      {/* Background job progress */}
      <CategorizationProgress />
    </div>
  )
}

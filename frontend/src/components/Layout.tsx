import { Outlet, NavLink } from 'react-router-dom'
import { Home, List, Building2, Upload, BarChart3, MessageCircle, PiggyBank } from 'lucide-react'
import CategorizationProgress from './CategorizationProgress'

const navItems = [
  { to: '/', icon: Home, label: 'Overview' },
  { to: '/transactions', icon: List, label: 'Transactions' },
  { to: '/accounts', icon: Building2, label: 'Accounts' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/budget', icon: PiggyBank, label: 'Budget' },
  { to: '/chat', icon: MessageCircle, label: 'Ask AI' },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white">🏛️ Finance Minister</h1>
          <p className="text-xs text-gray-500 mt-1">Personal finance tracker</p>
        </div>
        <nav className="flex-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>

      {/* Background job progress */}
      <CategorizationProgress />
    </div>
  )
}

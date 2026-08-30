import { Outlet, NavLink } from 'react-router-dom'
import Icon from './Icon'
import CategorizationProgress from './CategorizationProgress'

const navItems = [
  { to: '/', icon: 'dashboard', label: 'Overview' },
  { to: '/transactions', icon: 'receipt_long', label: 'Transactions' },
  { to: '/accounts', icon: 'account_balance', label: 'Accounts' },
  { to: '/import', icon: 'upload_file', label: 'Import' },
  { to: '/analytics', icon: 'bar_chart', label: 'Analytics' },
  { to: '/budget', icon: 'account_balance_wallet', label: 'Budget' },
  { to: '/chat', icon: 'smart_toy', label: 'Ask AI' },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-content">
      {/* Sidebar — fixed 280px */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[280px] bg-surface-lowest border-r border-outline-variant/40 py-6 z-50">
        {/* Brand */}
        <div className="px-6 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary">
            <Icon name="account_balance_wallet" fill />
          </div>
          <div>
            <h1 className="text-headline-md font-bold text-primary leading-none">Aurelian</h1>
            <p className="label-caps text-content-variant mt-1">Personal Finance</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors active:scale-[0.98] duration-150 ${
                  isActive
                    ? 'text-primary font-bold bg-surface-low border-r-4 border-primary'
                    : 'text-content-variant hover:bg-surface-high'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={icon} fill={isActive} size={22} />
                  <span className="text-body-md">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 mt-auto pt-4 border-t border-outline-variant/40">
          <div className="flex items-center gap-3 px-4 py-2 text-content-variant">
            <Icon name="lock" size={20} />
            <div>
              <p className="text-body-sm font-semibold text-content leading-none">Local-first</p>
              <p className="text-xs mt-0.5">Private · On-device AI</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Top app bar — 64px */}
      <header className="fixed top-0 right-0 md:w-[calc(100%-280px)] w-full h-16 bg-surface-lowest border-b border-outline-variant/40 flex items-center justify-between px-6 z-40">
        <div className="flex-1 max-w-md">
          <div className="relative flex items-center h-10 rounded-full bg-surface-low px-4 focus-within:ring-2 focus-within:ring-primary transition-all">
            <Icon name="search" className="text-content-variant mr-2" size={20} />
            <input
              className="w-full bg-transparent border-none outline-none text-body-sm text-content placeholder-content-variant p-0"
              placeholder="Search accounts, transactions…"
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full text-content-variant hover:bg-surface-low transition-colors relative">
            <Icon name="notifications" size={22} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
          </button>
          <button className="p-2 rounded-full text-content-variant hover:bg-surface-low transition-colors">
            <Icon name="history" size={22} />
          </button>
          <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-primary ml-2 border border-outline-variant/40">
            <Icon name="person" fill size={22} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="md:ml-[280px] pt-16 min-h-screen">
        <div className="max-w-content mx-auto p-container-padding">
          <Outlet />
        </div>
      </main>

      {/* Background job progress */}
      <CategorizationProgress />
    </div>
  )
}

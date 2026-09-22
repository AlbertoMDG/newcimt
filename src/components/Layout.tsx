import type { ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router'

const navItems = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/contacts', label: 'Contacts', icon: '☎' },
  { to: '/checklist', label: 'Checklist', icon: '☑' },
  { to: '/flow', label: 'Flow', icon: '➔' },
]

function NavItems({ vertical = false }: { vertical?: boolean }) {
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item ? item.end : false}
          className={({ isActive }) =>
            (vertical
              ? 'flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold '
              : 'flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ') +
            (isActive
              ? 'border-accent text-accent'
              : 'border-transparent text-steel hover:text-ink')
          }
        >
          {vertical ? <span aria-hidden className="text-lg leading-none">{item.icon}</span> : null}
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

export function Shell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-20 sm:pb-0">
      <header className="sticky top-0 z-20 bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/osiLogo.jpg" alt="OSI Group" className="h-10 w-auto shrink-0" />
            <span className="hidden h-8 w-px bg-line md:block" aria-hidden />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-lg font-extrabold tracking-tight text-ink">CIMT</span>
              <span className="hidden truncate text-[11px] font-semibold tracking-[0.08em] text-steel uppercase md:block">
                Critical Incident Management Team
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavItems />
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                'ml-3 flex min-h-10 items-center rounded-full px-4 text-sm font-bold ' +
                (isActive
                  ? 'bg-ink text-white'
                  : 'bg-accent text-white hover:bg-accent-deep')
              }
            >
              Admin
            </NavLink>
          </nav>
          <NavLink to="/admin" className="text-sm font-bold text-accent sm:hidden">
            Admin
          </NavLink>
        </div>
        <div className="hazard-stripe" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:py-8">
        {children ?? <Outlet />}
      </main>

      <footer className="mt-8 hidden bg-ink text-white sm:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm">
          <p className="font-semibold">
            OSI Group · CIMT
            <span className="ml-2 font-normal text-white/60">
              Critical Incident Management Team
            </span>
          </p>
          <div className="flex gap-4 text-white/80">
            <Link to="/guides/workplace-violence" className="hover:text-white">Workplace Violence</Link>
            <Link to="/guides/chemical" className="hover:text-white">Chemical</Link>
            <Link to="/guides/food" className="hover:text-white">Food</Link>
            <Link to="/guides/media" className="hover:text-white">Media</Link>
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] sm:hidden">
        <NavItems vertical />
      </nav>
    </div>
  )
}

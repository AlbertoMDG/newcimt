import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useIncidents, useLogout, useMe } from '../api/client'
import { Avatar } from './ui'
import { TOPIC_COLORS } from './topicColors'

/** Global banner while an incident the user can see is active. */
function ActiveIncidentBanner() {
  const { data: incidents } = useIncidents()
  const location = useLocation()
  const active = (incidents ?? []).filter((i) => i.status === 'active')
  if (active.length === 0 || location.pathname.startsWith('/incidents')) return null
  const first = active[0]
  return (
    <Link
      to={active.length === 1 ? `/incidents/${first.incident_id}` : '/incidents'}
      className="block bg-emergency px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-emergency-deep"
    >
      ⚑ Active incident{active.length > 1 ? `s (${active.length})` : `: ${first.title}`} — open workspace ›
    </Link>
  )
}

/** Signed-in user chip with sign-out; shared by the public shell and the admin layout. */
export function UserMenu() {
  const { data: me } = useMe()
  const logout = useLogout()
  if (!me) return null
  return (
    <div className="flex items-center gap-2">
      <span title={me.email}><Avatar name={me.display_name} /></span>
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="min-h-10 rounded-lg px-2 text-sm font-semibold text-steel hover:text-ink"
      >
        Sign out
      </button>
    </div>
  )
}

const navItems = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/incidents', label: 'Workspace', icon: '⚑' },
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
  const { data: me } = useMe()
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
            {me?.is_admin ? (
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
            ) : null}
            <span className="ml-2"><UserMenu /></span>
          </nav>
          <div className="flex items-center gap-3 sm:hidden">
            {me?.is_admin ? (
              <NavLink to="/admin" className="text-sm font-bold text-accent">
                Admin
              </NavLink>
            ) : null}
            <UserMenu />
          </div>
        </div>
        <div className="hazard-stripe" />
      </header>

      <ActiveIncidentBanner />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:py-8">
        {children ?? <Outlet />}
      </main>

      <footer className="mt-8 hidden bg-ink text-white sm:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm">
          <p className="font-semibold">
            ©OSI Group, LLC. All Rights Reserved. · CIMT
            <span className="ml-2 font-normal text-white/60">
              Critical Incident Management Team
            </span>
          </p>
          <div className="flex flex-wrap gap-4 text-white/80">
            {([
              ['workplace-violence', 'Workplace Violence and Security'],
              ['severe-weather', 'Severe Weather'],
              ['emergency-response', 'Emergency Response'],
              ['chemical', 'Chemical'],
              ['food', 'Food'],
              ['media', 'Media'],
            ] as const).map(([slug, label]) => (
              <Link key={slug} to={`/guides/${slug}`} className="inline-flex items-center gap-1.5 hover:text-white">
                {/* dot = binder tab color; ring keeps the black (Chemical) dot visible on the dark footer */}
                {slug in TOPIC_COLORS ? (
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-full ring-1 ring-white/50 ${TOPIC_COLORS[slug].dot}`} />
                ) : null}
                {label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] sm:hidden">
        <NavItems vertical />
      </nav>
    </div>
  )
}

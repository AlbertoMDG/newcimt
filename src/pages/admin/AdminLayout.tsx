import { Link, NavLink, Outlet } from 'react-router'

const entityNav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/sites', label: 'Sites' },
  { to: '/admin/contacts', label: 'Contacts' },
  { to: '/admin/assignments', label: 'Role assignments' },
  { to: '/admin/roles', label: 'CIMT roles' },
  { to: '/admin/external', label: 'External agencies' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/customer-contacts', label: 'Customer contacts' },
  { to: '/admin/constituents', label: 'Constituents' },
  { to: '/admin/constituent-contacts', label: 'Constituent contacts' },
  { to: '/admin/war-rooms', label: 'War rooms' },
  { to: '/admin/resources', label: 'Resources' },
  { to: '/admin/content', label: 'Guides & checklists' },
]

export function AdminLayout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/admin" className="flex items-center gap-3">
            <img src="/osiLogo.jpg" alt="OSI Group" className="h-10 w-auto" />
            <span className="hidden h-8 w-px bg-line md:block" aria-hidden />
            <span className="flex items-baseline gap-2 leading-tight">
              <span className="text-lg font-extrabold tracking-tight text-ink">CIMT</span>
              <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold tracking-[0.1em] text-white uppercase">
                Admin
              </span>
            </span>
          </Link>
          <Link
            to="/"
            className="flex min-h-10 items-center rounded-lg border border-line px-4 text-sm font-bold text-ink hover:border-ink"
          >
            View app ›
          </Link>
        </div>
        <div className="hazard-stripe" />
      </header>

      <div className="mx-auto flex max-w-7xl">
        <nav className="hidden w-60 shrink-0 border-r border-line p-3 md:block">
          {entityNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                'block rounded-lg px-3 py-2 text-sm font-semibold ' +
                (isActive
                  ? 'bg-accent text-white'
                  : 'text-steel hover:bg-accent-soft hover:text-ink')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <select
            className="mb-4 min-h-12 w-full rounded-lg border border-line bg-card px-3 font-medium md:hidden"
            onChange={(e) => { window.location.href = e.target.value }}
            defaultValue=""
            aria-label="Admin section"
          >
            <option value="" disabled>Go to section…</option>
            {entityNav.map((i) => (
              <option key={i.to} value={i.to}>{i.label}</option>
            ))}
          </select>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

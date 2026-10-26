import { Link } from 'react-router'
import { useStats } from '../../api/client'
import { ErrorNote, Loading, PageHeader } from '../../components/ui'

interface StatsShape {
  sites: number; contacts: number; assignments: number; external_contacts: number
  customers: number; constituents: number; war_rooms: number; content_pages: number
  resources: number; incidents: number; active_incidents: number; users: number
}

const tiles: { key: keyof StatsShape; label: string; to: string }[] = [
  { key: 'active_incidents', label: 'Active incidents', to: '/admin/incidents' },
  { key: 'incidents', label: 'All incidents', to: '/admin/incidents' },
  { key: 'users', label: 'Users', to: '/admin/users' },
  { key: 'sites', label: 'Sites', to: '/admin/sites' },
  { key: 'contacts', label: 'Contacts', to: '/admin/contacts' },
  { key: 'assignments', label: 'Role assignments', to: '/admin/assignments' },
  { key: 'external_contacts', label: 'External agencies', to: '/admin/external' },
  { key: 'customers', label: 'Customers', to: '/admin/customers' },
  { key: 'constituents', label: 'Constituents', to: '/admin/constituents' },
  { key: 'war_rooms', label: 'Workspaces', to: '/admin/workspaces' },
  { key: 'content_pages', label: 'Guides & checklists', to: '/admin/content' },
  { key: 'resources', label: 'Resources', to: '/admin/resources' },
]

const quickActions = [
  { to: '/admin/incidents', label: 'Open a workspace' },
  { to: '/admin/users', label: 'Add a user' },
  { to: '/admin/contacts', label: 'Add a contact' },
  { to: '/admin/assignments', label: 'Assign a CIMT role' },
  { to: '/admin/external', label: 'Add an agency or hotline' },
  { to: '/admin/content', label: 'Edit a guide' },
  { to: '/admin/workspaces', label: 'Update a workspace' },
]

export function AdminDashboard() {
  const { data: stats, isPending, error } = useStats()
  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Everything in the app is editable here"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            className="group rounded-2xl bg-card p-4 shadow-card hover:ring-2 hover:ring-accent"
          >
            <p className="tel text-3xl font-extrabold text-ink group-hover:text-accent">
              {stats?.[t.key] ?? 0}
            </p>
            <p className="mt-1 text-sm font-semibold text-steel">{t.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-xs font-bold tracking-[0.14em] text-steel uppercase">
        Quick actions
      </h2>
      <div className="flex flex-wrap gap-2">
        {quickActions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="inline-flex min-h-11 items-center rounded-full bg-card px-5 text-sm font-semibold shadow-card hover:text-accent"
          >
            {a.label}
          </Link>
        ))}
      </div>

      <p className="mt-8 text-sm text-steel">
        Changes are saved to the CIMT database and appear in the app immediately.
      </p>
    </div>
  )
}

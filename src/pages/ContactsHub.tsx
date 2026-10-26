import { Link } from 'react-router'
import { PageHeader } from '../components/ui'

const books = [
  { to: '/contacts/internal', title: 'Internal CIMT teams', hint: 'Site coordinators and function leads at every site' },
  { to: '/contacts/external', title: 'External agencies', hint: 'OSHA, FDA, USDA, SERC, LEPC and national hotlines' },
  { to: '/contacts/customers', title: 'Customers', hint: 'OSI and customer-side crisis contacts' },
  { to: '/contacts/constituents', title: 'Constituents', hint: 'Police, fire, hospitals and utilities near each site' },
  { to: '/contacts/workspaces', title: 'Workspaces · Schedule 1A', hint: 'Assembly rooms, direct lines and conference bridges' },
]

export function ContactsHub() {
  return (
    <div>
      <PageHeader eyebrow="Directory" title="Contacts" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((b) => (
          <Link
            key={b.to}
            to={b.to}
            className="group rounded-xl border border-line bg-card p-4 hover:border-ink"
          >
            <p className="text-lg font-bold group-hover:text-accent">{b.title}</p>
            <p className="mt-1 text-sm text-steel">{b.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

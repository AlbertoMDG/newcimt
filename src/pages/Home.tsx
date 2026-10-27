import { Link } from 'react-router'
import { useIncidents } from '../api/client'
import { PhoneLink } from '../components/ui'
import { TOPIC_COLORS } from '../components/topicColors'
import { SeverityChip, TypeChip } from './incidents/common'

const priorities = [
  'Protect human life',
  'Protect OSI assets',
  "Protect our customers' brand",
  'Continue operations',
]

const books = [
  { slug: 'workplace-violence', title: 'Workplace Violence and Security', hint: 'Bomb threats, civil disturbance, hostile intruders' },
  { slug: 'severe-weather', title: 'Severe Weather & Natural Disasters', hint: 'Tornado, hurricane, severe weather, flood' },
  { slug: 'emergency-response', title: 'Emergency Response', hint: 'Fire, explosion, medical and utility emergencies' },
  { slug: 'chemical', title: 'Chemical', hint: 'Ammonia, natural gas, solvents, chlorine' },
  { slug: 'food', title: 'Food', hint: 'Biological, physical and chemical hazards' },
  { slug: 'media', title: 'Media', hint: 'Press and communication guidance' },
]

/** Compact "open for" duration — minutes under an hour, then hours, then days. */
function openFor(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** Active incidents the user can see, with enough substance to act on — hidden when there are none. */
function ActiveWorkspaces() {
  const { data: incidents } = useIncidents()
  const active = (incidents ?? []).filter((i) => i.status === 'active')
  if (active.length === 0) return null
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-steel uppercase">
        Active workspaces
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {active.map((i) => (
          <Link
            key={i.incident_id}
            to={`/incidents/${i.incident_id}`}
            className={`group rounded-2xl bg-card p-4 shadow-card hover:ring-2 hover:ring-accent ${
              i.severity === 'critical' ? 'ring-2 ring-emergency' : ''
            }`}
          >
            <p className="text-lg font-bold group-hover:text-accent">{i.title}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-steel">
              <TypeChip type={i.incident_type} />
              <SeverityChip severity={i.severity} />
              <span>· open {openFor(i.created_at)}</span>
            </p>
            <p className="mt-3 text-sm font-bold text-accent">Enter workspace ›</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

const quickLinks = [
  { to: '/flow', label: 'Process flow' },
  { to: '/checklist', label: 'Crisis checklist' },
  { to: '/forms', label: 'Forms' },
  { to: '/contacts', label: 'All contacts' },
]

export function Home() {
  return (
    <div className="space-y-8">
      {/* Emergency block: soft red ground, red reserved for the crisis action */}
      <section className="rounded-3xl bg-emergency-soft p-5 lg:p-7">
        <p className="text-sm font-semibold text-emergency-deep">In an emergency</p>
        <h1 className="mt-1 max-w-2xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          Life safety first. Call local emergency services, then your Site Coordinator.
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PhoneLink number="+1-888-256-5388" label="24h Crisis Line" variant="emergency" />
          <Link
            to="/contacts/internal"
            className="inline-flex min-h-12 items-center rounded-full bg-card px-5 font-semibold text-ink shadow-card"
          >
            Find your site's team
          </Link>
        </div>
      </section>

      <ActiveWorkspaces />

      <section>
        <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-steel uppercase">
          Priorities, in order
        </h2>
        <ol className="grid gap-2 sm:grid-cols-4">
          {priorities.map((p, i) => (
            <li key={p} className="rounded-2xl bg-card p-4 shadow-card">
              <span className="tel text-lg font-bold text-accent">{i + 1}</span>
              <p className="mt-1 font-semibold leading-snug">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-steel uppercase">
          Response guides
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {books.map((b) => (
            <Link
              key={b.slug}
              to={`/guides/${b.slug}`}
              className={`group rounded-2xl border-l-8 bg-card p-4 shadow-card hover:ring-2 hover:ring-accent ${
                TOPIC_COLORS[b.slug]?.border ?? 'border-line'
              }`}
            >
              <p className="text-lg font-bold group-hover:text-accent">{b.title}</p>
              <p className="mt-1 text-sm text-steel">{b.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold tracking-[0.14em] text-steel uppercase">
          Quick access
        </h2>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="inline-flex min-h-11 items-center rounded-full bg-card px-5 text-sm font-semibold shadow-card hover:text-accent"
            >
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

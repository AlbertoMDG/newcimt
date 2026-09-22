import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useInternalBook, useSites } from '../api/client'
import type { InternalBookRow } from '@shared/types'
import { Avatar, Card, EmailLink, EmptyState, ErrorNote, Loading, PageHeader, Pagination, PhoneLink, usePagination } from '../components/ui'

const REGIONS = [
  { value: '', label: 'All regions' },
  { value: 'NA', label: 'North America' },
  { value: 'EU', label: 'Europe' },
  { value: 'APAC', label: 'Asia Pacific' },
]

export function InternalContacts() {
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const { data: sites, isPending, error } = useSites()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (sites ?? []).filter(
      (s) =>
        (!region || s.region === region) &&
        (!q || s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q)),
    )
  }, [sites, search, region])

  const pager = usePagination(filtered)

  return (
    <div>
      <PageHeader eyebrow="Internal" title="CIMT teams by site" />
      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          pager.reset()
        }}
        placeholder="Search site name or address"
        className="mb-3 min-h-12 w-full rounded-full bg-card px-5 shadow-card sm:max-w-md"
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {REGIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => {
              setRegion(r.value)
              pager.reset()
            }}
            className={
              'min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ' +
              (region === r.value ? 'bg-ink text-white' : 'bg-card text-steel shadow-card')
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {isPending ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pager.pageItems.map((s) => (
            <li key={s.site_id}>
              <Link
                to={`/contacts/internal/${s.site_id}`}
                className="flex min-h-14 flex-col justify-center rounded-2xl bg-card px-4 py-3 shadow-card hover:ring-2 hover:ring-accent"
              >
                <span className="font-bold">{s.name}</span>
                <span className="text-sm text-steel">
                  {[s.region, s.address].filter(Boolean).join(' · ')}
                </span>
              </Link>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="sm:col-span-2">
              <EmptyState title="No sites match" hint="Try a shorter search, or clear the region filter." />
            </li>
          ) : null}
        </ul>
        <Pagination page={pager.page} pageCount={pager.pageCount} setPage={pager.setPage} />
        </>
      )}
    </div>
  )
}

function ContactCard({ row }: { row: InternalBookRow }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <Avatar name={row.full_name} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{row.full_name}</p>
          {row.title && row.title !== row.preferred_email ? (
            <p className="truncate text-sm text-steel">{row.title}</p>
          ) : null}
        </div>
        <span
          className={
            'rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ' +
            (row.tier === 'primary' ? 'bg-accent-soft text-accent' : 'bg-mist text-steel')
          }
        >
          {row.tier === 'primary' ? 'Primary' : 'Alternate'}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <PhoneLink number={row.preferred_phone} />
        {row.alternate_phone && row.alternate_phone !== row.preferred_phone ? (
          <PhoneLink number={row.alternate_phone} label="alt" />
        ) : null}
      </div>
      <div className="mt-1 flex flex-col">
        <EmailLink email={row.preferred_email} />
      </div>
      {row.assistant_info ? (
        <p className="mt-1 text-sm text-steel">Assistant: {row.assistant_info}</p>
      ) : null}
    </Card>
  )
}

export function InternalSite() {
  const { siteId } = useParams()
  const { data: book, isPending, error } = useInternalBook()

  const rows = useMemo(
    () => (book ?? []).filter((r) => String(r.site_id) === siteId),
    [book, siteId],
  )
  const byRole = useMemo(() => {
    const groups = new Map<string, InternalBookRow[]>()
    for (const r of rows) {
      const list = groups.get(r.role_name) ?? []
      list.push(r)
      groups.set(r.role_name, list)
    }
    return [...groups.entries()]
  }, [rows])

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  const site = rows[0]
  return (
    <div>
      <Link to="/contacts/internal" className="text-sm font-semibold text-accent">
        ‹ All sites
      </Link>
      <PageHeader eyebrow="Internal CIMT team" title={site?.site_name ?? 'Site'} />
      {site?.address ? <p className="-mt-3 mb-5 text-sm text-steel">{site.address}</p> : null}

      {byRole.length === 0 ? (
        <EmptyState
          title="No CIMT contacts on file for this site yet"
          hint="Add them from the admin dashboard."
          to="/admin/contacts"
          cta="Open admin"
        />
      ) : (
        <div className="space-y-6">
          {byRole.map(([role, members]) => (
            <section key={role}>
              <h2 className="mb-2 text-sm font-semibold text-steel">{role}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {members.map((m) => (
                  <ContactCard key={m.assignment_id} row={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

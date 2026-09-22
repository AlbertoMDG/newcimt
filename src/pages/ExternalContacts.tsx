import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useExternalContacts, useSites } from '../api/client'
import type { ExternalAgencyContact } from '@shared/types'
import { Card, EmptyState, ErrorNote, Loading, PageHeader, PhoneLink } from '../components/ui'

const AGENCY_LABELS: Record<string, string> = {
  OSHA: 'OSHA', SERC: 'SERC · State Emergency Response Commission',
  LEPC: 'LEPC · Local Emergency Planning Committee', USDA: 'USDA district office',
  FDA: 'FDA district office', GFSI: 'GFSI certification body',
  HOTLINE: 'National hotline', MEDIA: 'Media agency', OTHER: 'Other',
}

function AgencyCard({ c }: { c: ExternalAgencyContact }) {
  return (
    <Card>
      <p className="text-xs font-bold tracking-[0.12em] text-steel uppercase">
        {AGENCY_LABELS[c.agency_type] ?? c.agency_type}
      </p>
      {c.contact_name ? <p className="mt-1 font-bold">{c.contact_name}</p> : null}
      {c.detail ? <p className="mt-1 text-sm whitespace-pre-line">{c.detail}</p> : null}
      <div className="mt-2">
        <PhoneLink number={c.phone} />
      </div>
      {c.comment ? <p className="mt-2 text-sm text-steel">{c.comment}</p> : null}
    </Card>
  )
}

export function ExternalContacts() {
  const [siteId, setSiteId] = useState('')
  const { data: sites } = useSites()
  const { data: all, isPending, error } = useExternalContacts()

  const national = useMemo(() => (all ?? []).filter((c) => c.site_id === null), [all])
  const siteContacts = useMemo(
    () => (all ?? []).filter((c) => siteId && String(c.site_id) === siteId),
    [all, siteId],
  )
  const sitesWithData = useMemo(() => {
    const ids = new Set((all ?? []).map((c) => c.site_id))
    return (sites ?? []).filter((s) => ids.has(s.site_id))
  }, [all, sites])

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  return (
    <div>
      <PageHeader
        eyebrow="External"
        title="Agencies & hotlines"
        action={
          <Link
            to="/admin/external"
            className="min-h-11 rounded-full bg-card px-5 py-2.5 text-sm font-semibold shadow-card hover:text-accent"
          >
            Manage ›
          </Link>
        }
      />

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-bold tracking-[0.14em] text-emergency-deep uppercase">
          Always available
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {national.map((c) => <AgencyCard key={c.id} c={c} />)}
          {national.length === 0 ? (
            <div className="sm:col-span-2">
              <EmptyState title="No national hotlines yet" to="/admin/external" cta="Add in admin" />
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold tracking-[0.14em] text-steel uppercase">
          By site
        </h2>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="mb-3 min-h-12 w-full rounded-lg border border-line bg-card px-3 font-medium sm:w-80"
          aria-label="Choose a site"
        >
          <option value="">Choose a site…</option>
          {sitesWithData.map((s) => (
            <option key={s.site_id} value={s.site_id}>{s.name}</option>
          ))}
        </select>
        {siteId ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {siteContacts.map((c) => <AgencyCard key={c.id} c={c} />)}
            {siteContacts.length === 0 ? (
              <div className="sm:col-span-2">
                <EmptyState title="No agency contacts for this site yet" to="/admin/external" cta="Add in admin" />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-steel">
            Pick a site to see its OSHA, SERC, LEPC, USDA, FDA and GFSI contacts.
          </p>
        )}
      </section>
    </div>
  )
}

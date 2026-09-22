import { useMemo, useState } from 'react'
import { useConstituentContacts, useConstituents, useSites } from '../api/client'
import type { Constituent } from '@shared/types'
import { Card, EmailLink, EmptyState, ErrorNote, Loading, PageHeader, PhoneLink } from '../components/ui'

export function ConstituentsPage() {
  const [siteId, setSiteId] = useState('')
  const { data: sites } = useSites()
  const numericSiteId = siteId ? Number(siteId) : undefined
  const { data: constituents, isPending, error } = useConstituents(numericSiteId)
  const { data: contacts } = useConstituentContacts()

  const bySection = useMemo(() => {
    const groups = new Map<string, Constituent[]>()
    for (const c of constituents ?? []) {
      const list = groups.get(c.section) ?? []
      list.push(c)
      groups.set(c.section, list)
    }
    return [...groups.entries()]
  }, [constituents])

  return (
    <div>
      <PageHeader eyebrow="Community" title="Constituents" />
      <select
        value={siteId}
        onChange={(e) => setSiteId(e.target.value)}
        className="mb-4 min-h-12 w-full rounded-lg border border-line bg-card px-3 font-medium sm:w-80"
        aria-label="Choose a site"
      >
        <option value="">Choose a site…</option>
        {(sites ?? []).map((s) => (
          <option key={s.site_id} value={s.site_id}>{s.name}</option>
        ))}
      </select>

      {!siteId ? (
        <p className="text-sm text-steel">
          Pick a site to see its local police, fire, hospitals, utilities and officials.
        </p>
      ) : isPending ? <Loading /> : error ? <ErrorNote error={error} /> : bySection.length === 0 ? (
        <EmptyState title="No constituents for this site yet" to="/admin/constituents" cta="Add in admin" />
      ) : (
        <div className="space-y-6">
          {bySection.map(([section, places]) => (
            <section key={section}>
              <h2 className="mb-2 text-xs font-bold tracking-[0.14em] text-steel uppercase">
                {section}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {places.map((p) => {
                  const people = (contacts ?? []).filter((c) => c.constituent_id === p.constituent_id)
                  return (
                    <Card key={p.constituent_id}>
                      <p className="font-bold">{p.place_name}</p>
                      {p.address ? <p className="text-sm text-steel">{p.address}</p> : null}
                      {people.map((person) => (
                        <div key={person.id} className="mt-3 border-t border-line pt-3">
                          {person.name ? <p className="font-semibold">{person.name}</p> : null}
                          {person.title ? <p className="text-sm text-steel">{person.title}</p> : null}
                          <div className="mt-1 flex flex-wrap gap-2">
                            <PhoneLink number={person.phone} />
                            <PhoneLink number={person.cell} label="cell" />
                          </div>
                          <EmailLink email={person.email} />
                        </div>
                      ))}
                      {p.notes ? <p className="mt-2 text-sm text-steel">{p.notes}</p> : null}
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

import { Link } from 'react-router'
import { useIncidents, useMe, useSites } from '../../api/client'
import { Card, EmptyState, ErrorNote, Loading, PageHeader } from '../../components/ui'
import { RoleChip, SeverityChip, StatusChip, TypeChip, fmtDate } from './common'

export function IncidentList() {
  const { data: incidents, isPending, error } = useIncidents()
  const { data: sites } = useSites()
  const { data: me } = useMe()

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  const siteName = (id: number | null) =>
    id === null ? null : (sites?.find((s) => s.site_id === id)?.name ?? `Site ${id}`)

  return (
    <div>
      <PageHeader eyebrow="Incidents" title="Workspaces" />
      {(incidents ?? []).length === 0 ? (
        <EmptyState
          title="You are not in any workspace"
          hint={me?.is_admin
            ? 'Open one from the admin panel when an incident starts.'
            : 'When an incident involves you, a coordinator will add you and it will appear here.'}
          to={me?.is_admin ? '/admin/incidents' : undefined}
          cta={me?.is_admin ? 'Open admin' : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(incidents ?? []).map((i) => (
            <Link key={i.incident_id} to={`/incidents/${i.incident_id}`} className="group">
              <Card className={`h-full transition group-hover:ring-2 group-hover:ring-accent ${
                i.status === 'active' && i.severity === 'critical' ? 'ring-2 ring-emergency' : ''
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold group-hover:text-accent">{i.title}</p>
                  <StatusChip status={i.status} />
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  <TypeChip type={i.incident_type} />
                  <SeverityChip severity={i.severity} />
                  {i.my_role ? <RoleChip role={i.my_role} /> : null}
                </p>
                <p className="mt-3 text-sm text-steel">
                  {siteName(i.site_id) ?? 'Corporate / multi-site'}
                  <span className="mx-1">·</span>
                  {i.member_count ?? 0} member{(i.member_count ?? 0) === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-xs text-steel">Opened {fmtDate(i.created_at)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

import { useSites, useWorkspaces } from '../api/client'
import { Card, EmptyState, ErrorNote, Loading, PageHeader, Pagination, PhoneLink, usePagination } from '../components/ui'

export function WorkspacesPage() {
  const { data: rooms, isPending, error } = useWorkspaces()
  const { data: sites } = useSites()
  const pager = usePagination(rooms ?? [])

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  const siteName = (id: number) => sites?.find((s) => s.site_id === id)?.name ?? `Site ${id}`

  return (
    <div>
      <PageHeader eyebrow="Schedule 1A" title="Workspaces" />
      {(rooms ?? []).length === 0 ? (
        <EmptyState title="No workspaces on file yet" to="/admin/workspaces" cta="Add in admin" />
      ) : (
        <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pager.pageItems.map((r) => (
            <Card key={r.war_room_id}>
              <p className="font-bold">{siteName(r.site_id)}</p>
              {r.war_room_location ? (
                <p className="mt-1 text-sm">{r.war_room_location}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <PhoneLink number={r.war_room_phone} label="workspace" />
                <PhoneLink number={r.direct_line} label="direct" />
                <PhoneLink number={r.conference_phone} label="bridge" />
              </div>
              {r.conference_access_code ? (
                <p className="tel mt-2 text-sm">
                  <span className="font-medium text-steel">Access code:</span>{' '}
                  <span className="font-bold">{r.conference_access_code}</span>
                </p>
              ) : null}
              {r.direct_fax ? (
                <p className="tel mt-1 text-sm text-steel">Fax: {r.direct_fax}</p>
              ) : null}
              {r.revised_at ? (
                <p className="mt-2 text-xs text-steel">
                  Revised {new Date(r.revised_at).toLocaleDateString()}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
        <Pagination page={pager.page} pageCount={pager.pageCount} setPage={pager.setPage} />
        </>
      )}
    </div>
  )
}

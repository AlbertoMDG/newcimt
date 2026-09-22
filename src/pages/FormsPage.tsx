import { useResources } from '../api/client'
import { Card, EmptyState, ErrorNote, Loading, PageHeader } from '../components/ui'

export function FormsPage() {
  const { data: resources, isPending, error } = useResources()

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  return (
    <div>
      <PageHeader eyebrow="Downloads" title="Forms & resources" />
      {(resources ?? []).length === 0 ? (
        <EmptyState title="No resources yet" to="/admin/resources" cta="Add in admin" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(resources ?? []).map((r) => {
            const href = r.url ?? (r.file_name ? `/files/${r.file_name}` : null)
            return (
              <Card key={r.resource_id}>
                {r.category ? (
                  <p className="text-xs font-bold tracking-[0.12em] text-steel uppercase">
                    {r.category}
                  </p>
                ) : null}
                <p className="mt-1 font-bold">{r.title}</p>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-deep"
                  >
                    Open
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-steel">No file attached yet.</p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

import Markdown from 'react-markdown'
import { useParams } from 'react-router'
import { useContentTree } from '../api/client'
import { Accordion, EmptyState, ErrorNote, Loading, PageHeader } from '../components/ui'

export function GuidePage() {
  const { slug = '' } = useParams()
  const { data: page, isPending, error } = useContentTree(slug)

  if (isPending) return <Loading />
  if (error) {
    return (
      <div>
        <PageHeader title="Guide" />
        <EmptyState
          title="This guide hasn't been published yet"
          hint="Its content can be created from the admin dashboard."
          to="/admin/content"
          cta="Open content admin"
        />
      </div>
    )
  }
  if (!page) return <ErrorNote error={new Error('Not found')} />

  return (
    <div>
      <PageHeader eyebrow="Response guide" title={page.title} />
      <div>
        {page.sections.map((s, i) => (
          <Accordion key={s.section_id} heading={s.heading} defaultOpen={i === 0}>
            <div className="prose-cimt space-y-3 text-[15px] leading-relaxed">
              {s.blocks.map((b) => (
                <div key={b.block_id} className="[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_p]:mt-2 [&_strong]:font-bold">
                  <Markdown>{b.body}</Markdown>
                </div>
              ))}
            </div>
          </Accordion>
        ))}
        {page.sections.length === 0 ? (
          <EmptyState title="No sections yet" to={`/admin/content/${page.slug}`} cta="Edit in admin" />
        ) : null}
      </div>
    </div>
  )
}

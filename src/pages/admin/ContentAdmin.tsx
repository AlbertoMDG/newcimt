import { useState } from 'react'
import { useForm } from 'react-hook-form'
import Markdown from 'react-markdown'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, useContentPages, useContentTree } from '../../api/client'
import type { ContentBlock, ContentSection } from '@shared/types'
import { Card, EmptyState, ErrorNote, Loading, PageHeader } from '../../components/ui'

const inputCls = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 py-2'

function useContentMutations(slug?: string) {
  const qc = useQueryClient()
  const invalidate = () =>
    Promise.all(
      ['content-pages', 'content-tree', 'content-sections', 'content-blocks', 'stats'].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    )
  const run = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    onSuccess: invalidate,
  })
  return { run, slug }
}

// ---------- page list ----------

export function ContentAdmin() {
  const { data: pages, isPending, error } = useContentPages()
  const { run } = useContentMutations()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { title: '', slug: '', kind: 'guide', book: '' },
  })

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  const submit = handleSubmit((data) => {
    run.mutate(
      {
        path: '/content/pages',
        method: 'POST',
        body: { ...data, book: data.book || null },
      },
      {
        onSuccess: (page) => {
          reset()
          setCreating(false)
          navigate(`/admin/content/${(page as { slug: string }).slug}`)
        },
      },
    )
  })

  return (
    <div>
      <PageHeader
        title="Guides & checklists"
        action={
          <button
            type="button"
            onClick={() => setCreating(!creating)}
            className="min-h-12 rounded-full bg-accent px-5 font-bold text-white hover:bg-accent-deep"
          >
            + New page
          </button>
        }
      />

      {creating ? (
        <Card className="mb-4">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Title *</span>
              <input {...register('title', { required: true })} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Slug * (url name)</span>
              <input {...register('slug', { required: true })} className={inputCls} placeholder="workplace-violence" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Kind</span>
              <select {...register('kind')} className={inputCls}>
                <option value="guide">Guide</option>
                <option value="checklist">Checklist</option>
                <option value="static">Static</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Book (optional)</span>
              <input {...register('book')} className={inputCls} placeholder="chemical" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={run.isPending} className="min-h-12 rounded-full bg-accent px-6 font-bold text-white hover:bg-accent-deep">
                Create page
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {(pages ?? []).length === 0 ? (
        <EmptyState title="No content pages yet" hint='Use "+ New page", or run the content seed.' />
      ) : (
        // Guides and checklists are separate sections, each under its own heading
        ([['guide', 'Guides'], ['checklist', 'Checklists'], ['static', 'Static pages']] as const).map(([kind, label]) => {
          const group = (pages ?? []).filter((p) => p.kind === kind)
          if (group.length === 0) return null
          return (
            <section key={kind} className="mb-6">
              <h2 className="mb-2 text-xs font-bold tracking-[0.14em] text-steel uppercase">{label}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.map((p) => (
                  <li key={p.page_id}>
                    <Link
                      to={`/admin/content/${p.slug}`}
                      className="flex min-h-14 flex-col justify-center rounded-xl border border-line bg-card px-4 py-3 hover:border-ink"
                    >
                      <span className="font-bold">{p.title}</span>
                      <span className="text-sm text-steel">
                        {p.book ? `${p.book} · ` : ''}/{p.slug}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

// ---------- page editor ----------

function BlockEditor({ block, run }: {
  block: ContentBlock
  run: ReturnType<typeof useContentMutations>['run']
}) {
  const [body, setBody] = useState(block.body)
  const [preview, setPreview] = useState(false)
  const dirty = body !== block.body

  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wide text-steel uppercase">
          {block.kind === 'checklist_item' ? 'Checklist item' : 'Markdown'}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="min-h-9 rounded px-2 text-xs font-semibold text-steel hover:bg-line/60"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this block?'))
                run.mutate({ path: `/content/blocks/${block.block_id}`, method: 'DELETE' })
            }}
            className="min-h-9 rounded px-2 text-xs font-semibold text-alarm hover:bg-alarm-soft"
          >
            Delete
          </button>
        </div>
      </div>
      {preview ? (
        <div className="[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mt-1 rounded bg-card p-3 text-sm">
          <Markdown>{body}</Markdown>
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.min(14, Math.max(3, body.split('\n').length + 1))}
          className="w-full rounded border border-line bg-card p-3 font-mono text-sm"
        />
      )}
      {dirty ? (
        <button
          type="button"
          disabled={run.isPending}
          onClick={() =>
            run.mutate({ path: `/content/blocks/${block.block_id}`, method: 'PUT', body: { body } })
          }
          className="mt-2 min-h-10 rounded-full bg-accent px-5 text-sm font-bold text-white hover:bg-accent-deep"
        >
          Save block
        </button>
      ) : null}
    </div>
  )
}

function SectionEditor({ section, blocks, run, isChecklist }: {
  section: ContentSection
  blocks: ContentBlock[]
  run: ReturnType<typeof useContentMutations>['run']
  isChecklist: boolean
}) {
  const [heading, setHeading] = useState(section.heading)
  const [open, setOpen] = useState(false)

  return (
    <Card className="mb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="min-h-11 px-1 text-lg text-steel"
          aria-label={open ? 'Collapse section' : 'Expand section'}
        >
          {open ? '▾' : '▸'}
        </button>
        <input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          className="min-h-11 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-bold hover:border-line focus:border-line focus:bg-card"
        />
        {heading !== section.heading ? (
          <button
            type="button"
            onClick={() =>
              run.mutate({ path: `/content/sections/${section.section_id}`, method: 'PUT', body: { heading } })
            }
            className="min-h-10 rounded-full bg-accent px-4 text-sm font-bold text-white"
          >
            Save
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (confirm('Delete this section and all its content?'))
              run.mutate({ path: `/content/sections/${section.section_id}`, method: 'DELETE' })
          }}
          className="min-h-10 rounded-lg px-3 text-sm font-semibold text-alarm hover:bg-alarm-soft"
        >
          Delete
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          {blocks.map((b) => (
            <BlockEditor key={b.block_id} block={b} run={run} />
          ))}
          <button
            type="button"
            onClick={() =>
              run.mutate({
                path: '/content/blocks',
                method: 'POST',
                body: {
                  section_id: section.section_id,
                  kind: isChecklist ? 'checklist_item' : 'markdown',
                  body: isChecklist ? 'New checklist item' : 'New content…',
                  sort_order: (blocks.at(-1)?.sort_order ?? 0) + 1,
                },
              })
            }
            className="min-h-11 rounded-lg border border-dashed border-line px-4 text-sm font-semibold text-steel hover:border-ink hover:text-ink"
          >
            + Add {isChecklist ? 'item' : 'block'}
          </button>
        </div>
      ) : (
        <p className="mt-1 pl-8 text-sm text-steel">{blocks.length} blocks</p>
      )}
    </Card>
  )
}

export function ContentEditor() {
  const { slug = '' } = useParams()
  const { data: page, isPending, error } = useContentTree(slug)
  const { run } = useContentMutations(slug)

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />
  if (!page) return <EmptyState title="Page not found" />

  const isChecklist = page.kind === 'checklist'
  const publicPath = isChecklist ? '/checklist' : `/guides/${page.slug}`

  return (
    <div>
      <Link to="/admin/content" className="text-sm font-semibold text-steel">
        ‹ All pages
      </Link>
      <PageHeader
        eyebrow={page.kind}
        title={page.title}
        action={
          <Link
            to={publicPath}
            className="min-h-11 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold"
          >
            View live ›
          </Link>
        }
      />

      {page.sections.map((s) => (
        <SectionEditor
          key={s.section_id}
          section={s}
          blocks={s.blocks}
          run={run}
          isChecklist={isChecklist}
        />
      ))}

      <button
        type="button"
        onClick={() =>
          run.mutate({
            path: '/content/sections',
            method: 'POST',
            body: {
              page_id: page.page_id,
              heading: 'New section',
              sort_order: (page.sections.at(-1)?.sort_order ?? 0) + 1,
            },
          })
        }
        className="min-h-12 w-full rounded-xl border border-dashed border-line font-semibold text-steel hover:border-ink hover:text-ink"
      >
        + Add section
      </button>
    </div>
  )
}

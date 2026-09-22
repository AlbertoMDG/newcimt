import { useEffect, useState } from 'react'
import { useContentTree } from '../api/client'
import { Accordion, EmptyState, ErrorNote, Loading, PageHeader } from '../components/ui'

const STORAGE_KEY = 'cimt-checklist-state'

function loadState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function ChecklistPage() {
  const { data: page, isPending, error } = useContentTree('crisis-checklist')
  const [checked, setChecked] = useState<Record<string, boolean>>(loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked))
    } catch {
      // storage unavailable: checklist still works, state just won't persist
    }
  }, [checked])

  if (isPending) return <Loading />
  if (error) {
    return (
      <div>
        <PageHeader title="Crisis checklist" />
        <EmptyState
          title="The checklist hasn't been published yet"
          to="/admin/content"
          cta="Open content admin"
        />
      </div>
    )
  }
  if (!page) return <ErrorNote error={new Error('Not found')} />

  const total = page.sections.reduce((n, s) => n + s.blocks.length, 0)
  const done = page.sections.reduce(
    (n, s) => n + s.blocks.filter((b) => checked[String(b.block_id)]).length,
    0,
  )

  return (
    <div>
      <PageHeader
        eyebrow="Working document"
        title="Crisis checklist"
        action={
          <button
            type="button"
            onClick={() => setChecked({})}
            className="min-h-11 rounded-full bg-mist px-5 text-sm font-semibold"
          >
            Reset
          </button>
        }
      />
      <div className="mb-4 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="tel text-sm font-semibold text-steel">
            {done} of {total} done
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full bg-ok transition-all"
              style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
        {done === total && total > 0 ? (
          <p className="mt-3 rounded-xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">
            All steps complete — notify Corporate CIMT.
          </p>
        ) : (
          <p className="mt-2 text-xs text-steel">Progress saves on this device only.</p>
        )}
      </div>

      {page.sections.map((s) => {
        const sectionDone = s.blocks.filter((b) => checked[String(b.block_id)]).length
        return (
          <Accordion
            key={s.section_id}
            heading={
              <span>
                {s.heading}{' '}
                <span className="tel text-sm font-medium text-steel">
                  {sectionDone}/{s.blocks.length}
                </span>
              </span>
            }
          >
            <ul className="space-y-1">
              {s.blocks.map((b) => {
                const id = String(b.block_id)
                return (
                  <li key={b.block_id}>
                    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-paper">
                      <input
                        type="checkbox"
                        checked={!!checked[id]}
                        onChange={(e) => setChecked({ ...checked, [id]: e.target.checked })}
                        className="mt-1 h-5 w-5 accent-ok"
                      />
                      <span className={checked[id] ? 'text-steel line-through' : ''}>
                        {b.body}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </Accordion>
        )
      })}
    </div>
  )
}

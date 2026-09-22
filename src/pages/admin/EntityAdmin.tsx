import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  api, useConstituents, useContacts, useCrud, useCustomers, useRoles, useSites,
} from '../../api/client'
import { EmptyState, Loading, ErrorNote, PageHeader } from '../../components/ui'
import { entities, type EntityConfig, type FieldSpec, type OptionSource } from './adminConfig'

type Row = Record<string, unknown>

function useLookups(): Record<OptionSource, Map<number, string>> {
  const { data: sites } = useSites()
  const { data: roles } = useRoles()
  const { data: contacts } = useContacts()
  const { data: customers } = useCustomers()
  const { data: constituents } = useConstituents(undefined)
  return useMemo(
    () => ({
      sites: new Map((sites ?? []).map((s) => [s.site_id, s.name])),
      roles: new Map((roles ?? []).map((r) => [r.role_id, r.name])),
      contacts: new Map((contacts ?? []).map((c) => [c.contact_id, c.full_name])),
      customers: new Map((customers ?? []).map((c) => [c.customer_id, c.name])),
      constituents: new Map((constituents ?? []).map((c) => [c.constituent_id, c.place_name])),
    }),
    [sites, roles, contacts, customers, constituents],
  )
}

function FormModal({ cfg, row, lookups, onClose, onSubmit, saving, error }: {
  cfg: EntityConfig
  row: Row | null
  lookups: Record<OptionSource, Map<number, string>>
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => void
  saving: boolean
  error: unknown
}) {
  const defaults: Record<string, unknown> = {}
  for (const f of cfg.fields) {
    let v = row?.[f.name] ?? (f.type === 'checkbox' ? false : '')
    if (f.type === 'date' && typeof v === 'string' && v) v = v.slice(0, 10)
    defaults[f.name] = v ?? ''
  }
  const { register, handleSubmit, formState } = useForm({ defaultValues: defaults })

  const submit = handleSubmit((data) => {
    const out: Record<string, unknown> = {}
    for (const f of cfg.fields) {
      let v: unknown = data[f.name]
      if (v === '') v = null
      if (f.type === 'select' && f.optionSource && v !== null) v = Number(v)
      out[f.name] = v
    }
    onSubmit(out)
  })

  const inputCls = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 py-2'

  function fieldInput(f: FieldSpec) {
    const reg = register(f.name, { required: f.required })
    if (f.type === 'textarea') return <textarea {...reg} rows={3} className={inputCls} />
    if (f.type === 'checkbox') return <input type="checkbox" {...reg} className="h-5 w-5 accent-accent" />
    if (f.type === 'select') {
      const opts = f.optionSource
        ? [...lookups[f.optionSource].entries()]
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value: String(value), label }))
        : (f.options ?? [])
      return (
        <select {...reg} className={inputCls}>
          {f.nullable || !f.required ? <option value="">—</option> : null}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    }
    return <input type={f.type ?? 'text'} {...reg} className={inputCls} />
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">
            {row ? 'Edit' : 'New'} · {cfg.title}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-xl text-steel" aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {cfg.fields.map((f) => (
            <label key={f.name} className="block">
              <span className="mb-1 block text-sm font-semibold">
                {f.label}
                {f.required ? <span className="text-alarm"> *</span> : null}
              </span>
              {fieldInput(f)}
              {formState.errors[f.name] ? (
                <span className="text-xs font-semibold text-alarm">Required.</span>
              ) : null}
            </label>
          ))}
          {error ? (
            <p className="rounded-lg bg-alarm-soft p-3 text-sm font-semibold text-alarm-deep">
              {error instanceof Error ? error.message : 'Save failed.'}
            </p>
          ) : null}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-12 flex-1 rounded-full bg-accent font-bold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-mist px-6 font-semibold">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const PAGE_SIZE = 50

export function EntityAdmin() {
  const { entity = '' } = useParams()
  const cfg = entities[entity]
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [modal, setModal] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const lookups = useLookups()

  const { data, isPending, error } = useQuery({
    // first invalidates entry is the resource key, so admin lists refetch after writes
    queryKey: [cfg?.invalidates[0] ?? entity, 'admin-list'],
    queryFn: () => api<Row[]>(cfg.endpoint),
    enabled: !!cfg,
  })
  const { create, update, remove } = useCrud(cfg?.endpoint ?? '', cfg?.invalidates ?? [])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data ?? []
    return (data ?? []).filter((r) =>
      cfg.searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)),
    )
  }, [data, search, cfg])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pagedRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  if (!cfg) return <EmptyState title="Unknown admin section" />
  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  const activeMutation = modal.row ? update : create
  const cell = (row: Row, col: (typeof cfg.columns)[number]) => {
    const v = row[col.key]
    if (col.lookup && typeof v === 'number') return lookups[col.lookup].get(v) ?? v
    if (v === null || v === undefined || v === '') return <span className="text-steel">—</span>
    return String(v)
  }

  return (
    <div>
      <PageHeader
        title={cfg.title}
        action={
          <button
            type="button"
            onClick={() => setModal({ open: true, row: null })}
            className="min-h-12 rounded-full bg-accent px-5 font-bold text-white hover:bg-accent-deep"
          >
            + Add
          </button>
        }
      />
      {cfg.searchKeys.length > 0 ? (
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Search…"
          className="mb-3 min-h-12 w-full rounded-lg border border-line bg-card px-4 sm:w-80"
        />
      ) : null}

      <p className="mb-2 text-sm text-steel">
        {rows.length === 0
          ? '0 records'
          : `Showing ${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, rows.length)} of ${rows.length} records`}
      </p>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold tracking-wide text-steel uppercase">
              {cfg.columns.map((c) => (
                <th key={c.key} className="px-4 py-3">{c.label}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => {
              const id = row[cfg.idKey] as number
              return (
                <tr key={id} className="border-b border-line last:border-0 hover:bg-paper">
                  {cfg.columns.map((c) => (
                    <td key={c.key} className="max-w-64 truncate px-4 py-3">{cell(row, c)}</td>
                  ))}
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setModal({ open: true, row })}
                      className="min-h-10 rounded-lg px-3 font-semibold text-ink hover:bg-line/60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this record? This cannot be undone.')) remove.mutate(id)
                      }}
                      className="min-h-10 rounded-lg px-3 font-semibold text-alarm hover:bg-alarm-soft"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cfg.columns.length + 1} className="px-4 py-8 text-center text-steel">
                  Nothing here yet. Use "+ Add" to create the first record.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="min-h-11 rounded-lg border border-line bg-card px-4 text-sm font-semibold disabled:opacity-40"
          >
            ‹ Previous
          </button>
          <span className="tel text-sm font-semibold text-steel">
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
            className="min-h-11 rounded-lg border border-line bg-card px-4 text-sm font-semibold disabled:opacity-40"
          >
            Next ›
          </button>
        </div>
      ) : null}

      {modal.open ? (
        <FormModal
          cfg={cfg}
          row={modal.row}
          lookups={lookups}
          saving={activeMutation.isPending}
          error={activeMutation.error}
          onClose={() => setModal({ open: false, row: null })}
          onSubmit={(data) => {
            const done = { onSuccess: () => setModal({ open: false, row: null }) }
            if (modal.row) {
              update.mutate({ id: modal.row[cfg.idKey] as number, data }, done)
            } else {
              create.mutate(data, done)
            }
          }}
        />
      ) : null}
    </div>
  )
}

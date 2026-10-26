// Admin screen for incident workspaces: create incidents, drive the lifecycle
// (close / archive / reopen), and manage members + roles. Custom page — the
// lifecycle and member panel don't fit the generic EntityAdmin.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import type { Incident, IncidentRole } from '@shared/types'
import {
  downloadIncidentExport, useApiMutation, useDirectory, useIncidentAudit,
  useIncidentMembers, useIncidents, useSites,
} from '../../api/client'
import { EmptyState, ErrorNote, Loading, PageHeader } from '../../components/ui'
import {
  ROLE_LABELS, SEVERITY_LABELS, STATUS_LABELS, SeverityChip, StatusChip, TYPE_LABELS, TypeChip, fmtDate,
} from '../incidents/common'

const inputCls = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 py-2'
const INVALIDATES = ['incidents', 'incident', 'incident-members', 'stats']

interface IncidentForm {
  title: string
  incident_type: string
  site_id: string
  severity: string
  summary: string
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const { data: sites } = useSites()
  const mutation = useApiMutation(INVALIDATES)
  const { register, handleSubmit, formState } = useForm<IncidentForm>({
    defaultValues: { title: '', incident_type: 'other', site_id: '', severity: 'medium', summary: '' },
  })

  const submit = handleSubmit((d) =>
    mutation.mutate(
      {
        path: '/incidents',
        method: 'POST',
        body: {
          title: d.title,
          incident_type: d.incident_type,
          site_id: d.site_id === '' ? null : Number(d.site_id),
          severity: d.severity,
          summary: d.summary || null,
        },
      },
      { onSuccess: onClose },
    ),
  )

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Open a workspace</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-xl text-steel" aria-label="Close">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Title <span className="text-alarm">*</span></span>
            <input {...register('title', { required: true })} className={inputCls} />
            {formState.errors.title ? <span className="text-xs font-semibold text-alarm">Required.</span> : null}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Incident type</span>
            <select {...register('incident_type')} className={inputCls}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Affected site</span>
            <select {...register('site_id')} className={inputCls}>
              <option value="">— (corporate / multi-site)</option>
              {(sites ?? []).map((s) => <option key={s.site_id} value={s.site_id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Severity</span>
            <select {...register('severity')} className={inputCls}>
              {Object.entries(SEVERITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Summary</span>
            <textarea {...register('summary')} rows={3} className={inputCls} />
          </label>
          {mutation.isError ? (
            <p className="rounded-lg bg-alarm-soft p-3 text-sm font-semibold text-alarm-deep">
              {mutation.error instanceof Error ? mutation.error.message : 'Save failed.'}
            </p>
          ) : null}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="min-h-12 flex-1 rounded-full bg-accent font-bold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {mutation.isPending ? 'Opening…' : 'Open workspace'}
            </button>
            <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-mist px-6 font-semibold">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MembersPanel({ incident }: { incident: Incident }) {
  const { data: members, isPending } = useIncidentMembers(incident.incident_id)
  const { data: directory } = useDirectory()
  const mutation = useApiMutation(INVALIDATES)
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<IncidentRole>('member')
  const writable = incident.status === 'active'

  const memberIds = new Set((members ?? []).map((m) => m.user_id))
  const candidates = (directory ?? []).filter((u) => !memberIds.has(u.user_id))
  const base = `/incidents/${incident.incident_id}/members`

  if (isPending) return <Loading />
  return (
    <div>
      {writable ? (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1">
            <span className="mb-1 block text-xs font-semibold text-steel">Add user</span>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
              <option value="">Select a user…</option>
              {candidates.map((u) => (
                <option key={u.user_id} value={u.user_id}>{u.display_name} ({u.email})</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-steel">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as IncidentRole)} className={inputCls}>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={!userId || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { path: base, method: 'POST', body: { user_id: Number(userId), role } },
                { onSuccess: () => setUserId('') },
              )}
            className="min-h-11 rounded-full bg-accent px-5 font-bold text-white hover:bg-accent-deep disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : (
        <p className="mb-3 text-sm text-steel">This workspace is {incident.status} — membership is frozen.</p>
      )}

      {mutation.isError ? (
        <p className="mb-3 rounded-lg bg-alarm-soft p-3 text-sm font-semibold text-alarm-deep">
          {mutation.error instanceof Error ? mutation.error.message : 'Change failed.'}
        </p>
      ) : null}

      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {(members ?? []).map((m) => (
          <li key={m.member_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.display_name}</p>
              <p className="truncate text-sm text-steel">{m.email}</p>
            </div>
            {writable ? (
              <>
                <select
                  value={m.role}
                  onChange={(e) =>
                    mutation.mutate({ path: `${base}/${m.member_id}`, method: 'PUT', body: { role: e.target.value } })}
                  className="min-h-10 rounded-lg border border-line bg-card px-2 text-sm"
                >
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove ${m.display_name} from this workspace?`)) {
                      mutation.mutate({ path: `${base}/${m.member_id}`, method: 'DELETE' })
                    }
                  }}
                  className="min-h-10 rounded-lg px-3 text-sm font-semibold text-alarm hover:bg-alarm-soft"
                >
                  Remove
                </button>
              </>
            ) : (
              <span className="text-sm font-semibold text-steel">{ROLE_LABELS[m.role]}</span>
            )}
          </li>
        ))}
        {(members ?? []).length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-steel">No members yet.</li>
        ) : null}
      </ul>
    </div>
  )
}

function AuditPanel({ incidentId }: { incidentId: number }) {
  const { data: audit, isPending } = useIncidentAudit(incidentId)
  const [filter, setFilter] = useState('')
  if (isPending) return <Loading />
  const actions = [...new Set((audit ?? []).map((a) => a.action))].sort()
  const rows = (audit ?? []).filter((a) => !filter || a.action === filter)
  return (
    <div>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-2 min-h-10 rounded-lg border border-line bg-card px-2 text-sm"
        aria-label="Filter by action"
      >
        <option value="">All actions ({(audit ?? []).length})</option>
        {actions.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <div className="max-h-80 overflow-y-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-line text-xs font-bold tracking-wide text-steel uppercase">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((a) => (
              <tr key={a.audit_id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-steel">{fmtDate(a.created_at)}</td>
                <td className="max-w-36 truncate px-3 py-2">{a.actor_name ?? '—'}</td>
                <td className="px-3 py-2 font-semibold whitespace-nowrap">{a.action}</td>
                <td className="max-w-72 truncate px-3 py-2 text-steel">{a.detail ?? ''}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-steel">No audit entries.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExportButton({ incidentId }: { incidentId: number }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await downloadIncidentExport(incidentId)
        } catch (e) {
          alert(e instanceof Error ? e.message : 'Export failed')
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-bold text-white hover:bg-ink/80 disabled:opacity-50"
    >
      {busy ? 'Exporting…' : '⎙ Export record'}
    </button>
  )
}

function LifecycleButtons({ incident }: { incident: Incident }) {
  const mutation = useApiMutation(INVALIDATES)
  const act = (action: string, confirmMsg: string) => {
    if (confirm(confirmMsg)) {
      mutation.mutate({ path: `/incidents/${incident.incident_id}/${action}`, method: 'POST' })
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {incident.status === 'active' ? (
        <button
          type="button"
          onClick={() => act('close', 'Close this workspace? It becomes read-only (an admin can reopen it).')}
          className="min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white"
        >
          Close workspace
        </button>
      ) : null}
      {incident.status === 'closed' ? (
        <>
          <button
            type="button"
            onClick={() => act('reopen', 'Reopen this workspace? The action is recorded in the audit trail.')}
            className="min-h-11 rounded-full bg-accent px-5 text-sm font-bold text-white"
          >
            Reopen
          </button>
          <button
            type="button"
            onClick={() => act('archive', 'Archive this workspace? It stays read-only and leaves the active lists.')}
            className="min-h-11 rounded-full bg-mist px-5 text-sm font-bold"
          >
            Archive
          </button>
        </>
      ) : null}
      {incident.status === 'archived' ? (
        <button
          type="button"
          onClick={() => act('reopen', 'Reopen this archived workspace? The action is recorded in the audit trail.')}
          className="min-h-11 rounded-full bg-accent px-5 text-sm font-bold text-white"
        >
          Reopen
        </button>
      ) : null}
      {mutation.isError ? (
        <p className="w-full rounded-lg bg-alarm-soft p-3 text-sm font-semibold text-alarm-deep">
          {mutation.error instanceof Error ? mutation.error.message : 'Action failed.'}
        </p>
      ) : null}
    </div>
  )
}

export function IncidentsAdmin() {
  const { data: incidents, isPending, error } = useIncidents()
  const { data: sites } = useSites()
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  const siteName = (id: number | null) =>
    id === null ? '—' : (sites?.find((s) => s.site_id === id)?.name ?? `Site ${id}`)
  const selected = (incidents ?? []).find((i) => i.incident_id === selectedId) ?? null

  return (
    <div>
      <PageHeader
        eyebrow="Incidents"
        title="Workspaces"
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="min-h-12 rounded-full bg-emergency px-5 font-bold text-white hover:bg-emergency-deep"
          >
            + Open workspace
          </button>
        }
      />

      {(incidents ?? []).length === 0 ? (
        <EmptyState
          title="No workspaces yet"
          hint="Open one when an incident starts; add the responders as members."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-bold tracking-wide text-steel uppercase">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Opened</th>
              </tr>
            </thead>
            <tbody>
              {(incidents ?? []).map((i) => (
                <tr
                  key={i.incident_id}
                  onClick={() => setSelectedId(i.incident_id === selectedId ? null : i.incident_id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-paper ${
                    i.incident_id === selectedId ? 'bg-accent-soft/50' : ''
                  }`}
                >
                  <td className="max-w-64 truncate px-4 py-3 font-semibold">{i.title}</td>
                  <td className="px-4 py-3"><TypeChip type={i.incident_type} /></td>
                  <td className="max-w-40 truncate px-4 py-3">{siteName(i.site_id)}</td>
                  <td className="px-4 py-3"><SeverityChip severity={i.severity} /></td>
                  <td className="px-4 py-3"><StatusChip status={i.status} /></td>
                  <td className="tel px-4 py-3">{i.member_count ?? 0}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-steel">{fmtDate(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="mt-5 rounded-2xl bg-card p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">{selected.title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-steel">
                <TypeChip type={selected.incident_type} />
                <SeverityChip severity={selected.severity} />
                <StatusChip status={selected.status} />
                <span>· {siteName(selected.site_id)}</span>
                {selected.closed_at ? <span>· {STATUS_LABELS[selected.status]} {fmtDate(selected.closed_at)}</span> : null}
              </p>
            </div>
            <span className="flex flex-wrap items-center gap-2">
              {selected.status !== 'active' ? <ExportButton incidentId={selected.incident_id} /> : null}
              <Link
                to={`/incidents/${selected.incident_id}`}
                className="min-h-11 rounded-full bg-accent px-5 text-sm font-bold text-white hover:bg-accent-deep inline-flex items-center"
              >
                Enter workspace ›
              </Link>
            </span>
          </div>

          <LifecycleButtons incident={selected} />

          <h3 className="mt-6 mb-2 text-xs font-bold tracking-[0.14em] text-steel uppercase">Members</h3>
          <MembersPanel incident={selected} />

          <h3 className="mt-6 mb-2 text-xs font-bold tracking-[0.14em] text-steel uppercase">Audit trail</h3>
          <AuditPanel incidentId={selected.incident_id} />
        </div>
      ) : null}

      {creating ? <CreateModal onClose={() => setCreating(false)} /> : null}
    </div>
  )
}

// A single incident workspace: live chat, documents, timeline, and members.
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { downloadIncidentExport, useIncident, useIncidentMembers, useMe, useSites } from '../../api/client'
import { Avatar, Card, ErrorNote, Loading, PageHeader } from '../../components/ui'
import { ChatPanel } from './ChatPanel'
import { FilesPanel } from './FilesPanel'
import { TimelinePanel } from './TimelinePanel'
import { WorkspaceModal } from './WorkspaceModal'
import { ROLE_LABELS, RoleChip, SeverityChip, StatusChip, TypeChip, fmtDate } from './common'

const TABS = ['Chat', 'Files', 'Timeline', 'Overview', 'Members'] as const

function ExportButton({ incidentId }: { incidentId: number }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await downloadIncidentExport(incidentId)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Export failed')
          } finally {
            setBusy(false)
          }
        }}
        className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-bold text-white hover:bg-ink/80 disabled:opacity-50"
      >
        {busy ? 'Exporting…' : '⎙ Export record'}
      </button>
      {error ? <span className="mt-1 text-xs font-semibold text-emergency-deep">{error}</span> : null}
    </span>
  )
}
type Tab = (typeof TABS)[number]

export function IncidentRoom() {
  const { id } = useParams()
  const incidentId = Number(id)
  const { data: incident, isPending, error } = useIncident(Number.isInteger(incidentId) ? incidentId : undefined)
  const { data: members } = useIncidentMembers(incident?.incident_id)
  const { data: sites } = useSites()
  const { data: me } = useMe()
  const [tab, setTab] = useState<Tab>('Chat')
  const [editing, setEditing] = useState(false)

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />
  if (!incident) return null

  const siteName = incident.site_id === null
    ? 'Corporate / multi-site'
    : (sites?.find((s) => s.site_id === incident.site_id)?.name ?? `Site ${incident.site_id}`)
  const readOnly = incident.status !== 'active'
  const isCommander = incident.my_role === 'commander' || Boolean(me?.is_admin)

  return (
    <div>
      {incident.status === 'active' && incident.severity === 'critical' ? (
        <div className="hazard-stripe mb-4 rounded" />
      ) : null}

      <PageHeader
        eyebrow="Workspace"
        title={incident.title}
        action={
          <span className="flex flex-wrap items-center gap-2">
            {readOnly && isCommander ? <ExportButton incidentId={incident.incident_id} /> : null}
            {!readOnly && isCommander ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-bold hover:border-ink"
              >
                ✎ Edit
              </button>
            ) : null}
            {me?.is_admin ? (
              <Link
                to="/admin/incidents"
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-bold hover:border-ink"
              >
                Manage ›
              </Link>
            ) : null}
          </span>
        }
      />

      <p className="-mt-3 mb-4 flex flex-wrap items-center gap-2 text-sm text-steel">
        <TypeChip type={incident.incident_type} />
        <SeverityChip severity={incident.severity} />
        <StatusChip status={incident.status} />
        {incident.my_role ? <RoleChip role={incident.my_role} /> : null}
        <span>· {siteName}</span>
      </p>

      {readOnly ? (
        <div className="mb-4 rounded-xl bg-mist p-3 text-sm font-semibold text-steel">
          This workspace is {incident.status} — everything is read-only.
          {incident.closed_at ? ` Closed ${fmtDate(incident.closed_at)}.` : ''}
        </div>
      ) : null}

      <div className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-steel hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Chat' ? <ChatPanel incident={incident} /> : null}

      {tab === 'Files' ? <FilesPanel incident={incident} /> : null}

      {tab === 'Timeline' ? <TimelinePanel incident={incident} /> : null}

      {tab === 'Overview' ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="mb-2 text-xs font-bold tracking-[0.14em] text-steel uppercase">Summary</h2>
            {incident.summary ? (
              <p className="whitespace-pre-wrap">{incident.summary}</p>
            ) : (
              <p className="text-sm text-steel">No summary yet.</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 text-xs font-bold tracking-[0.14em] text-steel uppercase">Details</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="font-semibold text-steel">Opened</dt><dd>{fmtDate(incident.created_at)}</dd></div>
              {incident.closed_at ? (
                <div><dt className="font-semibold text-steel">Closed</dt><dd>{fmtDate(incident.closed_at)}</dd></div>
              ) : null}
              <div><dt className="font-semibold text-steel">Site</dt><dd>{siteName}</dd></div>
              <div>
                <dt className="font-semibold text-steel">Participants</dt>
                <dd>{members?.length ?? incident.member_count ?? 0}</dd>
              </div>
            </dl>
          </Card>
        </div>
      ) : null}

      {tab === 'Members' ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {(members ?? []).map((m) => (
            <li key={m.member_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.display_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {m.display_name}
                  {m.user_id === me?.user_id ? <span className="text-steel"> (you)</span> : null}
                </p>
                <p className="truncate text-sm text-steel">{m.email}</p>
              </div>
              <span className="text-sm font-semibold text-steel">{ROLE_LABELS[m.role]}</span>
            </li>
          ))}
          {(members ?? []).length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-steel">No members yet.</li>
          ) : null}
        </ul>
      ) : null}

      {editing ? <WorkspaceModal incident={incident} onClose={() => setEditing(false)} /> : null}
    </div>
  )
}

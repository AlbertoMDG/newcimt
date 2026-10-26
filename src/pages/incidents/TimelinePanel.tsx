// Incident timeline: formal chat entries (event/decision/system) merged with
// audit milestones (commander/admin only — the server enforces it too).
import type { Incident, IncidentAuditEntry, IncidentMessage } from '@shared/types'
import { useIncidentAudit, useIncidentMessages, useMe } from '../../api/client'
import { ErrorNote, Loading } from '../../components/ui'
import { fmtDate } from './common'

interface TimelineItem {
  key: string
  ts: string
  icon: string
  title: string
  detail: string | null
  tone: 'accent' | 'emergency' | 'steel'
}

const AUDIT_LABELS: Record<string, { icon: string; label: string }> = {
  incident_created: { icon: '⚑', label: 'Workspace opened' },
  incident_updated: { icon: '✎', label: 'Details updated' },
  status_changed: { icon: '⟳', label: 'Status changed' },
  member_added: { icon: '+', label: 'Member added' },
  member_removed: { icon: '−', label: 'Member removed' },
  role_changed: { icon: '★', label: 'Role changed' },
  file_uploaded: { icon: '⤒', label: 'File uploaded' },
  file_downloaded: { icon: '⤓', label: 'File downloaded' },
  file_deleted: { icon: '✕', label: 'File removed' },
  folder_created: { icon: '▣', label: 'Folder created' },
  export_generated: { icon: '⎙', label: 'Record exported' },
  key_rotated: { icon: '⚿', label: 'Encryption key rotated' },
}

function auditDetail(a: IncidentAuditEntry): string | null {
  if (!a.detail) return null
  try {
    const d = JSON.parse(a.detail) as Record<string, unknown>
    const parts: string[] = []
    if (typeof d.name === 'string') parts.push(d.name)
    if (typeof d.title === 'string') parts.push(d.title)
    if (typeof d.email === 'string') parts.push(d.email)
    if (typeof d.role === 'string') parts.push(`role: ${d.role}`)
    if (typeof d.from === 'string' && typeof d.to === 'string') parts.push(`${d.from} → ${d.to}`)
    return parts.join(' · ') || null
  } catch {
    return a.detail
  }
}

export function TimelinePanel({ incident }: { incident: Incident }) {
  const { data: me } = useMe()
  const isCommander = incident.my_role === 'commander' || Boolean(me?.is_admin)
  const { data: messages, isPending: msgPending, error } = useIncidentMessages(incident.incident_id)
  const { data: audit } = useIncidentAudit(incident.incident_id, isCommander)

  if (msgPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  const items: TimelineItem[] = []

  for (const m of (messages ?? []).filter((x: IncidentMessage) => x.kind !== 'chat')) {
    items.push({
      key: `m${m.message_id}`,
      ts: m.created_at,
      icon: m.kind === 'decision' ? '⚖' : m.kind === 'event' ? '◉' : '·',
      title: m.kind === 'system' ? m.body : `${m.kind === 'decision' ? 'Decision' : 'Event'} — ${m.display_name}`,
      detail: m.kind === 'system' ? null : m.body,
      tone: m.kind === 'decision' ? 'emergency' : m.kind === 'event' ? 'accent' : 'steel',
    })
  }

  if (isCommander) {
    // message_posted/decision_logged already appear via the messages themselves
    for (const a of (audit ?? []).filter((x) => x.action !== 'message_posted' && x.action !== 'decision_logged')) {
      const meta = AUDIT_LABELS[a.action] ?? { icon: '·', label: a.action }
      items.push({
        key: `a${a.audit_id}`,
        ts: a.created_at,
        icon: meta.icon,
        title: `${meta.label}${a.actor_name ? ` — ${a.actor_name}` : ''}`,
        detail: auditDetail(a),
        tone: 'steel',
      })
    }
  }

  items.sort((x, y) => new Date(x.ts).getTime() - new Date(y.ts).getTime() || x.key.localeCompare(y.key))

  const toneCls = { accent: 'bg-accent', emergency: 'bg-emergency', steel: 'bg-steel' } as const

  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      {!isCommander ? (
        <p className="mb-3 text-xs font-semibold text-steel">
          Showing formal entries (events, decisions, system notices). Commanders also see the full audit trail.
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-steel">
          Nothing on the timeline yet. Events and decisions logged in the chat appear here.
        </p>
      ) : (
        <ol className="relative ml-3 space-y-4 border-l-2 border-line pl-5">
          {items.map((it) => (
            <li key={it.key} className="relative">
              <span
                aria-hidden
                className={`absolute top-1 -left-[1.95rem] flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${toneCls[it.tone]}`}
              >
                {it.icon}
              </span>
              <p className="text-xs font-semibold text-steel">{fmtDate(it.ts)}</p>
              <p className="font-semibold">{it.title}</p>
              {it.detail ? <p className="text-sm whitespace-pre-wrap text-steel">{it.detail}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

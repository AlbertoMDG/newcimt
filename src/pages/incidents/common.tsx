import type { IncidentRole, IncidentSeverity, IncidentStatus, IncidentType } from '@shared/types'

export const TYPE_LABELS: Record<IncidentType, string> = {
  food_safety: 'Food safety',
  workplace: 'Workplace',
  environmental: 'Environmental',
  security: 'Security',
  cyber: 'Cyber',
  product_recall: 'Product recall',
  other: 'Other',
}

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
}

export const SEVERITY_DESCRIPTIONS: Record<IncidentSeverity, string> = {
  low: 'Minor issue handled within normal operations. No injuries and no impact to production or product.',
  medium: 'Needs coordinated attention. Impact limited to one site or function.',
  high: 'Serious impact — injuries, production stoppage, or regulatory exposure. Response team required.',
  critical: 'Severe threat to people, product safety, or the business. Immediate company-wide response.',
}

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  active: 'Active', closed: 'Closed', archived: 'Archived',
}

export const ROLE_LABELS: Record<IncidentRole, string> = {
  commander: 'Commander', member: 'Member', observer: 'Observer',
}

const chipBase = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold'

export function SeverityChip({ severity }: { severity: IncidentSeverity }) {
  const colors: Record<IncidentSeverity, string> = {
    low: 'bg-mist text-steel',
    medium: 'bg-accent-soft text-accent-deep',
    high: 'bg-emergency-soft text-emergency-deep',
    critical: 'bg-emergency text-white',
  }
  return <span className={`${chipBase} ${colors[severity]}`}>{SEVERITY_LABELS[severity]}</span>
}

export function StatusChip({ status }: { status: IncidentStatus }) {
  const colors: Record<IncidentStatus, string> = {
    active: 'bg-ok-soft text-ok',
    closed: 'bg-mist text-steel',
    archived: 'bg-line text-steel',
  }
  return <span className={`${chipBase} ${colors[status]}`}>{STATUS_LABELS[status]}</span>
}

export function TypeChip({ type }: { type: IncidentType }) {
  return <span className={`${chipBase} bg-paper text-ink ring-1 ring-line`}>{TYPE_LABELS[type]}</span>
}

export function RoleChip({ role }: { role: IncidentRole }) {
  const colors: Record<IncidentRole, string> = {
    commander: 'bg-accent text-white',
    member: 'bg-accent-soft text-accent-deep',
    observer: 'bg-mist text-steel',
  }
  return <span className={`${chipBase} ${colors[role]}`}>{ROLE_LABELS[role]}</span>
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

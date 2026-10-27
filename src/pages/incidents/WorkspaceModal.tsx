// Shared workspace modal: create (no `incident` prop) or edit (pass the
// incident). Reachable from the global header, the admin incidents table, and
// the war room itself. Creating navigates straight into the new workspace so
// the commander lands in the room, not back on a table; editing stays put.
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import type { Incident, IncidentSeverity } from '@shared/types'
import { useApiMutation, useSites } from '../../api/client'
import { SEVERITY_DESCRIPTIONS, SEVERITY_LABELS, TYPE_LABELS } from './common'

const inputCls = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 py-2'
const INVALIDATES = ['incidents', 'incident', 'incident-members', 'stats']

interface IncidentForm {
  title: string
  incident_type: string
  site_id: string
  severity: string
  summary: string
}

export function WorkspaceModal({ incident, onClose }: { incident?: Incident; onClose: () => void }) {
  const editing = Boolean(incident)
  const { data: sites } = useSites()
  const navigate = useNavigate()
  const mutation = useApiMutation(INVALIDATES)
  const { register, handleSubmit, formState, watch } = useForm<IncidentForm>({
    defaultValues: incident
      ? {
          title: incident.title,
          incident_type: incident.incident_type,
          site_id: incident.site_id === null ? '' : String(incident.site_id),
          severity: incident.severity,
          summary: incident.summary ?? '',
        }
      : { title: '', incident_type: 'other', site_id: '', severity: 'medium', summary: '' },
  })
  const severity = watch('severity') as IncidentSeverity

  const submit = handleSubmit((d) =>
    mutation.mutate(
      {
        path: incident ? `/incidents/${incident.incident_id}` : '/incidents',
        method: incident ? 'PUT' : 'POST',
        body: {
          title: d.title,
          incident_type: d.incident_type,
          site_id: d.site_id === '' ? null : Number(d.site_id),
          severity: d.severity,
          summary: d.summary || null,
        },
      },
      {
        onSuccess: (saved) => {
          onClose()
          if (!incident) navigate(`/incidents/${(saved as Incident).incident_id}`)
        },
      },
    ),
  )

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{editing ? 'Edit workspace' : 'Open a workspace'}</h2>
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
            <span className="mt-1 block text-xs text-steel">{SEVERITY_DESCRIPTIONS[severity]}</span>
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
              {editing
                ? (mutation.isPending ? 'Saving…' : 'Save changes')
                : (mutation.isPending ? 'Opening…' : 'Open workspace')}
            </button>
            <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-mist px-6 font-semibold">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

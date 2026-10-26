import { PageHeader } from '../components/ui'

const steps = [
  { title: 'Coordinator is notified', detail: 'Any employee who becomes aware of a critical incident notifies the Site Coordinator.' },
  { title: 'Team is alerted', detail: 'The Site Coordinator alerts the CIMT via the mass-notification system.' },
  { title: 'Team assembles', detail: 'Members assemble in the workspace (see Schedule 1A) or join the conference bridge.' },
  { title: 'Initial briefing', detail: 'The Coordinator briefs the team on what is known so far.' },
  { title: 'Gather the facts', detail: 'Confirm what happened before acting on assumptions.' },
  { title: "Answer the 5 W's & H", detail: 'Who, what, when, where, why and how — documented as facts are confirmed.' },
  { title: 'Make notifications', detail: 'Notify corporate, regulatory agencies, customers and constituents as required.' },
  { title: 'Line up resources', detail: 'Identify people, equipment and outside help needed for the response.' },
  { title: 'Build the plan', detail: 'Agree on the response plan and assign owners for every action.' },
  { title: 'Implement', detail: 'Execute the plan; the Coordinator tracks actions and blockers.' },
  { title: 'Check effectiveness', detail: 'Verify the response is working; adjust the plan where it is not.' },
  { title: 'Debrief', detail: 'After the incident: document lessons learned and update procedures.' },
]

export function FlowPage() {
  return (
    <div>
      <PageHeader eyebrow="CIMT process" title="Incident response flow" />
      <ol className="relative space-y-3 border-l-2 border-line pl-6">
        {steps.map((s, i) => (
          <li key={s.title} className="relative">
            <span className="tel absolute -left-[35px] flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {i + 1}
            </span>
            <div className="rounded-xl border border-line bg-card p-4">
              <p className="font-bold">{s.title}</p>
              <p className="mt-1 text-sm text-steel">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

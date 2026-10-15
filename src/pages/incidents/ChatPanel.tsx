// War-room chat: live via SSE, encrypted at rest on the server. Messages are
// immutable — no edit/delete — because the chat IS the legal record.
import { useEffect, useRef, useState } from 'react'
import type { Incident, IncidentMessage, MessageKind } from '@shared/types'
import { useApiMutation, useIncidentMessages, useMe } from '../../api/client'
import { useIncidentStream } from '../../api/realtime'
import { ErrorNote, Loading } from '../../components/ui'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'full' })
const dayKey = (iso: string) => new Date(iso).toDateString()

function Message({ m, mine }: { m: IncidentMessage; mine: boolean }) {
  if (m.kind === 'system') {
    return (
      <p className="py-1 text-center text-xs font-medium text-steel">
        {m.body} · {fmtTime(m.created_at)}
      </p>
    )
  }
  const formal = m.kind === 'event' || m.kind === 'decision'
  return (
    <div className={`flex ${mine && !formal ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          formal
            ? `w-full rounded-xl border-l-4 p-3 ${
                m.kind === 'decision'
                  ? 'border-emergency bg-emergency-soft'
                  : 'border-accent bg-accent-soft'
              }`
            : `max-w-[85%] rounded-2xl px-3.5 py-2 sm:max-w-[70%] ${
                mine ? 'bg-accent text-white' : 'bg-card shadow-card'
              }`
        }
      >
        <p className={`text-xs font-bold ${
          formal
            ? m.kind === 'decision' ? 'text-emergency-deep' : 'text-accent-deep'
            : mine ? 'text-white/80' : 'text-accent'
        }`}>
          {formal ? `${m.kind === 'decision' ? 'DECISION' : 'EVENT'} · ` : ''}
          {m.display_name}
          <span className={`ml-2 font-medium ${mine && !formal ? 'text-white/60' : 'text-steel'}`}>
            {fmtTime(m.created_at)}
          </span>
        </p>
        <p className="mt-0.5 break-words whitespace-pre-wrap">{m.body}</p>
      </div>
    </div>
  )
}

export function ChatPanel({ incident }: { incident: Incident }) {
  const { data: me } = useMe()
  const { data: messages, isPending, error } = useIncidentMessages(incident.incident_id)
  const { connected } = useIncidentStream(incident.incident_id, true)
  const send = useApiMutation(['incident-messages'])
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<MessageKind>('chat')
  const scrollRef = useRef<HTMLDivElement>(null)

  const readOnly = incident.status !== 'active'
  const canWrite = !readOnly && incident.my_role !== 'observer'
  const isCommander = incident.my_role === 'commander' || Boolean(me?.is_admin)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages?.length])

  const submit = () => {
    const text = body.trim()
    if (!text || send.isPending) return
    send.mutate(
      {
        path: `/incidents/${incident.incident_id}/messages`,
        method: 'POST',
        body: { body: text, kind },
      },
      { onSuccess: () => { setBody(''); setKind('chat') } },
    )
  }

  if (isPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  let lastDay = ''
  return (
    <div className="flex h-[65dvh] flex-col rounded-2xl border border-line bg-paper">
      <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs font-semibold text-steel">
        <span>Encrypted war-room chat — everything here is part of the incident record</span>
        <span className={`inline-flex items-center gap-1.5 ${connected ? 'text-ok' : 'text-steel'}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-ok' : 'bg-line'}`} aria-hidden />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {(messages ?? []).map((m) => {
          const day = dayKey(m.created_at)
          const showDay = day !== lastDay
          lastDay = day
          return (
            <div key={m.message_id}>
              {showDay ? (
                <p className="my-3 text-center text-xs font-bold tracking-wide text-steel uppercase">
                  {fmtDay(m.created_at)}
                </p>
              ) : null}
              <Message m={m} mine={m.user_id === me?.user_id} />
            </div>
          )
        })}
        {(messages ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-steel">
            No messages yet. Everything posted here stays in the incident record.
          </p>
        ) : null}
      </div>

      {canWrite ? (
        <div className="border-t border-line p-3">
          {send.isError ? (
            <p className="mb-2 rounded-lg bg-emergency-soft p-2 text-sm font-semibold text-emergency-deep">
              {send.error instanceof Error ? send.error.message : 'Send failed.'}
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            {isCommander ? (
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as MessageKind)}
                className="min-h-11 rounded-lg border border-line bg-card px-2 text-sm font-semibold"
                aria-label="Message kind"
              >
                <option value="chat">Chat</option>
                <option value="event">Event</option>
                <option value="decision">Decision</option>
              </select>
            ) : null}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              rows={2}
              placeholder={kind === 'chat' ? 'Message… (Enter to send)' : `Log a formal ${kind}…`}
              className="min-h-11 flex-1 resize-none rounded-lg border border-line bg-card px-3 py-2"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!body.trim() || send.isPending}
              className="min-h-11 rounded-full bg-accent px-5 font-bold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <p className="border-t border-line p-3 text-center text-sm font-semibold text-steel">
          {readOnly ? 'This war room is read-only.' : 'Observers can read but not post.'}
        </p>
      )}
    </div>
  )
}

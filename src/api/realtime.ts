// Live war-room updates over SSE. EventSource sends the session cookie
// automatically and reconnects on its own; on every (re)connect we refetch the
// message history so nothing is missed while disconnected.
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { IncidentMessage } from '@shared/types'

export function useIncidentStream(incidentId: number | undefined, enabled: boolean) {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled || incidentId === undefined) return
    const es = new EventSource(`/api/incidents/${incidentId}/stream`)

    es.onopen = () => {
      setConnected(true)
      // Catch up on anything posted while we weren't listening
      qc.invalidateQueries({ queryKey: ['incident-messages', incidentId] })
    }
    es.onerror = () => setConnected(false) // EventSource retries by itself

    es.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data) as IncidentMessage
      qc.setQueryData<IncidentMessage[]>(['incident-messages', incidentId], (old) => {
        if (!old) return [msg]
        if (old.some((m) => m.message_id === msg.message_id)) return old
        return [...old, msg]
      })
    })

    es.addEventListener('files', () => {
      // Someone uploaded/removed a document or changed folders
      qc.invalidateQueries({ queryKey: ['incident-files', incidentId] })
      qc.invalidateQueries({ queryKey: ['incident-folders', incidentId] })
    })

    es.addEventListener('incident', () => {
      // Lifecycle changed elsewhere (closed/reopened): refresh the room
      qc.invalidateQueries({ queryKey: ['incident', incidentId] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
    })

    return () => {
      es.close()
      setConnected(false)
    }
  }, [incidentId, enabled, qc])

  return { connected }
}

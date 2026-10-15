// SSE hub for war-room live updates. In-memory by design: single-process app
// (documented limitation — scaling out would need a message bus).
import type { Request, Response } from 'express'

const channels = new Map<number, Set<Response>>()

export function subscribe(incidentId: number, req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    // Hint reverse proxies (nginx/IIS ARR) not to buffer the stream
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 3000\n\n')

  let set = channels.get(incidentId)
  if (!set) {
    set = new Set()
    channels.set(incidentId, set)
  }
  set.add(res)

  req.on('close', () => {
    set.delete(res)
    if (set.size === 0) channels.delete(incidentId)
  })
}

/** Send one named event to every open stream of the incident. */
export function broadcast(incidentId: number, event: string, data: unknown, id?: number | string): void {
  const set = channels.get(incidentId)
  if (!set || set.size === 0) return
  const frame =
    (id !== undefined ? `id: ${id}\n` : '') +
    `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n\n`
  for (const res of set) {
    try {
      res.write(frame)
    } catch {
      set.delete(res)
    }
  }
}

// Keep-alive comment so idle corporate proxies don't drop the connection
setInterval(() => {
  for (const set of channels.values()) {
    for (const res of set) {
      try {
        res.write(': ping\n\n')
      } catch {
        set.delete(res)
      }
    }
  }
}, 25_000).unref()

import type { NextFunction, Request, Response } from 'express'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

export const notFound = (msg = 'Not found') => new HttpError(404, msg)
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details)
export const unauthorized = (msg = 'Not signed in') => new HttpError(401, msg)
export const forbidden = (msg = 'Not allowed') => new HttpError(403, msg)

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details ?? null })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}

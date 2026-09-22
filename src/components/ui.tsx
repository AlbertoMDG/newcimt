import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

export function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z" />
    </svg>
  )
}

/** Tap-to-call pill. Accent blue by default; variant="emergency" for crisis lines. */
export function PhoneLink({ number, label, variant = 'accent' }: {
  number: string | null
  label?: string
  variant?: 'accent' | 'emergency'
}) {
  if (!number) return null
  const href = 'tel:' + number.replace(/[^\d+]/g, '')
  const colors =
    variant === 'emergency'
      ? 'bg-emergency text-white active:bg-emergency-deep'
      : 'bg-accent text-white active:bg-accent-deep'
  return (
    <a
      href={href}
      className={`tel inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-semibold ${colors}`}
    >
      <PhoneIcon />
      {label ? <span className="text-sm font-medium text-white/75">{label}</span> : null}
      {number}
    </a>
  )
}

export function EmailLink({ email }: { email: string | null }) {
  if (!email) return null
  return (
    <a
      href={`mailto:${email}`}
      className="inline-flex min-h-11 items-center break-all text-sm font-semibold text-accent hover:text-accent-deep"
    >
      {email}
    </a>
  )
}

/** Initials avatar, accent-tinted (from the Claude Design contact card). */
export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
      {initials}
    </span>
  )
}

export function Accordion({ heading, children, defaultOpen = false }: {
  heading: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-base font-semibold"
        aria-expanded={open}
      >
        <span>{heading}</span>
        <span
          className={`text-steel transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        >
          ›
        </span>
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  )
}

export function PageHeader({ eyebrow, title, action }: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold tracking-[0.14em] text-steel uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-card p-4 shadow-card ${className}`}>{children}</div>
  )
}

export function EmptyState({ title, hint, to, cta }: {
  title: string
  hint?: string
  to?: string
  cta?: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
      <p className="font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-sm text-steel">{hint}</p> : null}
      {to && cta ? (
        <Link
          to={to}
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-white"
        >
          {cta}
        </Link>
      ) : null}
    </div>
  )
}

export const PAGE_SIZE = 50

/** Client-side pagination over a list. Returns the current page slice and controls. */
export function usePagination<T>(items: T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  return {
    pageItems: items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    page: safePage,
    pageCount,
    setPage,
    reset: () => setPage(0),
    rangeLabel:
      items.length === 0
        ? '0 results'
        : `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, items.length)} of ${items.length}`,
  }
}

export function Pagination({ page, pageCount, setPage }: {
  page: number
  pageCount: number
  setPage: (p: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
        className="min-h-11 rounded-full bg-mist px-5 text-sm font-semibold disabled:opacity-40"
      >
        ‹ Previous
      </button>
      <span className="tel text-sm font-semibold text-steel">
        Page {page + 1} of {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount - 1}
        onClick={() => setPage(page + 1)}
        className="min-h-11 rounded-full bg-mist px-5 text-sm font-semibold disabled:opacity-40"
      >
        Next ›
      </button>
    </div>
  )
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-steel">Loading…</p>
}

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <div className="rounded-2xl bg-emergency-soft p-4 text-sm shadow-card">
      <p className="font-semibold text-emergency-deep">Couldn't load this data.</p>
      <p className="mt-1 text-steel">{error instanceof Error ? error.message : 'Check that the API is running, then reload.'}</p>
    </div>
  )
}

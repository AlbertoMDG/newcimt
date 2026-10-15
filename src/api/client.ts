import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CimtRole, Constituent, ConstituentContact, Contact, ContactAssignment, ContentBlock,
  ContentPage, ContentSection, ContentTree, Customer, CustomerContact, DirectoryUser,
  ExternalAgencyContact, Incident, IncidentAuditEntry, IncidentFile, IncidentFolder,
  IncidentMember, IncidentMessage, InternalBookRow, ResourceItem, SessionUser, Site,
  Stats, WarRoom,
} from '@shared/types'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    // Session expired mid-use: send the user back to login (except the probe itself)
    if (res.status === 401 && path !== '/auth/me' && !location.pathname.startsWith('/login')) {
      location.assign('/login')
    }
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

// ---------- auth ----------

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<SessionUser>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  })

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api<SessionUser>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (user) => qc.setQueryData(['me'], user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear()
      location.assign('/login')
    },
  })
}

const qs = (params?: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '')
  return entries.length
    ? '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
    : ''
}

export const useSites = (region?: string) =>
  useQuery({ queryKey: ['sites', region], queryFn: () => api<Site[]>(`/sites${qs({ region })}`) })

export const useRoles = () =>
  useQuery({ queryKey: ['roles'], queryFn: () => api<CimtRole[]>('/roles'), staleTime: Infinity })

export const useContacts = () =>
  useQuery({ queryKey: ['contacts'], queryFn: () => api<Contact[]>('/contacts') })

export const useAssignments = (filters?: { contactId?: number; siteId?: number }) =>
  useQuery({
    queryKey: ['assignments', filters],
    queryFn: () => api<ContactAssignment[]>(`/assignments${qs(filters)}`),
  })

export const useInternalBook = () =>
  useQuery({
    queryKey: ['internal-book'],
    queryFn: () => api<InternalBookRow[]>('/internal-book'),
    staleTime: 5 * 60_000,
  })

export const useExternalContacts = (filters?: { siteId?: number; type?: string }) =>
  useQuery({
    queryKey: ['external-contacts', filters],
    queryFn: () => api<ExternalAgencyContact[]>(`/external-contacts${qs(filters)}`),
  })

export const useCustomers = () =>
  useQuery({ queryKey: ['customers'], queryFn: () => api<Customer[]>('/customers') })

export const useCustomerContacts = (customerId?: number) =>
  useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: () => api<CustomerContact[]>(`/customer-contacts${qs({ customerId })}`),
  })

export const useConstituents = (siteId?: number) =>
  useQuery({
    queryKey: ['constituents', siteId],
    queryFn: () => api<Constituent[]>(`/constituents${qs({ siteId })}`),
  })

export const useConstituentContacts = () =>
  useQuery({
    queryKey: ['constituent-contacts'],
    queryFn: () => api<ConstituentContact[]>('/constituent-contacts'),
  })

export const useWarRooms = () =>
  useQuery({ queryKey: ['war-rooms'], queryFn: () => api<WarRoom[]>('/war-rooms') })

export const useContentPages = (filters?: { book?: string; kind?: string }) =>
  useQuery({
    queryKey: ['content-pages', filters],
    queryFn: () => api<ContentPage[]>(`/content/pages${qs(filters)}`),
  })

export const useContentTree = (slug: string) =>
  useQuery({
    queryKey: ['content-tree', slug],
    queryFn: () => api<ContentTree>(`/content/tree/${slug}`),
    staleTime: 5 * 60_000,
  })

export const useContentSections = (pageId?: number) =>
  useQuery({
    queryKey: ['content-sections', pageId],
    queryFn: () => api<ContentSection[]>(`/content/sections${qs({ pageId })}`),
    enabled: pageId !== undefined,
  })

export const useContentBlocks = (sectionId?: number) =>
  useQuery({
    queryKey: ['content-blocks', sectionId],
    queryFn: () => api<ContentBlock[]>(`/content/blocks${qs({ sectionId })}`),
    enabled: sectionId !== undefined,
  })

export const useResources = () =>
  useQuery({ queryKey: ['resources'], queryFn: () => api<ResourceItem[]>('/resources') })

export const useStats = () =>
  useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/stats') })

// ---------- digital war rooms (incidents) ----------

export const useIncidents = () =>
  useQuery({
    queryKey: ['incidents'],
    queryFn: () => api<Incident[]>('/incidents'),
    staleTime: 30_000,
  })

export const useIncident = (id?: number) =>
  useQuery({
    queryKey: ['incident', id],
    queryFn: () => api<Incident>(`/incidents/${id}`),
    enabled: id !== undefined,
  })

export const useIncidentMembers = (id?: number) =>
  useQuery({
    queryKey: ['incident-members', id],
    queryFn: () => api<IncidentMember[]>(`/incidents/${id}/members`),
    enabled: id !== undefined,
  })

export const useIncidentMessages = (id?: number) =>
  useQuery({
    queryKey: ['incident-messages', id],
    queryFn: () => api<IncidentMessage[]>(`/incidents/${id}/messages`),
    enabled: id !== undefined,
    // The SSE stream keeps this cache current; refetch happens on (re)connect
    staleTime: Infinity,
  })

/** Multipart upload — no JSON Content-Type header so the browser sets the boundary. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', body: form })
  if (!res.ok) {
    if (res.status === 401 && !location.pathname.startsWith('/login')) location.assign('/login')
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Upload failed (${res.status})`)
  }
  return res.json()
}

export const useIncidentFolders = (id?: number) =>
  useQuery({
    queryKey: ['incident-folders', id],
    queryFn: () => api<IncidentFolder[]>(`/incidents/${id}/folders`),
    enabled: id !== undefined,
  })

export const useIncidentFiles = (id?: number) =>
  useQuery({
    queryKey: ['incident-files', id],
    queryFn: () => api<IncidentFile[]>(`/incidents/${id}/files`),
    enabled: id !== undefined,
  })

/** Commander/admin only — the server answers 403 for other roles. */
export const useIncidentAudit = (id?: number, enabled = true) =>
  useQuery({
    queryKey: ['incident-audit', id],
    queryFn: () => api<IncidentAuditEntry[]>(`/incidents/${id}/audit`),
    enabled: enabled && id !== undefined,
  })

/** POST the export and hand the ZIP to the browser as a download. */
export async function downloadIncidentExport(incidentId: number): Promise<void> {
  const res = await fetch(`/api/incidents/${incidentId}/export`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Export failed (${res.status})`)
  }
  const blob = await res.blob()
  const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('Content-Disposition') ?? '')?.[1]
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name ? decodeURIComponent(name) : `incident-${incidentId}-record.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const useDirectory = () =>
  useQuery({
    queryKey: ['directory'],
    queryFn: () => api<DirectoryUser[]>('/directory'),
    staleTime: 5 * 60_000,
  })

/** Ad-hoc mutation (any path/method/body) that invalidates the given query keys. */
export function useApiMutation(invalidates: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    onSuccess: () =>
      Promise.all(invalidates.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })
}

/** Generic CRUD mutations for an endpoint; invalidates the given query key prefixes. */
export function useCrud(endpoint: string, invalidates: string[]) {
  const qc = useQueryClient()
  const invalidate = () =>
    Promise.all(invalidates.map((k) => qc.invalidateQueries({ queryKey: [k] })))

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api(`${endpoint}`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api(`${endpoint}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api(`${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
  return { create, update, remove }
}

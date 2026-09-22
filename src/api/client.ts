import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CimtRole, Constituent, ConstituentContact, Contact, ContactAssignment, ContentBlock,
  ContentPage, ContentSection, ContentTree, Customer, CustomerContact,
  ExternalAgencyContact, InternalBookRow, ResourceItem, Site, Stats, WarRoom,
} from '@shared/types'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
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

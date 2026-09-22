// DTOs shared between the React app and the Express API.

export interface Site {
  site_id: number
  code: string
  name: string
  region: string | null
  country: string | null
  address: string | null
  city: string | null
  state: string | null
  postal: string | null
  is_active: boolean
  updated_at: string
}

export interface CimtRole {
  role_id: number
  name: string
  sort_order: number
}

export interface Contact {
  contact_id: number
  full_name: string
  title: string | null
  desk_phone: string | null
  preferred_phone: string | null
  alternate_phone: string | null
  preferred_email: string | null
  alternate_email: string | null
  assistant_info: string | null
  language: string | null
  notes: string | null
  updated_at: string
}

export interface ContactAssignment {
  assignment_id: number
  contact_id: number
  site_id: number | null
  role_id: number
  tier: 'primary' | 'alternate'
  scope: 'site' | 'corporate'
  sort_order: number
}

export interface InternalBookRow {
  site_id: number | null
  site_name: string | null
  region: string | null
  address: string | null
  role_id: number
  role_name: string
  role_sort: number
  assignment_id: number
  tier: 'primary' | 'alternate'
  scope: 'site' | 'corporate'
  contact_id: number
  full_name: string
  title: string | null
  desk_phone: string | null
  preferred_phone: string | null
  alternate_phone: string | null
  preferred_email: string | null
  alternate_email: string | null
  assistant_info: string | null
}

export type AgencyType =
  | 'OSHA' | 'SERC' | 'LEPC' | 'USDA' | 'FDA' | 'GFSI' | 'HOTLINE' | 'MEDIA' | 'OTHER'

export interface ExternalAgencyContact {
  id: number
  site_id: number | null
  agency_type: AgencyType
  contact_name: string | null
  phone: string | null
  detail: string | null
  comment: string | null
  sort_order: number
  updated_at: string
}

export interface Customer {
  customer_id: number
  name: string
  region: string | null
  notes: string | null
  updated_at: string
}

export interface CustomerContact {
  id: number
  customer_id: number
  side: 'osi_primary' | 'osi_alternate' | 'customer'
  name: string | null
  title: string | null
  work_phone: string | null
  cell_phone: string | null
  email: string | null
  note: string | null
  sort_order: number
}

export interface Constituent {
  constituent_id: number
  site_id: number
  section: string
  section_sort: number
  place_name: string
  address: string | null
  notes: string | null
  updated_at: string
}

export interface ConstituentContact {
  id: number
  constituent_id: number
  name: string | null
  title: string | null
  phone: string | null
  cell: string | null
  email: string | null
  sort_order: number
}

export interface WarRoom {
  war_room_id: number
  site_id: number
  war_room_location: string | null
  war_room_phone: string | null
  direct_line: string | null
  direct_fax: string | null
  conference_phone: string | null
  conference_access_code: string | null
  revised_at: string | null
  updated_at: string
}

export interface ContentPage {
  page_id: number
  slug: string
  kind: 'guide' | 'checklist' | 'static'
  book: string | null
  locale: string
  title: string
  sort_order: number
  updated_at: string
}

export interface ContentSection {
  section_id: number
  page_id: number
  heading: string
  sort_order: number
}

export interface ContentBlock {
  block_id: number
  section_id: number
  kind: 'markdown' | 'checklist_item'
  body: string
  sort_order: number
}

export interface ContentTree extends ContentPage {
  sections: (ContentSection & { blocks: ContentBlock[] })[]
}

export interface ResourceItem {
  resource_id: number
  title: string
  category: string | null
  file_name: string | null
  url: string | null
  sort_order: number
  updated_at: string
}

export interface Stats {
  sites: number
  contacts: number
  assignments: number
  external_contacts: number
  customers: number
  constituents: number
  war_rooms: number
  content_pages: number
  resources: number
}

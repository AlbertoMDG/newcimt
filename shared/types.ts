// DTOs shared between the React app and the Express API.

export interface SessionUser {
  user_id: number
  email: string
  display_name: string
  is_admin: boolean
}

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

// Field names mirror the legacy dbo.war_rooms columns ("workspace" is the UI label).
export interface Workspace {
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
  incidents: number
  active_incidents: number
  users: number
}

// ---------- incident workspaces ----------

export type IncidentType =
  | 'food_safety' | 'workplace' | 'environmental' | 'security'
  | 'cyber' | 'product_recall' | 'other'
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'active' | 'closed' | 'archived'
export type IncidentRole = 'commander' | 'member' | 'observer'

export interface Incident {
  incident_id: number
  title: string
  incident_type: IncidentType
  site_id: number | null
  severity: IncidentSeverity
  status: IncidentStatus
  summary: string | null
  key_version: number
  created_at: string
  created_by: number
  closed_at: string | null
  closed_by: number | null
  updated_at: string
  /** caller's role in this room; null for an admin who is not a member */
  my_role: IncidentRole | null
  member_count?: number
}

export interface IncidentMember {
  member_id: number
  incident_id: number
  user_id: number
  role: IncidentRole
  added_at: string
  display_name: string
  email: string
}

export interface UserAccount {
  user_id: number
  email: string
  display_name: string
  entra_oid: string | null
  is_admin: boolean
  is_active: boolean
  created_at: string
  last_login_at: string | null
  updated_at: string
}

export interface DirectoryUser {
  user_id: number
  display_name: string
  email: string
}

export interface IncidentFolder {
  folder_id: number
  incident_id: number
  parent_folder_id: number | null
  name: string
  created_at: string
  created_by: number
}

export interface IncidentFile {
  file_id: number
  incident_id: number
  folder_id: number | null
  original_name: string
  content_type: string | null
  size_bytes: number
  uploaded_at: string
  uploaded_by: number
  uploader_name: string
}

export interface IncidentAuditEntry {
  audit_id: number
  incident_id: number
  user_id: number | null
  action: string
  detail: string | null
  created_at: string
  actor_name: string | null
}

export type MessageKind = 'chat' | 'event' | 'decision' | 'system'

export interface IncidentMessage {
  message_id: number
  incident_id: number
  user_id: number
  kind: MessageKind
  body: string
  created_at: string
  display_name: string
}

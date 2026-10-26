// Config that drives the generic admin CRUD screens.

export type OptionSource = 'sites' | 'roles' | 'contacts' | 'customers' | 'constituents'

export interface FieldSpec {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'date' | 'select'
  required?: boolean
  options?: { value: string; label: string }[]
  optionSource?: OptionSource
  /** select only: allow empty (null) choice */
  nullable?: boolean
  /** initial value when creating a new record (e.g. checkboxes that default on) */
  defaultValue?: string | number | boolean
}

export interface ColumnSpec {
  key: string
  label: string
  /** FK columns: resolve display name from this source */
  lookup?: OptionSource
}

export interface EntityConfig {
  title: string
  endpoint: string
  idKey: string
  /** query keys to invalidate after writes */
  invalidates: string[]
  columns: ColumnSpec[]
  fields: FieldSpec[]
  searchKeys: string[]
}

const tierOptions = [
  { value: 'primary', label: 'Primary' },
  { value: 'alternate', label: 'Alternate' },
]

const regionOptions = [
  { value: 'NA', label: 'North America' },
  { value: 'EU', label: 'Europe' },
  { value: 'APAC', label: 'Asia Pacific' },
]

export const entities: Record<string, EntityConfig> = {
  users: {
    title: 'Users',
    endpoint: '/users',
    idKey: 'user_id',
    invalidates: ['users', 'directory', 'stats'],
    columns: [
      { key: 'display_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'is_admin', label: 'Admin' },
      { key: 'is_active', label: 'Active' },
    ],
    searchKeys: ['display_name', 'email'],
    fields: [
      { name: 'display_name', label: 'Name', required: true },
      { name: 'email', label: 'Email', required: true },
      { name: 'password', label: 'Password (min 10 chars; leave blank to keep current)' },
      { name: 'is_admin', label: 'Administrator', type: 'checkbox' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },
  sites: {
    title: 'Sites',
    endpoint: '/sites',
    idKey: 'site_id',
    invalidates: ['sites', 'internal-book', 'stats'],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'region', label: 'Region' },
      { key: 'address', label: 'Address' },
    ],
    searchKeys: ['name', 'address', 'region'],
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'code', label: 'Code (unique)', required: true },
      { name: 'region', label: 'Region', type: 'select', options: regionOptions, nullable: true },
      { name: 'country', label: 'Country' },
      { name: 'address', label: 'Address', type: 'textarea' },
    ],
  },
  contacts: {
    title: 'Contacts',
    endpoint: '/contacts',
    idKey: 'contact_id',
    invalidates: ['contacts', 'internal-book', 'stats'],
    columns: [
      { key: 'full_name', label: 'Name' },
      { key: 'title', label: 'Title' },
      { key: 'preferred_phone', label: 'Phone' },
      { key: 'preferred_email', label: 'Email' },
    ],
    searchKeys: ['full_name', 'title', 'preferred_email', 'preferred_phone'],
    fields: [
      { name: 'full_name', label: 'Full name', required: true },
      { name: 'title', label: 'Job title' },
      { name: 'preferred_phone', label: 'Preferred phone' },
      { name: 'alternate_phone', label: 'Alternate phone' },
      { name: 'desk_phone', label: 'Desk phone' },
      { name: 'preferred_email', label: 'Preferred email' },
      { name: 'alternate_email', label: 'Alternate email' },
      { name: 'assistant_info', label: 'Assistant', type: 'textarea' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  roles: {
    title: 'CIMT roles',
    endpoint: '/roles',
    idKey: 'role_id',
    invalidates: ['roles', 'internal-book'],
    columns: [
      { key: 'name', label: 'Function' },
      { key: 'sort_order', label: 'Order' },
    ],
    searchKeys: ['name'],
    fields: [
      { name: 'name', label: 'Function name', required: true },
      { name: 'sort_order', label: 'Display order', type: 'number' },
    ],
  },
  assignments: {
    title: 'Role assignments',
    endpoint: '/assignments',
    idKey: 'assignment_id',
    invalidates: ['assignments', 'internal-book', 'stats'],
    columns: [
      { key: 'contact_id', label: 'Contact', lookup: 'contacts' },
      { key: 'site_id', label: 'Site', lookup: 'sites' },
      { key: 'role_id', label: 'CIMT role', lookup: 'roles' },
      { key: 'tier', label: 'Tier' },
    ],
    searchKeys: [],
    fields: [
      { name: 'contact_id', label: 'Contact', type: 'select', optionSource: 'contacts', required: true },
      { name: 'site_id', label: 'Site', type: 'select', optionSource: 'sites', nullable: true },
      { name: 'role_id', label: 'CIMT role', type: 'select', optionSource: 'roles', required: true },
      { name: 'tier', label: 'Tier', type: 'select', options: tierOptions, required: true },
      {
        name: 'scope', label: 'Scope', type: 'select', required: true,
        options: [
          { value: 'site', label: 'Site' },
          { value: 'corporate', label: 'Corporate' },
        ],
      },
    ],
  },
  external: {
    title: 'External agencies & hotlines',
    endpoint: '/external-contacts',
    idKey: 'id',
    invalidates: ['external-contacts', 'stats'],
    columns: [
      { key: 'agency_type', label: 'Type' },
      { key: 'site_id', label: 'Site', lookup: 'sites' },
      { key: 'contact_name', label: 'Contact' },
      { key: 'phone', label: 'Phone' },
    ],
    searchKeys: ['agency_type', 'contact_name', 'phone'],
    fields: [
      {
        name: 'agency_type', label: 'Type', type: 'select', required: true,
        options: ['OSHA', 'SERC', 'LEPC', 'USDA', 'FDA', 'GFSI', 'HOTLINE', 'MEDIA', 'OTHER']
          .map((v) => ({ value: v, label: v })),
      },
      { name: 'site_id', label: 'Site (empty = national)', type: 'select', optionSource: 'sites', nullable: true },
      { name: 'contact_name', label: 'Contact / office name' },
      { name: 'phone', label: 'Phone' },
      { name: 'detail', label: 'Detail (district, address…)', type: 'textarea' },
      { name: 'comment', label: 'Comment', type: 'textarea' },
    ],
  },
  customers: {
    title: 'Customers',
    endpoint: '/customers',
    idKey: 'customer_id',
    invalidates: ['customers', 'stats'],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'region', label: 'Region' },
    ],
    searchKeys: ['name'],
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'region', label: 'Region', type: 'select', options: regionOptions, nullable: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  'customer-contacts': {
    title: 'Customer contacts',
    endpoint: '/customer-contacts',
    idKey: 'id',
    invalidates: ['customer-contacts', 'stats'],
    columns: [
      { key: 'customer_id', label: 'Customer', lookup: 'customers' },
      { key: 'side', label: 'Side' },
      { key: 'name', label: 'Name' },
      { key: 'work_phone', label: 'Work phone' },
    ],
    searchKeys: ['name', 'email'],
    fields: [
      { name: 'customer_id', label: 'Customer', type: 'select', optionSource: 'customers', required: true },
      {
        name: 'side', label: 'Side', type: 'select', required: true,
        options: [
          { value: 'osi_primary', label: 'OSI primary' },
          { value: 'osi_alternate', label: 'OSI alternate' },
          { value: 'customer', label: 'Customer side' },
        ],
      },
      { name: 'name', label: 'Name' },
      { name: 'title', label: 'Title' },
      { name: 'work_phone', label: 'Work phone' },
      { name: 'cell_phone', label: 'Cell phone' },
      { name: 'email', label: 'Email' },
      { name: 'note', label: 'Note' },
    ],
  },
  constituents: {
    title: 'Constituents',
    endpoint: '/constituents',
    idKey: 'constituent_id',
    invalidates: ['constituents', 'stats'],
    columns: [
      { key: 'site_id', label: 'Site', lookup: 'sites' },
      { key: 'section', label: 'Section' },
      { key: 'place_name', label: 'Place' },
    ],
    searchKeys: ['section', 'place_name'],
    fields: [
      { name: 'site_id', label: 'Site', type: 'select', optionSource: 'sites', required: true },
      { name: 'section', label: 'Section (Police, Fire…)', required: true },
      { name: 'place_name', label: 'Place name', required: true },
      { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  'constituent-contacts': {
    title: 'Constituent contacts',
    endpoint: '/constituent-contacts',
    idKey: 'id',
    invalidates: ['constituent-contacts', 'stats'],
    columns: [
      { key: 'constituent_id', label: 'Place', lookup: 'constituents' },
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
    ],
    searchKeys: ['name', 'phone'],
    fields: [
      { name: 'constituent_id', label: 'Place', type: 'select', optionSource: 'constituents', required: true },
      { name: 'name', label: 'Name' },
      { name: 'title', label: 'Title' },
      { name: 'phone', label: 'Phone' },
      { name: 'cell', label: 'Cell' },
      { name: 'email', label: 'Email' },
    ],
  },
  workspaces: {
    title: 'Workspaces (Schedule 1A)',
    endpoint: '/workspaces',
    idKey: 'war_room_id',
    invalidates: ['workspaces', 'stats'],
    columns: [
      { key: 'site_id', label: 'Site', lookup: 'sites' },
      { key: 'war_room_location', label: 'Location' },
      { key: 'war_room_phone', label: 'Phone' },
    ],
    searchKeys: ['war_room_location'],
    fields: [
      { name: 'site_id', label: 'Site', type: 'select', optionSource: 'sites', required: true },
      { name: 'war_room_location', label: 'Workspace location', type: 'textarea' },
      { name: 'war_room_phone', label: 'Workspace phone' },
      { name: 'direct_line', label: 'Direct line' },
      { name: 'direct_fax', label: 'Direct fax' },
      { name: 'conference_phone', label: 'Conference phone' },
      { name: 'conference_access_code', label: 'Access code' },
      { name: 'revised_at', label: 'Revised on', type: 'date' },
    ],
  },
  resources: {
    title: 'Forms & resources',
    endpoint: '/resources',
    idKey: 'resource_id',
    invalidates: ['resources', 'stats'],
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'file_name', label: 'File' },
    ],
    searchKeys: ['title', 'category'],
    fields: [
      { name: 'title', label: 'Title', required: true },
      { name: 'category', label: 'Category' },
      { name: 'file_name', label: 'File name (served from /files/)' },
      { name: 'url', label: 'External URL' },
    ],
  },
}

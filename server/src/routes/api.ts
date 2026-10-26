import { Router } from 'express'
import { z } from 'zod'
import { getPool, sql } from '../db.ts'
import { makeCrudRouter } from '../crud.ts'
import { notFound } from '../errors.ts'
import { adminWrites, requireAdmin, requireAuth } from '../auth.ts'
import incidents from './incidents.ts'
import users from './users.ts'

const api = Router()

const str = (max: number) => z.string().trim().min(1).max(max)
const optStr = (max: number) => z.string().trim().max(max).nullable().optional()
  .transform((v) => (v === '' ? null : v ?? null))
const sort = z.coerce.number().int().default(0)

// ---------- health (public, for monitoring) ----------
api.get('/health', async (_req, res) => {
  try {
    const pool = await getPool()
    await pool.request().query('SELECT 1 AS ok')
    res.json({ status: 'ok', db: 'ok' })
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' })
  }
})

// Everything below is behind login; /api/auth/* (mounted separately) handles sign-in.
api.use(requireAuth)

// Member-gated writes — must sit above the adminWrites gate
api.use('/incidents', incidents)

// Active-user directory so commanders can pick members (full CRUD stays admin-only)
api.get('/directory', async (_req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().query(
      'SELECT user_id, display_name, email FROM dbo.users WHERE is_active = 1 ORDER BY display_name')
    res.json(r.recordset)
  } catch (e) { next(e) }
})

// User accounts: every verb admin-only
api.use('/users', requireAdmin, users)

// All entities below are admin-managed reference data: reads for any signed-in
// user, writes admin-only.
api.use(adminWrites)

// ---------- sites ----------
api.use('/sites', makeCrudRouter({
  table: 'dbo.sites',
  idColumn: 'site_id',
  orderBy: 'name',
  hasUpdatedAt: true,
  filters: { region: 'region' },
  columns: {
    code: sql.NVarChar(64), name: sql.NVarChar(200), region: sql.NVarChar(32),
    country: sql.NVarChar(100), address: sql.NVarChar(500), city: sql.NVarChar(100),
    state: sql.NVarChar(100), postal: sql.NVarChar(30), is_active: sql.Bit,
  },
  schema: z.object({
    code: str(64), name: str(200), region: optStr(32), country: optStr(100),
    address: optStr(500), city: optStr(100), state: optStr(100), postal: optStr(30),
    is_active: z.coerce.boolean().default(true),
  }),
}))

// ---------- roles ----------
api.use('/roles', makeCrudRouter({
  table: 'dbo.cimt_roles',
  idColumn: 'role_id',
  orderBy: 'sort_order',
  columns: { name: sql.NVarChar(100), sort_order: sql.Int },
  schema: z.object({ name: str(100), sort_order: sort }),
}))

// ---------- contacts ----------
api.use('/contacts', makeCrudRouter({
  table: 'dbo.contacts',
  idColumn: 'contact_id',
  orderBy: 'full_name',
  hasUpdatedAt: true,
  columns: {
    full_name: sql.NVarChar(200), title: sql.NVarChar(200), desk_phone: sql.NVarChar(50),
    preferred_phone: sql.NVarChar(50), alternate_phone: sql.NVarChar(50),
    preferred_email: sql.NVarChar(256), alternate_email: sql.NVarChar(256),
    assistant_info: sql.NVarChar(500), language: sql.NVarChar(50), notes: sql.NVarChar(sql.MAX),
  },
  schema: z.object({
    full_name: str(200), title: optStr(200), desk_phone: optStr(50),
    preferred_phone: optStr(50), alternate_phone: optStr(50),
    preferred_email: optStr(256), alternate_email: optStr(256),
    assistant_info: optStr(500), language: optStr(50), notes: optStr(1_000_000),
  }),
}))

// ---------- contact assignments (flat, filterable) ----------
api.use('/assignments', makeCrudRouter({
  table: 'dbo.contact_assignments',
  idColumn: 'assignment_id',
  orderBy: 'sort_order',
  filters: { contactId: 'contact_id', siteId: 'site_id', roleId: 'role_id' },
  columns: {
    contact_id: sql.Int, site_id: sql.Int, role_id: sql.Int,
    tier: sql.NVarChar(16), scope: sql.NVarChar(16), sort_order: sql.Int,
  },
  schema: z.object({
    contact_id: z.coerce.number().int(),
    site_id: z.coerce.number().int().nullable().optional(),
    role_id: z.coerce.number().int(),
    tier: z.enum(['primary', 'alternate']).default('primary'),
    scope: z.enum(['site', 'corporate']).default('site'),
    sort_order: sort,
  }),
}))

// ---------- internal book (denormalized read model) ----------
api.get('/internal-book', async (_req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().query(`
      SELECT s.site_id, s.name AS site_name, s.region, s.address,
             ro.role_id, ro.name AS role_name, ro.sort_order AS role_sort,
             a.assignment_id, a.tier, a.scope,
             c.contact_id, c.full_name, c.title, c.desk_phone, c.preferred_phone,
             c.alternate_phone, c.preferred_email, c.alternate_email, c.assistant_info
      FROM dbo.contact_assignments a
      JOIN dbo.contacts c ON c.contact_id = a.contact_id
      JOIN dbo.cimt_roles ro ON ro.role_id = a.role_id
      LEFT JOIN dbo.sites s ON s.site_id = a.site_id
      ORDER BY s.name, ro.sort_order, a.tier DESC, c.full_name`)
    res.json(r.recordset)
  } catch (e) { next(e) }
})

// ---------- external agency contacts ----------
api.use('/external-contacts', makeCrudRouter({
  table: 'dbo.external_agency_contacts',
  idColumn: 'id',
  orderBy: 'sort_order, agency_type',
  hasUpdatedAt: true,
  filters: { siteId: 'site_id', type: 'agency_type' },
  columns: {
    site_id: sql.Int, agency_type: sql.NVarChar(16), contact_name: sql.NVarChar(200),
    phone: sql.NVarChar(100), detail: sql.NVarChar(sql.MAX), comment: sql.NVarChar(sql.MAX),
    sort_order: sql.Int,
  },
  schema: z.object({
    site_id: z.coerce.number().int().nullable().optional(),
    agency_type: z.enum(['OSHA', 'SERC', 'LEPC', 'USDA', 'FDA', 'GFSI', 'HOTLINE', 'MEDIA', 'OTHER']),
    contact_name: optStr(200), phone: optStr(100),
    detail: optStr(1_000_000), comment: optStr(1_000_000), sort_order: sort,
  }),
}))

// ---------- customers ----------
api.use('/customers', makeCrudRouter({
  table: 'dbo.customers',
  idColumn: 'customer_id',
  orderBy: 'name',
  hasUpdatedAt: true,
  columns: { name: sql.NVarChar(200), region: sql.NVarChar(32), notes: sql.NVarChar(sql.MAX) },
  schema: z.object({ name: str(200), region: optStr(32), notes: optStr(1_000_000) }),
}))

api.use('/customer-contacts', makeCrudRouter({
  table: 'dbo.customer_contacts',
  idColumn: 'id',
  orderBy: 'sort_order',
  filters: { customerId: 'customer_id' },
  columns: {
    customer_id: sql.Int, side: sql.NVarChar(16), name: sql.NVarChar(200),
    title: sql.NVarChar(200), work_phone: sql.NVarChar(50), cell_phone: sql.NVarChar(50),
    email: sql.NVarChar(256), note: sql.NVarChar(500), sort_order: sql.Int,
  },
  schema: z.object({
    customer_id: z.coerce.number().int(),
    side: z.enum(['osi_primary', 'osi_alternate', 'customer']),
    name: optStr(200), title: optStr(200), work_phone: optStr(50), cell_phone: optStr(50),
    email: optStr(256), note: optStr(500), sort_order: sort,
  }),
}))

// ---------- constituents ----------
api.use('/constituents', makeCrudRouter({
  table: 'dbo.constituents',
  idColumn: 'constituent_id',
  orderBy: 'section_sort, place_name',
  hasUpdatedAt: true,
  filters: { siteId: 'site_id' },
  columns: {
    site_id: sql.Int, section: sql.NVarChar(100), section_sort: sql.Int,
    place_name: sql.NVarChar(200), address: sql.NVarChar(500), notes: sql.NVarChar(sql.MAX),
  },
  schema: z.object({
    site_id: z.coerce.number().int(), section: str(100), section_sort: sort,
    place_name: str(200), address: optStr(500), notes: optStr(1_000_000),
  }),
}))

api.use('/constituent-contacts', makeCrudRouter({
  table: 'dbo.constituent_contacts',
  idColumn: 'id',
  orderBy: 'sort_order',
  filters: { constituentId: 'constituent_id' },
  columns: {
    constituent_id: sql.Int, name: sql.NVarChar(200), title: sql.NVarChar(200),
    phone: sql.NVarChar(50), cell: sql.NVarChar(50), email: sql.NVarChar(256), sort_order: sql.Int,
  },
  schema: z.object({
    constituent_id: z.coerce.number().int(), name: optStr(200), title: optStr(200),
    phone: optStr(50), cell: optStr(50), email: optStr(256), sort_order: sort,
  }),
}))

// ---------- workspaces (legacy dbo.war_rooms table) ----------
api.use('/workspaces', makeCrudRouter({
  table: 'dbo.war_rooms',
  idColumn: 'war_room_id',
  orderBy: 'war_room_id',
  hasUpdatedAt: true,
  filters: { siteId: 'site_id' },
  columns: {
    site_id: sql.Int, war_room_location: sql.NVarChar(300), war_room_phone: sql.NVarChar(50),
    direct_line: sql.NVarChar(50), direct_fax: sql.NVarChar(50),
    conference_phone: sql.NVarChar(50), conference_access_code: sql.NVarChar(50),
    revised_at: sql.Date,
  },
  schema: z.object({
    site_id: z.coerce.number().int(),
    war_room_location: optStr(300), war_room_phone: optStr(50),
    direct_line: optStr(50), direct_fax: optStr(50),
    conference_phone: optStr(50), conference_access_code: optStr(50),
    revised_at: z.coerce.date().nullable().optional(),
  }),
}))

// ---------- content ----------
api.use('/content/pages', makeCrudRouter({
  table: 'dbo.content_pages',
  idColumn: 'page_id',
  orderBy: 'sort_order, title',
  hasUpdatedAt: true,
  filters: { book: 'book', kind: 'kind', slug: 'slug' },
  columns: {
    slug: sql.NVarChar(100), kind: sql.NVarChar(16), book: sql.NVarChar(32),
    locale: sql.NVarChar(8), title: sql.NVarChar(200), sort_order: sql.Int,
  },
  schema: z.object({
    slug: str(100), kind: z.enum(['guide', 'checklist', 'static']).default('guide'),
    book: optStr(32), locale: z.string().trim().max(8).default('en'),
    title: str(200), sort_order: sort,
  }),
}))

// full tree for public render
api.get('/content/tree/:slug', async (req, res, next) => {
  try {
    const pool = await getPool()
    const page = (await pool.request().input('slug', sql.NVarChar(100), req.params.slug)
      .query('SELECT * FROM dbo.content_pages WHERE slug = @slug')).recordset[0]
    if (!page) throw notFound('Page not found')
    const sections = (await pool.request().input('pid', sql.Int, page.page_id)
      .query('SELECT * FROM dbo.content_sections WHERE page_id = @pid ORDER BY sort_order, section_id')).recordset
    const blocks = (await pool.request().input('pid', sql.Int, page.page_id)
      .query(`SELECT b.* FROM dbo.content_blocks b
              JOIN dbo.content_sections s ON s.section_id = b.section_id
              WHERE s.page_id = @pid ORDER BY b.sort_order, b.block_id`)).recordset
    res.json({
      ...page,
      sections: sections.map((s: { section_id: number }) => ({
        ...s,
        blocks: blocks.filter((b: { section_id: number }) => b.section_id === s.section_id),
      })),
    })
  } catch (e) { next(e) }
})

api.use('/content/sections', makeCrudRouter({
  table: 'dbo.content_sections',
  idColumn: 'section_id',
  orderBy: 'sort_order, section_id',
  filters: { pageId: 'page_id' },
  columns: { page_id: sql.Int, heading: sql.NVarChar(300), sort_order: sql.Int },
  schema: z.object({ page_id: z.coerce.number().int(), heading: str(300), sort_order: sort }),
}))

api.use('/content/blocks', makeCrudRouter({
  table: 'dbo.content_blocks',
  idColumn: 'block_id',
  orderBy: 'sort_order, block_id',
  filters: { sectionId: 'section_id' },
  columns: { section_id: sql.Int, kind: sql.NVarChar(16), body: sql.NVarChar(sql.MAX), sort_order: sql.Int },
  schema: z.object({
    section_id: z.coerce.number().int(),
    kind: z.enum(['markdown', 'checklist_item']).default('markdown'),
    body: z.string().min(1), sort_order: sort,
  }),
}))

// ---------- resources ----------
api.use('/resources', makeCrudRouter({
  table: 'dbo.resources',
  idColumn: 'resource_id',
  orderBy: 'sort_order, title',
  hasUpdatedAt: true,
  columns: {
    title: sql.NVarChar(200), category: sql.NVarChar(100),
    file_name: sql.NVarChar(300), url: sql.NVarChar(500), sort_order: sql.Int,
  },
  schema: z.object({
    title: str(200), category: optStr(100), file_name: optStr(300),
    url: optStr(500), sort_order: sort,
  }),
}))

// ---------- dashboard stats ----------
api.get('/stats', async (_req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.sites) AS sites,
        (SELECT COUNT(*) FROM dbo.contacts) AS contacts,
        (SELECT COUNT(*) FROM dbo.contact_assignments) AS assignments,
        (SELECT COUNT(*) FROM dbo.external_agency_contacts) AS external_contacts,
        (SELECT COUNT(*) FROM dbo.customers) AS customers,
        (SELECT COUNT(*) FROM dbo.constituents) AS constituents,
        (SELECT COUNT(*) FROM dbo.war_rooms) AS war_rooms,
        (SELECT COUNT(*) FROM dbo.content_pages) AS content_pages,
        (SELECT COUNT(*) FROM dbo.resources) AS resources,
        (SELECT COUNT(*) FROM dbo.incidents) AS incidents,
        (SELECT COUNT(*) FROM dbo.incidents WHERE status = 'active') AS active_incidents,
        (SELECT COUNT(*) FROM dbo.users) AS users`)
    res.json(r.recordset[0])
  } catch (e) { next(e) }
})

export default api

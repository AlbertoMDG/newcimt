// Imports docs/CIMT Contact Information Form.xlsx (Microsoft Forms submissions)
// into sites / contacts / contact_assignments, with cleanup:
//  - NBSP + LRM removal, trimming
//  - NA / N/A / - / NO placeholders -> null
//  - role normalization ("Alternate X" -> tier, EHS/Risk Management stragglers)
//  - dedupe (site, role, tier, email) keeping the latest submission
//  - region inferred per site by majority email domain
import ExcelJS from 'exceljs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool, sql } from '../server/src/db.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = path.join(here, '..', 'docs', 'CIMT Contact Information Form.xlsx')

const PLACEHOLDERS = new Set(['na', 'n/a', 'n.a.', '-', '--', 'no', 'none', 'nil'])

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null
  let s = typeof v === 'object' && v !== null && 'text' in (v as object)
    ? String((v as { text: string }).text)
    : String(v)
  s = s.replace(/ /g, ' ').replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim()
  if (!s || PLACEHOLDERS.has(s.toLowerCase())) return null
  return s
}

const FUNCTION_ALIASES: Record<string, string> = {
  'EHS': 'EHS / Risk Management',
  'Risk Management': 'EHS / Risk Management',
  'EHS / Alternate Risk Management': 'EHS / Risk Management',
}

function parseRole(raw: string): { func: string; tier: 'primary' | 'alternate' } {
  let s = raw
  let tier: 'primary' | 'alternate' = 'primary'
  if (/^alternate\s+/i.test(s)) {
    tier = 'alternate'
    s = s.replace(/^alternate\s+/i, '').replace(/\balternate\s+/gi, '')
  }
  s = s.trim()
  return { func: FUNCTION_ALIASES[s] ?? s, tier }
}

const DOMAIN_REGION: Record<string, string> = {
  'osigroup.com': 'NA', 'on-cor.com': 'NA', 'osiglobal.com': 'NA',
  'park100foods.com': 'NA', 'smithfieldmurray.com': 'NA',
  'osieurope.com': 'EU', 'grandits.com': 'EU', 'creativefoods.co.uk': 'EU',
  'alpenrind.at': 'EU', 'henrivandebilt.nl': 'EU', 'iqi-petfood.com': 'EU',
  'turosi.com.au': 'APAC', 'ottosons.com.cn': 'APAC', 'vista-osi-group.com': 'APAC',
}

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 64)
}

interface Row {
  completedAt: Date
  site: string
  address: string | null
  deskPhone: string | null
  func: string
  tier: 'primary' | 'alternate'
  name: string
  title: string | null
  prefPhone: string | null
  altPhone: string | null
  prefEmail: string | null
  altEmail: string | null
  assistant: string | null
  language: string | null
}

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(XLSX_PATH)
  const ws = wb.getWorksheet('Submissions')
  if (!ws) throw new Error('Sheet "Submissions" not found')

  const rows: Row[] = []
  const skipped: string[] = []

  ws.eachRow((r, n) => {
    if (n === 1) return
    const site = clean(r.getCell(7).value)
    const roleRaw = clean(r.getCell(10).value)
    const name = clean(r.getCell(11).value)
    if (!site || !roleRaw || !name) {
      skipped.push(`row ${n}: missing site/role/name`)
      return
    }
    const completed = r.getCell(3).value
    const { func, tier } = parseRole(roleRaw)
    let prefEmail = clean(r.getCell(15).value)?.toLowerCase() ?? null
    // malformed entries like "x@y.com (head of finance)" -> keep only the address
    if (prefEmail && /\s/.test(prefEmail)) prefEmail = prefEmail.split(/\s+/)[0]
    rows.push({
      completedAt: completed instanceof Date ? completed : new Date(String(completed)),
      site, func, tier, name,
      address: clean(r.getCell(8).value),
      deskPhone: clean(r.getCell(9).value),
      title: clean(r.getCell(12).value),
      prefPhone: clean(r.getCell(13).value),
      altPhone: clean(r.getCell(14).value),
      prefEmail,
      altEmail: clean(r.getCell(16).value)?.toLowerCase() ?? null,
      assistant: clean(r.getCell(17).value),
      language: clean(r.getCell(6).value),
    })
  })

  // Dedupe: same (site, function, tier, email-or-name) -> keep latest submission
  const byKey = new Map<string, Row>()
  let dupes = 0
  for (const row of rows) {
    const key = [row.site, row.func, row.tier, row.prefEmail ?? row.name.toLowerCase()].join('|')
    const prev = byKey.get(key)
    if (!prev || row.completedAt > prev.completedAt) {
      if (prev) dupes++
      byKey.set(key, row)
    } else {
      dupes++
    }
  }
  const deduped = [...byKey.values()]

  // Sites: aggregate address/desk phone (latest wins) + region by domain majority
  const siteAgg = new Map<string, { address: string | null; latest: Date; domains: Map<string, number> }>()
  for (const row of deduped) {
    let agg = siteAgg.get(row.site)
    if (!agg) {
      agg = { address: null, latest: new Date(0), domains: new Map() }
      siteAgg.set(row.site, agg)
    }
    if (row.address && row.completedAt > agg.latest) {
      agg.address = row.address
      agg.latest = row.completedAt
    }
    const domain = row.prefEmail?.split('@')[1]
    if (domain) agg.domains.set(domain, (agg.domains.get(domain) ?? 0) + 1)
  }

  const unknownDomains = new Set<string>()
  function regionOf(domains: Map<string, number>): string | null {
    const votes = new Map<string, number>()
    for (const [d, n] of domains) {
      const reg = DOMAIN_REGION[d]
      if (!reg) { unknownDomains.add(d); continue }
      votes.set(reg, (votes.get(reg) ?? 0) + n)
    }
    return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }

  const pool = await getPool()
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    // Re-runnable: wipe assignment/contact/site data from previous imports
    await new sql.Request(tx).batch(`
      DELETE FROM dbo.contact_assignments;
      DELETE FROM dbo.contacts;
      DELETE FROM dbo.war_rooms;
      DELETE FROM dbo.constituent_contacts;
      DELETE FROM dbo.constituents;
      DELETE FROM dbo.external_agency_contacts WHERE site_id IS NOT NULL;
      DELETE FROM dbo.sites;
    `)

    const siteIds = new Map<string, number>()
    for (const [name, agg] of siteAgg) {
      const res = await new sql.Request(tx)
        .input('code', sql.NVarChar(64), slugify(name))
        .input('name', sql.NVarChar(200), name)
        .input('region', sql.NVarChar(32), regionOf(agg.domains))
        .input('address', sql.NVarChar(500), agg.address)
        .query(`INSERT INTO dbo.sites (code, name, region, address)
                OUTPUT INSERTED.site_id VALUES (@code, @name, @region, @address)`)
      siteIds.set(name, res.recordset[0].site_id)
    }

    const roleRes = await new sql.Request(tx).query('SELECT role_id, name FROM dbo.cimt_roles')
    const roleIds = new Map<string, number>(roleRes.recordset.map((r: { name: string; role_id: number }) => [r.name, r.role_id]))
    const unknownRoles = new Set<string>()

    // Contacts: keyed by email (fallback name) so one person with N roles = 1 row
    const contactIds = new Map<string, number>()
    let assignments = 0
    for (const row of deduped) {
      const roleId = roleIds.get(row.func)
      if (!roleId) { unknownRoles.add(row.func); continue }

      const ckey = row.prefEmail ?? `name:${row.name.toLowerCase()}`
      let contactId = contactIds.get(ckey)
      if (!contactId) {
        const res = await new sql.Request(tx)
          .input('full_name', sql.NVarChar(200), row.name)
          .input('title', sql.NVarChar(200), row.title)
          .input('desk_phone', sql.NVarChar(50), row.deskPhone)
          .input('preferred_phone', sql.NVarChar(50), row.prefPhone)
          .input('alternate_phone', sql.NVarChar(50), row.altPhone)
          .input('preferred_email', sql.NVarChar(256), row.prefEmail)
          .input('alternate_email', sql.NVarChar(256), row.altEmail)
          .input('assistant_info', sql.NVarChar(500), row.assistant)
          .input('language', sql.NVarChar(50), row.language)
          .query(`INSERT INTO dbo.contacts (full_name, title, desk_phone, preferred_phone,
                    alternate_phone, preferred_email, alternate_email, assistant_info, language)
                  OUTPUT INSERTED.contact_id
                  VALUES (@full_name, @title, @desk_phone, @preferred_phone, @alternate_phone,
                    @preferred_email, @alternate_email, @assistant_info, @language)`)
        contactId = res.recordset[0].contact_id as number
        contactIds.set(ckey, contactId)
      }

      await new sql.Request(tx)
        .input('contact_id', sql.Int, contactId)
        .input('site_id', sql.Int, siteIds.get(row.site)!)
        .input('role_id', sql.Int, roleId)
        .input('tier', sql.NVarChar(16), row.tier)
        .query(`INSERT INTO dbo.contact_assignments (contact_id, site_id, role_id, tier)
                VALUES (@contact_id, @site_id, @role_id, @tier)`)
      assignments++
    }

    await tx.commit()

    console.log('=== Import summary ===')
    console.log(`Submissions parsed:   ${rows.length}`)
    console.log(`Skipped (incomplete): ${skipped.length}${skipped.length ? '\n  ' + skipped.join('\n  ') : ''}`)
    console.log(`Duplicates dropped:   ${dupes}`)
    console.log(`Sites created:        ${siteIds.size}`)
    console.log(`Contacts created:     ${contactIds.size}`)
    console.log(`Assignments created:  ${assignments}`)
    if (unknownRoles.size) console.log(`UNMAPPED ROLES: ${[...unknownRoles].join(', ')}`)
    if (unknownDomains.size) console.log(`Unmapped email domains (no region vote): ${[...unknownDomains].join(', ')}`)
  } catch (err) {
    await tx.rollback()
    throw err
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('IMPORT FAILED:', err)
  process.exit(1)
})

// Seeds content pages (from seed/content/*.json) and sample data (seed/sample/*).
// Re-runnable: wipes and reloads these tables. Does NOT touch sites/contacts/assignments
// (those come from import-excel.ts).
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool, sql } from '../server/src/db.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

interface ContentJson {
  slug: string
  kind: string
  book: string | null
  title: string
  sections: { heading: string; blocks: { kind: string; body: string }[] }[]
}

const pool = await getPool()
const tx = new sql.Transaction(pool)
await tx.begin()

try {
  await new sql.Request(tx).batch(`
    DELETE FROM dbo.content_blocks;
    DELETE FROM dbo.content_sections;
    DELETE FROM dbo.content_pages;
    DELETE FROM dbo.external_agency_contacts;
    DELETE FROM dbo.customer_contacts;
    DELETE FROM dbo.customers;
    DELETE FROM dbo.constituent_contacts;
    DELETE FROM dbo.constituents;
    DELETE FROM dbo.war_rooms;
    DELETE FROM dbo.resources;
  `)

  // Site lookup by name (already imported from Excel)
  const siteRows = (await new sql.Request(tx).query('SELECT site_id, name FROM dbo.sites')).recordset
  const siteId = (name: string): number | null =>
    siteRows.find((s: { name: string }) => s.name === name)?.site_id ?? null

  // ---- content pages ----
  const contentDir = path.join(here, 'seed', 'content')
  let pageSort = 0
  for (const file of (await readdir(contentDir)).filter((f) => f.endsWith('.json'))) {
    const page: ContentJson = JSON.parse(await readFile(path.join(contentDir, file), 'utf8'))
    const pageRes = await new sql.Request(tx)
      .input('slug', sql.NVarChar(100), page.slug)
      .input('kind', sql.NVarChar(16), page.kind)
      .input('book', sql.NVarChar(32), page.book)
      .input('title', sql.NVarChar(200), page.title)
      .input('sort_order', sql.Int, pageSort++)
      .query(`INSERT INTO dbo.content_pages (slug, kind, book, title, sort_order)
              OUTPUT INSERTED.page_id VALUES (@slug, @kind, @book, @title, @sort_order)`)
    const pageId = pageRes.recordset[0].page_id
    let sectionSort = 0
    for (const section of page.sections) {
      const sectionRes = await new sql.Request(tx)
        .input('page_id', sql.Int, pageId)
        .input('heading', sql.NVarChar(300), section.heading)
        .input('sort_order', sql.Int, sectionSort++)
        .query(`INSERT INTO dbo.content_sections (page_id, heading, sort_order)
                OUTPUT INSERTED.section_id VALUES (@page_id, @heading, @sort_order)`)
      const sectionId = sectionRes.recordset[0].section_id
      let blockSort = 0
      for (const block of section.blocks) {
        await new sql.Request(tx)
          .input('section_id', sql.Int, sectionId)
          .input('kind', sql.NVarChar(16), block.kind)
          .input('body', sql.NVarChar(sql.MAX), block.body)
          .input('sort_order', sql.Int, blockSort++)
          .query(`INSERT INTO dbo.content_blocks (section_id, kind, body, sort_order)
                  VALUES (@section_id, @kind, @body, @sort_order)`)
      }
    }
    console.log(`content: ${page.slug} (${page.sections.length} sections)`)
  }

  // ---- national hotlines / media ----
  const national = JSON.parse(
    await readFile(path.join(here, 'seed', 'sample', 'external-national.json'), 'utf8'),
  )
  for (const c of national) {
    await new sql.Request(tx)
      .input('site_id', sql.Int, null)
      .input('agency_type', sql.NVarChar(16), c.agency_type)
      .input('contact_name', sql.NVarChar(200), c.contact_name)
      .input('phone', sql.NVarChar(100), c.phone)
      .input('detail', sql.NVarChar(sql.MAX), c.detail)
      .input('comment', sql.NVarChar(sql.MAX), c.comment)
      .input('sort_order', sql.Int, c.sort_order)
      .query(`INSERT INTO dbo.external_agency_contacts
                (site_id, agency_type, contact_name, phone, detail, comment, sort_order)
              VALUES (@site_id, @agency_type, @contact_name, @phone, @detail, @comment, @sort_order)`)
  }
  console.log(`national hotlines: ${national.length}`)

  // ---- sample data ----
  const sample = JSON.parse(
    await readFile(path.join(here, 'seed', 'sample', 'sample-data.json'), 'utf8'),
  )

  for (const group of sample.externalBySite) {
    const sid = siteId(group.site)
    if (!sid) { console.warn(`external: site not found: ${group.site}`); continue }
    for (const c of group.contacts) {
      await new sql.Request(tx)
        .input('site_id', sql.Int, sid)
        .input('agency_type', sql.NVarChar(16), c.agency_type)
        .input('contact_name', sql.NVarChar(200), c.contact_name)
        .input('phone', sql.NVarChar(100), c.phone)
        .input('detail', sql.NVarChar(sql.MAX), c.detail)
        .input('comment', sql.NVarChar(sql.MAX), c.comment)
        .input('sort_order', sql.Int, c.sort_order)
        .query(`INSERT INTO dbo.external_agency_contacts
                  (site_id, agency_type, contact_name, phone, detail, comment, sort_order)
                VALUES (@site_id, @agency_type, @contact_name, @phone, @detail, @comment, @sort_order)`)
    }
  }

  for (const cust of sample.customers) {
    const custRes = await new sql.Request(tx)
      .input('name', sql.NVarChar(200), cust.name)
      .input('region', sql.NVarChar(32), cust.region)
      .input('notes', sql.NVarChar(sql.MAX), cust.notes)
      .query(`INSERT INTO dbo.customers (name, region, notes)
              OUTPUT INSERTED.customer_id VALUES (@name, @region, @notes)`)
    const custId = custRes.recordset[0].customer_id
    for (const c of cust.contacts) {
      await new sql.Request(tx)
        .input('customer_id', sql.Int, custId)
        .input('side', sql.NVarChar(16), c.side)
        .input('name', sql.NVarChar(200), c.name)
        .input('title', sql.NVarChar(200), c.title)
        .input('work_phone', sql.NVarChar(50), c.work_phone)
        .input('cell_phone', sql.NVarChar(50), c.cell_phone)
        .input('email', sql.NVarChar(256), c.email)
        .input('note', sql.NVarChar(500), c.note)
        .input('sort_order', sql.Int, c.sort_order)
        .query(`INSERT INTO dbo.customer_contacts
                  (customer_id, side, name, title, work_phone, cell_phone, email, note, sort_order)
                VALUES (@customer_id, @side, @name, @title, @work_phone, @cell_phone, @email, @note, @sort_order)`)
    }
  }
  console.log(`customers: ${sample.customers.length}`)

  for (const group of sample.constituentsBySite) {
    const sid = siteId(group.site)
    if (!sid) { console.warn(`constituents: site not found: ${group.site}`); continue }
    for (const place of group.places) {
      const placeRes = await new sql.Request(tx)
        .input('site_id', sql.Int, sid)
        .input('section', sql.NVarChar(100), place.section)
        .input('section_sort', sql.Int, place.section_sort)
        .input('place_name', sql.NVarChar(200), place.place_name)
        .input('address', sql.NVarChar(500), place.address)
        .input('notes', sql.NVarChar(sql.MAX), place.notes)
        .query(`INSERT INTO dbo.constituents (site_id, section, section_sort, place_name, address, notes)
                OUTPUT INSERTED.constituent_id
                VALUES (@site_id, @section, @section_sort, @place_name, @address, @notes)`)
      const placeId = placeRes.recordset[0].constituent_id
      for (const c of place.contacts) {
        await new sql.Request(tx)
          .input('constituent_id', sql.Int, placeId)
          .input('name', sql.NVarChar(200), c.name)
          .input('title', sql.NVarChar(200), c.title)
          .input('phone', sql.NVarChar(50), c.phone)
          .input('cell', sql.NVarChar(50), c.cell)
          .input('email', sql.NVarChar(256), c.email)
          .input('sort_order', sql.Int, c.sort_order)
          .query(`INSERT INTO dbo.constituent_contacts
                    (constituent_id, name, title, phone, cell, email, sort_order)
                  VALUES (@constituent_id, @name, @title, @phone, @cell, @email, @sort_order)`)
      }
    }
  }

  for (const room of sample.warRoomsBySite) {
    const sid = siteId(room.site)
    if (!sid) { console.warn(`war room: site not found: ${room.site}`); continue }
    await new sql.Request(tx)
      .input('site_id', sql.Int, sid)
      .input('war_room_location', sql.NVarChar(300), room.war_room_location)
      .input('war_room_phone', sql.NVarChar(50), room.war_room_phone)
      .input('direct_line', sql.NVarChar(50), room.direct_line)
      .input('direct_fax', sql.NVarChar(50), room.direct_fax)
      .input('conference_phone', sql.NVarChar(50), room.conference_phone)
      .input('conference_access_code', sql.NVarChar(50), room.conference_access_code)
      .input('revised_at', sql.Date, room.revised_at)
      .query(`INSERT INTO dbo.war_rooms
                (site_id, war_room_location, war_room_phone, direct_line, direct_fax,
                 conference_phone, conference_access_code, revised_at)
              VALUES (@site_id, @war_room_location, @war_room_phone, @direct_line, @direct_fax,
                 @conference_phone, @conference_access_code, @revised_at)`)
  }

  for (const r of sample.resources) {
    await new sql.Request(tx)
      .input('title', sql.NVarChar(200), r.title)
      .input('category', sql.NVarChar(100), r.category)
      .input('file_name', sql.NVarChar(300), r.file_name)
      .input('url', sql.NVarChar(500), r.url)
      .input('sort_order', sql.Int, r.sort_order)
      .query(`INSERT INTO dbo.resources (title, category, file_name, url, sort_order)
              VALUES (@title, @category, @file_name, @url, @sort_order)`)
  }
  console.log(`resources: ${sample.resources.length}`)

  await tx.commit()
  console.log('Seed complete.')
} catch (err) {
  await tx.rollback()
  throw err
} finally {
  await pool.close()
}

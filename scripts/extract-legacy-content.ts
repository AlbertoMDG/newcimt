// One-time extraction: legacy .aspx accordion pages -> scripts/seed/content/*.json
// Output is committed and hand-reviewed; the .aspx files are never a runtime dependency.
import { load, type Cheerio, type CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const LEGACY = path.join(here, '..', '..', 'cimt-legacy', 'secure')
const OUT = path.join(here, 'seed', 'content')

const GUIDES = [
  { file: 'workplaceViolence.aspx', slug: 'workplace-violence', title: 'Workplace Violence', book: 'workplace-violence' },
  { file: 'chemical.aspx', slug: 'chemical', title: 'Chemical', book: 'chemical' },
  { file: 'food.aspx', slug: 'food', title: 'Food', book: 'food' },
  { file: 'media.aspx', slug: 'media', title: 'Media', book: 'media' },
]

function textOf($: CheerioAPI, el: Cheerio<AnyNode>): string {
  return el.text().replace(/\s+/g, ' ').trim()
}

/** Convert a legacy sub-menu fragment to markdown. */
function toMarkdown($: CheerioAPI, container: Cheerio<AnyNode>): string {
  const parts: string[] = []

  const walk = (node: AnyNode) => {
    if (node.type === 'text') {
      const t = (node.data ?? '').replace(/\s+/g, ' ').trim()
      if (t) parts.push(t + '\n\n')
      return
    }
    if (node.type !== 'tag') return
    const el = $(node)
    switch (node.name) {
      case 'em':
      case 'i':
        parts.push(`*${textOf($, el)}*\n\n`)
        break
      case 'strong':
      case 'b':
        parts.push(`**${textOf($, el)}**\n\n`)
        break
      case 'ol': {
        el.children('li').each((i, li) => {
          parts.push(`${i + 1}. ${textOf($, $(li))}\n`)
        })
        parts.push('\n')
        break
      }
      case 'ul': {
        el.children('li').each((_, li) => {
          const inner = $(li)
          // nested structures inside a li: recurse instead of flattening
          if (inner.children('ol, ul, em, strong').length > 0) {
            inner.contents().each((_, c) => walk(c))
          } else {
            parts.push(`- ${textOf($, inner)}\n`)
          }
        })
        parts.push('\n')
        break
      }
      case 'li': {
        if (el.children('ol, ul, em, strong, p').length > 0) {
          el.contents().each((_, c) => walk(c))
        } else {
          const t = textOf($, el)
          if (t) parts.push(t + '\n\n')
        }
        break
      }
      case 'br':
        break
      case 'table': {
        parts.push(textOf($, el) + '\n\n')
        break
      }
      default:
        el.contents().each((_, c) => walk(c))
    }
  }

  container.contents().each((_, c) => walk(c))
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim()
}

async function readLegacy(file: string): Promise<string> {
  const buf = await readFile(path.join(LEGACY, file))
  return buf.toString('latin1')
}

interface SectionOut { heading: string; blocks: { kind: string; body: string }[] }

function extractSections(html: string, asChecklist: boolean): SectionOut[] {
  const $ = load(html)
  const sections: SectionOut[] = []
  $('ul.accordion > li').each((_, li) => {
    const el = $(li)
    const heading = textOf($, el.children('a').first()).replace(/:$/, '')
    if (!heading) return
    const sub = el.children('ul.sub-menu').first()
    if (asChecklist) {
      const items: { kind: string; body: string }[] = []
      sub.find('ol > li, ul:not(.sub-menu) > li').each((_, item) => {
        const t = textOf($, $(item))
        if (t) items.push({ kind: 'checklist_item', body: t })
      })
      if (items.length === 0) {
        const t = textOf($, sub)
        if (t) items.push({ kind: 'checklist_item', body: t })
      }
      sections.push({ heading, blocks: items })
    } else {
      const md = toMarkdown($, sub)
      sections.push({ heading, blocks: md ? [{ kind: 'markdown', body: md }] : [] })
    }
  })
  return sections
}

await mkdir(OUT, { recursive: true })

for (const g of GUIDES) {
  const html = await readLegacy(g.file)
  const sections = extractSections(html, false)
  const out = { slug: g.slug, kind: 'guide', book: g.book, title: g.title, sections }
  await writeFile(path.join(OUT, `${g.slug}.json`), JSON.stringify(out, null, 2), 'utf8')
  console.log(`${g.slug}: ${sections.length} sections, ${sections.reduce((n, s) => n + s.blocks.length, 0)} blocks`)
}

{
  const html = await readLegacy('criticalIncident.aspx')
  const sections = extractSections(html, true)
  const out = { slug: 'crisis-checklist', kind: 'checklist', book: null, title: 'Crisis Checklist', sections }
  await writeFile(path.join(OUT, 'crisis-checklist.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log(`crisis-checklist: ${sections.length} sections, ${sections.reduce((n, s) => n + s.blocks.length, 0)} items`)
}

// Binder tab colors: each response topic is color-coded everywhere it appears
// (Home cards, footer links, guide headers, forms). Tokens live in index.css.
export interface TopicColor {
  border: string
  dot: string
}

export const TOPIC_COLORS: Record<string, TopicColor> = {
  'workplace-violence': { border: 'border-topic-workplace', dot: 'bg-topic-workplace' },
  chemical: { border: 'border-topic-chemical', dot: 'bg-topic-chemical' },
  food: { border: 'border-topic-food', dot: 'bg-topic-food' },
  media: { border: 'border-topic-media', dot: 'bg-topic-media' },
  roles: { border: 'border-topic-roles', dot: 'bg-topic-roles' },
}

const TITLE_PATTERNS: [RegExp, string][] = [
  [/workplace\s*violence/i, 'workplace-violence'],
  [/roles?\s*(&|and)\s*responsibilit/i, 'roles'],
  [/chemical/i, 'chemical'],
  [/\bfood\b/i, 'food'],
  [/\bmedia\b/i, 'media'],
]

/** Topic color for a free-text title (resources, forms), or null if no topic matches. */
export function topicColorForTitle(title: string): TopicColor | null {
  for (const [pattern, slug] of TITLE_PATTERNS) {
    if (pattern.test(title)) return TOPIC_COLORS[slug]
  }
  return null
}

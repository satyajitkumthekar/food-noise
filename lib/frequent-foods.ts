import type { FoodLog } from '@/lib/database.types'

export type FrequentFood = {
  name: string
  kcal: number | null
  protein: number | null
  count: number
}

// Cluster similar food names: lowercase, strip leading quantities and common
// units, drop trailing 's', collapse whitespace. Crude but effective for
// catching "1 roti" / "2 rotis" / "Roti" as the same item.
function normalise(raw: string): string {
  let s = raw.toLowerCase().trim()
  // Strip leading quantity tokens like "2", "2x", "200g", "1 cup", "half"
  s = s.replace(/^(\d+(\.\d+)?\s*(g|gm|grams?|ml|cups?|tbsp|tsp|pcs?|piece?s?|servings?|x)?\s*)+/, '')
  s = s.replace(/^(half|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+/, '')
  // Collapse whitespace + punctuation
  s = s.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  // Drop trailing 's' (rotis → roti)
  if (s.endsWith('s') && s.length > 3) s = s.slice(0, -1)
  return s
}

const MIN_COUNT = 2
const MAX_RESULTS = 7

export function buildFrequentFoods(logs: FoodLog[]): FrequentFood[] {
  type Cluster = { count: number; latest: FoodLog }
  const clusters = new Map<string, Cluster>()

  // logs come in DESC by created_at; the first one we see for a key IS the latest.
  for (const log of logs) {
    if (!log.name) continue
    const key = normalise(log.name)
    if (!key) continue
    const existing = clusters.get(key)
    if (existing) {
      existing.count += 1
    } else {
      clusters.set(key, { count: 1, latest: log })
    }
  }

  return Array.from(clusters.values())
    .filter(c => c.count >= MIN_COUNT)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_RESULTS)
    .map(c => ({
      name: c.latest.name ?? '',
      kcal: c.latest.kcal,
      protein: c.latest.protein,
      count: c.count,
    }))
}

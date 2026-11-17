import { test, expect } from 'bun:test'
import { comparePublications, getAuthorRank } from '../src/utils/publications.mjs'
import { createContentSchemas } from '../src/content-schemas.mjs'

const paper = (overrides = {}) => ({
  title: 'Example',
  authors: 'First Author, <strong>Site Author</strong>',
  publication: 'Venue',
  year: 2026,
  order: 1,
  ...overrides
})

test('author position takes priority over a newer date', () => {
  const lead = paper({ authorRank: 1, year: 2024 })
  const newer = paper({ authorRank: 3, publishedDate: '2026-10-26' })
  expect([newer, lead].sort(comparePublications)).toEqual([lead, newer])
  expect(getAuthorRank(paper())).toBe(2)
  expect(getAuthorRank(paper({ authorRank: 1 }))).toBe(1)
})

test('equal author positions sort newest first, including month-only dates', () => {
  const july = paper({ publishedDate: '2026-07' })
  const september = paper({ publishedDate: '2026-09-03' })
  const unknownMonth = paper()
  expect([july, unknownMonth, september].sort(comparePublications)).toEqual([
    september,
    july,
    unknownMonth
  ])
})

test('unmarked authors sort after ranked authors and ties retain manual order', () => {
  const unmarked = paper({ authors: 'Other Author', order: 1 })
  const later = paper({ order: 3 })
  const earlier = paper({ order: 2 })
  expect([unmarked, later, earlier].sort(comparePublications)).toEqual([earlier, later, unmarked])
  expect(comparePublications(unmarked, unmarked)).toBe(0)
})

test('publication metadata accepts legacy entries and rejects impossible dates or ranks', () => {
  const schema = createContentSchemas([{ key: 'test', parent: null }]).publications
  expect(schema.safeParse(paper()).success).toBe(true)
  expect(schema.safeParse(paper({ publishedDate: '2026-07' })).success).toBe(true)
  for (const invalid of [
    { authorRank: 0 },
    { publishedDate: '2026-02-30' },
    { publishedDate: '2025-09-03' }
  ]) {
    expect(schema.safeParse(paper(invalid)).success).toBe(false)
  }
})

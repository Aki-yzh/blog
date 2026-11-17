import { z } from 'astro/zod'

/** Shared by Astro and the local editor: one source of truth for content fields.
 * @param {{ key: string, parent: string | null }[]} groups
 */
export function createContentSchemas(groups) {
  const parents = new Set(groups.flatMap((group) => (group.parent ? [group.parent] : [])))
  const leaves = groups.filter((group) => !parents.has(group.key)).map((group) => group.key)
  if (!leaves.length) throw new Error('Gunpla group manifest must contain at least one leaf group')
  const text = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)])
  const card = {
    order: z.number().int().positive(),
    title: text,
    description: text,
    image: z.string().min(1)
  }
  return {
    publications: z
      .object({
        title: z.string().min(1),
        authors: z.string().min(1),
        publication: z.string().min(1),
        year: z.number().int().min(1900),
        authorRank: z.number().int().positive().optional(),
        publishedDate: z
          .string()
          .refine((value) => {
            if (!/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(value)) return false
            const date = value.length === 7 ? `${value}-01` : value
            const parsed = new Date(`${date}T00:00:00Z`)
            return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
          }, '发表日期应为有效的 YYYY-MM 或 YYYY-MM-DD')
          .optional(),
        link: z.url().optional(),
        order: z.number().int().positive()
      })
      .strict()
      .refine((paper) => !paper.publishedDate || paper.publishedDate.startsWith(`${paper.year}-`), {
        message: '发表日期必须与年份一致',
        path: ['publishedDate']
      }),
    gunpla: z
      .object({
        order: z.number().int().positive(),
        group: z.enum(/** @type {[string, ...string[]]} */ (leaves)),
        officialImages: z.array(z.string().min(1)).min(1),
        myImages: z.array(z.string().min(1)).min(1),
        name: z.string().min(1),
        releasePrice: z.string().min(1),
        brand: z.string().min(1),
        purchasePrice: z.string().min(1),
        link78: z.url(),
        review: z.string().min(1)
      })
      .strict(),
    acg: z.discriminatedUnion('section', [
      z
        .object({
          ...card,
          section: z.literal('anime-featured'),
          badge: z.string().min(1),
          link: z.url()
        })
        .strict(),
      z.object({ ...card, section: z.literal('anime-more'), link: z.url() }).strict(),
      z
        .object({
          ...card,
          section: z.literal('anime-timeline'),
          year: z.number().int().min(1900),
          link: z.url()
        })
        .strict(),
      z
        .object({
          ...card,
          section: z.literal('comic-featured'),
          badge: z.string().min(1),
          link: z.url()
        })
        .strict(),
      z.object({ ...card, section: z.literal('game'), link: z.url().optional() }).strict()
    ])
  }
}

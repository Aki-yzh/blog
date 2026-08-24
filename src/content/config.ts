import { defineCollection, z } from 'astro:content'

import gunplaGroupsManifest from '../data/gunpla-groups.json'

function removeDupsAndLowerCase(array: string[]) {
  if (!array.length) return array
  const lowercaseItems = array.map((str) => str.toLowerCase())
  const distinctItems = new Set(lowercaseItems)
  return Array.from(distinctItems)
}

const post = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string().max(60),
      description: z.string().min(10).max(160),
      publishDate: z
        .string()
        .or(z.date())
        .transform((val) => new Date(val)),
      updatedDate: z
        .string()
        .optional()
        .transform((str) => (str ? new Date(str) : undefined)),
      coverImage: z
        .object({
          src: z.union([image(), z.string()]),
          alt: z.string().optional(),
          color: z.string().optional()
        })
        .optional(),
      draft: z.boolean().default(false),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      ogImage: z.string().optional(),
      language: z.string().optional()
    })
})

const publications = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string().min(1),
    authors: z.string().min(1),
    publication: z.string().min(1),
    year: z.number().int().min(1900),
    link: z.string().url().optional(),
    order: z.number().int().positive()
  })
})

const gunplaParentGroups = new Set(
  gunplaGroupsManifest.groups.flatMap((group) => (group.parent ? [group.parent] : []))
)
const gunplaLeafGroups = gunplaGroupsManifest.groups
  .filter((group) => !gunplaParentGroups.has(group.key))
  .map((group) => group.key)

if (gunplaLeafGroups.length === 0) {
  throw new Error('Gunpla group manifest must contain at least one leaf group')
}

const gunplaGroup = z.enum(gunplaLeafGroups as [string, ...string[]])

const gunpla = defineCollection({
  type: 'data',
  schema: z.object({
    order: z.number().int().positive(),
    group: gunplaGroup,
    officialImages: z.array(z.string().min(1)).min(1),
    myImages: z.array(z.string().min(1)).min(1),
    name: z.string().min(1),
    releasePrice: z.string().min(1),
    brand: z.string().min(1),
    purchasePrice: z.string().min(1),
    link78: z.string().url(),
    review: z.string().min(1)
  })
})

const acgText = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)])
const acgCardFields = {
  order: z.number().int().positive(),
  title: acgText,
  description: acgText,
  image: z.string().min(1)
}

const acg = defineCollection({
  type: 'data',
  schema: z.discriminatedUnion('section', [
    z
      .object({
        ...acgCardFields,
        section: z.literal('anime-featured'),
        badge: z.string().min(1),
        link: z.string().url()
      })
      .strict(),
    z
      .object({
        ...acgCardFields,
        section: z.literal('anime-more'),
        link: z.string().url()
      })
      .strict(),
    z
      .object({
        ...acgCardFields,
        section: z.literal('anime-timeline'),
        year: z.number().int().min(1900),
        link: z.string().url()
      })
      .strict(),
    z
      .object({
        ...acgCardFields,
        section: z.literal('comic-featured'),
        badge: z.string().min(1),
        link: z.string().url()
      })
      .strict(),
    z
      .object({
        ...acgCardFields,
        section: z.literal('game'),
        link: z.string().url().optional()
      })
      .strict()
  ])
})

export const collections = { post, publications, gunpla, acg }

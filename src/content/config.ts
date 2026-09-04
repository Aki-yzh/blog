import { defineCollection, z } from 'astro:content'

import { createContentSchemas } from '../content-schemas.mjs'
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

const schemas = createContentSchemas(gunplaGroupsManifest.groups)
const publications = defineCollection({ type: 'data', schema: schemas.publications })
const gunpla = defineCollection({ type: 'data', schema: schemas.gunpla })
const acg = defineCollection({ type: 'data', schema: schemas.acg })

export const collections = { post, publications, gunpla, acg }

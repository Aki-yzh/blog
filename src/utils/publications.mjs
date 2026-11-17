/** @typedef {{authors: string, authorRank?: number, year: number, publishedDate?: string, order: number}} Publication */

/** @param {Publication} paper */
export function getAuthorRank(paper) {
  if (paper.authorRank !== undefined) return paper.authorRank
  const index = paper.authors.split(',').findIndex((name) => /<(?:strong|b)(?:\s|>)/i.test(name))
  return index < 0 ? Number.POSITIVE_INFINITY : index + 1
}

/** Author position first, then newest publication date; order breaks remaining ties.
 * @param {Publication} left
 * @param {Publication} right
 */
export function comparePublications(left, right) {
  const leftRank = getAuthorRank(left)
  const rightRank = getAuthorRank(right)
  if (leftRank !== rightRank) return leftRank < rightRank ? -1 : 1
  const dateOrder = (right.publishedDate || String(right.year)).localeCompare(
    left.publishedDate || String(left.year)
  )
  return dateOrder || left.order - right.order
}

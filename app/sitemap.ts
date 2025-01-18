import { getPosts } from '@/lib/content'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts()
  const routes = posts.map(({ frontmatter }) => {
    return {
      url: `https://mayo.rocks${frontmatter.permalink}`,
      lastModified: new Date(frontmatter.date),
    }
  })

  return [
    {
      url: 'https://mayo.rocks',
      lastModified: new Date(),
    },
    ...routes,
  ]
}

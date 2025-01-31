import { getPosts } from '@/lib/content'
import Link from 'next/link'

export default async function Page() {
  const posts = await getPosts()

  return (
    <>
      {posts.map(({ frontmatter }) => (
        <Link href={`${frontmatter.permalink}`} key={frontmatter.title} className="block group">
          <article>
            <div className="space-y-4">
              <time className="text-sm uppercase tracking-wider text-gray-500">
                {new Date(frontmatter.date).toISOString()}
              </time>
              <h2
                className="text-4xl font-normal text-gray-900 group-hover:text-blue-600 transition-colors"
                lang={frontmatter.lang ?? 'ja'}
              >
                {frontmatter.title}
              </h2>
              <div className="pt-4">
                <span className="text-blue-600 group-hover:text-blue-700 transition-colors">Read more →</span>
              </div>
            </div>
          </article>
        </Link>
      ))}
    </>
  )
}

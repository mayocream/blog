import { getPosts } from '@/lib/content'
import Link from 'next/link'

export default async function Page() {
  const posts = await getPosts()

  return (
    <>
      {posts.map(({ frontmatter }) => (
        <Link href={`${frontmatter.permalink}`} key={frontmatter.title} className="block group">
          <article>
            {frontmatter.image && (
              <div className="mb-8 overflow-hidden rounded-2xl">
                <img
                  src={frontmatter.image}
                  alt=""
                  className="w-full h-96 object-cover transform group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}
            <div className="space-y-4">
              <div className="text-sm uppercase tracking-wider text-gray-500">
                {new Date(frontmatter.date).toISOString()}
              </div>
              <h2 className="text-4xl font-normal text-gray-900 group-hover:text-blue-600 transition-colors">
                {frontmatter.title}
              </h2>
              {frontmatter.excerpt && (
                <p className="text-xl text-gray-600 font-light leading-relaxed">{frontmatter.excerpt}</p>
              )}
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

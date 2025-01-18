import Article from '@/components/article'
import { getPost, getPosts, markdownToHtml } from '@/lib/content'
import { Metadata } from 'next'

export async function generateStaticParams() {
  const params = []
  for (const { frontmatter } of await getPosts()) {
    const { date, slug } = frontmatter
    const [year, month] = String(date).split('-')
    params.push({ year, month, slug })
  }
  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; month: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = (await getPost(slug))!
  return {
    title: post.frontmatter.title,
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{
    year: string
    month: string
    slug: string
  }>
}) {
  const { slug } = await params
  const post = (await getPost(slug))!
  const html = await markdownToHtml(post.content)
  return (
    <>
      <aside>
        <div className="text-sm uppercase tracking-wider text-gray-500">
          {new Date(post.frontmatter.date).toISOString()}
        </div>
        <h2 className="mt-4 text-4xl font-normal text-gray-900 group-hover:text-blue-600 transition-colors">
          {post.frontmatter.title}
        </h2>
      </aside>
      <Article raw={html} />
    </>
  )
}

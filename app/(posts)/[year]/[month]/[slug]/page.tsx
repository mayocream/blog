import { getPost, getPosts, markdownToHtml } from '@/lib/content'

export async function generateStaticParams() {
    const params = []
    for (const { frontmatter } of await getPosts()) {
        const { date, slug } = frontmatter
        const [year, month] = String(date).split('-')
        params.push({ year, month, slug })
    }
    return params
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
    return <article dangerouslySetInnerHTML={{ __html: html }} />
}

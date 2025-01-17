import { getPost, getPosts, markdownToHtml } from '@/lib/content'

export async function generateStaticParams() {
    const params = []
    for (const { frontmatter, content } of await getPosts()) {
        let { date, slug } = frontmatter
        const [year, month] = String(date).split('-')
        params.push({ year, month, slug, content })
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
    let { content } = (await getPost(slug))!
    content = await markdownToHtml(content)

    return <article dangerouslySetInnerHTML={{ __html: content }} />
}

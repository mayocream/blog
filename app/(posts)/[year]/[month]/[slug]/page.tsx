import { glob } from 'node:fs/promises'
import matter from 'gray-matter'

export async function generateStaticParams() {
    const params = []
    for await (const path of glob('content/posts/**/*.md')) {
        const file = await matter.read(path)

        let { date, title, slug, draft } = file.data
        if (draft) continue

        slug = slug || title.toLowerCase().replace(/ /g, '-')
        const [year, month] = date?.toString().split('-')
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
    const { year, month, slug } = await params
    return (
        <>
            <h1>Post</h1>
            <p>Year: {year}</p>
            <p>Month: {month}</p>
            <p>Slug: {slug}</p>
        </>
    )
}

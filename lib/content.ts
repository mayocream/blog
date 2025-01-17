import matter from 'gray-matter'
import { glob } from 'node:fs/promises'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify)

export async function getPosts() {
    const posts = []
    for await (const path of glob('content/posts/**/*.md')) {
        const file = await matter.read(path)

        let { draft, slug, title, date } = file.data
        if (draft) continue

        // !!! URL encode the slug
        slug = slug || encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'))

        const frontmatter = file.data
        frontmatter.slug = slug

        const [year, month] = String(date).split('-')
        frontmatter.permalink = `/${year}/${month}/${slug}`

        posts.push({ frontmatter, content: file.content })
    }

    posts.sort((a, b) => {
        return new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime()
    })

    return posts
}

export async function getPost(slug: string) {
    const posts = await getPosts()
    return posts.find((post) => post.frontmatter.slug === slug)
}

export async function markdownToHtml(content: string) {
    const file = await processor.process(content)
    return String(file)
}

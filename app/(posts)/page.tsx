import { getPosts } from '@/lib/content'
import Link from 'next/link'

export default async function Page() {
    const posts = await getPosts()
    return (
        <ul>
            {posts.map(({ frontmatter }) => (
                <li key={frontmatter.title}>
                    <Link href={`${frontmatter.permalink}`}>{frontmatter.title}</Link>
                </li>
            ))}
        </ul>
    )
}

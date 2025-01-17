import { getPosts } from '@/lib/content'

export default async function Page() {
    const posts = await getPosts()
    return (
        <ul>
            {posts.map(({ frontmatter }) => (
                <li key={frontmatter.title}>
                    <a href={`${frontmatter.permalink}`}>{frontmatter.title}</a>
                </li>
            ))}
        </ul>
    )
}

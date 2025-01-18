---
title: "Next.js: 新時代のPHPでブログを作ってみた"
slug: next.js
date: "2025-01-18"
lang: ja
---

個人的な見解ですが、Next.js は新時代の PHP だと思います。PHP は、Web 開発の初心者にとって最も簡単な言語であり、最も多くの Web サイトで使用されている言語です。同様に、Next.js は React の知識があれば、簡単に Web アプリケーションを構築できるフレームワークです。

## Hugo から Next.js への移行

元は Hugo で作成していたこのブログも、Next.js に移行しました。そのため、まずは Markdown の記事の移行方法について説明します。

```python
import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Set, Tuple
from datetime import datetime
from collections import defaultdict

class HugoToNextjsMigration:
    def __init__(self, content_dir: str, public_dir: str):
        self.content_dir = Path(content_dir)
        self.public_dir = Path(public_dir)
        self.image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'}
        self.image_mapping: Dict[str, str] = {}
        self.date_counters = defaultdict(int)  # Track number of images per date

    def find_markdown_files(self) -> List[Path]:
        """Find all markdown files in the content directory."""
        return list(self.content_dir.glob("**/*.md"))

    def find_images(self) -> List[Path]:
        """Find all image files in the content directory."""
        image_files = []
        for ext in self.image_extensions:
            image_files.extend(self.content_dir.glob(f"**/*{ext}"))
        return image_files

    def get_image_date(self, image_path: Path) -> str:
        """
        Get the date for the image based on the folder structure or file modification time.
        Returns date in YYYY-MM-DD format.
        """
        # Try to extract date from the path (assuming content/posts/YYYY/MM/... structure)
        parts = image_path.parts
        try:
            # Look for year and month in the path
            for i, part in enumerate(parts):
                if part.isdigit() and len(part) == 4:  # Year
                    year = part
                    if i + 1 < len(parts) and parts[i + 1].isdigit() and len(parts[i + 1]) <= 2:  # Month
                        month = parts[i + 1].zfill(2)
                        return f"{year}-{month}-01"
        except (IndexError, ValueError):
            pass

        # Fallback to file modification time
        mtime = os.path.getmtime(image_path)
        return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')

    def generate_new_image_path(self, original_path: Path) -> Path:
        """Generate a new path for the image in the public directory."""
        date = self.get_image_date(original_path)
        self.date_counters[date] += 1
        new_filename = f"{date}-{str(self.date_counters[date]).zfill(2)}{original_path.suffix}"
        return self.public_dir / 'images' / new_filename

    def move_images(self) -> None:
        """Move all images to the public directory and create mapping."""
        # Create public images directory if it doesn't exist
        (self.public_dir / 'images').mkdir(parents=True, exist_ok=True)

        # Sort images by date to ensure consistent numbering
        images = self.find_images()
        sorted_images = sorted(images, key=lambda x: (self.get_image_date(x), str(x)))

        for image_path in sorted_images:
            new_path = self.generate_new_image_path(image_path)
            # Store the mapping of old path to new path
            self.image_mapping[str(image_path.relative_to(self.content_dir))] = f'/images/{new_path.name}'
            # Move the image
            shutil.copy2(image_path, new_path)
            print(f"Moved: {image_path} -> {new_path}")

    def update_markdown_content(self, content: str) -> str:
        """Update markdown content with new image paths."""
        # Regular expressions for different markdown image syntaxes
        patterns = [
            r'!\[(.*?)\]\((.*?)\)',  # ![alt](src)
            r'<img.*?src=[\'\"](.*?)[\'\"].*?>'  # <img src="src" />
        ]

        updated_content = content
        for pattern in patterns:
            def replace_path(match):
                if pattern == patterns[0]:  # Markdown syntax
                    alt_text, img_path = match.groups()
                    img_path = img_path.split(' ')[0]  # Remove any title after the path
                else:  # HTML syntax
                    img_path = match.group(1)

                # Clean the path
                img_path = img_path.strip()
                if img_path.startswith('./'):
                    img_path = img_path[2:]

                # Try to find the new path in our mapping
                for old_path, new_path in self.image_mapping.items():
                    if old_path.endswith(img_path) or img_path.endswith(old_path):
                        if pattern == patterns[0]:
                            return f'![{alt_text}]({new_path})'
                        else:
                            return f'<img src="{new_path}" />'

                print(f"Warning: Could not find mapping for image: {img_path}")
                return match.group(0)

            updated_content = re.sub(pattern, replace_path, updated_content)

        return updated_content

    def process_markdown_files(self) -> None:
        """Process all markdown files and update image references."""
        for md_file in self.find_markdown_files():
            print(f"Processing: {md_file}")

            # Read the original content
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Update the content
            updated_content = self.update_markdown_content(content)

            # Write the updated content
            with open(md_file, 'w', encoding='utf-8') as f:
                f.write(updated_content)

    def run(self):
        """Run the complete migration process."""
        print("Starting migration process...")
        self.move_images()
        self.process_markdown_files()
        print("Migration completed!")


if __name__ == "__main__":
    # Configuration
    CONTENT_DIR = "content/posts"
    PUBLIC_DIR = "public"

    # Run migration
    migrator = HugoToNextjsMigration(CONTENT_DIR, PUBLIC_DIR)
    migrator.run()
```

`content/posts` ディレクトリにある Markdown ファイルと画像を `public` ディレクトリに移動し、Markdown ファイル内の画像パスを更新します。このスクリプトを実行すると、Hugo から Next.js にブログを移行する準備が整います。

## SSG と ISR

Next.js は、静的サイト生成（SSG）とインクリメンタル静的再生成（ISR）をサポートしています。これにより、ビルド時に静的な HTML ページを生成し、必要に応じてページを再生成できます。これにより、高速なパフォーマンスと SEO を実現できます。

```typescript
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
      <aside
        style={{
          fontVariantEastAsian: post.frontmatter.lang === 'ja' ? 'simplified' : 'jis78',
        }}
      >
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
```

## Markdown から HTML への変換

Markdown ファイルを HTML に変換するために、`remark` と `rehype` を使用します。これにより、Markdown ファイルを HTML に変換し、React コンポーネントとして表示できます。

```typescript
import matter from 'gray-matter'
import { glob } from 'node:fs/promises'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)

export async function getPosts() {
    const posts = []
    for await (const path of glob('content/posts/**/*.md')) {
        const file = await matter.read(path)

        let { draft, slug, title, date } = file.data
        if (draft) continue

        // !!! URL encode the slug
        slug = slug || encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-').replace(':', ''))

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
    return posts.find((post) => post.frontmatter.slug === slug || encodeURIComponent(post.frontmatter.slug) === slug)
}

export async function markdownToHtml(content: string) {
    const file = await processor.process(content)
    return String(file)
}
```

## Sitemap フィード

サイトマップを自動的に生成し、サイトの SEO を向上させることができます。

```typescript
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
```

## Note.com からのインポート

Note.com からブログをインポートするために、`feedparser` と `requests` を使用します。これにより、Note.com の RSS フィードを解析し、各エントリのタイトル、URL、日付、およびコンテンツを取得できます。

```python
import feedparser
import requests
from bs4 import BeautifulSoup
from markdownify import markdownify
from datetime import datetime

# Read URL from .note file
with open('.note', 'r') as file:
    url = file.read().strip()

# Append "/rss" to the URL
rss_url = url + "/rss"

# Parse the RSS feed
feed = feedparser.parse(rss_url)

# Extract title, URL, and date from each entry in the feed
for entry in feed.entries:
    title = entry.title
    entry_url = entry.link
    date = entry.published

    # Convert the date to ISO format with timezone
    parsed_date = datetime.strptime(date, '%a, %d %b %Y %H:%M:%S %z')
    formatted_date = parsed_date.isoformat()

    # Fetch the HTML content from the entry URL
    response = requests.get(entry_url)
    html_content = response.content

    # Parse the HTML content
    soup = BeautifulSoup(html_content, 'html.parser')
    content_div = soup.find(class_='note-common-styles__textnote-body')

    # Convert the HTML content to Markdown
    if content_div:
        markdown_content = markdownify(str(content_div))
    else:
        markdown_content = "Content not found."

    # Featured image
    featured_image = soup.find(class_='o-noteEyecatch__image')
    if featured_image:
        markdown_content = markdownify(str(featured_image)) + "\n\n" + markdown_content

    # Format title and content
    formatted_title = title.replace(" ", "-").lower()
    formatted_content = f"""---
title: "{title}"
date: "{formatted_date}"
---
{markdown_content}
"""

    # Save the formatted content to a file
    filename = f"./content/posts/note/{formatted_title}.md"
    with open(filename, 'w') as file:
        file.write(formatted_content)
```

## Highlight.js と Mermaid

Markdown ファイル内のコードブロックをシンタックスハイライトするために、`highlight.js` を使用します。また、Mermaid というライブラリを使用して、フローチャートやシーケンス図を描画します。

```typescript
'use client'

import { useEffect } from 'react'
import hljs from 'highlight.js'
import mermaid from 'mermaid'

export default function Article({ raw }: { raw: string }) {
  useEffect(() => {
    hljs.highlightAll()
    mermaid.init({ startOnLoad: true }, 'pre code.language-mermaid', () => {
      const codeBlocks = document.querySelectorAll('code.language-mermaid')
      for (const codeBlock of codeBlocks) {
        let element = (codeBlock as HTMLElement)
        element.style.backgroundColor = 'initial'

        const preBlock = (element.parentNode as HTMLElement)
        preBlock.style.border = 'none'
        preBlock.style.textAlign = 'center'
        preBlock.style.backgroundColor = 'initial'
      }
    })
  }, [])

  return <article className="prose lg:prose-xl" dangerouslySetInnerHTML={{ __html: raw }} />
}
```

## まとめ

Next.js は、React 開発者にとって非常に使いやすいフレームワークです。静的サイト生成（SSG）とインクリメンタル静的再生成（ISR）をサポートしており、高速なパフォーマンスと SEO を実現できます。また、Markdown ファイルを HTML に変換するためのライブラリも豊富に揃っています。これにより、Next.js を使用してブログを作成することが非常に簡単になりました。次の PHP プロジェクトで、ぜひ Next.js を試してみてください！

最後に、このブログのソースコードは https://github.com/mayocream/rocks で公開されています。ぜひご覧ください！


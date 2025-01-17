'use client'

import { useEffect } from 'react'
import hljs from 'highlight.js'

export default function Article({ raw }: { raw: string }) {
  useEffect(() => {
    hljs.highlightAll()
  }, [])

  return <article className="prose lg:prose-xl" dangerouslySetInnerHTML={{ __html: raw }} />
}

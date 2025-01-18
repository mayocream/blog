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

  return <main className="prose lg:prose-xl" dangerouslySetInnerHTML={{ __html: raw }} />
}

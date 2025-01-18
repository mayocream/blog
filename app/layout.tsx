import type { Metadata } from 'next'
import { Noto_Sans_JP, Noto_Sans_SC, Noto_Sans } from 'next/font/google'
import './globals.css'

const NotoSansJP = Noto_Sans_JP({ subsets: ['latin'] })
const NotoSansSC = Noto_Sans_SC({ subsets: ['latin'] })
const NotoSans = Noto_Sans({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mayo Rocks!',
  description: "Mayo's Blog",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`${NotoSans.className} ${NotoSansJP.className} ${NotoSansSC.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}

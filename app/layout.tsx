import type { Metadata } from 'next'
import { Noto_Sans_JP } from 'next/font/google'
import './globals.css'

const noto = Noto_Sans_JP({ subsets: ['latin'], weight: ['400','500','700','900'] })

export const metadata: Metadata = {
  title: 'VisionClinic | 視機能評価・ビジョントレーニング',
  description: '眼球トラッキングと両眼視チェックからAIが個別ビジョントレーニングを処方。機能向上を目的とした視覚機能プログラム',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${noto.className} bg-gray-50 text-gray-900 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}

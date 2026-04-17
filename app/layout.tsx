import type { Metadata } from 'next'
import { Noto_Sans_JP } from 'next/font/google'
import './globals.css'

const noto = Noto_Sans_JP({ subsets: ['latin'], weight: ['400','500','700','900'] })

export const metadata: Metadata = {
  title: 'VisionClinic | 視機能評価・ビジョントレーニング',
  description: '眼球トラッキングと両眼視チェックからAIが個別ビジョントレーニングを処方。機能向上を目的とした視覚機能プログラム',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VisionClinic',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
  themeColor: '#4f46e5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className={`${noto.className} bg-gray-50 text-gray-900 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}

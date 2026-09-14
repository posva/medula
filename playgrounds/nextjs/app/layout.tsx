import type { ReactNode } from 'react'
import { McpDevtools } from 'medula/next'
import './globals.css'

export const metadata = {
  title: 'medula next playground',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* development only: hook bootstrap + page script */}
        <McpDevtools />
      </head>
      <body>{children}</body>
    </html>
  )
}

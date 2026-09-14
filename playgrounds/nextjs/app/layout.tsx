import type { ReactNode } from 'react'
import { McpDevtools } from 'mcp-devtools/next'
import './globals.css'

export const metadata = {
  title: 'mcp-devtools next playground',
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

import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'mcp-devtools next playground',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <script type="module" src="/__mcp-devtools/connect.js" />
        )}
      </body>
    </html>
  )
}

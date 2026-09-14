import type { ReactNode } from 'react'
import { reactDevtoolsHookScript } from 'mcp-devtools/next'
import './globals.css'

export const metadata = {
  title: 'mcp-devtools next playground',
}

const isDev = process.env.NODE_ENV === 'development'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* must run before React: enables the mcp-devtools_react_* component tools */}
        {isDev && <script dangerouslySetInnerHTML={{ __html: reactDevtoolsHookScript }} />}
      </head>
      <body>
        {children}
        {isDev && <script type="module" src="/__mcp-devtools/connect.js" />}
      </body>
    </html>
  )
}

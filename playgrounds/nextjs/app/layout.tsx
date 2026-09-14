import type { ReactNode } from 'react'
import { Medula } from 'medula/next'
import './globals.css'

export const metadata = {
  title: 'medula next playground',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* development only: hook shims, must run before React */}
        <Medula />
      </head>
      <body>
        {children}
        {/* the hub UI bootstrap: floating dock + the medula page script */}
        <script type="module" src="/__devframes/embedded.js" />
      </body>
    </html>
  )
}

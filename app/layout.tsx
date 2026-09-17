import './globals.css'

export const metadata = {
  title: 'iMersSUPA',
  description: 'Membership & Digital Content Platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}

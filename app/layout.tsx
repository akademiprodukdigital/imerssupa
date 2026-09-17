import './globals.css'

export const metadata = {
  title: 'iMersSUPA',
  description:
    'Membership & Digital Content Platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var saved = localStorage.getItem('imerssupa-theme') || 'system';

                  var resolved = saved;

                  if (saved === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
                      ? 'dark'
                      : 'light';
                  }

                  document.documentElement.dataset.theme = resolved;
                  document.documentElement.dataset.themeMode = saved;
                  document.documentElement.style.colorScheme = resolved;
                } catch (e) {
                  document.documentElement.dataset.theme = 'dark';
                  document.documentElement.dataset.themeMode = 'system';
                  document.documentElement.style.colorScheme = 'dark';
                }
              })();
            `,
          }}
        />
      </head>

      <body>{children}</body>
    </html>
  )
}

'use client'

import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'imerssupa-theme'

export default function ThemeSwitcher() {
  const [theme, setTheme] =
    useState<ThemeMode>('system')

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved =
      localStorage.getItem(STORAGE_KEY) as
        | ThemeMode
        | null

    const initialTheme: ThemeMode =
      saved === 'light' ||
      saved === 'dark' ||
      saved === 'system'
        ? saved
        : 'system'

    setTheme(initialTheme)
    applyTheme(initialTheme)
    setMounted(true)

    const media = window.matchMedia(
      '(prefers-color-scheme: dark)'
    )

    const handleSystemChange = () => {
      const current =
        localStorage.getItem(
          STORAGE_KEY
        ) as ThemeMode | null

      if (!current || current === 'system') {
        applyTheme('system')
      }
    }

    media.addEventListener(
      'change',
      handleSystemChange
    )

    return () => {
      media.removeEventListener(
        'change',
        handleSystemChange
      )
    }
  }, [])

  function applyTheme(mode: ThemeMode) {
    const root = document.documentElement

    let resolved: 'light' | 'dark'

    if (mode === 'system') {
      resolved = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches
        ? 'dark'
        : 'light'
    } else {
      resolved = mode
    }

    root.dataset.theme = resolved
    root.dataset.themeMode = mode
    root.style.colorScheme = resolved
  }

  function changeTheme(mode: ThemeMode) {
    setTheme(mode)

    localStorage.setItem(
      STORAGE_KEY,
      mode
    )

    applyTheme(mode)
  }

  if (!mounted) {
    return (
      <div
        className="theme-switcher theme-loading"
        aria-hidden="true"
        style={{
          width: 118,
          height: 38,
          flex: '0 0 auto',
        }}
      />
    )
  }

  return (
    <div
      className="theme-switcher"
      aria-label="Pilih tema"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        width: 'auto',
        minWidth: 0,
        maxWidth: 'none',
        flex: '0 0 auto',
        padding: 4,
        borderRadius: 14,
        whiteSpace: 'nowrap',
      }}
    >
      <button
        type="button"
        title="Light Mode"
        aria-label="Light Mode"
        className={
          theme === 'light'
            ? 'theme-option active'
            : 'theme-option'
        }
        onClick={() =>
          changeTheme('light')
        }
        style={{
          width: 32,
          minWidth: 32,
          height: 30,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 32px',
          borderRadius: 10,
        }}
      >
        <span
          className="theme-symbol"
          aria-hidden="true"
          style={{
            display: 'block',
            width: 'auto',
            lineHeight: 1,
            fontSize: 14,
          }}
        >
          ☀
        </span>

      </button>

      <button
        type="button"
        title="Dark Mode"
        aria-label="Dark Mode"
        className={
          theme === 'dark'
            ? 'theme-option active'
            : 'theme-option'
        }
        onClick={() =>
          changeTheme('dark')
        }
        style={{
          width: 32,
          minWidth: 32,
          height: 30,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 32px',
          borderRadius: 10,
        }}
      >
        <span
          className="theme-symbol"
          aria-hidden="true"
          style={{
            display: 'block',
            width: 'auto',
            lineHeight: 1,
            fontSize: 14,
          }}
        >
          ◐
        </span>

      </button>

      <button
        type="button"
        title="Ikuti Tema Perangkat"
        aria-label="System Theme"
        className={
          theme === 'system'
            ? 'theme-option active'
            : 'theme-option'
        }
        onClick={() =>
          changeTheme('system')
        }
        style={{
          width: 32,
          minWidth: 32,
          height: 30,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 32px',
          borderRadius: 10,
        }}
      >
        <span
          className="theme-symbol"
          aria-hidden="true"
          style={{
            display: 'block',
            width: 'auto',
            lineHeight: 1,
            fontSize: 14,
          }}
        >
          ◫
        </span>

      </button>
    </div>
  )
}

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
      />
    )
  }

  return (
    <div
      className="theme-switcher"
      aria-label="Pilih tema"
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
      >
        <span className="theme-symbol">
          ☀
        </span>

        <span className="theme-text">
          Light
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
      >
        <span className="theme-symbol">
          ◐
        </span>

        <span className="theme-text">
          Dark
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
      >
        <span className="theme-symbol">
          ◫
        </span>

        <span className="theme-text">
          System
        </span>
      </button>
    </div>
  )
}

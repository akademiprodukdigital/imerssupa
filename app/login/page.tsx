'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage('Login berhasil.')
    router.push('/member-test')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, #08111f 0%, #172554 50%, #312e81 100%)',
        padding: '24px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px',
          borderRadius: '24px',
          background:
            'linear-gradient(145deg, rgba(255,255,255,.16), rgba(255,255,255,.06))',
          border: '1px solid rgba(255,255,255,.18)',
          boxShadow: '0 24px 70px rgba(0,0,0,.35)',
          color: '#fff',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            opacity: 0.7,
            marginBottom: '8px',
          }}
        >
          MEMBERSHIP PLATFORM
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: '34px',
          }}
        >
          iMersSUPA
        </h1>

        <p
          style={{
            marginTop: '8px',
            marginBottom: '28px',
            opacity: 0.75,
          }}
        >
          Login ke akun member Anda
        </p>

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="member@email.com"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,.2)',
              marginBottom: '18px',
              fontSize: '15px',
            }}
          />

          <label
            style={{
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,.2)',
              marginBottom: '22px',
              fontSize: '15px',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              border: 0,
              borderRadius: '12px',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: '16px',
              fontWeight: 700,
              background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
              color: '#08111f',
            }}
          >
            {loading ? 'Menghubungkan...' : 'Login Member'}
          </button>
        </form>

        {message && (
          <div
            style={{
              marginTop: '18px',
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,.1)',
              fontSize: '14px',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  )
}

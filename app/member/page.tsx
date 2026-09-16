'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
}

export default function MemberDashboard() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      setEmail(user.email || '')

      const { data, error: productError } = await supabase
        .from('products')
        .select('id, name, slug, description, status')
        .order('created_at', { ascending: false })

      if (productError) {
        setError(productError.message)
        setLoading(false)
        return
      }

      setProducts(data || [])
      setLoading(false)
    }

    loadDashboard()
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07111f',
          color: '#fff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        Memuat Member Area...
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #07111f 0%, #111c44 55%, #312e81 100%)',
        color: '#fff',
        fontFamily: 'Arial, sans-serif',
        padding: '32px',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '38px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '13px',
                opacity: 0.65,
                marginBottom: '7px',
                letterSpacing: '1px',
              }}
            >
              MEMBER AREA
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
                margin: '8px 0 0',
                opacity: 0.7,
              }}
            >
              {email}
            </p>
          </div>

          <button
            onClick={logout}
            style={{
              border: '1px solid rgba(255,255,255,.18)',
              background: 'rgba(255,255,255,.08)',
              color: '#fff',
              padding: '11px 18px',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </header>

        <section
          style={{
            padding: '28px',
            borderRadius: '24px',
            marginBottom: '30px',
            background:
              'linear-gradient(135deg, rgba(59,130,246,.22), rgba(139,92,246,.22))',
            border: '1px solid rgba(255,255,255,.12)',
            boxShadow: '0 20px 60px rgba(0,0,0,.18)',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              opacity: 0.7,
            }}
          >
            Selamat datang kembali
          </div>

          <h2
            style={{
              fontSize: '28px',
              margin: '8px 0',
            }}
          >
            Produk Saya
          </h2>

          <p
            style={{
              margin: 0,
              opacity: 0.72,
            }}
          >
            Semua produk digital yang aktif di akun Anda akan tampil di sini.
          </p>
        </section>

        {error && (
          <div
            style={{
              padding: '18px',
              borderRadius: '14px',
              background: '#7f1d1d',
              marginBottom: '24px',
            }}
          >
            {error}
          </div>
        )}

        {!error && products.length === 0 && (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              borderRadius: '20px',
              background: 'rgba(255,255,255,.07)',
              border: '1px solid rgba(255,255,255,.1)',
            }}
          >
            <h3>Belum ada produk</h3>

            <p style={{ opacity: 0.65 }}>
              Belum ada produk aktif pada akun ini.
            </p>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '22px',
          }}
        >
          {products.map((product) => (
            <article
              key={product.id}
              style={{
                padding: '24px',
                borderRadius: '22px',
                background:
                  'linear-gradient(145deg, rgba(255,255,255,.14), rgba(255,255,255,.06))',
                border: '1px solid rgba(255,255,255,.12)',
                boxShadow: '0 18px 45px rgba(0,0,0,.16)',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  background: 'rgba(52,211,153,.15)',
                  color: '#6ee7b7',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                ACCESS ACTIVE
              </div>

              <h3
                style={{
                  fontSize: '21px',
                  margin: '0 0 10px',
                }}
              >
                {product.name}
              </h3>

              <p
                style={{
                  minHeight: '42px',
                  opacity: 0.65,
                  lineHeight: 1.5,
                }}
              >
                {product.description ||
                  'Konten digital tersedia untuk akun Anda.'}
              </p>

              <button
                onClick={() =>
                  router.push(`/member/product/${product.slug}`)
                }
                style={{
                  marginTop: '12px',
                  width: '100%',
                  border: 0,
                  borderRadius: '12px',
                  padding: '13px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  background:
                    'linear-gradient(90deg, #60a5fa, #a78bfa)',
                  color: '#08111f',
                }}
              >
                Buka Produk →
              </button>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}

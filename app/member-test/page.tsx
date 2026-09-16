'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function MemberTestPage() {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [product, setProduct] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function runTest() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('SESSION TIDAK DITEMUKAN')
        setLoading(false)
        return
      }

      setEmail(user.email || '')

      const { data, error: productError } = await supabase
        .from('products')
        .select('id, name, slug, status')
        .eq('slug', 'imerssupa-security-test')
        .maybeSingle()

      if (productError) {
        setError(productError.message)
        setLoading(false)
        return
      }

      setProduct(data)
      setLoading(false)
    }

    runTest()
  }, [])

  if (loading) {
    return (
      <main style={{ padding: 40, fontFamily: 'Arial' }}>
        Checking Supabase session & entitlement...
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '50px',
        fontFamily: 'Arial',
        background: '#08111f',
        color: 'white',
      }}
    >
      <h1>iMersSUPA Security Test</h1>

      <p>
        Login sebagai: <strong>{email || '-'}</strong>
      </p>

      {error ? (
        <div
          style={{
            marginTop: 25,
            padding: 20,
            borderRadius: 14,
            background: '#7f1d1d',
          }}
        >
          ❌ {error}
        </div>
      ) : product ? (
        <div
          style={{
            marginTop: 25,
            padding: 24,
            borderRadius: 18,
            background:
              'linear-gradient(135deg, #064e3b, #065f46, #047857)',
          }}
        >
          <h2>✅ ENTITLEMENT BERHASIL</h2>

          <p>
            Member berhasil membaca produk melalui Supabase RLS.
          </p>

          <hr style={{ opacity: 0.25 }} />

          <p><strong>Product:</strong> {product.name}</p>
          <p><strong>Slug:</strong> {product.slug}</p>
          <p><strong>Status:</strong> {product.status}</p>
          <p><strong>Product ID:</strong> {product.id}</p>
        </div>
      ) : (
        <div
          style={{
            marginTop: 25,
            padding: 24,
            borderRadius: 18,
            background: '#78350f',
          }}
        >
          <h2>🔒 PRODUCT TIDAK TERLIHAT</h2>

          <p>
            Session berhasil, tetapi RLS tidak memberikan akses ke produk test.
          </p>
        </div>
      )}
    </main>
  )
}

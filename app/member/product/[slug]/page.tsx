'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'

type Product = {
  id: string
  name: string
  slug: string
  description: string | null
}

type Section = {
  id: string
  title: string
  sort_order: number
}

export default function ProductReaderPage() {
  const router = useRouter()
  const params = useParams()

  const slug = params.slug as string

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProduct() {
      /*
       * 1. Pastikan user login
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/login')
        return
      }

      setEmail(user.email || '')

      /*
       * 2. Ambil produk.
       *
       * RLS Supabase yang menentukan apakah member
       * boleh melihat produk ini.
       */
      const {
        data: productData,
        error: productError,
      } = await supabase
        .from('products')
        .select('id, name, slug, description')
        .eq('slug', slug)
        .maybeSingle()

      if (productError) {
        setError(productError.message)
        setLoading(false)
        return
      }

      /*
       * Kalau produk tidak ditemukan,
       * bisa berarti slug salah ATAU member tidak punya akses.
       *
       * Kita sengaja tidak membocorkan detail entitlement.
       */
      if (!productData) {
        setError('Produk tidak ditemukan atau akun Anda tidak memiliki akses.')
        setLoading(false)
        return
      }

      setProduct(productData)

      /*
       * 3. Ambil section/module produk.
       *
       * Lagi-lagi RLS yang menjaga datanya.
       */
      const {
        data: sectionData,
        error: sectionError,
      } = await supabase
        .from('product_sections')
        .select('id, title, sort_order')
        .eq('product_id', productData.id)
        .order('sort_order', { ascending: true })

      if (sectionError) {
        setError(sectionError.message)
        setLoading(false)
        return
      }

      setSections(sectionData || [])
      setLoading(false)
    }

    loadProduct()
  }, [slug, router])

  if (loading) {
    return (
      <main style={styles.loading}>
        Membuka produk...
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <button
          onClick={() => router.push('/member')}
          style={styles.backButton}
        >
          ← Produk Saya
        </button>

        {error ? (
          <div style={styles.errorCard}>
            <div style={styles.errorIcon}>🔒</div>

            <h2 style={{ marginTop: 0 }}>
              Akses Tidak Tersedia
            </h2>

            <p style={styles.muted}>
              {error}
            </p>

            <button
              onClick={() => router.push('/member')}
              style={styles.primaryButton}
            >
              Kembali ke Member Area
            </button>
          </div>
        ) : (
          <>
            <section style={styles.hero}>
              <div style={styles.badge}>
                MEMBER CONTENT
              </div>

              <h1 style={styles.title}>
                {product?.name}
              </h1>

              <p style={styles.description}>
                {product?.description ||
                  'Konten digital khusus untuk member.'}
              </p>

              <div style={styles.member}>
                Login sebagai: {email}
              </div>
            </section>

            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.eyebrow}>
                  LEARNING AREA
                </div>

                <h2 style={styles.sectionTitle}>
                  Materi Produk
                </h2>
              </div>

              <div style={styles.counter}>
                {sections.length} Module
              </div>
            </div>

            {sections.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={styles.emptyIcon}>
                  📚
                </div>

                <h3>
                  Materi belum tersedia
                </h3>

                <p style={styles.muted}>
                  Produk ini sudah aktif di akun Anda,
                  tetapi belum memiliki section atau materi.
                </p>
              </div>
            ) : (
              <div style={styles.grid}>
                {sections.map((section, index) => (
                  <article
                    key={section.id}
                    style={styles.moduleCard}
                  >
                    <div style={styles.moduleNumber}>
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={styles.moduleLabel}>
                        MODULE
                      </div>

                      <h3 style={styles.moduleTitle}>
                        {section.title}
                      </h3>
                    </div>

                    <div style={styles.arrow}>
                      →
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(135deg,#07111f 0%,#101c42 50%,#312e81 100%)',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
    padding: '38px 24px 70px',
  },

  container: {
    maxWidth: '1100px',
    margin: '0 auto',
  },

  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#07111f',
    color: '#fff',
    fontFamily: 'Arial, sans-serif',
  },

  backButton: {
    background: 'rgba(255,255,255,.08)',
    border: '1px solid rgba(255,255,255,.13)',
    color: '#fff',
    padding: '11px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    marginBottom: '25px',
  },

  hero: {
    padding: '36px',
    borderRadius: '26px',
    background:
      'linear-gradient(135deg,rgba(59,130,246,.25),rgba(139,92,246,.27))',
    border: '1px solid rgba(255,255,255,.13)',
    boxShadow: '0 25px 70px rgba(0,0,0,.2)',
    marginBottom: '38px',
  },

  badge: {
    display: 'inline-block',
    padding: '7px 11px',
    borderRadius: '999px',
    background: 'rgba(52,211,153,.15)',
    color: '#6ee7b7',
    fontSize: '11px',
    letterSpacing: '1px',
    fontWeight: 700,
    marginBottom: '18px',
  },

  title: {
    fontSize: '34px',
    margin: '0 0 12px',
  },

  description: {
    fontSize: '16px',
    opacity: 0.72,
    lineHeight: 1.6,
    maxWidth: '700px',
  },

  member: {
    marginTop: '22px',
    fontSize: '13px',
    opacity: 0.55,
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '18px',
  },

  eyebrow: {
    fontSize: '11px',
    letterSpacing: '1.5px',
    opacity: 0.55,
  },

  sectionTitle: {
    margin: '5px 0 0',
    fontSize: '25px',
  },

  counter: {
    padding: '8px 13px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,.08)',
    fontSize: '12px',
  },

  grid: {
    display: 'grid',
    gap: '14px',
  },

  moduleCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '22px',
    borderRadius: '18px',
    background:
      'linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.06))',
    border: '1px solid rgba(255,255,255,.11)',
  },

  moduleNumber: {
    width: '50px',
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '14px',
    background:
      'linear-gradient(135deg,#60a5fa,#a78bfa)',
    color: '#08111f',
    fontWeight: 800,
  },

  moduleLabel: {
    fontSize: '10px',
    opacity: 0.5,
    letterSpacing: '1.5px',
  },

  moduleTitle: {
    margin: '5px 0 0',
    fontSize: '17px',
  },

  arrow: {
    fontSize: '24px',
    opacity: 0.55,
  },

  emptyCard: {
    textAlign: 'center',
    padding: '55px 25px',
    borderRadius: '22px',
    background:
      'linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,255,255,.05))',
    border: '1px solid rgba(255,255,255,.1)',
  },

  emptyIcon: {
    fontSize: '35px',
    marginBottom: '12px',
  },

  muted: {
    opacity: 0.65,
    lineHeight: 1.6,
  },

  errorCard: {
    maxWidth: '600px',
    margin: '80px auto',
    padding: '35px',
    borderRadius: '24px',
    background:
      'linear-gradient(135deg,rgba(127,29,29,.6),rgba(76,29,149,.4))',
    border: '1px solid rgba(255,255,255,.12)',
    textAlign: 'center',
  },

  errorIcon: {
    fontSize: '40px',
    marginBottom: '15px',
  },

  primaryButton: {
    marginTop: '15px',
    border: 0,
    padding: '13px 20px',
    borderRadius: '12px',
    background:
      'linear-gradient(90deg,#60a5fa,#a78bfa)',
    fontWeight: 700,
    cursor: 'pointer',
  },
}

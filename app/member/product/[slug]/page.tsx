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

type Content = {
  id: string
  product_id: string
  section_id: string | null
  title: string
  content_type: 'text' | 'html' | 'video' | 'external_url'
  content_text: string | null
  external_url: string | null
  sort_order: number
  is_published: boolean
  is_preview: boolean
}

export default function MemberProductPage() {
  const params = useParams()
  const router = useRouter()

  const slug = params.slug as string

  const [email, setEmail] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [contents, setContents] = useState<Content[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProduct()
  }, [slug])

  async function loadProduct() {
    setLoading(true)
    setError('')

    // ========================================================
    // CHECK AUTH
    // ========================================================

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/login')
      return
    }

    setEmail(user.email ?? '')

    // ========================================================
    // LOAD PRODUCT
    // RLS akan menentukan apakah member berhak melihat produk.
    // ========================================================

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

    if (!productData) {
      setError('Produk tidak ditemukan atau akun ini tidak memiliki akses.')
      setLoading(false)
      return
    }

    setProduct(productData)

    // ========================================================
    // LOAD SECTIONS / MODULES
    // ========================================================

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

    setSections(sectionData ?? [])

    // ========================================================
    // LOAD CONTENT / LESSONS
    //
    // PENTING:
    // Query dilakukan sebagai member yang sedang login.
    // Jadi hasilnya melewati RLS Supabase.
    // ========================================================

    const {
      data: contentData,
      error: contentError,
    } = await supabase
      .from('product_contents')
      .select(`
        id,
        product_id,
        section_id,
        title,
        content_type,
        content_text,
        external_url,
        sort_order,
        is_published,
        is_preview
      `)
      .eq('product_id', productData.id)
      .order('sort_order', { ascending: true })

    if (contentError) {
      setError(contentError.message)
      setLoading(false)
      return
    }

    setContents(contentData ?? [])

    setLoading(false)
  }

  function getContents(sectionId: string) {
    return contents
      .filter((content) => content.section_id === sectionId)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  function getTypeLabel(type: Content['content_type']) {
    switch (type) {
      case 'text':
        return 'TEXT'

      case 'html':
        return 'HTML'

      case 'video':
        return 'VIDEO'

      case 'external_url':
        return 'LINK'

      default:
        return type
    }
  }

  function getTypeIcon(type: Content['content_type']) {
    switch (type) {
      case 'video':
        return '▶'

      case 'external_url':
        return '↗'

      case 'html':
        return '◆'

      default:
        return '●'
    }
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <main style={styles.centerPage}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingIcon}>S</div>

          <h2 style={{ margin: 0 }}>
            Membuka Member Content...
          </h2>

          <p style={styles.muted}>
            Memeriksa akses dan mengambil materi dari Supabase.
          </p>
        </div>
      </main>
    )
  }

  // ==========================================================
  // ERROR / NO ACCESS
  // ==========================================================

  if (error || !product) {
    return (
      <main style={styles.centerPage}>
        <div style={styles.errorCard}>
          <div style={styles.errorBadge}>
            ACCESS CHECK
          </div>

          <h1 style={{ marginBottom: 10 }}>
            Materi tidak dapat dibuka
          </h1>

          <p style={styles.muted}>
            {error || 'Produk tidak tersedia.'}
          </p>

          <button
            onClick={() => router.push('/member')}
            style={styles.primaryButton}
          >
            Kembali ke Member Area
          </button>
        </div>
      </main>
    )
  }

  // ==========================================================
  // PRODUCT PAGE
  // ==========================================================

  return (
    <main style={styles.page}>

      <div style={styles.container}>

        {/* TOP NAV */}

        <div style={styles.topNav}>

          <button
            onClick={() => router.push('/member')}
            style={styles.backButton}
          >
            ← Produk Saya
          </button>

          <div style={styles.userBox}>
            <span style={styles.onlineDot}></span>
            {email}
          </div>

        </div>


        {/* PRODUCT HERO */}

        <section style={styles.hero}>

          <div style={styles.heroGlow}></div>

          <div style={styles.heroContent}>

            <div style={styles.badge}>
              MEMBER CONTENT
            </div>

            <h1 style={styles.title}>
              {product.name}
            </h1>

            <p style={styles.description}>
              {product.description || 'Digital member content'}
            </p>

            <div style={styles.heroMeta}>

              <div style={styles.metaItem}>
                <strong>{sections.length}</strong>
                <span>Module</span>
              </div>

              <div style={styles.metaDivider}></div>

              <div style={styles.metaItem}>
                <strong>{contents.length}</strong>
                <span>Lesson</span>
              </div>

              <div style={styles.metaDivider}></div>

              <div style={styles.metaItem}>
                <strong>Active</strong>
                <span>Access</span>
              </div>

            </div>

          </div>

        </section>


        {/* LEARNING AREA */}

        <section style={styles.learningArea}>

          <div style={styles.sectionHeader}>

            <div>
              <div style={styles.smallLabel}>
                LEARNING AREA
              </div>

              <h2 style={styles.sectionTitle}>
                Materi Produk
              </h2>
            </div>

            <div style={styles.lessonCounter}>
              {contents.length} Lesson
            </div>

          </div>


          {/* MODULES */}

          <div style={styles.moduleList}>

            {sections.map((section, sectionIndex) => {

              const lessons = getContents(section.id)

              return (
                <div
                  key={section.id}
                  style={styles.moduleCard}
                >

                  {/* MODULE HEADER */}

                  <div style={styles.moduleHeader}>

                    <div style={styles.moduleNumber}>
                      {String(sectionIndex + 1).padStart(2, '0')}
                    </div>

                    <div style={{ flex: 1 }}>

                      <div style={styles.moduleLabel}>
                        MODULE
                      </div>

                      <h3 style={styles.moduleTitle}>
                        {section.title}
                      </h3>

                    </div>

                    <div style={styles.moduleCount}>
                      {lessons.length} Lesson
                    </div>

                  </div>


                  {/* LESSON LIST */}

                  <div style={styles.lessonList}>

                    {lessons.length === 0 ? (

                      <div style={styles.emptyLesson}>
                        Belum ada materi di module ini.
                      </div>

                    ) : (

                      lessons.map((lesson, lessonIndex) => (

                        <div
                          key={lesson.id}
                          style={styles.lessonRow}
                        >

                          <div style={styles.lessonIcon}>
                            {getTypeIcon(lesson.content_type)}
                          </div>


                          <div style={styles.lessonInfo}>

                            <div style={styles.lessonTitle}>
                              {String(lessonIndex + 1).padStart(2, '0')}
                              {' · '}
                              {lesson.title}
                            </div>

                            <div style={styles.lessonMeta}>

                              <span style={styles.typeBadge}>
                                {getTypeLabel(lesson.content_type)}
                              </span>

                              {lesson.is_preview && (
                                <span style={styles.previewBadge}>
                                  PREVIEW
                                </span>
                              )}

                            </div>

                          </div>


                          <div style={styles.lessonArrow}>
                            →
                          </div>

                        </div>

                      ))

                    )}

                  </div>

                </div>
              )
            })}

          </div>

        </section>


        {/* SECURITY STATUS */}

        <div style={styles.securityBox}>

          <div style={styles.securityIcon}>
            ✓
          </div>

          <div>
            <strong>
              Secure Member Access
            </strong>

            <div style={styles.securityText}>
              Materi ini berhasil dibaca melalui authenticated
              Supabase RLS.
            </div>
          </div>

        </div>

      </div>

    </main>
  )
}


// ============================================================
// STYLES
// ============================================================

const styles: Record<string, React.CSSProperties> = {

  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, #172554 0%, #070b18 35%, #030712 100%)',
    color: '#ffffff',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '32px 18px 70px',
  },

  container: {
    width: '100%',
    maxWidth: 1050,
    margin: '0 auto',
  },

  centerPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(circle at top, #172554, #030712 65%)',
    color: '#ffffff',
    padding: 20,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, sans-serif',
  },

  loadingCard: {
    width: '100%',
    maxWidth: 460,
    textAlign: 'center',
    padding: 38,
    borderRadius: 26,
    background:
      'linear-gradient(145deg, rgba(30,64,175,.28), rgba(88,28,135,.18))',
    border: '1px solid rgba(255,255,255,.12)',
    boxShadow: '0 30px 80px rgba(0,0,0,.35)',
  },

  loadingIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    margin: '0 auto 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 24,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
  },

  errorCard: {
    width: '100%',
    maxWidth: 520,
    padding: 38,
    borderRadius: 26,
    textAlign: 'center',
    background:
      'linear-gradient(145deg, rgba(127,29,29,.28), rgba(30,41,59,.35))',
    border: '1px solid rgba(248,113,113,.22)',
  },

  errorBadge: {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.4,
    background: 'rgba(239,68,68,.14)',
    color: '#fca5a5',
    marginBottom: 10,
  },

  muted: {
    color: '#94a3b8',
    lineHeight: 1.7,
  },

  primaryButton: {
    marginTop: 16,
    border: 0,
    borderRadius: 12,
    padding: '12px 18px',
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
    color: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  },

  topNav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 22,
    flexWrap: 'wrap',
  },

  backButton: {
    border: '1px solid rgba(255,255,255,.12)',
    background: 'rgba(15,23,42,.55)',
    color: '#cbd5e1',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 700,
  },

  userBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#94a3b8',
  },

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#22c55e',
    boxShadow: '0 0 14px rgba(34,197,94,.8)',
  },

  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 30,
    border: '1px solid rgba(255,255,255,.12)',
    background:
      'linear-gradient(135deg, rgba(30,64,175,.48), rgba(88,28,135,.42), rgba(15,23,42,.85))',
    boxShadow: '0 30px 80px rgba(0,0,0,.35)',
  },

  heroGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: '50%',
    right: -80,
    top: -160,
    background: 'rgba(59,130,246,.22)',
    filter: 'blur(30px)',
  },

  heroContent: {
    position: 'relative',
    padding: '42px 38px',
  },

  badge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.8,
    padding: '7px 11px',
    borderRadius: 999,
    background: 'rgba(255,255,255,.1)',
    color: '#bfdbfe',
    border: '1px solid rgba(255,255,255,.1)',
  },

  title: {
    margin: '16px 0 8px',
    fontSize: 'clamp(30px, 5vw, 50px)',
    lineHeight: 1.05,
    letterSpacing: '-1.5px',
  },

  description: {
    margin: 0,
    color: '#cbd5e1',
    lineHeight: 1.7,
    maxWidth: 700,
  },

  heroMeta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 30,
  },

  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },

  metaDivider: {
    width: 1,
    height: 34,
    background: 'rgba(255,255,255,.14)',
  },

  learningArea: {
    marginTop: 36,
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    marginBottom: 18,
  },

  smallLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.8,
    color: '#818cf8',
  },

  sectionTitle: {
    margin: '5px 0 0',
    fontSize: 27,
  },

  lessonCounter: {
    color: '#94a3b8',
    fontSize: 13,
    padding: '8px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.08)',
  },

  moduleList: {
    display: 'grid',
    gap: 18,
  },

  moduleCard: {
    overflow: 'hidden',
    borderRadius: 22,
    background:
      'linear-gradient(135deg, rgba(30,41,59,.78), rgba(15,23,42,.9))',
    border: '1px solid rgba(255,255,255,.09)',
    boxShadow: '0 20px 50px rgba(0,0,0,.2)',
  },

  moduleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '20px 22px',
    background:
      'linear-gradient(90deg, rgba(37,99,235,.12), rgba(124,58,237,.08))',
    borderBottom: '1px solid rgba(255,255,255,.07)',
  },

  moduleNumber: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: 15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
    boxShadow: '0 10px 30px rgba(37,99,235,.25)',
  },

  moduleLabel: {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.4,
    color: '#818cf8',
  },

  moduleTitle: {
    margin: '3px 0 0',
    fontSize: 18,
  },

  moduleCount: {
    color: '#94a3b8',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },

  lessonList: {
    padding: '5px 14px 14px',
  },

  lessonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '15px 10px',
    borderBottom: '1px solid rgba(255,255,255,.06)',
  },

  lessonIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'linear-gradient(135deg, rgba(37,99,235,.24), rgba(124,58,237,.22))',
    color: '#bfdbfe',
    fontWeight: 900,
  },

  lessonInfo: {
    flex: 1,
    minWidth: 0,
  },

  lessonTitle: {
    fontWeight: 750,
    color: '#e5e7eb',
    lineHeight: 1.4,
  },

  lessonMeta: {
    display: 'flex',
    gap: 7,
    flexWrap: 'wrap',
    marginTop: 6,
  },

  typeBadge: {
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: 900,
    color: '#93c5fd',
  },

  previewBadge: {
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: 900,
    color: '#fcd34d',
  },

  lessonArrow: {
    fontSize: 20,
    color: '#64748b',
  },

  emptyLesson: {
    padding: 20,
    textAlign: 'center',
    color: '#64748b',
  },

  securityBox: {
    marginTop: 24,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: 17,
    borderRadius: 17,
    background:
      'linear-gradient(135deg, rgba(6,78,59,.28), rgba(15,23,42,.6))',
    border: '1px solid rgba(52,211,153,.15)',
  },

  securityIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(34,197,94,.14)',
    color: '#86efac',
    fontWeight: 900,
  },

  securityText: {
    marginTop: 3,
    fontSize: 12,
    color: '#94a3b8',
  },
}

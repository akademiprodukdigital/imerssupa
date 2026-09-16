'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'

type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  product_type?: string | null
  status?: string | null
}

type Section = {
  id: string
  product_id: string
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

type Progress = {
  id: string
  user_id: string
  content_id: string
  progress_percent: number
  completed: boolean
  last_position: number | null
  started_at: string | null
  completed_at: string | null
  updated_at: string | null
}

export default function MemberProductPage() {
  const params = useParams()
  const router = useRouter()

  const slug = params.slug as string

  const [email, setEmail] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [progressRows, setProgressRows] = useState<Progress[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProduct()
  }, [slug])

  // ==========================================================
  // LOAD PRODUCT + CONTENT + PROGRESS
  // ==========================================================

  async function loadProduct() {
    setLoading(true)
    setError('')

    // ========================================================
    // AUTH
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
    // PRODUCT
    // ========================================================

    const {
      data: productData,
      error: productError,
    } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (productError) {
      setError(productError.message)
      setLoading(false)
      return
    }

    if (!productData) {
      setError(
        'Produk tidak ditemukan atau akun ini tidak memiliki akses.'
      )
      setLoading(false)
      return
    }

    setProduct(productData)

    // ========================================================
    // SECTIONS
    // ========================================================

    const {
      data: sectionData,
      error: sectionError,
    } = await supabase
      .from('product_sections')
      .select('id, product_id, title, sort_order')
      .eq('product_id', productData.id)
      .order('sort_order', { ascending: true })

    if (sectionError) {
      setError(sectionError.message)
      setLoading(false)
      return
    }

    const loadedSections = sectionData ?? []
    setSections(loadedSections)

    // ========================================================
    // CONTENTS
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
      .eq('is_published', true)
      .order('sort_order', { ascending: true })

    if (contentError) {
      setError(contentError.message)
      setLoading(false)
      return
    }

    const loadedContents = contentData ?? []
    setContents(loadedContents)

    // ========================================================
    // MEMBER PROGRESS
    // ========================================================

    if (loadedContents.length > 0) {
      const contentIds = loadedContents.map((item) => item.id)

      const {
        data: progressData,
        error: progressError,
      } = await supabase
        .from('member_content_progress')
        .select(`
          id,
          user_id,
          content_id,
          progress_percent,
          completed,
          last_position,
          started_at,
          completed_at,
          updated_at
        `)
        .eq('user_id', user.id)
        .in('content_id', contentIds)

      if (progressError) {
        setError(progressError.message)
        setLoading(false)
        return
      }

      setProgressRows(progressData ?? [])
    } else {
      setProgressRows([])
    }

    setLoading(false)
  }

  // ==========================================================
  // PROGRESS MAP
  // ==========================================================

  const progressMap = useMemo(() => {
    const map = new Map<string, Progress>()

    for (const row of progressRows) {
      map.set(row.content_id, row)
    }

    return map
  }, [progressRows])

  // ==========================================================
  // PRODUCT PROGRESS
  // ==========================================================

  const totalLessons = contents.length

  const completedLessons = useMemo(() => {
    return contents.filter((content) => {
      const row = progressMap.get(content.id)

      return (
        row?.completed === true ||
        row?.progress_percent === 100
      )
    }).length
  }, [contents, progressMap])

  const productProgress =
    totalLessons > 0
      ? Math.round(
          (completedLessons / totalLessons) * 100
        )
      : 0

  const productCompleted =
    totalLessons > 0 &&
    completedLessons === totalLessons

  // ==========================================================
  // HELPERS
  // ==========================================================

  function getContentIcon(type: Content['content_type']) {
    switch (type) {
      case 'video':
        return '▶'

      case 'external_url':
        return '↗'

      case 'html':
        return '◇'

      case 'text':
      default:
        return '≡'
    }
  }

  function getContentLabel(type: Content['content_type']) {
    switch (type) {
      case 'video':
        return 'VIDEO'

      case 'external_url':
        return 'RESOURCE'

      case 'html':
        return 'HTML'

      case 'text':
      default:
        return 'LESSON'
    }
  }

  function getSectionContents(sectionId: string) {
    return contents
      .filter((content) => content.section_id === sectionId)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  function isLessonCompleted(contentId: string) {
    const row = progressMap.get(contentId)

    return (
      row?.completed === true ||
      row?.progress_percent === 100
    )
  }

  function openLesson(contentId: string) {
    router.push(
      `/member/product/${slug}/lesson/${contentId}`
    )
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <main style={styles.centerPage}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingLogo}>
            S
          </div>

          <h2 style={{ margin: '0 0 8px' }}>
            Membuka Produk...
          </h2>

          <p style={styles.muted}>
            Mengambil module, lesson, dan progress belajar.
          </p>
        </div>
      </main>
    )
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error || !product) {
    return (
      <main style={styles.centerPage}>
        <div style={styles.errorCard}>
          <div style={styles.errorBadge}>
            PRODUCT ACCESS
          </div>

          <h1 style={{ margin: '10px 0' }}>
            Produk tidak dapat dibuka
          </h1>

          <p style={styles.muted}>
            {error || 'Produk tidak tersedia.'}
          </p>

          <button
            onClick={() => router.push('/member')}
            style={styles.primaryButton}
          >
            ← Kembali ke Member Area
          </button>
        </div>
      </main>
    )
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* ====================================================
            TOP BAR
        ==================================================== */}

        <div style={styles.topBar}>
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

        {/* ====================================================
            HERO
        ==================================================== */}

        <section style={styles.hero}>
          <div style={styles.heroGlowOne}></div>
          <div style={styles.heroGlowTwo}></div>

          <div style={styles.heroContent}>
            <div style={styles.heroTop}>
              <div>
                <div style={styles.memberBadge}>
                  MEMBER PRODUCT
                </div>

                <h1 style={styles.productTitle}>
                  {product.name}
                </h1>

                <p style={styles.productDescription}>
                  {product.description ||
                    'Akses materi dan content digital Anda.'}
                </p>
              </div>

              <div
                style={
                  productCompleted
                    ? styles.completedProductBadge
                    : styles.activeBadge
                }
              >
                {productCompleted
                  ? '✓ COMPLETED'
                  : '✓ ACTIVE ACCESS'}
              </div>
            </div>

            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>
                  {sections.length}
                </div>

                <div style={styles.statLabel}>
                  Module
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statValue}>
                  {totalLessons}
                </div>

                <div style={styles.statLabel}>
                  Lesson
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statValue}>
                  {completedLessons}
                </div>

                <div style={styles.statLabel}>
                  Completed
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================
            PRODUCT PROGRESS
        ==================================================== */}

        <section style={styles.progressCard}>
          <div style={styles.progressTop}>
            <div>
              <div style={styles.progressEyebrow}>
                PROGRESS BELAJAR
              </div>

              <h2 style={styles.progressTitle}>
                {productCompleted
                  ? '✓ Produk Selesai'
                  : 'Lanjutkan Belajar'}
              </h2>

              <div style={styles.progressDescription}>
                {completedLessons} dari {totalLessons} lesson
                telah selesai.
              </div>
            </div>

            <div style={styles.progressNumber}>
              {productProgress}%
            </div>
          </div>

          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${productProgress}%`,
              }}
            ></div>
          </div>

          <div style={styles.progressFooter}>
            <span>
              {completedLessons} / {totalLessons} Lesson
            </span>

            <span>
              {productCompleted
                ? 'Semua materi selesai ✓'
                : `${totalLessons - completedLessons} lesson tersisa`}
            </span>
          </div>
        </section>

        {/* ====================================================
            CONTENT HEADER
        ==================================================== */}

        <div style={styles.contentHeader}>
          <div>
            <div style={styles.contentEyebrow}>
              COURSE CONTENT
            </div>

            <h2 style={styles.contentTitle}>
              Materi Pembelajaran
            </h2>
          </div>

          <div style={styles.contentCount}>
            {sections.length} Module • {totalLessons} Lesson
          </div>
        </div>

        {/* ====================================================
            SECTIONS
        ==================================================== */}

        <div style={styles.sectionList}>
          {sections.map((section, sectionIndex) => {
            const sectionContents =
              getSectionContents(section.id)

            const sectionCompleted =
              sectionContents.length > 0 &&
              sectionContents.every((content) =>
                isLessonCompleted(content.id)
              )

            const completedInSection =
              sectionContents.filter((content) =>
                isLessonCompleted(content.id)
              ).length

            return (
              <section
                key={section.id}
                style={styles.sectionCard}
              >
                {/* SECTION HEADER */}

                <div style={styles.sectionHeader}>
                  <div style={styles.sectionNumber}>
                    {String(sectionIndex + 1).padStart(
                      2,
                      '0'
                    )}
                  </div>

                  <div style={styles.sectionInfo}>
                    <div style={styles.moduleLabel}>
                      MODULE{' '}
                      {String(sectionIndex + 1).padStart(
                        2,
                        '0'
                      )}
                    </div>

                    <h3 style={styles.sectionTitle}>
                      {section.title}
                    </h3>

                    <div style={styles.sectionMeta}>
                      {completedInSection} /{' '}
                      {sectionContents.length} lesson selesai
                    </div>
                  </div>

                  <div
                    style={
                      sectionCompleted
                        ? styles.sectionCompleteBadge
                        : styles.sectionLessonCount
                    }
                  >
                    {sectionCompleted
                      ? '✓ SELESAI'
                      : `${sectionContents.length} LESSON`}
                  </div>
                </div>

                {/* LESSONS */}

                <div style={styles.lessonList}>
                  {sectionContents.length === 0 ? (
                    <div style={styles.emptyLesson}>
                      Belum ada materi pada module ini.
                    </div>
                  ) : (
                    sectionContents.map(
                      (content, lessonIndex) => {
                        const completed =
                          isLessonCompleted(content.id)

                        return (
                          <button
                            key={content.id}
                            onClick={() =>
                              openLesson(content.id)
                            }
                            style={{
                              ...styles.lessonButton,

                              ...(completed
                                ? styles.lessonCompleted
                                : {}),
                            }}
                          >
                            {/* ICON */}

                            <div
                              style={{
                                ...styles.lessonIcon,

                                ...(completed
                                  ? styles.lessonIconCompleted
                                  : {}),
                              }}
                            >
                              {completed
                                ? '✓'
                                : getContentIcon(
                                    content.content_type
                                  )}
                            </div>

                            {/* INFO */}

                            <div style={styles.lessonInfo}>
                              <div
                                style={styles.lessonTopLine}
                              >
                                <span
                                  style={
                                    styles.lessonNumber
                                  }
                                >
                                  LESSON{' '}
                                  {String(
                                    lessonIndex + 1
                                  ).padStart(2, '0')}
                                </span>

                                <span
                                  style={
                                    styles.lessonType
                                  }
                                >
                                  {getContentLabel(
                                    content.content_type
                                  )}
                                </span>
                              </div>

                              <div
                                style={styles.lessonTitle}
                              >
                                {content.title}
                              </div>

                              {content.is_preview && (
                                <div
                                  style={
                                    styles.previewBadge
                                  }
                                >
                                  PREVIEW
                                </div>
                              )}
                            </div>

                            {/* STATUS */}

                            <div
                              style={styles.lessonStatus}
                            >
                              {completed ? (
                                <span
                                  style={
                                    styles.completedText
                                  }
                                >
                                  ✓ SELESAI
                                </span>
                              ) : (
                                <>
                                  <span
                                    style={
                                      styles.notCompletedText
                                    }
                                  >
                                    BELUM
                                  </span>

                                  <span
                                    style={
                                      styles.arrow
                                    }
                                  >
                                    →
                                  </span>
                                </>
                              )}
                            </div>
                          </button>
                        )
                      }
                    )
                  )}
                </div>
              </section>
            )
          })}
        </div>

        {/* ====================================================
            UNGROUPED CONTENT
        ==================================================== */}

        {contents.filter(
          (content) => !content.section_id
        ).length > 0 && (
          <section style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionNumber}>
                +
              </div>

              <div style={styles.sectionInfo}>
                <div style={styles.moduleLabel}>
                  ADDITIONAL CONTENT
                </div>

                <h3 style={styles.sectionTitle}>
                  Materi Tambahan
                </h3>
              </div>
            </div>

            <div style={styles.lessonList}>
              {contents
                .filter(
                  (content) => !content.section_id
                )
                .map((content, index) => {
                  const completed =
                    isLessonCompleted(content.id)

                  return (
                    <button
                      key={content.id}
                      onClick={() =>
                        openLesson(content.id)
                      }
                      style={{
                        ...styles.lessonButton,

                        ...(completed
                          ? styles.lessonCompleted
                          : {}),
                      }}
                    >
                      <div
                        style={{
                          ...styles.lessonIcon,

                          ...(completed
                            ? styles.lessonIconCompleted
                            : {}),
                        }}
                      >
                        {completed
                          ? '✓'
                          : getContentIcon(
                              content.content_type
                            )}
                      </div>

                      <div style={styles.lessonInfo}>
                        <div style={styles.lessonTopLine}>
                          <span
                            style={styles.lessonNumber}
                          >
                            LESSON{' '}
                            {String(index + 1).padStart(
                              2,
                              '0'
                            )}
                          </span>

                          <span
                            style={styles.lessonType}
                          >
                            {getContentLabel(
                              content.content_type
                            )}
                          </span>
                        </div>

                        <div style={styles.lessonTitle}>
                          {content.title}
                        </div>
                      </div>

                      <div style={styles.lessonStatus}>
                        {completed ? (
                          <span
                            style={styles.completedText}
                          >
                            ✓ SELESAI
                          </span>
                        ) : (
                          <>
                            <span
                              style={
                                styles.notCompletedText
                              }
                            >
                              BELUM
                            </span>

                            <span style={styles.arrow}>
                              →
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  )
                })}
            </div>
          </section>
        )}

        {/* ====================================================
            EMPTY
        ==================================================== */}

        {totalLessons === 0 && (
          <div style={styles.emptyProduct}>
            <div style={styles.emptyProductIcon}>
              ◇
            </div>

            <h3 style={{ margin: '0 0 8px' }}>
              Belum ada materi
            </h3>

            <p style={styles.muted}>
              Content produk ini belum tersedia.
            </p>
          </div>
        )}

        {/* ====================================================
            SECURITY
        ==================================================== */}

        <div style={styles.securityBox}>
          <div style={styles.securityIcon}>
            ✓
          </div>

          <div>
            <strong>
              Protected Member Access
            </strong>

            <div style={styles.securityText}>
              Produk, materi, dan progress ditampilkan
              berdasarkan akun member yang sedang login
              dan dilindungi Row Level Security.
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
    padding: '28px 18px 70px',
    color: '#ffffff',
    background:
      'radial-gradient(circle at 10% 0%, #172554 0%, #070b18 38%, #030712 100%)',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  container: {
    width: '100%',
    maxWidth: 1080,
    margin: '0 auto',
  },

  centerPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    color: '#ffffff',
    background:
      'radial-gradient(circle at top, #172554, #030712 65%)',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, sans-serif',
  },

  loadingCard: {
    width: '100%',
    maxWidth: 460,
    padding: 38,
    textAlign: 'center',
    borderRadius: 26,
    border: '1px solid rgba(255,255,255,.12)',
    background:
      'linear-gradient(145deg, rgba(30,64,175,.28), rgba(88,28,135,.18))',
    boxShadow: '0 30px 80px rgba(0,0,0,.35)',
  },

  loadingLogo: {
    width: 56,
    height: 56,
    margin: '0 auto 18px',
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 900,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
  },

  errorCard: {
    width: '100%',
    maxWidth: 520,
    padding: 38,
    textAlign: 'center',
    borderRadius: 26,
    border: '1px solid rgba(248,113,113,.2)',
    background:
      'linear-gradient(145deg, rgba(127,29,29,.26), rgba(30,41,59,.4))',
  },

  errorBadge: {
    display: 'inline-block',
    padding: '6px 11px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.5,
    color: '#fca5a5',
    background: 'rgba(239,68,68,.12)',
  },

  muted: {
    margin: 0,
    color: '#94a3b8',
    lineHeight: 1.7,
  },

  primaryButton: {
    marginTop: 18,
    padding: '12px 18px',
    border: 0,
    borderRadius: 12,
    cursor: 'pointer',
    color: '#ffffff',
    fontWeight: 800,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
  },

  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 18,
  },

  backButton: {
    padding: '10px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 750,
    color: '#cbd5e1',
    border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(15,23,42,.6)',
  },

  userBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#94a3b8',
    fontSize: 13,
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
    border: '1px solid rgba(255,255,255,.11)',
    background:
      'linear-gradient(135deg, rgba(30,64,175,.48), rgba(88,28,135,.40), rgba(15,23,42,.9))',
    boxShadow: '0 30px 80px rgba(0,0,0,.3)',
  },

  heroGlowOne: {
    position: 'absolute',
    width: 330,
    height: 330,
    top: -210,
    right: -40,
    borderRadius: '50%',
    background: 'rgba(59,130,246,.30)',
    filter: 'blur(25px)',
  },

  heroGlowTwo: {
    position: 'absolute',
    width: 280,
    height: 280,
    bottom: -210,
    left: 80,
    borderRadius: '50%',
    background: 'rgba(168,85,247,.25)',
    filter: 'blur(25px)',
  },

  heroContent: {
    position: 'relative',
    padding: '38px 36px',
  },

  heroTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 24,
  },

  memberBadge: {
    display: 'inline-block',
    padding: '7px 11px',
    borderRadius: 999,
    color: '#bfdbfe',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.5,
    border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(255,255,255,.08)',
  },

  productTitle: {
    margin: '15px 0 10px',
    maxWidth: 720,
    fontSize: 'clamp(30px, 5vw, 48px)',
    lineHeight: 1.08,
    letterSpacing: '-1.2px',
  },

  productDescription: {
    margin: 0,
    maxWidth: 720,
    color: '#cbd5e1',
    lineHeight: 1.75,
  },

  activeBadge: {
    padding: '9px 13px',
    borderRadius: 999,
    color: '#86efac',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.6,
    border: '1px solid rgba(34,197,94,.15)',
    background: 'rgba(34,197,94,.10)',
  },

  completedProductBadge: {
    padding: '9px 13px',
    borderRadius: 999,
    color: '#fde68a',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.6,
    border: '1px solid rgba(250,204,21,.18)',
    background: 'rgba(250,204,21,.10)',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 12,
    marginTop: 30,
  },

  statCard: {
    padding: '15px 17px',
    borderRadius: 17,
    border: '1px solid rgba(255,255,255,.09)',
    background:
      'linear-gradient(135deg, rgba(255,255,255,.09), rgba(255,255,255,.035))',
  },

  statValue: {
    fontSize: 25,
    fontWeight: 900,
  },

  statLabel: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 700,
  },

  progressCard: {
    marginTop: 18,
    padding: '23px 24px',
    borderRadius: 22,
    border: '1px solid rgba(99,102,241,.16)',
    background:
      'linear-gradient(135deg, rgba(30,64,175,.20), rgba(88,28,135,.15), rgba(15,23,42,.78))',
    boxShadow: '0 20px 50px rgba(0,0,0,.16)',
  },

  progressTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
  },

  progressEyebrow: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.5,
  },

  progressTitle: {
    margin: '5px 0 4px',
    fontSize: 20,
  },

  progressDescription: {
    color: '#94a3b8',
    fontSize: 12,
  },

  progressNumber: {
    fontSize: 'clamp(28px, 5vw, 42px)',
    fontWeight: 950,
    color: '#bfdbfe',
  },

  progressTrack: {
    height: 10,
    marginTop: 18,
    overflow: 'hidden',
    borderRadius: 999,
    background: 'rgba(255,255,255,.07)',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    background:
      'linear-gradient(90deg, #2563eb, #7c3aed, #22c55e)',
    transition: 'width .4s ease',
  },

  progressFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    color: '#64748b',
    fontSize: 11,
  },

  contentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 14,
    margin: '34px 2px 15px',
  },

  contentEyebrow: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.5,
  },

  contentTitle: {
    margin: '5px 0 0',
    fontSize: 23,
  },

  contentCount: {
    color: '#64748b',
    fontSize: 12,
  },

  sectionList: {
    display: 'grid',
    gap: 16,
  },

  sectionCard: {
    overflow: 'hidden',
    borderRadius: 23,
    border: '1px solid rgba(255,255,255,.09)',
    background:
      'linear-gradient(145deg, rgba(30,41,59,.76), rgba(15,23,42,.9))',
    boxShadow: '0 18px 50px rgba(0,0,0,.16)',
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 15,
    padding: '19px 20px',
    borderBottom: '1px solid rgba(255,255,255,.065)',
    background:
      'linear-gradient(90deg, rgba(37,99,235,.11), rgba(124,58,237,.08))',
  },

  sectionNumber: {
    width: 46,
    height: 46,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: 900,
    background:
      'linear-gradient(135deg, rgba(37,99,235,.23), rgba(124,58,237,.24))',
  },

  sectionInfo: {
    flex: 1,
    minWidth: 160,
  },

  moduleLabel: {
    color: '#818cf8',
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: 1.4,
  },

  sectionTitle: {
    margin: '3px 0',
    fontSize: 17,
  },

  sectionMeta: {
    color: '#64748b',
    fontSize: 10,
  },

  sectionLessonCount: {
    padding: '7px 10px',
    borderRadius: 999,
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 850,
    background: 'rgba(255,255,255,.05)',
  },

  sectionCompleteBadge: {
    padding: '7px 10px',
    borderRadius: 999,
    color: '#86efac',
    fontSize: 9,
    fontWeight: 900,
    background: 'rgba(34,197,94,.10)',
    border: '1px solid rgba(34,197,94,.12)',
  },

  lessonList: {
    padding: 10,
  },

  lessonButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    padding: '14px 12px',
    margin: 0,
    textAlign: 'left',
    color: '#ffffff',
    cursor: 'pointer',
    border: 0,
    borderRadius: 15,
    background: 'transparent',
    transition:
      'transform .15s ease, background .15s ease',
  },

  lessonCompleted: {
    background:
      'linear-gradient(90deg, rgba(6,78,59,.20), rgba(15,23,42,.1))',
  },

  lessonIcon: {
    width: 42,
    height: 42,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    color: '#a5b4fc',
    fontSize: 16,
    fontWeight: 900,
    background:
      'linear-gradient(135deg, rgba(37,99,235,.16), rgba(124,58,237,.15))',
  },

  lessonIconCompleted: {
    color: '#86efac',
    background:
      'linear-gradient(135deg, rgba(22,163,74,.18), rgba(6,78,59,.24))',
  },

  lessonInfo: {
    flex: 1,
    minWidth: 0,
  },

  lessonTopLine: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 4,
  },

  lessonNumber: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: 1,
  },

  lessonType: {
    padding: '3px 6px',
    borderRadius: 999,
    color: '#818cf8',
    fontSize: 7,
    fontWeight: 900,
    background: 'rgba(99,102,241,.08)',
  },

  lessonTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.4,
  },

  previewBadge: {
    display: 'inline-block',
    marginTop: 5,
    padding: '3px 6px',
    borderRadius: 999,
    color: '#fde68a',
    fontSize: 7,
    fontWeight: 900,
    background: 'rgba(250,204,21,.08)',
  },

  lessonStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },

  completedText: {
    color: '#86efac',
    fontSize: 9,
    fontWeight: 900,
  },

  notCompletedText: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 850,
  },

  arrow: {
    color: '#818cf8',
    fontSize: 17,
  },

  emptyLesson: {
    padding: 20,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
  },

  emptyProduct: {
    marginTop: 20,
    padding: 45,
    textAlign: 'center',
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,.08)',
    background:
      'linear-gradient(135deg, rgba(30,41,59,.65), rgba(15,23,42,.8))',
  },

  emptyProductIcon: {
    width: 55,
    height: 55,
    margin: '0 auto 15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    color: '#818cf8',
    fontSize: 23,
    background: 'rgba(99,102,241,.10)',
  },

  securityBox: {
    marginTop: 26,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderRadius: 17,
    border: '1px solid rgba(52,211,153,.14)',
    background:
      'linear-gradient(135deg, rgba(6,78,59,.25), rgba(15,23,42,.62))',
  },

  securityIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    color: '#86efac',
    fontWeight: 900,
    background: 'rgba(34,197,94,.12)',
  },

  securityText: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 1.5,
  },
}

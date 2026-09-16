'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../../../lib/supabase'

type Product = {
  id: string
  name: string
  slug: string
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

export default function LessonReaderPage() {
  const params = useParams()
  const router = useRouter()

  const slug = params.slug as string
  const lessonId = params.id as string

  const [email, setEmail] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [lesson, setLesson] = useState<Content | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLesson()
  }, [slug, lessonId])

  async function loadLesson() {
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
    // Product tetap melewati RLS Supabase.
    // ========================================================

    const {
      data: productData,
      error: productError,
    } = await supabase
      .from('products')
      .select('id, name, slug')
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
    // LOAD LESSON
    //
    // Kita filter:
    // - ID lesson
    // - product_id
    // - published
    //
    // Jadi lesson dari produk lain tidak bisa "nyasar".
    // RLS tetap menjadi lapisan security utama.
    // ========================================================

    const {
      data: lessonData,
      error: lessonError,
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
      .eq('id', lessonId)
      .eq('product_id', productData.id)
      .eq('is_published', true)
      .maybeSingle()

    if (lessonError) {
      setError(lessonError.message)
      setLoading(false)
      return
    }

    if (!lessonData) {
      setError(
        'Materi tidak ditemukan atau akun ini tidak memiliki akses.'
      )
      setLoading(false)
      return
    }

    setLesson(lessonData)
    setLoading(false)
  }

  // ==========================================================
  // VIDEO HELPERS
  // ==========================================================

  function getYouTubeEmbedUrl(url: string) {
    try {
      const parsed = new URL(url)

      // youtube.com/watch?v=XXXX
      if (
        parsed.hostname.includes('youtube.com') &&
        parsed.searchParams.get('v')
      ) {
        return `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`
      }

      // youtu.be/XXXX
      if (parsed.hostname.includes('youtu.be')) {
        const videoId = parsed.pathname.replace('/', '')

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`
        }
      }

      // youtube.com/embed/XXXX
      if (
        parsed.hostname.includes('youtube.com') &&
        parsed.pathname.includes('/embed/')
      ) {
        return url
      }

      return null
    } catch {
      return null
    }
  }

  // ==========================================================
  // CONTENT TYPE LABEL
  // ==========================================================

  function getTypeLabel(type: Content['content_type']) {
    switch (type) {
      case 'text':
        return 'TEXT LESSON'

      case 'html':
        return 'HTML LESSON'

      case 'video':
        return 'VIDEO LESSON'

      case 'external_url':
        return 'EXTERNAL RESOURCE'

      default:
        return 'LESSON'
    }
  }

  // ==========================================================
  // CONTENT RENDERER
  // ==========================================================

  function renderContent() {
    if (!lesson) return null

    // --------------------------------------------------------
    // TEXT
    // --------------------------------------------------------

    if (lesson.content_type === 'text') {
      return (
        <div style={styles.textContent}>
          {lesson.content_text || 'Materi belum memiliki isi.'}
        </div>
      )
    }

    // --------------------------------------------------------
    // HTML
    // --------------------------------------------------------

    if (lesson.content_type === 'html') {
      return (
        <div style={styles.htmlBox}>
          <div
            style={styles.htmlContent}
            dangerouslySetInnerHTML={{
              __html:
                lesson.content_text ||
                '<p>Materi belum memiliki isi.</p>',
            }}
          />
        </div>
      )
    }

    // --------------------------------------------------------
    // VIDEO
    // --------------------------------------------------------

    if (lesson.content_type === 'video') {
      const videoUrl = lesson.external_url
      const youtubeEmbed = videoUrl
        ? getYouTubeEmbedUrl(videoUrl)
        : null

      return (
        <div>

          {youtubeEmbed ? (

            <div style={styles.videoWrapper}>
              <iframe
                src={youtubeEmbed}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={styles.videoIframe}
              />
            </div>

          ) : (

            <div style={styles.videoPlaceholder}>

              <div style={styles.playIcon}>
                ▶
              </div>

              <h3 style={{ margin: '0 0 8px' }}>
                Video Pembelajaran
              </h3>

              <p style={styles.muted}>
                URL video contoh ini belum mengarah ke video yang
                dapat di-embed.
              </p>

              {videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.externalButton}
                >
                  Buka Video ↗
                </a>
              )}

            </div>

          )}

          {lesson.content_text && (
            <div style={styles.videoDescription}>
              {lesson.content_text}
            </div>
          )}

        </div>
      )
    }

    // --------------------------------------------------------
    // EXTERNAL URL
    // --------------------------------------------------------

    if (lesson.content_type === 'external_url') {
      return (
        <div style={styles.resourceBox}>

          <div style={styles.resourceIcon}>
            ↗
          </div>

          <h2 style={{ margin: '0 0 10px' }}>
            Resource Eksternal
          </h2>

          <p style={styles.muted}>
            {lesson.content_text ||
              'Resource tambahan tersedia melalui link eksternal.'}
          </p>

          {lesson.external_url ? (

            <a
              href={lesson.external_url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.externalButton}
            >
              Buka Resource ↗
            </a>

          ) : (

            <div style={styles.noLink}>
              Link resource belum tersedia.
            </div>

          )}

        </div>
      )
    }

    return (
      <div style={styles.emptyContent}>
        Tipe materi belum didukung.
      </div>
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
            Membuka Materi...
          </h2>

          <p style={styles.muted}>
            Memeriksa akses member dan mengambil content.
          </p>

        </div>

      </main>
    )
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error || !lesson || !product) {
    return (
      <main style={styles.centerPage}>

        <div style={styles.errorCard}>

          <div style={styles.errorBadge}>
            CONTENT ACCESS
          </div>

          <h1 style={{ margin: '10px 0' }}>
            Materi tidak dapat dibuka
          </h1>

          <p style={styles.muted}>
            {error || 'Materi tidak tersedia.'}
          </p>

          <button
            onClick={() =>
              router.push(`/member/product/${slug}`)
            }
            style={styles.primaryButton}
          >
            ← Kembali ke Produk
          </button>

        </div>

      </main>
    )
  }

  // ==========================================================
  // READER
  // ==========================================================

  return (
    <main style={styles.page}>

      <div style={styles.container}>

        {/* ====================================================
            TOP BAR
        ==================================================== */}

        <div style={styles.topBar}>

          <button
            onClick={() =>
              router.push(`/member/product/${slug}`)
            }
            style={styles.backButton}
          >
            ← Kembali ke Materi
          </button>

          <div style={styles.userBox}>
            <span style={styles.onlineDot}></span>
            {email}
          </div>

        </div>


        {/* ====================================================
            BREADCRUMB
        ==================================================== */}

        <div style={styles.breadcrumb}>
          {product.name}
          <span style={styles.breadcrumbArrow}>
            /
          </span>
          {lesson.title}
        </div>


        {/* ====================================================
            LESSON HERO
        ==================================================== */}

        <section style={styles.hero}>

          <div style={styles.heroGlowOne}></div>
          <div style={styles.heroGlowTwo}></div>

          <div style={styles.heroContent}>

            <div style={styles.typeBadge}>
              {getTypeLabel(lesson.content_type)}
            </div>

            <h1 style={styles.title}>
              {lesson.title}
            </h1>

            <div style={styles.lessonMeta}>

              <span>
                Lesson {String(lesson.sort_order).padStart(2, '0')}
              </span>

              <span style={styles.dot}>•</span>

              <span>
                {lesson.is_published
                  ? 'Published'
                  : 'Draft'}
              </span>

              {lesson.is_preview && (
                <>
                  <span style={styles.dot}>•</span>
                  <span style={styles.previewText}>
                    Preview
                  </span>
                </>
              )}

            </div>

          </div>

        </section>


        {/* ====================================================
            CONTENT READER
        ==================================================== */}

        <section style={styles.readerCard}>

          <div style={styles.readerTop}>

            <div>

              <div style={styles.readerLabel}>
                MEMBER LEARNING
              </div>

              <h2 style={styles.readerTitle}>
                {lesson.title}
              </h2>

            </div>

            <div style={styles.secureBadge}>
              ✓ Secure Access
            </div>

          </div>


          <div style={styles.readerDivider}></div>


          <div style={styles.contentArea}>
            {renderContent()}
          </div>

        </section>


        {/* ====================================================
            BOTTOM NAVIGATION
        ==================================================== */}

        <div style={styles.bottomNavigation}>

          <button
            onClick={() =>
              router.push(`/member/product/${slug}`)
            }
            style={styles.secondaryButton}
          >
            ← Daftar Materi
          </button>


          <div style={styles.progressPlaceholder}>

            <span style={styles.progressDot}></span>

            Progress akan aktif di step berikutnya

          </div>

        </div>


        {/* ====================================================
            SECURITY INFO
        ==================================================== */}

        <div style={styles.securityBox}>

          <div style={styles.securityIcon}>
            ✓
          </div>

          <div>

            <strong>
              Protected Member Content
            </strong>

            <div style={styles.securityText}>
              Content ditampilkan melalui authenticated
              Supabase access dan Row Level Security.
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
    maxWidth: 1050,
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
    boxShadow: '0 12px 35px rgba(37,99,235,.28)',
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
    lineHeight: 1.75,
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

  breadcrumb: {
    display: 'flex',
    gap: 9,
    flexWrap: 'wrap',
    marginBottom: 14,
    color: '#64748b',
    fontSize: 12,
  },

  breadcrumbArrow: {
    color: '#475569',
  },

  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    border: '1px solid rgba(255,255,255,.11)',
    background:
      'linear-gradient(135deg, rgba(30,64,175,.45), rgba(88,28,135,.38), rgba(15,23,42,.88))',
    boxShadow: '0 30px 80px rgba(0,0,0,.3)',
  },

  heroGlowOne: {
    position: 'absolute',
    width: 300,
    height: 300,
    top: -190,
    right: -40,
    borderRadius: '50%',
    background: 'rgba(59,130,246,.28)',
    filter: 'blur(25px)',
  },

  heroGlowTwo: {
    position: 'absolute',
    width: 250,
    height: 250,
    bottom: -200,
    left: 80,
    borderRadius: '50%',
    background: 'rgba(168,85,247,.22)',
    filter: 'blur(25px)',
  },

  heroContent: {
    position: 'relative',
    padding: '38px 36px',
  },

  typeBadge: {
    display: 'inline-block',
    padding: '7px 11px',
    borderRadius: 999,
    color: '#bfdbfe',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.4,
    border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(255,255,255,.08)',
  },

  title: {
    margin: '15px 0 10px',
    fontSize: 'clamp(29px, 5vw, 46px)',
    lineHeight: 1.08,
    letterSpacing: '-1px',
  },

  lessonMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 9,
    color: '#94a3b8',
    fontSize: 12,
  },

  dot: {
    color: '#475569',
  },

  previewText: {
    color: '#fcd34d',
  },

  readerCard: {
    marginTop: 20,
    padding: '25px 26px 30px',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,.09)',
    background:
      'linear-gradient(145deg, rgba(30,41,59,.82), rgba(15,23,42,.92))',
    boxShadow: '0 22px 60px rgba(0,0,0,.22)',
  },

  readerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 15,
  },

  readerLabel: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.5,
  },

  readerTitle: {
    margin: '5px 0 0',
    fontSize: 22,
  },

  secureBadge: {
    padding: '7px 10px',
    borderRadius: 999,
    color: '#86efac',
    fontSize: 10,
    fontWeight: 850,
    background: 'rgba(34,197,94,.1)',
    border: '1px solid rgba(34,197,94,.12)',
  },

  readerDivider: {
    height: 1,
    margin: '20px 0 26px',
    background: 'rgba(255,255,255,.07)',
  },

  contentArea: {
    minHeight: 180,
  },

  textContent: {
    color: '#dbe4f0',
    fontSize: 16,
    lineHeight: 1.9,
    whiteSpace: 'pre-wrap',
  },

  htmlBox: {
    color: '#dbe4f0',
    lineHeight: 1.85,
  },

  htmlContent: {
    fontSize: 16,
  },

  videoWrapper: {
    position: 'relative',
    width: '100%',
    paddingTop: '56.25%',
    overflow: 'hidden',
    borderRadius: 18,
    background: '#000000',
  },

  videoIframe: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 0,
  },

  videoPlaceholder: {
    padding: '48px 22px',
    textAlign: 'center',
    borderRadius: 20,
    border: '1px solid rgba(96,165,250,.13)',
    background:
      'linear-gradient(135deg, rgba(30,64,175,.18), rgba(88,28,135,.14))',
  },

  playIcon: {
    width: 66,
    height: 66,
    margin: '0 auto 17px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontSize: 22,
    paddingLeft: 4,
    color: '#ffffff',
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
    boxShadow: '0 14px 40px rgba(37,99,235,.3)',
  },

  videoDescription: {
    marginTop: 20,
    color: '#cbd5e1',
    lineHeight: 1.8,
  },

  resourceBox: {
    padding: '42px 24px',
    textAlign: 'center',
    borderRadius: 20,
    border: '1px solid rgba(129,140,248,.15)',
    background:
      'linear-gradient(135deg, rgba(37,99,235,.14), rgba(124,58,237,.12))',
  },

  resourceIcon: {
    width: 62,
    height: 62,
    margin: '0 auto 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    fontSize: 27,
    fontWeight: 900,
    color: '#c4b5fd',
    background:
      'linear-gradient(135deg, rgba(37,99,235,.25), rgba(124,58,237,.25))',
  },

  externalButton: {
    display: 'inline-block',
    marginTop: 20,
    padding: '12px 18px',
    borderRadius: 12,
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: 800,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
    boxShadow: '0 12px 30px rgba(37,99,235,.22)',
  },

  noLink: {
    marginTop: 18,
    color: '#64748b',
    fontSize: 13,
  },

  emptyContent: {
    padding: 30,
    textAlign: 'center',
    color: '#64748b',
  },

  bottomNavigation: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 18,
  },

  secondaryButton: {
    padding: '11px 15px',
    cursor: 'pointer',
    borderRadius: 12,
    color: '#cbd5e1',
    fontWeight: 750,
    border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(15,23,42,.65)',
  },

  progressPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#64748b',
    fontSize: 11,
  },

  progressDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#6366f1',
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
  },
}

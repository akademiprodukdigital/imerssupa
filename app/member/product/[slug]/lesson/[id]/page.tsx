'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../../../lib/supabase'
import MemberShell from '../../../../../../components/MemberShell'

type Product = {
  id: string
  name: string
  slug: string
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

export default function LessonReaderPage() {
  const params = useParams()
  const router = useRouter()

  const slug = params.slug as string
  const lessonId = params.id as string

  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')

  const [product, setProduct] = useState<Product | null>(null)
  const [lesson, setLesson] = useState<Content | null>(null)
  const [allLessons, setAllLessons] = useState<Content[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)

  const [loading, setLoading] = useState(true)
  const [savingProgress, setSavingProgress] = useState(false)

  const [error, setError] = useState('')
  const [progressError, setProgressError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    loadLesson()
  }, [slug, lessonId])

  async function loadLesson() {
    setLoading(true)
    setError('')
    setProgressError('')
    setSuccessMessage('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/login')
      return
    }

    setUserId(user.id)
    setEmail(user.email ?? '')

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

    const {
      data: sectionsData,
      error: sectionsError,
    } = await supabase
      .from('product_sections')
      .select('id, product_id, title, sort_order')
      .eq('product_id', productData.id)
      .order('sort_order', { ascending: true })

    if (sectionsError) {
      setError(sectionsError.message)
      setLoading(false)
      return
    }

    const sections = (sectionsData ?? []) as Section[]

    const {
      data: contentsData,
      error: contentsError,
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

    if (contentsError) {
      setError(contentsError.message)
      setLoading(false)
      return
    }

    const contents = (contentsData ?? []) as Content[]

    /*
      Urutan final:
      1. sort_order module
      2. sort_order lesson di dalam module
      3. materi tanpa module diletakkan terakhir
    */

    const sectionOrder = new Map<string, number>()

    sections.forEach((section, index) => {
      sectionOrder.set(section.id, index)
    })

    const sortedContents = [...contents].sort((a, b) => {
      const aSection =
        a.section_id && sectionOrder.has(a.section_id)
          ? sectionOrder.get(a.section_id)!
          : 999999

      const bSection =
        b.section_id && sectionOrder.has(b.section_id)
          ? sectionOrder.get(b.section_id)!
          : 999999

      if (aSection !== bSection) {
        return aSection - bSection
      }

      return a.sort_order - b.sort_order
    })

    setAllLessons(sortedContents)

    const currentLesson = sortedContents.find(
      (item) => item.id === lessonId
    )

    if (!currentLesson) {
      setError(
        'Materi tidak ditemukan atau akun ini tidak memiliki akses.'
      )
      setLoading(false)
      return
    }

    setLesson(currentLesson)

    const {
      data: progressData,
      error: progressLoadError,
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
      .eq('content_id', currentLesson.id)
      .maybeSingle()

    if (progressLoadError) {
      setProgressError(progressLoadError.message)
    } else {
      setProgress(progressData)
    }

    setLoading(false)
  }

  const currentIndex = useMemo(() => {
    return allLessons.findIndex(
      (item) => item.id === lessonId
    )
  }, [allLessons, lessonId])

  const previousLesson =
    currentIndex > 0
      ? allLessons[currentIndex - 1]
      : null

  const nextLesson =
    currentIndex >= 0 &&
    currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null

  async function markAsCompleted() {
    if (!userId || !lesson) return

    setSavingProgress(true)
    setProgressError('')
    setSuccessMessage('')

    const now = new Date().toISOString()

    const payload = {
      user_id: userId,
      content_id: lesson.id,
      progress_percent: 100,
      completed: true,
      last_position: 100,
      started_at: progress?.started_at || now,
      completed_at: now,
      updated_at: now,
    }

    const {
      data,
      error: saveError,
    } = await supabase
      .from('member_content_progress')
      .upsert(payload, {
        onConflict: 'user_id,content_id',
      })
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
      .single()

    if (saveError) {
      setProgressError(saveError.message)
      setSavingProgress(false)
      return
    }

    setProgress(data)
    setSuccessMessage('Materi berhasil ditandai selesai.')
    setSavingProgress(false)
  }

  function openLesson(id: string) {
    router.push(
      `/member/product/${slug}/lesson/${id}`
    )
  }

  function getYouTubeEmbedUrl(url: string) {
    try {
      const parsed = new URL(url)

      if (
        parsed.hostname.includes('youtube.com') &&
        parsed.searchParams.get('v')
      ) {
        return `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`
      }

      if (parsed.hostname.includes('youtu.be')) {
        const videoId = parsed.pathname.replace('/', '')

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`
        }
      }

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

  function renderContent() {
    if (!lesson) return null

    if (lesson.content_type === 'text') {
      return (
        <div style={styles.textContent}>
          {lesson.content_text ||
            'Materi belum memiliki isi.'}
        </div>
      )
    }

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
                Video tersedia melalui link yang
                telah disediakan.
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

    return null
  }

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
            Memeriksa akses dan progress member.
          </p>
        </div>
      </main>
    )
  }

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

  const isCompleted =
    progress?.completed === true ||
    progress?.progress_percent === 100

  const progressPercent =
    progress?.progress_percent ?? 0

  return (
    <MemberShell email={email} active="learning">
      <main style={styles.page}>
      <div style={styles.container}>

        <div style={styles.topBar}>
          <button
            onClick={() =>
              router.push(`/member/product/${slug}`)
            }
            style={styles.backButton}
          >
            ← Daftar Materi
          </button>

          <div style={styles.userBox}>
            <span style={styles.onlineDot}></span>
            {email}
          </div>
        </div>

        <div style={styles.breadcrumb}>
          {product.name}

          <span style={styles.breadcrumbArrow}>
            /
          </span>

          {lesson.title}
        </div>

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
                Materi {currentIndex + 1} dari{' '}
                {allLessons.length}
              </span>

              <span style={styles.dot}>•</span>

              <span>Published</span>
            </div>
          </div>
        </section>

        <section style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <div>
              <div style={styles.progressLabel}>
                LESSON PROGRESS
              </div>

              <div style={styles.progressStatus}>
                {isCompleted
                  ? '✓ Materi Selesai'
                  : 'Belum Selesai'}
              </div>
            </div>

            <div
              style={{
                ...styles.progressPercent,
                color: isCompleted
                  ? '#86efac'
                  : '#bfdbfe',
              }}
            >
              {progressPercent}%
            </div>
          </div>

          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${progressPercent}%`,
              }}
            />
          </div>
        </section>

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

        <section
          style={
            isCompleted
              ? styles.completedCard
              : styles.actionCard
          }
        >
          {isCompleted ? (
            <>
              <div style={styles.completeIcon}>
                ✓
              </div>

              <div style={styles.actionInfo}>
                <strong style={styles.actionTitle}>
                  Materi Selesai
                </strong>

                <div style={styles.actionText}>
                  Progress materi ini sudah tersimpan.
                </div>
              </div>

              <div style={styles.completedBadge}>
                100%
              </div>
            </>
          ) : (
            <>
              <div style={styles.incompleteIcon}>
                ○
              </div>

              <div style={styles.actionInfo}>
                <strong style={styles.actionTitle}>
                  Sudah selesai mempelajari materi ini?
                </strong>

                <div style={styles.actionText}>
                  Tandai selesai agar progress belajar
                  tersimpan ke akun Anda.
                </div>
              </div>

              <button
                onClick={markAsCompleted}
                disabled={savingProgress}
                style={{
                  ...styles.completeButton,
                  opacity: savingProgress ? 0.65 : 1,
                  cursor: savingProgress
                    ? 'wait'
                    : 'pointer',
                }}
              >
                {savingProgress
                  ? 'Menyimpan...'
                  : 'Tandai Selesai ✓'}
              </button>
            </>
          )}
        </section>

        {successMessage && (
          <div style={styles.successMessage}>
            ✓ {successMessage}
          </div>
        )}

        {progressError && (
          <div style={styles.progressError}>
            <strong>
              Progress belum dapat disimpan.
            </strong>

            <div style={{ marginTop: 4 }}>
              {progressError}
            </div>
          </div>
        )}

        {/* PREVIOUS / NEXT */}

        <section style={styles.navigationSection}>
          <div style={styles.navigationLabel}>
            NAVIGASI MATERI
          </div>

          <div style={styles.navigationGrid}>
            {previousLesson ? (
              <button
                onClick={() =>
                  openLesson(previousLesson.id)
                }
                style={styles.navigationCard}
              >
                <div style={styles.navigationDirection}>
                  ← MATERI SEBELUMNYA
                </div>

                <div style={styles.navigationTitle}>
                  {previousLesson.title}
                </div>
              </button>
            ) : (
              <div style={styles.navigationDisabled}>
                <div style={styles.navigationDirection}>
                  ← MATERI SEBELUMNYA
                </div>

                <div style={styles.navigationDisabledText}>
                  Ini materi pertama
                </div>
              </div>
            )}

            {nextLesson ? (
              <button
                onClick={() =>
                  openLesson(nextLesson.id)
                }
                style={{
                  ...styles.navigationCard,
                  textAlign: 'right',
                }}
              >
                <div style={styles.navigationDirection}>
                  MATERI BERIKUTNYA →
                </div>

                <div style={styles.navigationTitle}>
                  {nextLesson.title}
                </div>
              </button>
            ) : (
              <div
                style={{
                  ...styles.navigationDisabled,
                  textAlign: 'right',
                }}
              >
                <div style={styles.navigationDirection}>
                  MATERI BERIKUTNYA →
                </div>

                <div style={styles.navigationDisabledText}>
                  Semua materi sudah dijelajahi
                </div>
              </div>
            )}
          </div>
        </section>

        <div style={styles.bottomNavigation}>
          <button
            onClick={() =>
              router.push(`/member/product/${slug}`)
            }
            style={styles.secondaryButton}
          >
            ← Daftar Materi
          </button>

          <div style={styles.bottomStatus}>
            <span
              style={{
                ...styles.bottomStatusDot,
                background: isCompleted
                  ? '#22c55e'
                  : '#6366f1',
              }}
            ></span>

            {isCompleted
              ? 'Progress tersimpan'
              : 'Progress belum selesai'}
          </div>
        </div>

        <div style={styles.securityBox}>
          <div style={styles.securityIcon}>
            ✓
          </div>

          <div>
            <strong>
              Protected Member Content
            </strong>

            <div style={styles.securityText}>
              Content dan progress dilindungi
              authenticated Supabase access dan Row
              Level Security.
            </div>
          </div>
        </div>
      </div>
      </main>
    </MemberShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '28px 18px 70px',
    color: '#fff',
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
    color: '#fff',
    background:
      'radial-gradient(circle at top, #172554, #030712 65%)',
    fontFamily: 'Inter, system-ui, sans-serif',
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
    fontSize: 12,
    fontWeight: 900,
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
    color: '#fff',
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
  },

  breadcrumb: {
    display: 'flex',
    gap: 9,
    flexWrap: 'wrap',
    marginBottom: 14,
    color: '#64748b',
    fontSize: 14,
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
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.4,
    background: 'rgba(255,255,255,.08)',
  },

  title: {
    margin: '15px 0 10px',
    fontSize: 'clamp(29px, 5vw, 46px)',
    lineHeight: 1.08,
  },

  lessonMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 9,
    color: '#94a3b8',
    fontSize: 14,
  },

  dot: {
    color: '#475569',
  },

  progressCard: {
    marginTop: 18,
    padding: '18px 20px',
    borderRadius: 18,
    border: '1px solid rgba(99,102,241,.15)',
    background:
      'linear-gradient(135deg, rgba(30,64,175,.16), rgba(88,28,135,.12), rgba(15,23,42,.78))',
  },

  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 13,
  },

  progressLabel: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.5,
  },

  progressStatus: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: 800,
  },

  progressPercent: {
    fontSize: 25,
    fontWeight: 900,
  },

  progressTrack: {
    width: '100%',
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    background: 'rgba(255,255,255,.07)',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    background:
      'linear-gradient(90deg, #2563eb, #7c3aed, #22c55e)',
    transition: 'width .35s ease',
  },

  readerCard: {
    marginTop: 18,
    padding: '25px 26px 30px',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,.09)',
    background:
      'linear-gradient(145deg, rgba(30,41,59,.82), rgba(15,23,42,.92))',
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: 850,
    background: 'rgba(34,197,94,.1)',
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
    background: '#000',
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
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
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
    background:
      'linear-gradient(135deg, rgba(37,99,235,.25), rgba(124,58,237,.25))',
  },

  externalButton: {
    display: 'inline-block',
    marginTop: 20,
    padding: '12px 18px',
    borderRadius: 12,
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 800,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
  },

  noLink: {
    marginTop: 18,
    color: '#64748b',
  },

  actionCard: {
    marginTop: 18,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    borderRadius: 18,
    background:
      'linear-gradient(135deg, rgba(30,64,175,.18), rgba(88,28,135,.12))',
  },

  completedCard: {
    marginTop: 18,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    borderRadius: 18,
    background:
      'linear-gradient(135deg, rgba(6,78,59,.30), rgba(15,23,42,.72))',
  },

  incompleteIcon: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    fontSize: 25,
    color: '#a5b4fc',
    background: 'rgba(99,102,241,.13)',
  },

  completeIcon: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    color: '#86efac',
    fontWeight: 900,
    background: 'rgba(34,197,94,.13)',
  },

  actionInfo: {
    flex: 1,
    minWidth: 210,
  },

  actionTitle: {
    fontSize: 14,
  },

  actionText: {
    marginTop: 4,
    color: '#94a3b8',
    fontSize: 14,
  },

  completeButton: {
    padding: '12px 17px',
    border: 0,
    borderRadius: 12,
    color: '#fff',
    fontWeight: 850,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
  },

  completedBadge: {
    padding: '9px 13px',
    borderRadius: 999,
    color: '#86efac',
    fontWeight: 900,
    background: 'rgba(34,197,94,.1)',
  },

  successMessage: {
    marginTop: 12,
    padding: '12px 15px',
    borderRadius: 12,
    color: '#86efac',
    background: 'rgba(6,78,59,.22)',
  },

  progressError: {
    marginTop: 12,
    padding: '12px 15px',
    borderRadius: 12,
    color: '#fca5a5',
    background: 'rgba(127,29,29,.2)',
  },

  navigationSection: {
    marginTop: 28,
  },

  navigationLabel: {
    marginBottom: 10,
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.5,
  },

  navigationGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 12,
  },

  navigationCard: {
    minHeight: 105,
    padding: 18,
    textAlign: 'left',
    cursor: 'pointer',
    color: '#fff',
    borderRadius: 18,
    border: '1px solid rgba(99,102,241,.17)',
    background:
      'linear-gradient(135deg, rgba(37,99,235,.20), rgba(124,58,237,.14), rgba(15,23,42,.82))',
  },

  navigationDisabled: {
    minHeight: 105,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,.06)',
    background:
      'linear-gradient(135deg, rgba(30,41,59,.45), rgba(15,23,42,.65))',
  },

  navigationDirection: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.1,
  },

  navigationTitle: {
    marginTop: 9,
    fontSize: 15,
    fontWeight: 850,
    lineHeight: 1.4,
  },

  navigationDisabledText: {
    marginTop: 9,
    color: '#475569',
    fontSize: 14,
    fontWeight: 700,
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

  bottomStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#64748b',
    fontSize: 13,
  },

  bottomStatusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
  },

  securityBox: {
    marginTop: 26,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderRadius: 17,
    background:
      'linear-gradient(135deg, rgba(6,78,59,.25), rgba(15,23,42,.62))',
  },

  securityIcon: {
    width: 36,
    height: 36,
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
    fontSize: 14,
  },
}

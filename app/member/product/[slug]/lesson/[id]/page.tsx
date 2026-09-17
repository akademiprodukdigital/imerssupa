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

  const [activeLessonId, setActiveLessonId] = useState(lessonId)
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')

  const [product, setProduct] = useState<Product | null>(null)
  const [lesson, setLesson] = useState<Content | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [allLessons, setAllLessons] = useState<Content[]>([])
  const [allProgress, setAllProgress] = useState<Progress[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)

  const [loading, setLoading] = useState(true)
  const [savingProgress, setSavingProgress] = useState(false)

  const [error, setError] = useState('')
  const [progressError, setProgressError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    setActiveLessonId(lessonId)
    loadLesson()
  }, [slug])

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
    setSections(sections)

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

    const lessonIds = sortedContents.map((item) => item.id)

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
      .in('content_id', lessonIds.length > 0 ? lessonIds : [currentLesson.id])

    if (progressLoadError) {
      setProgressError(progressLoadError.message)
    } else {
      const rows = (progressData ?? []) as Progress[]
      setAllProgress(rows)
      setProgress(
        rows.find((row) => row.content_id === currentLesson.id) ?? null
      )
    }

    setLoading(false)
  }

  const currentIndex = useMemo(() => {
    return allLessons.findIndex(
      (item) => item.id === activeLessonId
    )
  }, [allLessons, activeLessonId])

  const previousLesson =
    currentIndex > 0
      ? allLessons[currentIndex - 1]
      : null

  const nextLesson =
    currentIndex >= 0 &&
    currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null

  useEffect(() => {
    function handlePopState() {
      const idFromUrl =
        window.location.pathname.split('/').filter(Boolean).pop() ?? ''

      const selectedLesson = allLessons.find(
        (item) => item.id === idFromUrl
      )

      if (!selectedLesson) {
        return
      }

      setActiveLessonId(selectedLesson.id)
      setLesson(selectedLesson)
      setProgress(
        allProgress.find(
          (row) => row.content_id === selectedLesson.id
        ) ?? null
      )
      setProgressError('')
      setSuccessMessage('')
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [allLessons, allProgress])

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
    setAllProgress((current) => [
      ...current.filter((row) => row.content_id !== data.content_id),
      data,
    ])
    setSuccessMessage('Materi berhasil ditandai selesai.')
    setSavingProgress(false)
  }

  function openLesson(id: string) {
    const selectedLesson = allLessons.find(
      (item) => item.id === id
    )

    if (!selectedLesson || id === activeLessonId) {
      return
    }

    setActiveLessonId(id)
    setLesson(selectedLesson)
    setProgress(
      allProgress.find((row) => row.content_id === id) ?? null
    )
    setProgressError('')
    setSuccessMessage('')

    // Update URL without triggering a Next.js route transition.
    // The Course Workspace stays mounted, so the viewer changes instantly.
    window.history.pushState(
      { lessonId: id },
      '',
      `/member/product/${slug}/lesson/${id}`
    )

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
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

  function lessonCompleted(id: string) {
    const row = allProgress.find((item) => item.content_id === id)
    return row?.completed === true || Number(row?.progress_percent ?? 0) >= 100
  }

  const curriculumGroups = sections.map((section) => ({
    ...section,
    lessons: allLessons.filter((item) => item.section_id === section.id),
  }))

  const ungroupedLessons = allLessons.filter(
    (item) => !item.section_id || !sections.some((section) => section.id === item.section_id)
  )

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
          <div style={styles.courseTopbar}>
            <button
              onClick={() => router.push('/member?view=learning')}
              style={styles.backButton}
            >
              ← Lanjut Belajar
            </button>

            <div style={styles.courseIdentity}>
              <span style={styles.onlineDot} />
              <span>{product.name}</span>
            </div>
          </div>

          <section style={styles.courseHeader}>
            <div>
              <div style={styles.eyebrow}>MEMBER COURSE</div>
              <h1 style={styles.courseTitle}>{product.name}</h1>
              <p style={styles.courseSubtitle}>
                Materi {currentIndex + 1} dari {allLessons.length} • {lesson.title}
              </p>
            </div>

            <div style={styles.headerProgress}>
              <strong>
                {allLessons.length > 0
                  ? Math.round(
                      (allLessons.filter((item) => lessonCompleted(item.id)).length /
                        allLessons.length) *
                        100
                    )
                  : 0}
                %
              </strong>
              <span>Course Progress</span>
            </div>
          </section>

          <div style={styles.workspace}>
            <section style={styles.viewerColumn}>
              <div style={styles.lessonHeading}>
                <div>
                  <div style={styles.typeBadge}>
                    {getTypeLabel(lesson.content_type)}
                  </div>
                  <h2 style={styles.lessonTitle}>{lesson.title}</h2>
                </div>

                <div
                  style={{
                    ...styles.statusBadge,
                    ...(isCompleted ? styles.statusDone : {}),
                  }}
                >
                  {isCompleted ? '✓ Selesai' : 'Sedang Dipelajari'}
                </div>
              </div>

              <div style={styles.viewerCard}>
                {renderContent()}
              </div>

              <section
                style={isCompleted ? styles.completedCard : styles.actionCard}
              >
                <div style={isCompleted ? styles.completeIcon : styles.incompleteIcon}>
                  {isCompleted ? '✓' : '○'}
                </div>

                <div style={styles.actionInfo}>
                  <strong style={styles.actionTitle}>
                    {isCompleted
                      ? 'Materi sudah selesai'
                      : 'Sudah selesai mempelajari materi ini?'}
                  </strong>
                  <div style={styles.actionText}>
                    {isCompleted
                      ? 'Progress materi ini sudah tersimpan di akun Anda.'
                      : 'Tandai selesai agar progress pembelajaran tersimpan.'}
                  </div>
                </div>

                {!isCompleted && (
                  <button
                    onClick={markAsCompleted}
                    disabled={savingProgress}
                    style={{
                      ...styles.completeButton,
                      opacity: savingProgress ? 0.65 : 1,
                    }}
                  >
                    {savingProgress ? 'Menyimpan...' : 'Tandai Selesai ✓'}
                  </button>
                )}
              </section>

              {successMessage && (
                <div style={styles.successMessage}>✓ {successMessage}</div>
              )}

              {progressError && (
                <div style={styles.progressError}>{progressError}</div>
              )}

              <div style={styles.lessonNavigation}>
                <button
                  disabled={!previousLesson}
                  onClick={() => previousLesson && openLesson(previousLesson.id)}
                  style={{
                    ...styles.navButton,
                    opacity: previousLesson ? 1 : 0.45,
                  }}
                >
                  ← Sebelumnya
                </button>

                <button
                  disabled={!nextLesson}
                  onClick={() => nextLesson && openLesson(nextLesson.id)}
                  style={{
                    ...styles.navButtonPrimary,
                    opacity: nextLesson ? 1 : 0.45,
                  }}
                >
                  Selanjutnya →
                </button>
              </div>
            </section>

            <aside style={styles.curriculum}>
              <div style={styles.curriculumHead}>
                <div>
                  <div style={styles.eyebrow}>COURSE CONTENT</div>
                  <h3 style={styles.curriculumTitle}>Daftar Materi</h3>
                </div>
                <span style={styles.lessonCount}>{allLessons.length} Materi</span>
              </div>

              <div style={styles.curriculumScroll}>
                {curriculumGroups.map((section, sectionIndex) => (
                  <div key={section.id} style={styles.moduleCard}>
                    <div style={styles.moduleHeader}>
                      <span style={styles.moduleNumber}>
                        {String(sectionIndex + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <strong style={styles.moduleTitle}>{section.title}</strong>
                        <span style={styles.moduleMeta}>
                          {section.lessons.filter((item) => lessonCompleted(item.id)).length}/
                          {section.lessons.length} selesai
                        </span>
                      </div>
                    </div>

                    <div style={styles.lessonList}>
                      {section.lessons.map((item, lessonIndex) => {
                        const active = item.id === lesson.id
                        const done = lessonCompleted(item.id)

                        return (
                          <button
                            key={item.id}
                            onClick={() => openLesson(item.id)}
                            style={{
                              ...styles.curriculumLesson,
                              ...(active ? styles.curriculumLessonActive : {}),
                            }}
                          >
                            <span
                              style={{
                                ...styles.lessonState,
                                ...(done ? styles.lessonStateDone : {}),
                              }}
                            >
                              {done ? '✓' : lessonIndex + 1}
                            </span>

                            <span style={styles.curriculumLessonText}>
                              <strong>{item.title}</strong>
                              <small>{getTypeLabel(item.content_type).replace(' LESSON', '')}</small>
                            </span>

                            {active && <span style={styles.playingDot}>●</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {ungroupedLessons.length > 0 && (
                  <div style={styles.moduleCard}>
                    <div style={styles.moduleHeader}>
                      <span style={styles.moduleNumber}>+</span>
                      <div>
                        <strong style={styles.moduleTitle}>Materi Lainnya</strong>
                        <span style={styles.moduleMeta}>
                          {ungroupedLessons.length} materi
                        </span>
                      </div>
                    </div>

                    <div style={styles.lessonList}>
                      {ungroupedLessons.map((item, lessonIndex) => {
                        const active = item.id === lesson.id
                        const done = lessonCompleted(item.id)

                        return (
                          <button
                            key={item.id}
                            onClick={() => openLesson(item.id)}
                            style={{
                              ...styles.curriculumLesson,
                              ...(active ? styles.curriculumLessonActive : {}),
                            }}
                          >
                            <span
                              style={{
                                ...styles.lessonState,
                                ...(done ? styles.lessonStateDone : {}),
                              }}
                            >
                              {done ? '✓' : lessonIndex + 1}
                            </span>
                            <span style={styles.curriculumLessonText}>
                              <strong>{item.title}</strong>
                              <small>{getTypeLabel(item.content_type).replace(' LESSON', '')}</small>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.protectedBox}>
                <span>🔒</span>
                <div>
                  <strong>Protected Member Content</strong>
                  <p>
                    Materi ditampilkan di Member Area setelah autentikasi dan
                    pengecekan akses.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </MemberShell>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '26px 24px 70px',
    color: '#172033',
    background:
      'radial-gradient(circle at 10% 0%, rgba(191,219,254,.70), transparent 30%), radial-gradient(circle at 88% 12%, rgba(233,213,255,.72), transparent 34%), linear-gradient(135deg,#f7fbff,#faf7ff 55%,#fff8fc)',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: { width: '100%', maxWidth: 1320, margin: '0 auto' },
  centerPage: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 20, background: '#f7f8ff',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  loadingCard: {
    width: '100%', maxWidth: 460, padding: 38, textAlign: 'center',
    borderRadius: 26, border: '1px solid #e5e7eb', background: '#fff',
  },
  loadingLogo: {
    width: 56, height: 56, margin: '0 auto 18px', borderRadius: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 900, color: '#fff',
    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
  },
  errorCard: {
    width: '100%', maxWidth: 520, padding: 38, textAlign: 'center',
    borderRadius: 26, border: '1px solid #fecaca', background: '#fff',
  },
  errorBadge: {
    display: 'inline-block', padding: '6px 11px', borderRadius: 999,
    fontSize: 12, fontWeight: 900, color: '#dc2626', background: '#fee2e2',
  },
  muted: { margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.7 },
  primaryButton: {
    marginTop: 20, border: 0, borderRadius: 12, padding: '12px 18px',
    color: '#fff', fontWeight: 800, cursor: 'pointer',
    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
  },
  courseTopbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, marginBottom: 18,
  },
  backButton: {
    border: '1px solid rgba(99,102,241,.16)', borderRadius: 12,
    padding: '11px 15px', background: 'rgba(255,255,255,.76)',
    color: '#334155', fontWeight: 800, cursor: 'pointer',
  },
  courseIdentity: {
    display: 'flex', alignItems: 'center', gap: 8, color: '#64748b',
    fontSize: 13, fontWeight: 700,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 99, background: '#22c55e' },
  courseHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 24, padding: '24px 28px', marginBottom: 20, borderRadius: 24,
    border: '1px solid rgba(99,102,241,.13)',
    background: 'linear-gradient(120deg,rgba(219,234,254,.88),rgba(255,255,255,.78),rgba(243,232,255,.88))',
    boxShadow: '0 18px 45px rgba(79,70,229,.08)',
  },
  eyebrow: {
    color: '#6366f1', fontSize: 11, lineHeight: 1.2, fontWeight: 900,
    letterSpacing: '1.5px',
  },
  courseTitle: {
    margin: '7px 0 5px', fontSize: 28, lineHeight: 1.08,
    letterSpacing: '-.7px', color: '#172033',
  },
  courseSubtitle: { margin: 0, color: '#64748b', fontSize: 13.5 },
  headerProgress: {
    minWidth: 130,
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
  },
  workspace: {
    display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 370px',
    gap: 20, alignItems: 'start',
  },
  viewerColumn: { minWidth: 0 },
  lessonHeading: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 18, marginBottom: 14,
  },
  typeBadge: {
    display: 'inline-flex', padding: '6px 10px', borderRadius: 999,
    background: '#eef2ff', color: '#6366f1', fontSize: 10.5,
    fontWeight: 900, letterSpacing: '1px',
  },
  lessonTitle: {
    margin: '9px 0 0', fontSize: 27, lineHeight: 1.15,
    letterSpacing: '-.6px', color: '#172033',
  },
  statusBadge: {
    padding: '7px 11px', borderRadius: 999, background: '#eef2ff',
    color: '#6366f1', fontSize: 11, fontWeight: 900,
  },
  statusDone: { background: '#dcfce7', color: '#15803d' },
  viewerCard: {
    minHeight: 430, padding: 26, borderRadius: 22,
    border: '1px solid rgba(99,102,241,.12)', background: 'rgba(255,255,255,.82)',
    boxShadow: '0 18px 50px rgba(15,23,42,.06)',
  },
  textContent: {
    whiteSpace: 'pre-wrap', color: '#334155', fontSize: 15,
    lineHeight: 1.85,
  },
  htmlBox: { color: '#334155' },
  htmlContent: { fontSize: 15, lineHeight: 1.8 },
  videoWrapper: {
    position: 'relative', width: '100%', paddingTop: '56.25%',
    overflow: 'hidden', borderRadius: 18, background: '#020617',
  },
  videoIframe: {
    position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0,
  },
  videoPlaceholder: {
    padding: '55px 24px', textAlign: 'center', borderRadius: 18,
    background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
  },
  playIcon: {
    width: 64, height: 64, margin: '0 auto 16px', borderRadius: 999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 24, background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
  },
  videoDescription: { marginTop: 18, color: '#475569', fontSize: 14.5, lineHeight: 1.75 },
  resourceBox: {
    padding: '50px 28px', textAlign: 'center', borderRadius: 18,
    background: 'linear-gradient(135deg,#eff6ff,#faf5ff)',
  },
  resourceIcon: {
    width: 58, height: 58, margin: '0 auto 14px', borderRadius: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 24, background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
  },
  externalButton: {
    display: 'inline-flex', marginTop: 18, padding: '11px 16px',
    borderRadius: 12, color: '#fff', textDecoration: 'none', fontWeight: 800,
    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
  },
  noLink: { marginTop: 16, color: '#94a3b8', fontSize: 13 },
  actionCard: {
    display: 'flex', alignItems: 'center', gap: 13, marginTop: 14,
    padding: 16, borderRadius: 18, border: '1px solid #e0e7ff',
    background: 'rgba(255,255,255,.78)',
  },
  completedCard: {
    display: 'flex', alignItems: 'center', gap: 13, marginTop: 14,
    padding: 16, borderRadius: 18, border: '1px solid #bbf7d0',
    background: 'rgba(240,253,244,.88)',
  },
  incompleteIcon: {
    width: 38, height: 38, borderRadius: 12, display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: '#6366f1',
    background: '#eef2ff', fontSize: 22,
  },
  completeIcon: {
    width: 38, height: 38, borderRadius: 12, display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: '#15803d',
    background: '#dcfce7', fontSize: 18, fontWeight: 900,
  },
  actionInfo: { flex: 1, minWidth: 0 },
  actionTitle: { display: 'block', color: '#172033', fontSize: 13.5 },
  actionText: { marginTop: 3, color: '#64748b', fontSize: 12.5, lineHeight: 1.5 },
  completeButton: {
    border: 0, borderRadius: 12, padding: '11px 15px', color: '#fff',
    fontSize: 13, fontWeight: 900, cursor: 'pointer',
    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
  },
  successMessage: {
    marginTop: 12, padding: '11px 14px', borderRadius: 12,
    color: '#15803d', background: '#dcfce7', fontSize: 13, fontWeight: 800,
  },
  progressError: {
    marginTop: 12, padding: '11px 14px', borderRadius: 12,
    color: '#b91c1c', background: '#fee2e2', fontSize: 13,
  },
  lessonNavigation: {
    display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 14,
  },
  navButton: {
    border: '1px solid #e2e8f0', borderRadius: 12, padding: '11px 15px',
    background: '#fff', color: '#334155', fontWeight: 800, cursor: 'pointer',
  },
  navButtonPrimary: {
    border: 0, borderRadius: 12, padding: '11px 15px', color: '#fff',
    fontWeight: 800, cursor: 'pointer',
    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
  },
  curriculum: {
    position: 'sticky', top: 18, overflow: 'hidden', borderRadius: 22,
    border: '1px solid rgba(99,102,241,.13)', background: 'rgba(255,255,255,.86)',
    boxShadow: '0 18px 50px rgba(15,23,42,.07)',
  },
  curriculumHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 12, padding: '20px 20px 15px', borderBottom: '1px solid #eef2f7',
  },
  curriculumTitle: { margin: '5px 0 0', fontSize: 19, color: '#172033' },
  lessonCount: {
    padding: '6px 9px', borderRadius: 999, background: '#eef2ff',
    color: '#6366f1', fontSize: 10.5, fontWeight: 900,
  },
  curriculumScroll: { maxHeight: '66vh', overflowY: 'auto', padding: 12 },
  moduleCard: {
    overflow: 'hidden', marginBottom: 10, borderRadius: 16,
    border: '1px solid #edf0f6', background: '#fbfcff',
  },
  moduleHeader: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px',
    background: 'linear-gradient(135deg,#f8faff,#f7f3ff)',
  },
  moduleNumber: {
    width: 34, height: 34, flex: '0 0 34px', borderRadius: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#6366f1', background: '#e0e7ff', fontSize: 11, fontWeight: 900,
  },
  moduleTitle: { display: 'block', color: '#253047', fontSize: 13.5 },
  moduleMeta: { display: 'block', marginTop: 2, color: '#94a3b8', fontSize: 10.5 },
  lessonList: { padding: 6 },
  curriculumLesson: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 9px', margin: 0, border: 0, borderRadius: 12,
    textAlign: 'left', background: 'transparent', color: '#334155', cursor: 'pointer',
  },
  curriculumLessonActive: {
    background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
    boxShadow: 'inset 0 0 0 1px rgba(99,102,241,.14)',
  },
  lessonState: {
    width: 28, height: 28, flex: '0 0 28px', borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#64748b', background: '#f1f5f9', fontSize: 10.5, fontWeight: 900,
  },
  lessonStateDone: { color: '#15803d', background: '#dcfce7' },
  curriculumLessonText: {
    minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
  },
  playingDot: { color: '#6366f1', fontSize: 10 },
  protectedBox: {
    display: 'flex', gap: 10, margin: '0 12px 12px', padding: 12,
    borderRadius: 14, background: '#f8fafc', color: '#475569', fontSize: 11.5,
  },
}

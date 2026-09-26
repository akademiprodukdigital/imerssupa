'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import ThemeSwitcher from '../../components/ThemeSwitcher'

type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  status: string | null
}

type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  created_at?: string | null
  cover_url?: string | null
  thumbnail_url?: string | null
  image_url?: string | null
  [key: string]: unknown
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
  sort_order: number
  is_published: boolean
}

type Progress = {
  id: string
  user_id: string
  content_id: string
  progress_percent: number
  completed: boolean
  updated_at: string | null
}

type ProductInfo = Product & {
  lessons: Content[]
  completedCount: number
  progressPercent: number
  nextLesson: Content | null
  cover: string | null
}

export default function MemberDashboard() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [progressRows, setProgressRows] = useState<Progress[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [memberView, setMemberView] = useState<'dashboard' | 'products' | 'learning' | 'resources'>('dashboard')
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    loadDashboard()

    if (typeof window !== 'undefined') {
      const view = new URLSearchParams(window.location.search).get('view')
      if (view === 'products' || view === 'learning' || view === 'resources') {
        setMemberView(view)
      }
      if (view === 'profile') {
        setProfileOpen(true)
      }
    }
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/login')
      return
    }

    setEmail(user.email ?? '')

    // PROFILE
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (profileData) {
      setProfile(profileData as Profile)
    }

    // PRODUCTS
    // RLS otomatis hanya mengembalikan produk yang boleh
    // diakses oleh member ini.
    const {
      data: productData,
      error: productError,
    } = await supabase
      .from('products')
      .select('*')

    if (productError) {
      setError(productError.message)
      setLoading(false)
      return
    }

    const memberProducts = (productData ?? []) as Product[]
    setProducts(memberProducts)

    if (memberProducts.length === 0) {
      setLoading(false)
      return
    }

    const productIds = memberProducts.map((item) => item.id)

    // SECTIONS
    const {
      data: sectionData,
      error: sectionError,
    } = await supabase
      .from('product_sections')
      .select('id, product_id, title, sort_order')
      .in('product_id', productIds)

    if (sectionError) {
      setError(sectionError.message)
      setLoading(false)
      return
    }

    const memberSections = (sectionData ?? []) as Section[]
    setSections(memberSections)

    // CONTENTS
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
        sort_order,
        is_published
      `)
      .in('product_id', productIds)
      .eq('is_published', true)

    if (contentError) {
      setError(contentError.message)
      setLoading(false)
      return
    }

    const memberContents = (contentData ?? []) as Content[]
    setContents(memberContents)

    if (memberContents.length === 0) {
      setLoading(false)
      return
    }

    const contentIds = memberContents.map((item) => item.id)

    // PROGRESS
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
        updated_at
      `)
      .eq('user_id', user.id)
      .in('content_id', contentIds)

    if (progressError) {
      setError(progressError.message)
      setLoading(false)
      return
    }

    setProgressRows((progressData ?? []) as Progress[])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  function scrollTo(id: string) {
    setMenuOpen(false)

    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  function openMemberView(
    view: 'dashboard' | 'products' | 'learning' | 'resources'
  ) {
    setMenuOpen(false)
    setMemberView(view)

    if (typeof window !== 'undefined') {
      const url = view === 'dashboard' ? '/member' : `/member?view=${view}`
      window.history.pushState({}, '', url)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function isCompleted(contentId: string) {
    const row = progressRows.find(
      (item) => item.content_id === contentId
    )

    return (
      row?.completed === true ||
      Number(row?.progress_percent ?? 0) >= 100
    )
  }

  function sortProductLessons(productId: string) {
    const productSections = sections
      .filter((item) => item.product_id === productId)
      .sort((a, b) => a.sort_order - b.sort_order)

    const sectionPosition = new Map<string, number>()

    productSections.forEach((section, index) => {
      sectionPosition.set(section.id, index)
    })

    return contents
      .filter((item) => item.product_id === productId)
      .sort((a, b) => {
        const sectionA =
          a.section_id &&
          sectionPosition.has(a.section_id)
            ? sectionPosition.get(a.section_id)!
            : 999999

        const sectionB =
          b.section_id &&
          sectionPosition.has(b.section_id)
            ? sectionPosition.get(b.section_id)!
            : 999999

        if (sectionA !== sectionB) {
          return sectionA - sectionB
        }

        return a.sort_order - b.sort_order
      })
  }

  const productInfos = useMemo<ProductInfo[]>(() => {
    return products.map((product) => {
      const lessons = sortProductLessons(product.id)

      const completedCount = lessons.filter((lesson) =>
        isCompleted(lesson.id)
      ).length

      const progressPercent =
        lessons.length > 0
          ? Math.round(
              (completedCount / lessons.length) * 100
            )
          : 0

      const nextLesson =
        lessons.find(
          (lesson) => !isCompleted(lesson.id)
        ) ?? null

      const possibleCover =
        typeof product.cover_url === 'string'
          ? product.cover_url
          : typeof product.thumbnail_url === 'string'
            ? product.thumbnail_url
            : typeof product.image_url === 'string'
              ? product.image_url
              : null

      return {
        ...product,
        lessons,
        completedCount,
        progressPercent,
        nextLesson,
        cover: possibleCover,
      }
    })
  }, [products, sections, contents, progressRows])

  const totalLessons = contents.length

  const completedLessons = contents.filter((lesson) =>
    isCompleted(lesson.id)
  ).length

  const overallProgress =
    totalLessons > 0
      ? Math.round(
          (completedLessons / totalLessons) * 100
        )
      : 0

  // Product pertama yang belum 100%.
  const continueProduct =
    productInfos.find(
      (item) =>
        item.nextLesson && item.progressPercent < 100
    ) ?? null

  const continueLesson =
    continueProduct?.nextLesson ?? null

  const recentActivity = useMemo(() => {
    return [...progressRows]
      .filter(
        (row) =>
          row.completed ||
          Number(row.progress_percent) > 0
      )
      .sort((a, b) => {
        const timeA = a.updated_at
          ? new Date(a.updated_at).getTime()
          : 0

        const timeB = b.updated_at
          ? new Date(b.updated_at).getTime()
          : 0

        return timeB - timeA
      })
      .slice(0, 4)
      .map((row) => {
        const lesson = contents.find(
          (item) => item.id === row.content_id
        )

        const product = products.find(
          (item) => item.id === lesson?.product_id
        )

        return {
          progress: row,
          lesson,
          product,
        }
      })
      .filter((item) => item.lesson && item.product)
  }, [progressRows, contents, products])

  const resourceContents = contents.filter(
    (item) => item.content_type === 'external_url'
  )

  const searchResults = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return []

    const productMatches = productInfos
      .filter((product) =>
        product.name.toLowerCase().includes(keyword)
      )
      .slice(0, 3)
      .map((product) => ({
        id: product.id,
        title: product.name,
        subtitle: 'Produk',
        url: `/member/product/${product.slug}`,
      }))

    const lessonMatches = contents
      .filter((lesson) =>
        lesson.title.toLowerCase().includes(keyword)
      )
      .slice(0, 5)
      .map((lesson) => {
        const product = products.find(
          (item) => item.id === lesson.product_id
        )

        return {
          id: lesson.id,
          title: lesson.title,
          subtitle: product?.name ?? 'Materi',
          url: product
            ? `/member/product/${product.slug}/lesson/${lesson.id}`
            : '/member',
        }
      })

    return [...productMatches, ...lessonMatches].slice(0, 6)
  }, [search, productInfos, contents, products])

  const displayName =
    profile?.full_name?.trim() ||
    email.split('@')[0] ||
    'Member'

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('')

  function greeting() {
    const hour = new Date().getHours()

    if (hour < 11) return 'Selamat pagi'
    if (hour < 15) return 'Selamat siang'
    if (hour < 18) return 'Selamat sore'

    return 'Selamat malam'
  }

  function continueLearning() {
    if (continueProduct && continueLesson) {
      router.push(
        `/member/product/${continueProduct.slug}/lesson/${continueLesson.id}`
      )
      return
    }

    const fallbackProduct = productInfos.find(
      (item) => item.lessons.length > 0
    )

    const fallbackLesson = fallbackProduct?.lessons[0]

    if (fallbackProduct && fallbackLesson) {
      router.push(
        `/member/product/${fallbackProduct.slug}/lesson/${fallbackLesson.id}`
      )
    }
  }

  if (loading) {
    return (
      <main className="loading-page">
        <div className="loading-card">
          <div className="logo-box">S</div>
          <h2>iMersSUPA</h2>
          <p>Menyiapkan dashboard member...</p>
          <div className="loading-line">
            <span />
          </div>
        </div>

        <DashboardStyles />
      </main>
    )
  }

  return (
    <>
      <ThemeSwitcher />
      <div className="app-shell">

        {/* ===================================================
            DESKTOP SIDEBAR
        =================================================== */}

        <aside className="sidebar">
          <div>
            <div className="brand">
              <div className="logo-box">S</div>

              <div>
                <div className="brand-name">
                  iMersSUPA
                </div>
                <div className="brand-caption">
                  MEMBER AREA
                </div>
              </div>
            </div>

            <div className="menu-label">
              MAIN MENU
            </div>

            <nav className="sidebar-nav">
              <button
                className={`nav-item ${memberView === 'dashboard' ? 'active' : ''}`}
                onClick={() => openMemberView('dashboard')}
              >
                <span className="nav-icon">⌂</span>
                Dashboard
              </button>

              <button
                className={`nav-item ${memberView === 'products' ? 'active' : ''}`}
                onClick={() => openMemberView('products')}
              >
                <span className="nav-icon">▣</span>
                Produk Saya
              </button>

              <button
                className={`nav-item ${memberView === 'learning' ? 'active' : ''}`}
                onClick={() => openMemberView('learning')}
              >
                <span className="nav-icon">▶</span>
                Lanjut Belajar
              </button>

              <button
                className={`nav-item ${memberView === 'resources' ? 'active' : ''}`}
                onClick={() => openMemberView('resources')}
              >
                <span className="nav-icon">◆</span>
                Resources
              </button>

              <button
                className="nav-item"
                onClick={() => {
                  setMenuOpen(false)
                  router.push('/member/affiliate')
                }}
              >
                <span className="nav-icon">↗</span>
                Affiliate Center
              </button>

              <button
                className="nav-item"
                onClick={() => setProfileOpen(true)}
              >
                <span className="nav-icon">◎</span>
                Profile & Account
              </button>
            </nav>
          </div>

          <div className="sidebar-bottom">
            <div className="mini-profile">
              <Avatar
                avatarUrl={profile?.avatar_url}
                initials={initials}
              />

              <div className="mini-profile-info">
                <strong>{displayName}</strong>
                <span>{email}</span>
              </div>
            </div>

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              <span>↗</span>
              Keluar
            </button>
          </div>
        </aside>

        {/* ===================================================
            MOBILE SIDEBAR
        =================================================== */}

        {menuOpen && (
          <div
            className="mobile-overlay"
            onClick={() => setMenuOpen(false)}
          >
            <aside
              className="mobile-drawer"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="drawer-top">
                <div className="brand">
                  <div className="logo-box">S</div>

                  <div>
                    <div className="brand-name">
                      iMersSUPA
                    </div>
                    <div className="brand-caption">
                      MEMBER AREA
                    </div>
                  </div>
                </div>

                <button
                  className="icon-button"
                  onClick={() => setMenuOpen(false)}
                >
                  ×
                </button>
              </div>

              <nav className="sidebar-nav">
                <button
                  className={`nav-item ${memberView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => openMemberView('dashboard')}
                >
                  <span className="nav-icon">⌂</span>
                  Dashboard
                </button>

                <button
                  className={`nav-item ${memberView === 'products' ? 'active' : ''}`}
                  onClick={() => openMemberView('products')}
                >
                  <span className="nav-icon">▣</span>
                  Produk Saya
                </button>

                <button
                  className={`nav-item ${memberView === 'learning' ? 'active' : ''}`}
                  onClick={() => openMemberView('learning')}
                >
                  <span className="nav-icon">▶</span>
                  Lanjut Belajar
                </button>

                <button
                  className={`nav-item ${memberView === 'resources' ? 'active' : ''}`}
                  onClick={() => openMemberView('resources')}
                >
                  <span className="nav-icon">◆</span>
                  Resources
                </button>

                <button
                  className="nav-item"
                  onClick={() => {
                    setMenuOpen(false)
                    router.push('/member/affiliate')
                  }}
                >
                  <span className="nav-icon">↗</span>
                  Affiliate Center
                </button>

                <button
                  className="nav-item"
                  onClick={() => {
                    setMenuOpen(false)
                    setProfileOpen(true)
                  }}
                >
                  <span className="nav-icon">◎</span>
                  Profile & Account
                </button>
              </nav>

              <div className="drawer-logout">
                <button
                  className="logout-button"
                  onClick={handleLogout}
                >
                  Keluar dari Akun
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ===================================================
            MAIN
        =================================================== */}

        <main className="main-content" id="dashboard">

          {/* TOPBAR */}

          <header className="topbar">
            <div className="mobile-menu-area">
              <button
                className="icon-button menu-button"
                onClick={() => setMenuOpen(true)}
              >
                ☰
              </button>

              <div className="mobile-logo">
                iMersSUPA
              </div>
            </div>

            <div className="search-area">
              <span className="search-icon">⌕</span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Cari produk atau materi..."
              />

              {search && (
                <button
                  className="clear-search"
                  onClick={() => setSearch('')}
                >
                  ×
                </button>
              )}

              {search && (
                <div className="search-dropdown">
                  {searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={`${result.subtitle}-${result.id}`}
                        className="search-result"
                        onClick={() => {
                          setSearch('')
                          router.push(result.url)
                        }}
                      >
                        <span className="search-result-icon">
                          →
                        </span>

                        <span>
                          <strong>
                            {result.title}
                          </strong>
                          <small>
                            {result.subtitle}
                          </small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="search-empty">
                      Tidak ada hasil ditemukan.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="top-actions">
              <button
                className="notification-button"
                title="Notifikasi"
              >
                ♢
                <span className="notification-dot" />
              </button>

              <button
                className="top-profile"
                onClick={() => setProfileOpen(true)}
              >
                <Avatar
                  avatarUrl={profile?.avatar_url}
                  initials={initials}
                />

                <span className="top-profile-text">
                  <strong>{displayName}</strong>
                  <small>Member</small>
                </span>
              </button>
            </div>
          </header>

          <div className="dashboard-container">

            {error && (
              <div className="error-box">
                <strong>
                  Dashboard belum dapat dimuat sempurna.
                </strong>
                <span>{error}</span>
              </div>
            )}

            {memberView !== 'dashboard' && (
              <section className="member-view-header">
                <div>
                  <div className="eyebrow">
                    {memberView === 'products'
                      ? 'MY LIBRARY'
                      : memberView === 'learning'
                        ? 'CONTINUE LEARNING'
                        : 'MEMBER RESOURCES'}
                  </div>
                  <h1>
                    {memberView === 'products'
                      ? 'Produk Saya'
                      : memberView === 'learning'
                        ? 'Lanjut Belajar'
                        : 'Resources & Bonus'}
                  </h1>
                  <p>
                    {memberView === 'products'
                      ? 'Semua produk digital yang aktif di akun Anda.'
                      : memberView === 'learning'
                        ? 'Lanjutkan materi terakhir dan pantau progress pembelajaran Anda.'
                        : 'Akses bonus, link dan resource dari seluruh produk yang Anda miliki.'}
                  </p>
                </div>
              </section>
            )}

            {/* =================================================
                WELCOME
            ================================================= */}

            {memberView === 'dashboard' && (
            <section className="welcome-section">
              <div>
                <div className="eyebrow">
                  MEMBER DASHBOARD
                </div>

                <h1>
                  {greeting()},{' '}
                  <span>{displayName}</span> 👋
                </h1>

                <p>
                  Selamat datang kembali. Lanjutkan materi
                  terakhir Anda dan selesaikan progress belajar.
                </p>
              </div>

              <div className="welcome-date">
                <small>LEARNING SPACE</small>
                <strong>
                  {new Intl.DateTimeFormat('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }).format(new Date())}
                </strong>
              </div>
            </section>
            )}

            {/* =================================================
                STATS
            ================================================= */}

            {memberView === 'dashboard' && (
            <section className="stats-grid">
              <StatCard
                icon="▣"
                label="Produk Aktif"
                value={productInfos.length}
                caption="Produk yang dapat diakses"
                variant="blue"
              />

              <StatCard
                icon="▶"
                label="Total Materi"
                value={totalLessons}
                caption="Materi pembelajaran tersedia"
                variant="purple"
              />

              <StatCard
                icon="✓"
                label="Materi Selesai"
                value={completedLessons}
                caption={`${Math.max(
                  totalLessons - completedLessons,
                  0
                )} materi tersisa`}
                variant="green"
              />

              <StatCard
                icon="↗"
                label="Overall Progress"
                value={`${overallProgress}%`}
                caption="Progress seluruh pembelajaran"
                variant="pink"
              />
            </section>
            )}

            {/* =================================================
                CONTINUE LEARNING
            ================================================= */}

            {(memberView === 'dashboard' || memberView === 'learning') && (
            <section className="section-block">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    CONTINUE LEARNING
                  </div>
                  <h2>Lanjutkan Belajar</h2>
                </div>
              </div>

              {continueProduct && continueLesson ? (
                <div className="continue-card">
                  <div className="continue-glow one" />
                  <div className="continue-glow two" />

                  <div className="continue-cover">
                    {continueProduct.cover ? (
                      <img
                        src={continueProduct.cover}
                        alt={continueProduct.name}
                      />
                    ) : (
                      <>
                        <span className="cover-label">
                          DIGITAL COURSE
                        </span>

                        <div className="cover-symbol">
                          S
                        </div>

                        <strong>
                          {continueProduct.name}
                        </strong>
                      </>
                    )}
                  </div>

                  <div className="continue-info">
                    <div className="continue-badge">
                      LANJUTKAN MATERI
                    </div>

                    <h2>
                      {continueProduct.name}
                    </h2>

                    <p className="next-label">
                      Berikutnya:
                    </p>

                    <h3>
                      {continueLesson.title}
                    </h3>

                    <div className="progress-meta">
                      <span>
                        {continueProduct.completedCount} dari{' '}
                        {continueProduct.lessons.length} materi
                        selesai
                      </span>

                      <strong>
                        {continueProduct.progressPercent}%
                      </strong>
                    </div>

                    <ProgressBar
                      value={
                        continueProduct.progressPercent
                      }
                    />

                    <div className="continue-actions">
                      <button
                        className="primary-button"
                        onClick={continueLearning}
                      >
                        ▶ Lanjutkan Belajar
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() =>
                          router.push(
                            `/member/product/${continueProduct.slug}`
                          )
                        }
                      >
                        Lihat Semua Materi
                      </button>
                    </div>
                  </div>
                </div>
              ) : productInfos.length > 0 ? (
                <div className="complete-all-card">
                  <div className="complete-all-icon">
                    ✓
                  </div>

                  <div>
                    <div className="eyebrow green">
                      COMPLETED
                    </div>
                    <h2>
                      Semua materi sudah selesai!
                    </h2>
                    <p>
                      Progress pembelajaran Anda sudah mencapai
                      100%.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="empty-card">
                  <div className="empty-icon">▣</div>
                  <h3>Belum ada produk aktif</h3>
                  <p>
                    Produk yang diberikan kepada akun Anda akan
                    muncul di sini.
                  </p>
                </div>
              )}
            </section>
            )}

            {/* =================================================
                MY PRODUCTS
            ================================================= */}

            {(memberView === 'dashboard' || memberView === 'products') && (
            <section
              className="section-block"
              id="my-products"
            >
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    MY LIBRARY
                  </div>
                  <h2>Produk Saya</h2>
                </div>

                <span className="section-count">
                  {productInfos.length} Produk
                </span>
              </div>

              {productInfos.length > 0 ? (
                <div className="product-grid">
                  {productInfos.map((product, index) => (
                    <article
                      className="product-card"
                      key={product.id}
                    >
                      <div
                        className={`product-cover cover-${
                          (index % 4) + 1
                        }`}
                      >
                        {product.cover ? (
                          <img
                            src={product.cover}
                            alt={product.name}
                          />
                        ) : (
                          <>
                            <div className="product-cover-top">
                              <span>MEMBER PRODUCT</span>
                              <span className="active-pill">
                                ACTIVE
                              </span>
                            </div>

                            <div className="product-cover-icon">
                              S
                            </div>

                            <strong>
                              {product.name}
                            </strong>
                          </>
                        )}
                      </div>

                      <div className="product-body">
                        <div className="product-status-row">
                          <span className="access-badge">
                            ✓ ACCESS ACTIVE
                          </span>

                          <span>
                            {product.lessons.length} Materi
                          </span>
                        </div>

                        <h3>{product.name}</h3>

                        <p className="product-description">
                          {product.description ||
                            'Produk digital tersedia di member area Anda.'}
                        </p>

                        <div className="progress-meta">
                          <span>Progress Belajar</span>
                          <strong>
                            {product.progressPercent}%
                          </strong>
                        </div>

                        <ProgressBar
                          value={product.progressPercent}
                        />

                        <div className="product-footer">
                          <span>
                            {product.completedCount}/
                            {product.lessons.length} selesai
                          </span>

                          <button
                            onClick={() => {
                              if (product.nextLesson) {
                                router.push(
                                  `/member/product/${product.slug}/lesson/${product.nextLesson.id}`
                                )
                              } else {
                                router.push(
                                  `/member/product/${product.slug}`
                                )
                              }
                            }}
                          >
                            {product.progressPercent === 100
                              ? 'Buka Produk →'
                              : product.completedCount > 0
                                ? 'Lanjutkan →'
                                : 'Mulai Belajar →'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-card">
                  <div className="empty-icon">▣</div>
                  <h3>Library masih kosong</h3>
                  <p>
                    Belum ada produk yang diberikan kepada akun
                    ini.
                  </p>
                </div>
              )}
            </section>
            )}

            {/* =================================================
                ACTIVITY + RESOURCES
            ================================================= */}

            {(memberView === 'dashboard' || memberView === 'resources') && (
            <section className={`bottom-grid ${memberView === 'resources' ? 'resources-only' : ''}`}>

              {/* ACTIVITY */}

              {memberView === 'dashboard' && (
              <div className="panel-card">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">
                      YOUR ACTIVITY
                    </div>
                    <h2>Aktivitas Terbaru</h2>
                  </div>

                  <span className="panel-icon">
                    ↗
                  </span>
                </div>

                {recentActivity.length > 0 ? (
                  <div className="activity-list">
                    {recentActivity.map((item) => (
                      <button
                        className="activity-item"
                        key={item.progress.id}
                        onClick={() =>
                          router.push(
                            `/member/product/${item.product!.slug}/lesson/${item.lesson!.id}`
                          )
                        }
                      >
                        <div className="activity-icon">
                          {item.progress.completed
                            ? '✓'
                            : '▶'}
                        </div>

                        <div className="activity-info">
                          <strong>
                            {item.lesson!.title}
                          </strong>

                          <span>
                            {item.product!.name}
                          </span>
                        </div>

                        <div className="activity-progress">
                          {item.progress.progress_percent}%
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="small-empty">
                    <span>◎</span>
                    <p>
                      Aktivitas belajar akan tampil setelah Anda
                      mulai membuka materi.
                    </p>
                  </div>
                )}
              </div>
              )}

              {/* RESOURCES */}

              <div
                className="panel-card"
                id="resources"
              >
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">
                      QUICK ACCESS
                    </div>
                    <h2>Resources & Bonus</h2>
                  </div>

                  <span className="panel-icon">
                    ◆
                  </span>
                </div>

                <div className="resource-summary">
                  <div className="resource-number">
                    {resourceContents.length}
                  </div>

                  <div>
                    <strong>
                      Resource tersedia
                    </strong>
                    <p>
                      Link, bonus dan resource dari produk yang
                      Anda miliki.
                    </p>
                  </div>
                </div>

                {resourceContents.length > 0 ? (
                  <div className="resource-list">
                    {resourceContents
                      .slice(0, 3)
                      .map((resource) => {
                        const product = products.find(
                          (item) =>
                            item.id === resource.product_id
                        )

                        if (!product) return null

                        return (
                          <button
                            className="resource-item"
                            key={resource.id}
                            onClick={() =>
                              router.push(
                                `/member/product/${product.slug}/lesson/${resource.id}`
                              )
                            }
                          >
                            <span className="resource-item-icon">
                              ↗
                            </span>

                            <span>
                              <strong>
                                {resource.title}
                              </strong>
                              <small>
                                {product.name}
                              </small>
                            </span>

                            <span className="resource-arrow">
                              →
                            </span>
                          </button>
                        )
                      })}
                  </div>
                ) : (
                  <div className="small-empty">
                    <span>◆</span>
                    <p>
                      Belum ada resource eksternal pada produk
                      Anda.
                    </p>
                  </div>
                )}
              </div>
            </section>
            )}

            <footer className="dashboard-footer">
              <span>
                © {new Date().getFullYear()} iMersSUPA
              </span>

              <span>
                Secure Membership & Digital Content Platform
              </span>
            </footer>
          </div>
        </main>
      </div>

      {/* =====================================================
          PROFILE / ACCOUNT DRAWER
      ====================================================== */}

      {profileOpen && (
        <div
          className="profile-overlay"
          onClick={() => setProfileOpen(false)}
        >
          <aside
            className="profile-drawer"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="profile-drawer-header">
              <div>
                <div className="eyebrow">
                  ACCOUNT
                </div>
                <h2>Profile & Account</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setProfileOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="profile-hero">
              <Avatar
                avatarUrl={profile?.avatar_url}
                initials={initials}
                large
              />

              <h3>{displayName}</h3>
              <p>{email}</p>

              <span className="member-pill">
                MEMBER ACTIVE
              </span>
            </div>

            <div className="account-info-card">
              <div className="account-info-row">
                <span>Nama</span>
                <strong>{displayName}</strong>
              </div>

              <div className="account-info-row">
                <span>Email</span>
                <strong>{email}</strong>
              </div>

              <div className="account-info-row">
                <span>Status</span>
                <strong className="status-active">
                  {profile?.status === 'active'
                    ? 'Active'
                    : profile?.status || 'Active'}
                </strong>
              </div>

              <div className="account-info-row">
                <span>Role</span>
                <strong>
                  {profile?.role || 'member'}
                </strong>
              </div>
            </div>

            <div className="security-card">
              <div className="security-icon">
                ◇
              </div>

              <div>
                <strong>Account Security</strong>
                <p>
                  Password akun dapat diganti melalui menu
                  Security.
                </p>
              </div>
            </div>

            <button
              className="change-password-button"
              onClick={() => {
                setProfileOpen(false)
                router.push('/member/change-password')
              }}
            >
              ◇ Ganti Password
              <span>→</span>
            </button>

            <button
              className="drawer-logout-button"
              onClick={handleLogout}
            >
              Keluar dari Akun
            </button>
          </aside>
        </div>
      )}

      <DashboardStyles />
    </>
  )
}

// ============================================================
// COMPONENTS
// ============================================================

function Avatar({
  avatarUrl,
  initials,
  large = false,
}: {
  avatarUrl?: string | null
  initials: string
  large?: boolean
}) {
  return (
    <div
      className={
        large
          ? 'avatar avatar-large'
          : 'avatar'
      }
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
        />
      ) : (
        <span>{initials || 'M'}</span>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  caption,
  variant,
}: {
  icon: string
  label: string
  value: string | number
  caption: string
  variant: string
}) {
  return (
    <article className={`stat-card ${variant}`}>
      <div className="stat-top">
        <div className="stat-icon">
          {icon}
        </div>

        <span>↗</span>
      </div>

      <div className="stat-value">
        {value}
      </div>

      <div className="stat-label">
        {label}
      </div>

      <div className="stat-caption">
        {caption}
      </div>
    </article>
  )
}

function ProgressBar({
  value,
}: {
  value: number
}) {
  return (
    <div className="progress-track">
      <div
        className="progress-fill"
        style={{
          width: `${Math.max(
            0,
            Math.min(value, 100)
          )}%`,
        }}
      />
    </div>
  )
}

// ============================================================
// CSS
// ============================================================

function DashboardStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        background: #030712;
        color: #ffffff;
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      button,
      input {
        font: inherit;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      .app-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 250px minmax(0, 1fr);
        background:
          radial-gradient(
            circle at 80% 0%,
            rgba(76, 29, 149, 0.14),
            transparent 32%
          ),
          radial-gradient(
            circle at 20% 0%,
            rgba(30, 64, 175, 0.15),
            transparent 32%
          ),
          #030712;
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 24px 18px 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        background:
          linear-gradient(
            180deg,
            rgba(15, 23, 42, 0.96),
            rgba(3, 7, 18, 0.98)
          );
        z-index: 30;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 11px;
      }

      .logo-box {
        width: 43px;
        height: 43px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        color: #ffffff;
        font-weight: 950;
        font-size: 19px;
        background:
          linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
        box-shadow:
          0 12px 32px rgba(79, 70, 229, 0.28);
      }

      .brand-name {
        font-size: 16px;
        font-weight: 950;
        letter-spacing: -0.3px;
      }

      .brand-caption {
        margin-top: 2px;
        color: #64748b;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.7px;
      }

      .menu-label {
        margin: 37px 11px 10px;
        color: #475569;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 1.5px;
      }

      .sidebar-nav {
        display: grid;
        gap: 5px;
      }

      .nav-item {
        width: 100%;
        padding: 11px 12px;
        display: flex;
        align-items: center;
        gap: 11px;
        border: 1px solid transparent;
        border-radius: 13px;
        cursor: pointer;
        color: #94a3b8;
        text-align: left;
        font-size: 13px;
        font-weight: 750;
        background: transparent;
        transition: 0.2s ease;
      }

      .nav-item:hover {
        color: #ffffff;
        border-color: rgba(99, 102, 241, 0.12);
        background:
          linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.12),
            rgba(124, 58, 237, 0.08)
          );
      }

      .nav-item.active {
        color: #ffffff;
        border-color: rgba(99, 102, 241, 0.18);
        background:
          linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.22),
            rgba(124, 58, 237, 0.14)
          );
      }

      .nav-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        color: #a5b4fc;
        background: rgba(99, 102, 241, 0.1);
      }

      .sidebar-bottom {
        display: grid;
        gap: 10px;
      }

      .mini-profile {
        padding: 11px;
        display: flex;
        align-items: center;
        gap: 9px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        background:
          linear-gradient(
            135deg,
            rgba(30, 64, 175, 0.1),
            rgba(88, 28, 135, 0.07)
          );
      }

      .avatar {
        width: 36px;
        height: 36px;
        flex: 0 0 auto;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #ffffff;
        font-size: 13px;
        font-weight: 950;
        background:
          linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-large {
        width: 76px;
        height: 76px;
        border-radius: 24px;
        font-size: 22px;
        box-shadow:
          0 20px 45px rgba(79, 70, 229, 0.25);
      }

      .mini-profile-info {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .mini-profile-info strong {
        overflow: hidden;
        color: #e2e8f0;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mini-profile-info span {
        overflow: hidden;
        color: #64748b;
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .logout-button {
        width: 100%;
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border: 1px solid rgba(239, 68, 68, 0.08);
        border-radius: 12px;
        cursor: pointer;
        color: #fca5a5;
        font-size: 12px;
        font-weight: 800;
        background: rgba(127, 29, 29, 0.08);
      }

      .main-content {
        min-width: 0;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        height: 76px;
        padding: 0 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        background: rgba(3, 7, 18, 0.78);
        backdrop-filter: blur(20px);
      }

      .mobile-menu-area {
        display: none;
      }

      .search-area {
        position: relative;
        width: min(430px, 48vw);
        display: flex;
        align-items: center;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 14px;
        background:
          linear-gradient(
            135deg,
            rgba(15, 23, 42, 0.78),
            rgba(30, 41, 59, 0.56)
          );
      }

      .search-icon {
        padding-left: 14px;
        color: #64748b;
        font-size: 19px;
      }

      .search-area input {
        width: 100%;
        min-width: 0;
        padding: 12px 12px;
        border: 0;
        outline: 0;
        color: #ffffff;
        font-size: 12px;
        background: transparent;
      }

      .search-area input::placeholder {
        color: #475569;
      }

      .clear-search {
        padding: 0 13px;
        border: 0;
        cursor: pointer;
        color: #64748b;
        background: transparent;
      }

      .search-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        padding: 7px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.98);
        box-shadow:
          0 25px 70px rgba(0, 0, 0, 0.45);
      }

      .search-result {
        width: 100%;
        padding: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 0;
        border-radius: 11px;
        cursor: pointer;
        color: #ffffff;
        text-align: left;
        background: transparent;
      }

      .search-result:hover {
        background: rgba(99, 102, 241, 0.1);
      }

      .search-result-icon {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        color: #a5b4fc;
        background: rgba(99, 102, 241, 0.1);
      }

      .search-result span:last-child {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .search-result strong {
        overflow: hidden;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .search-result small {
        overflow: hidden;
        color: #64748b;
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .search-empty {
        padding: 15px;
        color: #64748b;
        text-align: center;
        font-size: 12px;
      }

      .top-actions {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      .notification-button,
      .icon-button {
        position: relative;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 12px;
        cursor: pointer;
        color: #cbd5e1;
        background:
          linear-gradient(
            135deg,
            rgba(30, 41, 59, 0.8),
            rgba(15, 23, 42, 0.8)
          );
      }

      .notification-dot {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 6px;
        height: 6px;
        border: 2px solid #0f172a;
        border-radius: 50%;
        background: #818cf8;
      }

      .top-profile {
        padding: 5px 8px 5px 5px;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        cursor: pointer;
        color: #ffffff;
        background:
          linear-gradient(
            135deg,
            rgba(30, 64, 175, 0.09),
            rgba(88, 28, 135, 0.06)
          );
      }

      .top-profile-text {
        max-width: 120px;
        display: grid;
        gap: 1px;
        text-align: left;
      }

      .top-profile-text strong {
        overflow: hidden;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .top-profile-text small {
        color: #64748b;
        font-size: 11px;
      }

      .dashboard-container {
        width: 100%;
        max-width: 1450px;
        margin: 0 auto;
        padding: 34px 32px 55px;
      }

      .error-box {
        margin-bottom: 18px;
        padding: 13px 15px;
        display: grid;
        gap: 4px;
        border: 1px solid rgba(239, 68, 68, 0.12);
        border-radius: 14px;
        color: #fca5a5;
        font-size: 12px;
        background:
          linear-gradient(
            135deg,
            rgba(127, 29, 29, 0.18),
            rgba(69, 10, 10, 0.08)
          );
      }

      .welcome-section {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
      }

      .eyebrow {
        color: #818cf8;
        font-size: 12px;
        font-weight: 950;
        letter-spacing: 1.6px;
      }

      .eyebrow.green {
        color: #86efac;
      }

      .welcome-section h1 {
        margin: 7px 0 8px;
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1.08;
        letter-spacing: -1.3px;
      }

      .welcome-section h1 span {
        color: #a5b4fc;
      }

      .welcome-section p {
        margin: 0;
        color: #64748b;
        font-size: 13px;
        line-height: 1.6;
      }

      .welcome-date {
        min-width: 180px;
        padding: 13px 15px;
        display: grid;
        gap: 4px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 15px;
        background:
          linear-gradient(
            135deg,
            rgba(30, 64, 175, 0.1),
            rgba(88, 28, 135, 0.07)
          );
      }

      .welcome-date small {
        color: #64748b;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.2px;
      }

      .welcome-date strong {
        font-size: 12px;
      }

      .member-view-header {
        margin-bottom: 24px;
        padding: 28px 30px;
        border: 1px solid rgba(99, 102, 241, 0.12);
        border-radius: 22px;
        background:
          radial-gradient(circle at 15% 20%, rgba(191, 219, 254, 0.72), transparent 32%),
          radial-gradient(circle at 85% 25%, rgba(233, 213, 255, 0.72), transparent 34%),
          rgba(255,255,255,0.58);
        box-shadow: 0 20px 50px rgba(79, 70, 229, 0.08);
      }

      .member-view-header h1 {
        margin: 5px 0 6px;
        font-size: clamp(28px, 3vw, 42px);
        line-height: 1.05;
        letter-spacing: -1.2px;
      }

      .member-view-header p {
        margin: 0;
        color: #64748b;
        font-size: 14px;
        line-height: 1.65;
      }

      .bottom-grid.resources-only {
        grid-template-columns: minmax(0, 1fr);
      }

      .stats-grid {
        margin-top: 27px;
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .stat-card {
        position: relative;
        overflow: hidden;
        min-height: 150px;
        padding: 17px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 19px;
      }

      .stat-card.blue {
        background:
          linear-gradient(
            145deg,
            rgba(30, 64, 175, 0.35),
            rgba(15, 23, 42, 0.88)
          );
      }

      .stat-card.purple {
        background:
          linear-gradient(
            145deg,
            rgba(91, 33, 182, 0.32),
            rgba(15, 23, 42, 0.88)
          );
      }

      .stat-card.green {
        background:
          linear-gradient(
            145deg,
            rgba(6, 95, 70, 0.3),
            rgba(15, 23, 42, 0.88)
          );
      }

      .stat-card.pink {
        background:
          linear-gradient(
            145deg,
            rgba(157, 23, 77, 0.25),
            rgba(30, 27, 75, 0.82)
          );
      }

      .stat-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #64748b;
        font-size: 12px;
      }

      .stat-icon {
        width: 35px;
        height: 35px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color: #e0e7ff;
        background: rgba(255, 255, 255, 0.07);
      }

      .stat-value {
        margin-top: 17px;
        font-size: 28px;
        font-weight: 950;
        letter-spacing: -1px;
      }

      .stat-label {
        margin-top: 2px;
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 800;
      }

      .stat-caption {
        margin-top: 5px;
        color: #64748b;
        font-size: 11px;
      }

      .section-block {
        padding-top: 34px;
        scroll-margin-top: 90px;
      }

      .section-heading,
      .panel-heading {
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
      }

      .section-heading h2,
      .panel-heading h2 {
        margin: 4px 0 0;
        font-size: 18px;
        letter-spacing: -0.4px;
      }

      .section-count {
        padding: 7px 10px;
        border-radius: 999px;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 800;
        background: rgba(255, 255, 255, 0.05);
      }

      .continue-card {
        position: relative;
        overflow: hidden;
        padding: 18px;
        display: grid;
        grid-template-columns: 230px minmax(0, 1fr);
        gap: 25px;
        border: 1px solid rgba(99, 102, 241, 0.16);
        border-radius: 25px;
        background:
          linear-gradient(
            135deg,
            rgba(30, 64, 175, 0.28),
            rgba(88, 28, 135, 0.22),
            rgba(15, 23, 42, 0.9)
          );
        box-shadow:
          0 25px 65px rgba(0, 0, 0, 0.22);
      }

      .continue-glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(25px);
        pointer-events: none;
      }

      .continue-glow.one {
        width: 220px;
        height: 220px;
        top: -170px;
        right: 10%;
        background: rgba(59, 130, 246, 0.22);
      }

      .continue-glow.two {
        width: 220px;
        height: 220px;
        bottom: -180px;
        left: 35%;
        background: rgba(168, 85, 247, 0.2);
      }

      .continue-cover {
        position: relative;
        z-index: 1;
        min-height: 210px;
        overflow: hidden;
        padding: 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 20px;
        background:
          radial-gradient(
            circle at top right,
            rgba(96, 165, 250, 0.34),
            transparent 40%
          ),
          linear-gradient(
            145deg,
            #172554,
            #312e81 55%,
            #581c87
          );
      }

      .continue-cover img,
      .product-cover img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .cover-label {
        position: relative;
        z-index: 2;
        color: #bfdbfe;
        font-size: 11px;
        font-weight: 950;
        letter-spacing: 1.4px;
      }

      .cover-symbol {
        position: relative;
        z-index: 2;
        width: 55px;
        height: 55px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 18px;
        font-size: 23px;
        font-weight: 950;
        background: rgba(255, 255, 255, 0.11);
        backdrop-filter: blur(10px);
      }

      .continue-cover strong {
        position: relative;
        z-index: 2;
        max-width: 180px;
        font-size: 15px;
        line-height: 1.3;
      }

      .continue-info {
        position: relative;
        z-index: 1;
        padding: 8px 10px 8px 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .continue-badge {
        width: fit-content;
        padding: 6px 9px;
        border-radius: 999px;
        color: #c4b5fd;
        font-size: 11px;
        font-weight: 950;
        letter-spacing: 1.2px;
        background: rgba(124, 58, 237, 0.13);
      }

      .continue-info h2 {
        margin: 10px 0 4px;
        font-size: clamp(20px, 3vw, 28px);
        letter-spacing: -0.7px;
      }

      .next-label {
        margin: 10px 0 3px;
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
      }

      .continue-info h3 {
        margin: 0 0 18px;
        color: #cbd5e1;
        font-size: 14px;
      }

      .progress-meta {
        margin-bottom: 7px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: #64748b;
        font-size: 12px;
      }

      .progress-meta strong {
        color: #a5b4fc;
        font-size: 12px;
      }

      .progress-track {
        width: 100%;
        height: 7px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
      }

      .progress-fill {
        height: 100%;
        border-radius: 999px;
        background:
          linear-gradient(
            90deg,
            #2563eb,
            #7c3aed,
            #22c55e
          );
        transition: width 0.4s ease;
      }

      .continue-actions {
        margin-top: 20px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .primary-button,
      .secondary-button {
        padding: 11px 14px;
        border-radius: 11px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 850;
      }

      .primary-button {
        border: 0;
        color: #ffffff;
        background:
          linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
        box-shadow:
          0 12px 30px rgba(79, 70, 229, 0.2);
      }

      .secondary-button {
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        background: rgba(15, 23, 42, 0.48);
      }

      .complete-all-card,
      .empty-card {
        min-height: 180px;
        padding: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 18px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 22px;
        background:
          linear-gradient(
            135deg,
            rgba(6, 78, 59, 0.2),
            rgba(15, 23, 42, 0.82)
          );
      }

      .complete-all-card h2,
      .empty-card h3 {
        margin: 5px 0;
      }

      .complete-all-card p,
      .empty-card p {
        margin: 0;
        color: #64748b;
        font-size: 12px;
      }

      .complete-all-icon,
      .empty-icon {
        width: 60px;
        height: 60px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 19px;
        color: #86efac;
        font-size: 23px;
        font-weight: 950;
        background: rgba(34, 197, 94, 0.1);
      }

      .product-grid {
        display: grid;
        grid-template-columns:
          repeat(auto-fill, minmax(260px, 1fr));
        gap: 14px;
      }

      .product-card {
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 21px;
        background:
          linear-gradient(
            145deg,
            rgba(30, 41, 59, 0.76),
            rgba(15, 23, 42, 0.9)
          );
        transition:
          transform 0.2s ease,
          border-color 0.2s ease;
      }

      .product-card:hover {
        transform: translateY(-3px);
        border-color: rgba(99, 102, 241, 0.2);
      }

      .product-cover {
        position: relative;
        min-height: 175px;
        overflow: hidden;
        padding: 15px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .product-cover.cover-1 {
        background:
          radial-gradient(
            circle at top right,
            rgba(96, 165, 250, 0.35),
            transparent 38%
          ),
          linear-gradient(
            145deg,
            #172554,
            #312e81,
            #581c87
          );
      }

      .product-cover.cover-2 {
        background:
          radial-gradient(
            circle at top left,
            rgba(52, 211, 153, 0.25),
            transparent 38%
          ),
          linear-gradient(
            145deg,
            #064e3b,
            #164e63,
            #1e3a8a
          );
      }

      .product-cover.cover-3 {
        background:
          radial-gradient(
            circle at top right,
            rgba(244, 114, 182, 0.25),
            transparent 40%
          ),
          linear-gradient(
            145deg,
            #4c1d95,
            #831843,
            #172554
          );
      }

      .product-cover.cover-4 {
        background:
          radial-gradient(
            circle at top left,
            rgba(251, 191, 36, 0.2),
            transparent 38%
          ),
          linear-gradient(
            145deg,
            #78350f,
            #7c2d12,
            #312e81
          );
      }

      .product-cover-top {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .product-cover-top > span:first-child {
        color: #c7d2fe;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: 1.3px;
      }

      .active-pill {
        padding: 5px 7px;
        border-radius: 999px;
        color: #86efac;
        font-size: 10px;
        font-weight: 950;
        background: rgba(34, 197, 94, 0.12);
      }

      .product-cover-icon {
        position: relative;
        z-index: 2;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 15px;
        font-size: 20px;
        font-weight: 950;
        background: rgba(255, 255, 255, 0.1);
      }

      .product-cover > strong {
        position: relative;
        z-index: 2;
        max-width: 220px;
        font-size: 13px;
        line-height: 1.35;
      }

      .product-body {
        padding: 15px;
      }

      .product-status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: #64748b;
        font-size: 11px;
      }

      .access-badge {
        color: #86efac;
        font-size: 10px;
        font-weight: 900;
      }

      .product-body h3 {
        margin: 10px 0 6px;
        font-size: 13px;
      }

      .product-description {
        min-height: 34px;
        margin: 0 0 15px;
        display: -webkit-box;
        overflow: hidden;
        color: #64748b;
        font-size: 12px;
        line-height: 1.5;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }

      .product-footer {
        margin-top: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .product-footer span {
        color: #64748b;
        font-size: 11px;
      }

      .product-footer button {
        padding: 8px 10px;
        border: 0;
        border-radius: 9px;
        cursor: pointer;
        color: #ffffff;
        font-size: 11px;
        font-weight: 850;
        background:
          linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
      }

      .bottom-grid {
        padding-top: 34px;
        display: grid;
        grid-template-columns:
          minmax(0, 1fr) minmax(0, 1fr);
        gap: 14px;
      }

      .panel-card {
        padding: 19px;
        scroll-margin-top: 90px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 21px;
        background:
          linear-gradient(
            145deg,
            rgba(30, 41, 59, 0.72),
            rgba(15, 23, 42, 0.9)
          );
      }

      .panel-icon {
        width: 33px;
        height: 33px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: #a5b4fc;
        background: rgba(99, 102, 241, 0.09);
      }

      .activity-list,
      .resource-list {
        display: grid;
        gap: 7px;
      }

      .activity-item,
      .resource-item {
        width: 100%;
        padding: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(255, 255, 255, 0.045);
        border-radius: 12px;
        cursor: pointer;
        color: #ffffff;
        text-align: left;
        background:
          linear-gradient(
            135deg,
            rgba(30, 64, 175, 0.07),
            rgba(88, 28, 135, 0.045)
          );
      }

      .activity-item:hover,
      .resource-item:hover {
        border-color: rgba(99, 102, 241, 0.15);
      }

      .activity-icon,
      .resource-item-icon {
        width: 31px;
        height: 31px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: #a5b4fc;
        background: rgba(99, 102, 241, 0.09);
      }

      .activity-info,
      .resource-item > span:nth-child(2) {
        min-width: 0;
        flex: 1;
        display: grid;
        gap: 2px;
      }

      .activity-info strong,
      .resource-item strong {
        overflow: hidden;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .activity-info span,
      .resource-item small {
        overflow: hidden;
        color: #64748b;
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .activity-progress,
      .resource-arrow {
        color: #818cf8;
        font-size: 12px;
        font-weight: 900;
      }

      .resource-summary {
        margin-bottom: 12px;
        padding: 13px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-radius: 14px;
        background:
          linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.12),
            rgba(124, 58, 237, 0.08)
          );
      }

      .resource-number {
        min-width: 45px;
        font-size: 28px;
        font-weight: 950;
        color: #a5b4fc;
      }

      .resource-summary strong {
        font-size: 12px;
      }

      .resource-summary p {
        margin: 3px 0 0;
        color: #64748b;
        font-size: 11px;
        line-height: 1.4;
      }

      .small-empty {
        min-height: 120px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #475569;
        text-align: center;
      }

      .small-empty span {
        font-size: 25px;
      }

      .small-empty p {
        max-width: 260px;
        margin: 8px 0 0;
        font-size: 12px;
        line-height: 1.5;
      }

      .dashboard-footer {
        margin-top: 35px;
        padding-top: 17px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        color: #334155;
        font-size: 11px;
      }

      .profile-overlay,
      .mobile-overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(6px);
      }

      .profile-drawer {
        position: absolute;
        top: 0;
        right: 0;
        width: min(390px, 92vw);
        height: 100%;
        overflow-y: auto;
        padding: 25px;
        border-left: 1px solid rgba(255, 255, 255, 0.08);
        background:
          radial-gradient(
            circle at top right,
            rgba(76, 29, 149, 0.22),
            transparent 32%
          ),
          #0b1120;
        box-shadow:
          -30px 0 80px rgba(0, 0, 0, 0.4);
      }

      .profile-drawer-header,
      .drawer-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
      }

      .profile-drawer-header h2 {
        margin: 4px 0 0;
        font-size: 19px;
      }

      .profile-hero {
        margin-top: 27px;
        padding: 25px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        border: 1px solid rgba(99, 102, 241, 0.12);
        border-radius: 21px;
        background:
          linear-gradient(
            135deg,
            rgba(30, 64, 175, 0.2),
            rgba(88, 28, 135, 0.14)
          );
      }

      .profile-hero h3 {
        margin: 12px 0 3px;
        font-size: 16px;
      }

      .profile-hero p {
        margin: 0;
        color: #64748b;
        font-size: 12px;
      }

      .member-pill {
        margin-top: 11px;
        padding: 6px 9px;
        border-radius: 999px;
        color: #86efac;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: 1px;
        background: rgba(34, 197, 94, 0.1);
      }

      .account-info-card {
        margin-top: 14px;
        padding: 5px 14px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 17px;
        background:
          linear-gradient(
            145deg,
            rgba(30, 41, 59, 0.6),
            rgba(15, 23, 42, 0.75)
          );
      }

      .account-info-row {
        padding: 12px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.045);
      }

      .account-info-row:last-child {
        border-bottom: 0;
      }

      .account-info-row span {
        color: #64748b;
        font-size: 12px;
      }

      .account-info-row strong {
        max-width: 210px;
        overflow: hidden;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .status-active {
        color: #86efac;
      }

      .security-card {
        margin-top: 14px;
        padding: 14px;
        display: flex;
        align-items: center;
        gap: 11px;
        border: 1px solid rgba(99, 102, 241, 0.1);
        border-radius: 16px;
        background:
          linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.11),
            rgba(124, 58, 237, 0.07)
          );
      }

      .security-icon {
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #a5b4fc;
        background: rgba(99, 102, 241, 0.1);
      }

      .security-card strong {
        font-size: 12px;
      }

      .security-card p {
        margin: 3px 0 0;
        color: #64748b;
        font-size: 11px;
        line-height: 1.4;
      }

      .change-password-button,
      .drawer-logout-button {
        width: 100%;
        margin-top: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 850;
      }

      .change-password-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border: 0;
        color: #ffffff;
        background:
          linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
      }

      .drawer-logout-button {
        border: 1px solid rgba(239, 68, 68, 0.1);
        color: #fca5a5;
        background: rgba(127, 29, 29, 0.08);
      }

      .mobile-drawer {
        width: min(300px, 86vw);
        height: 100%;
        padding: 20px;
        background: #0b1120;
        box-shadow:
          30px 0 80px rgba(0, 0, 0, 0.4);
      }

      .mobile-drawer .sidebar-nav {
        margin-top: 30px;
      }

      .drawer-logout {
        position: absolute;
        left: 20px;
        right: 20px;
        bottom: 20px;
      }

      .loading-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background:
          radial-gradient(
            circle at top,
            #172554,
            #030712 65%
          );
      }

      .loading-card {
        width: 100%;
        max-width: 350px;
        padding: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        text-align: center;
        background:
          linear-gradient(
            145deg,
            rgba(30, 64, 175, 0.2),
            rgba(88, 28, 135, 0.12)
          );
      }

      .loading-card h2 {
        margin: 14px 0 4px;
        font-size: 18px;
      }

      .loading-card p {
        margin: 0;
        color: #64748b;
        font-size: 12px;
      }

      .loading-line {
        width: 100%;
        height: 4px;
        margin-top: 20px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
      }

      .loading-line span {
        display: block;
        width: 45%;
        height: 100%;
        border-radius: 999px;
        background:
          linear-gradient(
            90deg,
            #2563eb,
            #7c3aed
          );
        animation: loadingMove 1.1s infinite ease-in-out;
      }

      @keyframes loadingMove {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(250%);
        }
      }

      @media (max-width: 1100px) {
        .stats-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 900px) {
        .app-shell {
          display: block;
        }

        .sidebar {
          display: none;
        }

        .topbar {
          height: 68px;
          padding: 0 17px;
        }

        .mobile-menu-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mobile-logo {
          font-size: 13px;
          font-weight: 950;
        }

        .menu-button {
          width: 36px;
          height: 36px;
        }

        .search-area {
          flex: 1;
          width: auto;
        }

        .top-profile-text {
          display: none;
        }

        .dashboard-container {
          padding: 25px 17px 45px;
        }

        .welcome-date {
          display: none;
        }

        .continue-card {
          grid-template-columns: 180px minmax(0, 1fr);
        }
      }

      @media (max-width: 650px) {
        .topbar {
          gap: 9px;
        }

        .mobile-logo {
          display: none;
        }

        .notification-button {
          display: none;
        }

        .search-area input {
          font-size: 12px;
        }

        .welcome-section h1 {
          font-size: 29px;
        }

        .stats-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .stat-card {
          min-height: 135px;
          padding: 14px;
        }

        .stat-value {
          font-size: 24px;
        }

        .continue-card {
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .continue-cover {
          min-height: 190px;
        }

        .continue-info {
          padding: 3px;
        }

        .product-grid,
        .bottom-grid {
          grid-template-columns: 1fr;
        }

        .dashboard-footer {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-width: 390px) {
        .stats-grid {
          grid-template-columns: 1fr;
        }

        .top-profile {
          padding: 3px;
          border: 0;
          background: transparent;
        }

        .search-area {
          min-width: 0;
        }
      }


      /* =====================================================
         MEMBER PREMIUM + READABILITY + SHARED THEME
         ===================================================== */
      body {
        background: var(--page-gradient, #030712) !important;
        color: var(--text-primary, #fff) !important;
      }
      .app-shell {
        grid-template-columns: 270px minmax(0, 1fr) !important;
        color: var(--text-primary, #fff) !important;
        background: var(--page-gradient, #030712) !important;
      }
      .sidebar {
        background: var(--sidebar-bg, rgba(3,7,18,.92)) !important;
        border-right: 1px solid var(--border, rgba(255,255,255,.07)) !important;
        backdrop-filter: blur(22px);
      }
      .topbar {
        background: var(--topbar-bg, rgba(3,7,18,.72)) !important;
        border-bottom-color: var(--border, rgba(255,255,255,.07)) !important;
        backdrop-filter: blur(22px);
      }
      .brand-name { font-size: 17px !important; line-height: 1.15 !important; }
      .brand-caption { font-size: 12px !important; letter-spacing: .17em !important; }
      .menu-label { font-size: 12px !important; letter-spacing: .16em !important; }
      .nav-item { font-size: 13.5px !important; font-weight: 760 !important; min-height: 46px !important; color: var(--text-secondary, #cbd5e1) !important; }
      .nav-item.active { color: var(--text-primary, #fff) !important; background: var(--surface-gradient, linear-gradient(135deg,rgba(59,130,246,.18),rgba(124,58,237,.14))) !important; border-color: var(--border-strong, rgba(129,140,248,.25)) !important; }
      .mini-profile-info strong { font-size: 14px !important; color: var(--text-primary, #fff) !important; }
      .mini-profile-info span { font-size: 12px !important; color: var(--text-muted, #94a3b8) !important; }
      .logout-button { font-size: 14px !important; }
      .main-content { background: var(--page-gradient, #030712) !important; }
      .search-area { background: var(--input-bg, rgba(255,255,255,.05)) !important; border-color: var(--border, rgba(255,255,255,.08)) !important; }
      .search-area input { font-size: 13.5px !important; color: var(--text-primary, #fff) !important; }
      .search-area input::placeholder { color: var(--text-muted, #94a3b8) !important; }
      .top-profile strong { font-size: 14px !important; color: var(--text-primary, #fff) !important; }
      .top-profile small { font-size: 12px !important; color: var(--text-muted, #94a3b8) !important; }
      .eyebrow { font-size: 12px !important; letter-spacing: .16em !important; }
      .welcome h1, .hero-copy h1 { font-size: clamp(34px, 3vw, 48px) !important; line-height: 1.08 !important; color: var(--text-primary, #fff) !important; }
      .welcome p, .hero-copy p { font-size: 13.5px !important; line-height: 1.7 !important; color: var(--text-secondary, #cbd5e1) !important; }
      .stat-card { background: var(--card-gradient, rgba(255,255,255,.05)) !important; border-color: var(--border, rgba(255,255,255,.08)) !important; box-shadow: var(--shadow, 0 20px 60px rgba(0,0,0,.15)) !important; }
      .stat-label { font-size: 13px !important; color: var(--text-secondary, #cbd5e1) !important; }
      .stat-value { font-size: 30px !important; line-height: 1 !important; color: var(--text-primary, #fff) !important; }
      .stat-note { font-size: 13px !important; line-height: 1.45 !important; color: var(--text-muted, #94a3b8) !important; }
      .section-heading h2 { font-size: 23px !important; color: var(--text-primary, #fff) !important; }
      .section-heading p { font-size: 14px !important; line-height: 1.6 !important; color: var(--text-secondary, #cbd5e1) !important; }
      .continue-card, .product-card, .activity-card, .resource-card, .empty-card, .profile-modal-card {
        background: var(--card-gradient, rgba(255,255,255,.05)) !important;
        border-color: var(--border, rgba(255,255,255,.08)) !important;
        box-shadow: var(--shadow, 0 20px 60px rgba(0,0,0,.16)) !important;
      }
      .continue-info h3, .product-card h3 { font-size: 18px !important; line-height: 1.35 !important; color: var(--text-primary, #fff) !important; }
      .continue-info p, .product-card p { font-size: 14px !important; line-height: 1.65 !important; color: var(--text-secondary, #cbd5e1) !important; }
      .progress-label, .progress-meta { font-size: 13px !important; color: var(--text-secondary, #cbd5e1) !important; }
      .continue-button, .open-product-button, .primary-action { font-size: 13px !important; font-weight: 850 !important; min-height: 44px !important; }
      .activity-item strong, .resource-item strong { font-size: 14px !important; color: var(--text-primary, #fff) !important; }
      .activity-item small, .resource-item small { font-size: 12px !important; line-height: 1.5 !important; color: var(--text-muted, #94a3b8) !important; }
      .search-result strong { font-size: 14px !important; }
      .search-result span, .search-result small { font-size: 12px !important; }
      .dashboard-footer { font-size: 13px !important; color: var(--text-muted, #94a3b8) !important; }

      @media (max-width: 900px) {
        .app-shell { grid-template-columns: 1fr !important; }
        .welcome h1, .hero-copy h1 { font-size: 32px !important; }
        .search-area input { font-size: 14px !important; }
      }



      /* ======================================================
         PROFILE MODAL — CENTERED / PROFESSIONAL / READABLE
         ====================================================== */
      .profile-overlay {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        background: rgba(2, 6, 23, .56) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
      }

      .profile-drawer {
        position: relative !important;
        top: auto !important;
        right: auto !important;
        width: min(560px, calc(100vw - 48px)) !important;
        height: auto !important;
        max-height: calc(100vh - 48px) !important;
        overflow-y: auto !important;
        padding: 28px !important;
        border: 1px solid var(--border-strong, rgba(129,140,248,.22)) !important;
        border-radius: 26px !important;
        color: var(--text-primary, #f8fafc) !important;
        background: var(--page-gradient, #0b1120) !important;
        box-shadow: 0 35px 100px rgba(2, 6, 23, .38) !important;
        animation: profileModalIn .22s ease-out !important;
      }

      @keyframes profileModalIn {
        from { opacity: 0; transform: translateY(12px) scale(.975); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .profile-drawer-header { gap: 20px !important; }
      .profile-drawer-header .eyebrow { font-size: 13px !important; letter-spacing: 1.4px !important; }
      .profile-drawer-header h2 { margin: 5px 0 0 !important; font-size: 23px !important; line-height: 1.2 !important; }
      .profile-drawer-header .icon-button { width: 42px !important; height: 42px !important; flex: 0 0 auto !important; border-radius: 13px !important; font-size: 20px !important; }

      .profile-drawer .profile-hero {
        margin-top: 22px !important;
        padding: 25px 22px !important;
        border: 1px solid var(--border, rgba(255,255,255,.08)) !important;
        border-radius: 21px !important;
        background: var(--card-gradient, linear-gradient(135deg,rgba(30,64,175,.20),rgba(88,28,135,.14))) !important;
      }
      .profile-drawer .avatar.avatar-large { width: 72px !important; height: 72px !important; border-radius: 22px !important; font-size: 22px !important; }
      .profile-drawer .profile-hero h3 { margin: 14px 0 5px !important; font-size: 18px !important; line-height: 1.3 !important; color: var(--text-primary, #fff) !important; }
      .profile-drawer .profile-hero p { font-size: 13px !important; line-height: 1.5 !important; color: var(--text-muted, #94a3b8) !important; }
      .profile-drawer .member-pill { margin-top: 12px !important; padding: 7px 11px !important; font-size: 12px !important; letter-spacing: .8px !important; }

      .profile-drawer .account-info-card {
        margin-top: 16px !important;
        padding: 5px 17px !important;
        border: 1px solid var(--border, rgba(255,255,255,.08)) !important;
        border-radius: 18px !important;
        background: var(--surface-gradient, rgba(15,23,42,.75)) !important;
      }
      .profile-drawer .account-info-row { min-height: 50px !important; padding: 13px 0 !important; }
      .profile-drawer .account-info-row span { font-size: 13px !important; color: var(--text-muted, #94a3b8) !important; }
      .profile-drawer .account-info-row strong { max-width: 330px !important; font-size: 13px !important; line-height: 1.4 !important; color: var(--text-primary, #fff) !important; }
      .profile-drawer .status-active { color: var(--success, #86efac) !important; }

      .profile-drawer .security-card {
        margin-top: 16px !important;
        padding: 16px !important;
        gap: 13px !important;
        border-radius: 17px !important;
      }
      .profile-drawer .security-icon { width: 42px !important; height: 42px !important; border-radius: 13px !important; font-size: 16px !important; }
      .profile-drawer .security-card strong { font-size: 13.5px !important; color: var(--text-primary, #fff) !important; }
      .profile-drawer .security-card p { margin-top: 4px !important; font-size: 14px !important; line-height: 1.5 !important; color: var(--text-muted, #94a3b8) !important; }

      .profile-drawer .change-password-button,
      .profile-drawer .drawer-logout-button {
        min-height: 48px !important;
        padding: 13px 16px !important;
        border-radius: 13px !important;
        font-size: 13.5px !important;
      }
      .profile-drawer .change-password-button { margin-top: 16px !important; }
      .profile-drawer .drawer-logout-button { margin-top: 9px !important; }

      @media (max-width: 620px) {
        .profile-overlay { padding: 14px !important; align-items: center !important; }
        .profile-drawer {
          width: 100% !important;
          max-height: calc(100vh - 28px) !important;
          padding: 21px !important;
          border-radius: 22px !important;
        }
        .profile-drawer-header h2 { font-size: 21px !important; }
        .profile-drawer .profile-hero { padding: 21px 16px !important; }
        .profile-drawer .profile-hero p { max-width: 100% !important; overflow-wrap: anywhere !important; }
        .profile-drawer .account-info-row { align-items: flex-start !important; flex-direction: column !important; gap: 5px !important; }
        .profile-drawer .account-info-row strong { max-width: 100% !important; white-space: normal !important; overflow-wrap: anywhere !important; }
      }
    `}</style>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import ThemeSwitcher from '../../components/ThemeSwitcher'

type Profile = {
  id: string
  full_name: string | null
  phone?: string | null
  avatar_url: string | null
  role: string | null
  status: string | null
  created_at?: string | null
}

type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  status?: string | null
  price?: number | null
  created_at?: string | null
  [key: string]: unknown
}

type Content = {
  id: string
  product_id: string
  title: string
  content_type: string
  is_published: boolean
  created_at?: string | null
}

type AccessRow = {
  id?: string
  user_id: string
  product_id: string
  access_status?: string | null
  source?: string | null
  expires_at?: string | null
  created_at?: string | null
}

export default function AdminDashboard() {
  const router = useRouter()

  const [currentUser, setCurrentUser] =
    useState<Profile | null>(null)

  const [currentEmail, setCurrentEmail] =
    useState('')

  const [members, setMembers] =
    useState<Profile[]>([])

  const [products, setProducts] =
    useState<Product[]>([])

  const [contents, setContents] =
    useState<Content[]>([])

  const [accessRows, setAccessRows] =
    useState<AccessRow[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [sidebarOpen, setSidebarOpen] =
    useState(false)

  const [profileOpen, setProfileOpen] =
    useState(false)

  const [search, setSearch] =
    useState('')

  useEffect(() => {
    loadDashboard()

    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('profile') === '1'
    ) {
      setProfileOpen(true)
    }
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError('')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      router.replace('/login')
      return
    }

    setCurrentEmail(user.email ?? '')

    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profileData) {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }

    const profile =
      profileData as Profile

    if (profile.status !== 'active') {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }

    if (
      profile.role !== 'admin' &&
      profile.role !== 'super_admin'
    ) {
      router.replace('/member')
      return
    }

    setCurrentUser(profile)

    /*
      Dashboard dibuat tolerant.

      Kalau policy admin untuk salah satu tabel
      belum tersedia, dashboard utama tetap
      dapat tampil dan error dijelaskan.
    */

    const [
      profilesResult,
      productsResult,
      contentsResult,
      accessResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*'),

      supabase
        .from('products')
        .select('*'),

      supabase
        .from('product_contents')
        .select(`
          id,
          product_id,
          title,
          content_type,
          is_published,
          created_at
        `),

      supabase
        .from('member_access')
        .select('*'),
    ])

    const errors: string[] = []

    if (profilesResult.error) {
      errors.push(
        `Members: ${profilesResult.error.message}`
      )
    } else {
      setMembers(
        (
          profilesResult.data ?? []
        ).filter(
          (item) =>
            item.role === 'member'
        ) as Profile[]
      )
    }

    if (productsResult.error) {
      errors.push(
        `Products: ${productsResult.error.message}`
      )
    } else {
      setProducts(
        (productsResult.data ??
          []) as Product[]
      )
    }

    if (contentsResult.error) {
      errors.push(
        `Contents: ${contentsResult.error.message}`
      )
    } else {
      setContents(
        (contentsResult.data ??
          []) as Content[]
      )
    }

    if (accessResult.error) {
      errors.push(
        `Access: ${accessResult.error.message}`
      )
    } else {
      setAccessRows(
        (accessResult.data ??
          []) as AccessRow[]
      )
    }

    if (errors.length > 0) {
      setError(errors.join(' • '))
    }

    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()

    router.replace('/login')
    router.refresh()
  }

  function greeting() {
    const hour =
      new Date().getHours()

    if (hour < 11) {
      return 'Selamat pagi'
    }

    if (hour < 15) {
      return 'Selamat siang'
    }

    if (hour < 18) {
      return 'Selamat sore'
    }

    return 'Selamat malam'
  }

  const displayName =
    currentUser?.full_name?.trim() ||
    currentEmail.split('@')[0] ||
    'Administrator'

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((item) =>
        item.charAt(0).toUpperCase()
      )
      .join('') || 'A'

  const isSuperAdmin =
    currentUser?.role ===
    'super_admin'

  const activeMembers =
    members.filter(
      (member) =>
        member.status === 'active'
    ).length

  const publishedProducts =
    products.filter(
      (product) =>
        product.status === 'published'
    ).length

  const publishedContents =
    contents.filter(
      (content) =>
        content.is_published === true
    ).length

  const activeAccess =
    accessRows.filter(
      (access) =>
        !access.access_status ||
        access.access_status ===
          'active'
    ).length

  const recentMembers =
    useMemo(() => {
      return [...members]
        .sort((a, b) => {
          const aTime =
            a.created_at
              ? new Date(
                  a.created_at
                ).getTime()
              : 0

          const bTime =
            b.created_at
              ? new Date(
                  b.created_at
                ).getTime()
              : 0

          return bTime - aTime
        })
        .slice(0, 5)
    }, [members])

  const recentProducts =
    useMemo(() => {
      return [...products]
        .sort((a, b) => {
          const aTime =
            a.created_at
              ? new Date(
                  a.created_at
                ).getTime()
              : 0

          const bTime =
            b.created_at
              ? new Date(
                  b.created_at
                ).getTime()
              : 0

          return bTime - aTime
        })
        .slice(0, 5)
    }, [products])

  const searchResults =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase()

      if (!keyword) {
        return []
      }

      const memberResults =
        members
          .filter((member) =>
            (
              member.full_name ||
              ''
            )
              .toLowerCase()
              .includes(keyword)
          )
          .slice(0, 4)
          .map((member) => ({
            id: member.id,
            title:
              member.full_name ||
              'Member',
            subtitle: 'Member',
          }))

      const productResults =
        products
          .filter((product) =>
            product.name
              .toLowerCase()
              .includes(keyword)
          )
          .slice(0, 4)
          .map((product) => ({
            id: product.id,
            title: product.name,
            subtitle: 'Produk',
          }))

      const contentResults =
        contents
          .filter((content) =>
            content.title
              .toLowerCase()
              .includes(keyword)
          )
          .slice(0, 4)
          .map((content) => ({
            id: content.id,
            title: content.title,
            subtitle: 'Materi',
          }))

      return [
        ...memberResults,
        ...productResults,
        ...contentResults,
      ].slice(0, 7)
    }, [
      search,
      members,
      products,
      contents,
    ])

  if (loading) {
    return (
      <>
        <main className="admin-loading">
          <ThemeSwitcher />

          <div className="loading-box">
            <div className="logo">
              S
            </div>

            <h2>
              iMersSUPA
            </h2>

            <p>
              Menyiapkan Admin
              Dashboard...
            </p>

            <div className="loader">
              <span />
            </div>
          </div>
        </main>

        <Styles />
      </>
    )
  }

  return (
    <>
      <div className="admin-shell">

        <ThemeSwitcher />

        {/* =========================================
            DESKTOP SIDEBAR
        ========================================= */}

        <aside className="sidebar">

          <div>
            <Brand />

            <div className="role-card">
              <div className="role-icon">
                {isSuperAdmin
                  ? '★'
                  : '◆'}
              </div>

              <div>
                <span>
                  LOGGED IN AS
                </span>

                <strong>
                  {isSuperAdmin
                    ? 'Super Admin'
                    : 'Administrator'}
                </strong>
              </div>
            </div>

            <Menu
              isSuperAdmin={
                isSuperAdmin
              }
              router={router}
              onProfile={() =>
                setProfileOpen(true)
              }
            />
          </div>

          <div className="sidebar-bottom">

            <button
              className="sidebar-profile"
              onClick={() =>
                setProfileOpen(true)
              }
            >
              <Avatar
                url={
                  currentUser
                    ?.avatar_url
                }
                initials={initials}
              />

              <span>
                <strong>
                  {displayName}
                </strong>

                <small>
                  {isSuperAdmin
                    ? 'Super Admin'
                    : 'Admin'}
                </small>
              </span>
            </button>

            <button
              className="logout"
              onClick={logout}
            >
              ↗ Keluar
            </button>

          </div>
        </aside>

        {/* =========================================
            MOBILE SIDEBAR
        ========================================= */}

        {sidebarOpen && (
          <div
            className="mobile-overlay"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <aside
              className="mobile-sidebar"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="mobile-head">
                <Brand />

                <button
                  onClick={() =>
                    setSidebarOpen(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <Menu
                isSuperAdmin={
                  isSuperAdmin
                }
                router={router}
                onNavigate={() =>
                  setSidebarOpen(
                    false
                  )
                }
              />

              <button
                className="mobile-logout"
                onClick={logout}
              >
                Keluar dari Akun
              </button>
            </aside>
          </div>
        )}

        {/* =========================================
            CONTENT
        ========================================= */}

        <main className="main">

          {/* TOPBAR */}

          <header className="topbar">

            <div className="mobile-brand">
              <button
                className="mobile-menu"
                onClick={() =>
                  setSidebarOpen(true)
                }
              >
                ☰
              </button>

              <strong>
                iMersSUPA
              </strong>
            </div>

            <div className="search">
              <span>⌕</span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Cari member, produk atau materi..."
              />

              {search && (
                <button
                  className="search-clear"
                  onClick={() =>
                    setSearch('')
                  }
                >
                  ×
                </button>
              )}

              {search && (
                <div className="search-results">
                  {searchResults
                    .length > 0 ? (
                    searchResults.map(
                      (result) => (
                        <div
                          className="search-result"
                          key={`${result.subtitle}-${result.id}`}
                        >
                          <span className="result-icon">
                            →
                          </span>

                          <div>
                            <strong>
                              {
                                result.title
                              }
                            </strong>

                            <small>
                              {
                                result.subtitle
                              }
                            </small>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <div className="no-search">
                      Tidak ada hasil.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="top-actions">

              <button
                className="notification"
                title="Notification Center"
              >
                ♢
                <i />
              </button>

              <button
                className="profile-button"
                onClick={() =>
                  setProfileOpen(true)
                }
              >
                <Avatar
                  url={
                    currentUser
                      ?.avatar_url
                  }
                  initials={
                    initials
                  }
                />

                <span>
                  <strong>
                    {displayName}
                  </strong>

                  <small>
                    {isSuperAdmin
                      ? 'Super Admin'
                      : 'Admin'}
                  </small>
                </span>
              </button>

            </div>
          </header>

          <div className="content">

            {/* =====================================
                WELCOME
            ===================================== */}

            <section className="welcome">

              <div>
                <div className="eyebrow">
                  ADMIN CONTROL CENTER
                </div>

                <h1>
                  {greeting()},{' '}
                  <span>
                    {displayName}
                  </span>{' '}
                  👋
                </h1>

                <p>
                  Pantau member,
                  produk, materi dan
                  akses digital
                  iMersSUPA dari satu
                  dashboard.
                </p>
              </div>

              <div className="system-status">
                <div className="online">
                  <i />
                  SYSTEM ONLINE
                </div>

                <strong>
                  {new Intl.DateTimeFormat(
                    'id-ID',
                    {
                      weekday:
                        'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }
                  ).format(
                    new Date()
                  )}
                </strong>
              </div>

            </section>

            {error && (
              <div className="warning">
                <div>
                  !
                </div>

                <span>
                  <strong>
                    Sebagian data
                    belum dapat
                    dibaca.
                  </strong>

                  {error}
                </span>
              </div>
            )}

            {/* =====================================
                STATS
            ===================================== */}

            <section className="stats">

              <Stat
                icon="◎"
                label="Total Member"
                value={
                  members.length
                }
                note={`${activeMembers} member aktif`}
                type="blue"
              />

              <Stat
                icon="▣"
                label="Total Produk"
                value={
                  products.length
                }
                note={`${publishedProducts} published`}
                type="purple"
              />

              <Stat
                icon="▶"
                label="Total Materi"
                value={
                  contents.length
                }
                note={`${publishedContents} materi published`}
                type="green"
              />

              <Stat
                icon="◇"
                label="Active Access"
                value={
                  activeAccess
                }
                note="Entitlement aktif"
                type="pink"
              />

            </section>

            {/* =====================================
                QUICK ACTION
            ===================================== */}

            <section className="section">

              <Heading
                eyebrow="QUICK ACTIONS"
                title="Kelola Platform"
                description="Akses cepat ke aktivitas utama."
              />

              <div className="quick-grid">

                <Quick
                  icon="+"
                  title="Tambah Member"
                  description="Buat dan kelola akun member."
                  className="quick-blue"
                />

                <Quick
                  icon="▣"
                  title="Buat Produk"
                  description="Tambah produk digital baru."
                  className="quick-purple"
                />

                <Quick
                  icon="▶"
                  title="Tambah Materi"
                  description="Kelola module dan lesson."
                  className="quick-green"
                />

                <Quick
                  icon="◇"
                  title="Berikan Access"
                  description="Atur entitlement member."
                  className="quick-orange"
                />

              </div>
            </section>

            {/* =====================================
                MEMBER + PRODUCTS
            ===================================== */}

            <section className="dashboard-grid">

              <div className="panel">

                <div className="panel-head">
                  <div>
                    <div className="eyebrow">
                      MEMBERS
                    </div>

                    <h2>
                      Member Terbaru
                    </h2>
                  </div>

                  <button>
                    Lihat Semua →
                  </button>
                </div>

                {recentMembers.length >
                0 ? (
                  <div className="member-list">

                    {recentMembers.map(
                      (member) => {
                        const name =
                          member.full_name ||
                          'Member'

                        const memberInitial =
                          name
                            .split(' ')
                            .filter(
                              Boolean
                            )
                            .slice(0, 2)
                            .map(
                              (part) =>
                                part[0]
                                  ?.toUpperCase()
                            )
                            .join('')

                        return (
                          <div
                            className="member-row"
                            key={
                              member.id
                            }
                          >
                            <Avatar
                              url={
                                member.avatar_url
                              }
                              initials={
                                memberInitial ||
                                'M'
                              }
                            />

                            <div className="member-info">
                              <strong>
                                {name}
                              </strong>

                              <span>
                                Member
                              </span>
                            </div>

                            <StatusBadge
                              status={
                                member.status
                              }
                            />
                          </div>
                        )
                      }
                    )}

                  </div>
                ) : (
                  <Empty
                    icon="◎"
                    title="Belum ada member"
                    description="Member baru akan muncul di sini."
                  />
                )}

              </div>

              <div className="panel">

                <div className="panel-head">
                  <div>
                    <div className="eyebrow">
                      PRODUCTS
                    </div>

                    <h2>
                      Produk Terbaru
                    </h2>
                  </div>

                  <button>
                    Kelola Produk →
                  </button>
                </div>

                {recentProducts.length >
                0 ? (
                  <div className="product-list">

                    {recentProducts.map(
                      (
                        product,
                        index
                      ) => (
                        <div
                          className="product-row"
                          key={
                            product.id
                          }
                        >
                          <div
                            className={`product-icon product-${
                              (index %
                                4) +
                              1
                            }`}
                          >
                            S
                          </div>

                          <div className="product-info">
                            <strong>
                              {
                                product.name
                              }
                            </strong>

                            <span>
                              {
                                contents.filter(
                                  (
                                    content
                                  ) =>
                                    content.product_id ===
                                    product.id
                                )
                                  .length
                              }{' '}
                              materi
                            </span>
                          </div>

                          <StatusBadge
                            status={
                              product.status ||
                              'active'
                            }
                          />
                        </div>
                      )
                    )}

                  </div>
                ) : (
                  <Empty
                    icon="▣"
                    title="Belum ada produk"
                    description="Produk baru akan muncul di sini."
                  />
                )}

              </div>

            </section>

            {/* =====================================
                OVERVIEW
            ===================================== */}

            <section className="overview-grid">

              <div className="overview-card">

                <div className="overview-icon">
                  ↗
                </div>

                <div>
                  <span>
                    MEMBER ACTIVITY
                  </span>

                  <strong>
                    {activeMembers}
                  </strong>

                  <p>
                    akun member
                    berstatus aktif.
                  </p>
                </div>

                <div className="mini-chart">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>

              </div>

              <div className="overview-card">

                <div className="overview-icon purple">
                  ◆
                </div>

                <div>
                  <span>
                    CONTENT LIBRARY
                  </span>

                  <strong>
                    {
                      publishedContents
                    }
                  </strong>

                  <p>
                    materi aktif
                    tersedia.
                  </p>
                </div>

                <div className="ring">
                  <div>
                    {contents.length >
                    0
                      ? Math.round(
                          (publishedContents /
                            contents.length) *
                            100
                        )
                      : 0}
                    %
                  </div>
                </div>

              </div>

              <div className="overview-card">

                <div className="overview-icon green">
                  ✓
                </div>

                <div>
                  <span>
                    ACCESS STATUS
                  </span>

                  <strong>
                    {activeAccess}
                  </strong>

                  <p>
                    access member
                    sedang aktif.
                  </p>
                </div>

                <div className="access-bars">
                  <span />
                  <span />
                  <span />
                </div>

              </div>

            </section>

            {/* =====================================
                SUPER ADMIN
            ===================================== */}

            {isSuperAdmin && (
              <section className="section">

                <Heading
                  eyebrow="SUPER ADMIN"
                  title="Platform Control"
                  description="Area khusus Super Admin untuk mengelola sistem iMersSUPA."
                />

                <div className="super-grid">

                  <SuperCard
                    icon="♛"
                    title="Administrators"
                    description="Kelola akun Admin dan hak akses administrator."
                  />

                  <SuperCard
                    icon="⚙"
                    title="System Settings"
                    description="Branding, konfigurasi platform dan pengaturan global."
                  />

                  <SuperCard
                    icon="◇"
                    title="Security & Audit"
                    description="Pantau keamanan dan aktivitas administratif."
                  />

                </div>

              </section>
            )}

            <footer>
              <span>
                ©{' '}
                {new Date().getFullYear()}{' '}
                iMersSUPA
              </span>

              <span>
                Admin Control Center
              </span>
            </footer>

          </div>
        </main>
      </div>

      {/* =========================================
          PROFILE DRAWER
      ========================================= */}

      {profileOpen && (
        <div
          className="profile-overlay"
          onClick={() =>
            setProfileOpen(false)
          }
        >
          <aside
            className="profile-drawer"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="drawer-header">
              <div>
                <div className="eyebrow">
                  ACCOUNT
                </div>

                <h2>
                  Admin Profile
                </h2>
              </div>

              <button
                onClick={() =>
                  setProfileOpen(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="profile-hero">
              <Avatar
                url={
                  currentUser
                    ?.avatar_url
                }
                initials={initials}
                large
              />

              <h3>
                {displayName}
              </h3>

              <p>
                {currentEmail}
              </p>

              <span>
                {isSuperAdmin
                  ? 'SUPER ADMIN'
                  : 'ADMIN'}
              </span>
            </div>

            <div className="profile-info">

              <Info
                label="Nama"
                value={displayName}
              />

              <Info
                label="Email"
                value={currentEmail}
              />

              <Info
                label="Role"
                value={
                  isSuperAdmin
                    ? 'Super Admin'
                    : 'Admin'
                }
              />

              <Info
                label="Status"
                value={
                  currentUser
                    ?.status ||
                  'active'
                }
              />

            </div>

            <button
              className="password-button"
              onClick={() =>
                router.push(
                  '/admin/change-password'
                )
              }
            >
              ◇ Ganti Password
              <span>→</span>
            </button>

            <button
              className="drawer-logout"
              onClick={logout}
            >
              Keluar dari Akun
            </button>

          </aside>
        </div>
      )}

      <Styles />
    </>
  )
}

/* ==========================================================
   COMPONENTS
========================================================== */

function Brand() {
  return (
    <div className="brand">
      <div className="brand-logo">
        S
      </div>

      <div>
        <strong>
          iMersSUPA
        </strong>

        <span>
          ADMIN CONTROL
        </span>
      </div>
    </div>
  )
}

function Menu({
  isSuperAdmin,
  router,
  onNavigate,
  onProfile,
}: {
  isSuperAdmin: boolean
  router: ReturnType<typeof useRouter>
  onNavigate?: () => void
  onProfile?: () => void
}) {
  function go(path: string) {
    onNavigate?.()
    router.push(path)
  }

  return (
    <nav className="menu">

      <div className="menu-title">
        MAIN MENU
      </div>

      <button
        className="menu-item active"
        onClick={() =>
          go('/admin')
        }
      >
        <i>⌂</i>
        Dashboard
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/members')
        }
      >
        <i>◎</i>
        Members
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/products')
        }
      >
        <i>▣</i>
        Products
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/content')
        }
      >
        <i>▶</i>
        Content
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/access')
        }
      >
        <i>◇</i>
        Member Access
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/progress')
        }
      >
        <i>↗</i>
        Progress
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/resources')
        }
      >
        <i>◆</i>
        Resources
      </button>

      <div className="menu-title second">
        COMMERCE
      </div>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/orders')
        }
      >
        <i>▤</i>
        Orders & Transactions
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/payments')
        }
      >
        <i>◫</i>
        Payments
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/affiliates')
        }
      >
        <i>⌘</i>
        Affiliate & Coupons
      </button>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/notifications')
        }
      >
        <i>◌</i>
        Notifications
      </button>

      {isSuperAdmin && (
        <>
          <div className="menu-title second">
            SUPER ADMIN
          </div>

          <button
            className="menu-item"
            onClick={() =>
              go('/admin/agencies')
            }
          >
            <i>♟</i>
            Agency Management
          </button>

          <button
            className="menu-item"
            onClick={() =>
              go(
                '/admin/administrators'
              )
            }
          >
            <i>♛</i>
            Administrators
          </button>

          <button
            className="menu-item"
            onClick={() =>
              go('/admin/settings')
            }
          >
            <i>⚙</i>
            System Settings
          </button>

          <button
            className="menu-item"
            onClick={() =>
              go('/admin/settings/commerce')
            }
          >
            <i>◈</i>
            Commerce Settings
          </button>

          <button
            className="menu-item"
            onClick={() =>
              go('/admin/security')
            }
          >
            <i>◇</i>
            Security / Audit
          </button>
        </>
      )}

      <div className="menu-title second">
        ACCOUNT
      </div>

      <button
        className="menu-item"
        onClick={() => {
          onNavigate?.()
          onProfile?.()
        }}
      >
        <i>◉</i>
        Profile
      </button>

    </nav>
  )
}

function Avatar({
  url,
  initials,
  large = false,
}: {
  url?: string | null
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
      {url ? (
        <img
          src={url}
          alt="Avatar"
        />
      ) : (
        initials
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  note,
  type,
}: {
  icon: string
  label: string
  value: number
  note: string
  type: string
}) {
  return (
    <article
      className={`stat ${type}`}
    >
      <div className="stat-head">
        <div>
          {icon}
        </div>

        <span>
          ↗
        </span>
      </div>

      <strong className="stat-value">
        {value}
      </strong>

      <h3>
        {label}
      </h3>

      <p>
        {note}
      </p>
    </article>
  )
}

function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="heading">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h2>
          {title}
        </h2>

        <p>
          {description}
        </p>
      </div>
    </div>
  )
}

function Quick({
  icon,
  title,
  description,
  className,
}: {
  icon: string
  title: string
  description: string
  className: string
}) {
  return (
    <button
      className={`quick ${className}`}
    >
      <div>
        {icon}
      </div>

      <span>
        <strong>
          {title}
        </strong>

        <small>
          {description}
        </small>
      </span>

      <b>
        →
      </b>
    </button>
  )
}

function StatusBadge({
  status,
}: {
  status?: string | null
}) {
  const value =
    status || 'active'

  const good =
    value === 'active' ||
    value === 'published'

  return (
    <span
      className={
        good
          ? 'status good'
          : 'status'
      }
    >
      {value.toUpperCase()}
    </span>
  )
}

function Empty({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="empty">
      <div>
        {icon}
      </div>

      <strong>
        {title}
      </strong>

      <p>
        {description}
      </p>
    </div>
  )
}

function SuperCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <button className="super-card">
      <div>
        {icon}
      </div>

      <strong>
        {title}
      </strong>

      <p>
        {description}
      </p>

      <span>
        Buka Pengaturan →
      </span>
    </button>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="info-row">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  )
}

/* ==========================================================
   STYLES
========================================================== */

function Styles() {
  return (
    <style jsx global>{`
      .admin-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns:
          248px minmax(0, 1fr);
        color:
          var(--text-primary);
        background:
          var(--page-gradient);
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 23px 17px 17px;
        display: flex;
        flex-direction: column;
        justify-content:
          space-between;
        border-right:
          1px solid var(--border);
        background:
          var(--sidebar-bg);
        backdrop-filter:
          blur(20px);
        z-index: 30;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .brand-logo {
        width: 42px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        color: #fff;
        font-size: 18px;
        font-weight: 950;
        background:
          var(--primary-gradient);
        box-shadow:
          0 13px 30px
          rgba(79,70,229,.25);
      }

      .brand > div:last-child {
        display: grid;
        gap: 2px;
      }

      .brand strong {
        font-size: 15px;
        letter-spacing: -.4px;
      }

      .brand span {
        color:
          var(--text-muted);
        font-size: 6px;
        font-weight: 900;
        letter-spacing: 1.5px;
      }

      .role-card {
        margin-top: 25px;
        padding: 11px;
        display: flex;
        align-items: center;
        gap: 9px;
        border:
          1px solid
          var(--border);
        border-radius: 14px;
        background:
          var(--card-gradient);
      }

      .role-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: #c4b5fd;
        background:
          rgba(99,102,241,.12);
      }

      .role-card > div:last-child {
        display: grid;
        gap: 2px;
      }

      .role-card span {
        color:
          var(--text-muted);
        font-size: 6px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .role-card strong {
        font-size: 9px;
      }

      .menu {
        margin-top: 22px;
        display: grid;
        gap: 4px;
      }

      .menu-title {
        margin: 0 10px 7px;
        color:
          var(--text-soft);
        font-size: 7px;
        font-weight: 950;
        letter-spacing: 1.4px;
      }

      .menu-title.second {
        margin-top: 16px;
      }

      .menu-item {
        width: 100%;
        padding: 9px 10px;
        display: flex;
        align-items: center;
        gap: 9px;
        border:
          1px solid transparent;
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--text-muted);
        text-align: left;
        font-size: 9px;
        font-weight: 750;
        background: transparent;
        transition: .2s ease;
      }

      .menu-item i {
        width: 27px;
        height: 27px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color:
          var(--accent-light);
        font-style: normal;
        background:
          rgba(99,102,241,.09);
      }

      .menu-item:hover,
      .menu-item.active {
        color:
          var(--text-primary);
        border-color:
          var(--border-strong);
        background:
          var(--card-gradient);
      }

      .sidebar-bottom {
        display: grid;
        gap: 8px;
      }

      .sidebar-profile {
        width: 100%;
        padding: 9px;
        display: flex;
        align-items: center;
        gap: 8px;
        border:
          1px solid
          var(--border);
        border-radius: 13px;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        background:
          var(--card-gradient);
      }

      .avatar {
        width: 35px;
        height: 35px;
        flex: 0 0 auto;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color: #fff;
        font-size: 10px;
        font-weight: 950;
        background:
          var(--primary-gradient);
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-large {
        width: 75px;
        height: 75px;
        border-radius: 23px;
        font-size: 20px;
      }

      .sidebar-profile > span,
      .profile-button > span {
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .sidebar-profile strong,
      .profile-button strong {
        max-width: 130px;
        overflow: hidden;
        font-size: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sidebar-profile small,
      .profile-button small {
        color:
          var(--text-muted);
        font-size: 6px;
      }

      .logout {
        padding: 9px;
        border:
          1px solid
          rgba(239,68,68,.1);
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--danger);
        font-size: 8px;
        font-weight: 800;
        background:
          rgba(127,29,29,.07);
      }

      .main {
        min-width: 0;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        height: 72px;
        padding: 0 180px 0 28px;
        display: flex;
        align-items: center;
        justify-content:
          space-between;
        gap: 15px;
        border-bottom:
          1px solid
          var(--border);
        background:
          var(--topbar-bg);
        backdrop-filter:
          blur(20px);
      }

      .mobile-brand {
        display: none;
      }

      .search {
        position: relative;
        width:
          min(420px, 45vw);
        display: flex;
        align-items: center;
        border:
          1px solid
          var(--border);
        border-radius: 13px;
        background:
          var(--input-bg);
      }

      .search > span {
        padding-left: 13px;
        color:
          var(--text-muted);
        font-size: 17px;
      }

      .search input {
        width: 100%;
        min-width: 0;
        padding: 11px;
        border: 0;
        outline: 0;
        color:
          var(--text-primary);
        font-size: 9px;
        background: transparent;
      }

      .search input::placeholder {
        color:
          var(--text-soft);
      }

      .search-clear {
        padding: 0 12px;
        border: 0;
        cursor: pointer;
        color:
          var(--text-muted);
        background: transparent;
      }

      .search-results {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        padding: 6px;
        border:
          1px solid
          var(--border);
        border-radius: 14px;
        background:
          var(--surface-strong);
        box-shadow:
          var(--shadow);
      }

      .search-result {
        padding: 9px;
        display: flex;
        align-items: center;
        gap: 9px;
        border-radius: 9px;
      }

      .result-icon {
        width: 27px;
        height: 27px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color:
          var(--accent);
        background:
          rgba(99,102,241,.1);
      }

      .search-result div {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .search-result strong {
        font-size: 8px;
      }

      .search-result small {
        color:
          var(--text-muted);
        font-size: 6px;
      }

      .no-search {
        padding: 14px;
        color:
          var(--text-muted);
        text-align: center;
        font-size: 8px;
      }

      .top-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .notification {
        position: relative;
        width: 37px;
        height: 37px;
        border:
          1px solid
          var(--border);
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--text-secondary);
        background:
          var(--surface-gradient);
      }

      .notification i {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #818cf8;
      }

      .profile-button {
        padding: 4px 7px 4px 4px;
        display: flex;
        align-items: center;
        gap: 7px;
        border:
          1px solid
          var(--border);
        border-radius: 13px;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        background:
          var(--surface-gradient);
      }

      .content {
        width: 100%;
        max-width: 1450px;
        margin: 0 auto;
        padding:
          31px 28px 50px;
      }

      .welcome {
        display: flex;
        align-items: flex-end;
        justify-content:
          space-between;
        gap: 20px;
      }

      .eyebrow {
        color:
          var(--accent);
        font-size: 7px;
        font-weight: 950;
        letter-spacing: 1.5px;
      }

      .welcome h1 {
        margin: 6px 0 7px;
        font-size:
          clamp(27px,4vw,40px);
        line-height: 1.1;
        letter-spacing: -1.2px;
      }

      .welcome h1 span {
        color:
          var(--accent-light);
      }

      .welcome p,
      .heading p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 9px;
        line-height: 1.6;
      }

      .system-status {
        min-width: 210px;
        padding: 12px 14px;
        display: grid;
        gap: 5px;
        border:
          1px solid
          var(--border);
        border-radius: 14px;
        background:
          var(--card-gradient);
      }

      .system-status strong {
        font-size: 8px;
      }

      .online {
        display: flex;
        align-items: center;
        gap: 6px;
        color:
          var(--success);
        font-size: 6px;
        font-weight: 950;
        letter-spacing: 1px;
      }

      .online i {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow:
          0 0 12px
          rgba(34,197,94,.5);
      }

      .warning {
        margin-top: 18px;
        padding: 12px;
        display: flex;
        gap: 10px;
        border:
          1px solid
          rgba(245,158,11,.15);
        border-radius: 13px;
        color: #f59e0b;
        background:
          rgba(120,53,15,.08);
      }

      .warning > div {
        width: 28px;
        height: 28px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        background:
          rgba(245,158,11,.1);
      }

      .warning span {
        display: grid;
        gap: 3px;
        font-size: 7px;
      }

      .stats {
        margin-top: 25px;
        display: grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap: 11px;
      }

      .stat {
        min-height: 145px;
        padding: 16px;
        border:
          1px solid
          var(--border);
        border-radius: 18px;
        box-shadow:
          0 15px 40px
          rgba(0,0,0,.05);
      }

      .stat.blue {
        background:
          var(--card-gradient-blue);
      }

      .stat.purple {
        background:
          var(--card-gradient-purple);
      }

      .stat.green {
        background:
          var(--card-gradient-green);
      }

      .stat.pink {
        background:
          var(--card-gradient-pink);
      }

      .stat-head {
        display: flex;
        align-items: center;
        justify-content:
          space-between;
        color:
          var(--text-muted);
      }

      .stat-head > div {
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color:
          var(--accent-light);
        background:
          rgba(99,102,241,.1);
      }

      .stat-value {
        margin-top: 15px;
        display: block;
        font-size: 27px;
        letter-spacing: -1px;
      }

      .stat h3 {
        margin: 1px 0 4px;
        color:
          var(--text-secondary);
        font-size: 8px;
      }

      .stat p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 7px;
      }

      .section {
        padding-top: 31px;
      }

      .heading {
        margin-bottom: 13px;
      }

      .heading h2 {
        margin: 4px 0 3px;
        font-size: 17px;
      }

      .quick-grid {
        display: grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap: 10px;
      }

      .quick {
        padding: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        border:
          1px solid
          var(--border);
        border-radius: 16px;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        transition:
          transform .2s ease;
      }

      .quick:hover {
        transform:
          translateY(-2px);
      }

      .quick-blue {
        background:
          var(--card-gradient-blue);
      }

      .quick-purple {
        background:
          var(--card-gradient-purple);
      }

      .quick-green {
        background:
          var(--card-gradient-green);
      }

      .quick-orange {
        background:
          linear-gradient(
            145deg,
            rgba(180,83,9,.2),
            var(--surface)
          );
      }

      .quick > div {
        width: 37px;
        height: 37px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color:
          var(--accent-light);
        font-size: 15px;
        font-weight: 900;
        background:
          rgba(99,102,241,.1);
      }

      .quick > span {
        min-width: 0;
        flex: 1;
        display: grid;
        gap: 2px;
      }

      .quick strong {
        font-size: 9px;
      }

      .quick small {
        color:
          var(--text-muted);
        font-size: 6px;
        line-height: 1.4;
      }

      .quick b {
        color:
          var(--accent);
        font-size: 10px;
      }

      .dashboard-grid {
        padding-top: 30px;
        display: grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap: 12px;
      }

      .panel {
        padding: 17px;
        border:
          1px solid
          var(--border);
        border-radius: 19px;
        background:
          var(--surface-gradient);
        box-shadow:
          0 15px 40px
          rgba(0,0,0,.04);
      }

      .panel-head {
        margin-bottom: 13px;
        display: flex;
        align-items: center;
        justify-content:
          space-between;
        gap: 10px;
      }

      .panel-head h2 {
        margin: 4px 0 0;
        font-size: 15px;
      }

      .panel-head button {
        border: 0;
        cursor: pointer;
        color:
          var(--accent);
        font-size: 7px;
        font-weight: 800;
        background: transparent;
      }

      .member-list,
      .product-list {
        display: grid;
        gap: 6px;
      }

      .member-row,
      .product-row {
        padding: 9px;
        display: flex;
        align-items: center;
        gap: 9px;
        border:
          1px solid
          var(--border);
        border-radius: 11px;
        background:
          var(--card-gradient);
      }

      .member-info,
      .product-info {
        min-width: 0;
        flex: 1;
        display: grid;
        gap: 2px;
      }

      .member-info strong,
      .product-info strong {
        overflow: hidden;
        font-size: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .member-info span,
      .product-info span {
        color:
          var(--text-muted);
        font-size: 6px;
      }

      .status {
        padding: 5px 7px;
        border-radius: 999px;
        color:
          var(--text-muted);
        font-size: 5px;
        font-weight: 950;
        background:
          rgba(100,116,139,.1);
      }

      .status.good {
        color:
          var(--success);
        background:
          rgba(34,197,94,.1);
      }

      .product-icon {
        width: 35px;
        height: 35px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color: #fff;
        font-size: 11px;
        font-weight: 950;
      }

      .product-1 {
        background:
          linear-gradient(
            135deg,#2563eb,#7c3aed
          );
      }

      .product-2 {
        background:
          linear-gradient(
            135deg,#059669,#2563eb
          );
      }

      .product-3 {
        background:
          linear-gradient(
            135deg,#db2777,#7c3aed
          );
      }

      .product-4 {
        background:
          linear-gradient(
            135deg,#d97706,#dc2626
          );
      }

      .empty {
        min-height: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color:
          var(--text-muted);
        text-align: center;
      }

      .empty > div {
        margin-bottom: 8px;
        font-size: 25px;
      }

      .empty strong {
        color:
          var(--text-secondary);
        font-size: 9px;
      }

      .empty p {
        margin: 4px 0 0;
        font-size: 7px;
      }

      .overview-grid {
        padding-top: 12px;
        display: grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap: 11px;
      }

      .overview-card {
        min-height: 135px;
        padding: 15px;
        display: flex;
        align-items: center;
        gap: 11px;
        border:
          1px solid
          var(--border);
        border-radius: 17px;
        background:
          var(--surface-gradient);
      }

      .overview-icon {
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #93c5fd;
        background:
          rgba(37,99,235,.11);
      }

      .overview-icon.purple {
        color: #c4b5fd;
        background:
          rgba(124,58,237,.1);
      }

      .overview-icon.green {
        color:
          var(--success);
        background:
          rgba(34,197,94,.1);
      }

      .overview-card > div:nth-child(2) {
        flex: 1;
        display: grid;
        gap: 2px;
      }

      .overview-card span {
        color:
          var(--text-muted);
        font-size: 6px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .overview-card strong {
        font-size: 23px;
      }

      .overview-card p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 7px;
      }

      .mini-chart {
        height: 50px;
        display: flex;
        align-items: flex-end;
        gap: 3px;
      }

      .mini-chart i {
        width: 4px;
        border-radius: 4px;
        background:
          linear-gradient(
            180deg,#60a5fa,#7c3aed
          );
      }

      .mini-chart i:nth-child(1) {
        height: 18px;
      }

      .mini-chart i:nth-child(2) {
        height: 28px;
      }

      .mini-chart i:nth-child(3) {
        height: 23px;
      }

      .mini-chart i:nth-child(4) {
        height: 38px;
      }

      .mini-chart i:nth-child(5) {
        height: 31px;
      }

      .mini-chart i:nth-child(6) {
        height: 44px;
      }

      .mini-chart i:nth-child(7) {
        height: 36px;
      }

      .ring {
        width: 53px;
        height: 53px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background:
          conic-gradient(
            #7c3aed 0 72%,
            rgba(99,102,241,.1)
            72% 100%
          );
      }

      .ring div {
        width: 41px;
        height: 41px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        color:
          var(--text-primary);
        font-size: 8px;
        font-weight: 900;
        background:
          var(--surface-strong);
      }

      .access-bars {
        display: grid;
        gap: 5px;
      }

      .access-bars span {
        display: block;
        height: 6px;
        border-radius: 999px;
        background:
          linear-gradient(
            90deg,#22c55e,#2563eb
          );
      }

      .access-bars span:nth-child(1) {
        width: 55px;
      }

      .access-bars span:nth-child(2) {
        width: 40px;
      }

      .access-bars span:nth-child(3) {
        width: 48px;
      }

      .super-grid {
        display: grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap: 11px;
      }

      .super-card {
        min-height: 175px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        border:
          1px solid
          rgba(124,58,237,.16);
        border-radius: 18px;
        cursor: pointer;
        color:
          var(--text-primary);
        text-align: left;
        background:
          linear-gradient(
            145deg,
            rgba(76,29,149,.2),
            rgba(30,64,175,.14),
            var(--surface)
          );
      }

      .super-card > div {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #c4b5fd;
        font-size: 16px;
        background:
          rgba(124,58,237,.11);
      }

      .super-card strong {
        margin-top: 13px;
        font-size: 11px;
      }

      .super-card p {
        flex: 1;
        margin: 5px 0 13px;
        color:
          var(--text-muted);
        font-size: 7px;
        line-height: 1.5;
      }

      .super-card > span {
        color:
          var(--accent);
        font-size: 7px;
        font-weight: 850;
      }

      footer {
        margin-top: 34px;
        padding-top: 16px;
        display: flex;
        justify-content:
          space-between;
        border-top:
          1px solid
          var(--border);
        color:
          var(--text-soft);
        font-size: 6px;
      }

      .profile-overlay,
      .mobile-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background:
          var(--overlay);
        backdrop-filter:
          blur(7px);
      }

      .profile-drawer {
        position: absolute;
        top: 0;
        right: 0;
        width:
          min(390px,92vw);
        height: 100%;
        overflow-y: auto;
        padding: 24px;
        border-left:
          1px solid
          var(--border);
        color:
          var(--text-primary);
        background:
          var(--page-gradient);
        box-shadow:
          var(--shadow);
      }

      .drawer-header {
        display: flex;
        align-items: center;
        justify-content:
          space-between;
      }

      .drawer-header h2 {
        margin: 4px 0 0;
        font-size: 18px;
      }

      .drawer-header button,
      .mobile-head button {
        width: 35px;
        height: 35px;
        border:
          1px solid
          var(--border);
        border-radius: 10px;
        cursor: pointer;
        color:
          var(--text-primary);
        background:
          var(--surface-gradient);
      }

      .profile-hero {
        margin-top: 24px;
        padding: 23px;
        display: flex;
        flex-direction: column;
        align-items: center;
        border:
          1px solid
          var(--border);
        border-radius: 19px;
        text-align: center;
        background:
          var(--card-gradient);
      }

      .profile-hero h3 {
        margin: 11px 0 3px;
        font-size: 15px;
      }

      .profile-hero p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 8px;
      }

      .profile-hero > span {
        margin-top: 10px;
        padding: 5px 8px;
        border-radius: 999px;
        color:
          var(--success);
        font-size: 6px;
        font-weight: 950;
        background:
          rgba(34,197,94,.1);
      }

      .profile-info {
        margin-top: 13px;
        padding: 4px 13px;
        border:
          1px solid
          var(--border);
        border-radius: 15px;
        background:
          var(--surface-gradient);
      }

      .info-row {
        padding: 11px 0;
        display: flex;
        justify-content:
          space-between;
        gap: 15px;
        border-bottom:
          1px solid
          var(--border);
      }

      .info-row:last-child {
        border-bottom: 0;
      }

      .info-row span {
        color:
          var(--text-muted);
        font-size: 7px;
      }

      .info-row strong {
        max-width: 210px;
        overflow: hidden;
        font-size: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .password-button {
        width: 100%;
        margin-top: 11px;
        padding: 12px;
        display: flex;
        justify-content:
          space-between;
        border: 0;
        border-radius: 11px;
        cursor: pointer;
        color: #fff;
        font-size: 8px;
        font-weight: 850;
        background:
          var(--primary-gradient);
      }

      .drawer-logout {
        width: 100%;
        margin-top: 8px;
        padding: 11px;
        border:
          1px solid
          rgba(239,68,68,.1);
        border-radius: 11px;
        cursor: pointer;
        color:
          var(--danger);
        font-size: 8px;
        font-weight: 850;
        background:
          rgba(127,29,29,.07);
      }

      .mobile-sidebar {
        width:
          min(300px,86vw);
        height: 100%;
        overflow-y: auto;
        padding: 19px;
        background:
          var(--surface-strong);
      }

      .mobile-head {
        display: flex;
        align-items: center;
        justify-content:
          space-between;
      }

      .mobile-sidebar .menu {
        margin-top: 30px;
      }

      .mobile-logout {
        width: 100%;
        margin-top: 25px;
        padding: 11px;
        border:
          1px solid
          rgba(239,68,68,.1);
        border-radius: 11px;
        color:
          var(--danger);
        background:
          rgba(127,29,29,.07);
      }

      .admin-loading {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          var(--page-gradient);
      }

      .loading-box {
        width: 320px;
        padding: 30px;
        display: flex;
        flex-direction: column;
        align-items: center;
        border:
          1px solid
          var(--border);
        border-radius: 22px;
        text-align: center;
        background:
          var(--surface-gradient);
      }

      .logo {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 15px;
        color: #fff;
        font-size: 19px;
        font-weight: 950;
        background:
          var(--primary-gradient);
      }

      .loading-box h2 {
        margin: 12px 0 3px;
      }

      .loading-box p {
        margin: 0;
        color:
          var(--text-muted);
        font-size: 8px;
      }

      .loader {
        width: 100%;
        height: 4px;
        margin-top: 18px;
        overflow: hidden;
        border-radius: 999px;
        background:
          rgba(99,102,241,.08);
      }

      .loader span {
        display: block;
        width: 40%;
        height: 100%;
        border-radius: 999px;
        background:
          var(--primary-gradient);
        animation:
          move 1s infinite ease-in-out;
      }

      @keyframes move {
        from {
          transform:
            translateX(-100%);
        }

        to {
          transform:
            translateX(250%);
        }
      }

      @media(max-width:1150px) {
        .stats,
        .quick-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .overview-grid {
          grid-template-columns:
            1fr;
        }
      }

      @media(max-width:900px) {
        .admin-shell {
          display: block;
        }

        .sidebar {
          display: none;
        }

        .topbar {
          height: 67px;
          padding:
            0 145px 0 15px;
        }

        .mobile-brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mobile-menu {
          width: 35px;
          height: 35px;
          border:
            1px solid
            var(--border);
          border-radius: 10px;
          color:
            var(--text-primary);
          background:
            var(--surface-gradient);
        }

        .mobile-brand strong {
          font-size: 11px;
        }

        .search {
          flex: 1;
          width: auto;
        }

        .profile-button > span {
          display: none;
        }

        .content {
          padding:
            24px 16px 45px;
        }

        .super-grid {
          grid-template-columns:
            1fr;
        }
      }

      @media(max-width:650px) {
        .topbar {
          padding:
            0 12px;
        }

        .admin-shell
        .theme-switcher {
          position: fixed;
          top: auto;
          right: 12px;
          bottom: 12px;
        }

        .mobile-brand strong {
          display: none;
        }

        .notification {
          display: none;
        }

        .system-status {
          display: none;
        }

        .welcome h1 {
          font-size: 27px;
        }

        .stats,
        .quick-grid,
        .dashboard-grid {
          grid-template-columns:
            1fr;
        }

        .overview-grid {
          grid-template-columns:
            1fr;
        }

        footer {
          flex-direction: column;
          gap: 5px;
        }
      }


      /* =====================================================
         READABILITY UPGRADE — ADMIN / SUPER ADMIN
         ===================================================== */
      .admin-shell { grid-template-columns: 270px minmax(0, 1fr) !important; }
      .sidebar { padding: 24px 18px 18px !important; }
      .brand strong { font-size: 17px !important; line-height: 1.15 !important; }
      .brand small, .brand span { font-size: 10.5px !important; line-height: 1.35 !important; }
      .role-card span { font-size: 10px !important; letter-spacing: .14em !important; }
      .role-card strong { font-size: 13px !important; }
      .menu-label { font-size: 10px !important; letter-spacing: .15em !important; }
      .menu-item, .nav-item { font-size: 13px !important; font-weight: 750 !important; min-height: 44px !important; }
      .sidebar-profile strong { font-size: 12.5px !important; }
      .sidebar-profile small { font-size: 10.5px !important; }
      .logout, .mobile-logout { font-size: 12.5px !important; }
      .search input { font-size: 13.5px !important; }
      .profile-button strong { font-size: 12px !important; }
      .profile-button small { font-size: 10px !important; }
      .eyebrow { font-size: 10.5px !important; letter-spacing: .16em !important; }
      .welcome h1 { font-size: clamp(34px, 3vw, 48px) !important; line-height: 1.08 !important; }
      .welcome p { font-size: 13.5px !important; line-height: 1.7 !important; }
      .system-status .online { font-size: 10px !important; }
      .system-status strong { font-size: 11.5px !important; }
      .stat-card .label, .stat-label { font-size: 11.5px !important; }
      .stat-card .value, .stat-value { font-size: 30px !important; line-height: 1 !important; }
      .stat-card .note, .stat-note { font-size: 11px !important; line-height: 1.45 !important; }
      .section-heading h2, .heading h2 { font-size: 23px !important; }
      .section-heading p, .heading p { font-size: 12.5px !important; line-height: 1.6 !important; }
      .quick-card strong, .quick strong { font-size: 13px !important; }
      .quick-card small, .quick small { font-size: 11px !important; line-height: 1.45 !important; }
      .panel h3, .card-title { font-size: 18px !important; }
      .panel-header a, .panel-header button { font-size: 11px !important; }
      .list-item strong, .member-row strong, .product-row strong { font-size: 12.5px !important; }
      .list-item small, .member-row small, .product-row small { font-size: 10.5px !important; }
      .status, .badge { font-size: 9.5px !important; }
      .metric-label { font-size: 10px !important; }
      .metric-value { font-size: 25px !important; }
      .metric-note { font-size: 11px !important; }
      .warning { font-size: 12px !important; line-height: 1.55 !important; }

      @media (max-width: 900px) {
        .admin-shell { grid-template-columns: 1fr !important; }
        .welcome h1 { font-size: 32px !important; }
        .search input { font-size: 14px !important; }
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
        border: 1px solid var(--border-strong) !important;
        border-radius: 26px !important;
        color: var(--text-primary) !important;
        background: var(--page-gradient) !important;
        box-shadow: 0 35px 100px rgba(2, 6, 23, .30) !important;
        animation: profileModalIn .22s ease-out !important;
      }

      @keyframes profileModalIn {
        from { opacity: 0; transform: translateY(12px) scale(.975); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .drawer-header { gap: 20px !important; }
      .drawer-header .eyebrow { font-size: 11px !important; letter-spacing: 1.4px !important; }
      .drawer-header h2 { margin: 5px 0 0 !important; font-size: 23px !important; line-height: 1.2 !important; }
      .drawer-header button { width: 42px !important; height: 42px !important; flex: 0 0 auto !important; border-radius: 13px !important; font-size: 20px !important; }

      .profile-drawer .profile-hero {
        margin-top: 22px !important;
        padding: 25px 22px !important;
        border-radius: 21px !important;
      }
      .profile-drawer .avatar.avatar-large { width: 72px !important; height: 72px !important; border-radius: 22px !important; font-size: 22px !important; }
      .profile-drawer .profile-hero h3 { margin: 14px 0 5px !important; font-size: 18px !important; line-height: 1.3 !important; }
      .profile-drawer .profile-hero p { font-size: 13px !important; line-height: 1.5 !important; color: var(--text-muted) !important; }
      .profile-drawer .profile-hero > span { margin-top: 12px !important; padding: 7px 11px !important; font-size: 10px !important; letter-spacing: .8px !important; }

      .profile-drawer .profile-info { margin-top: 16px !important; padding: 5px 17px !important; border-radius: 18px !important; }
      .profile-drawer .info-row { min-height: 50px !important; padding: 13px 0 !important; align-items: center !important; }
      .profile-drawer .info-row span { font-size: 13px !important; }
      .profile-drawer .info-row strong { max-width: 330px !important; font-size: 13px !important; line-height: 1.4 !important; }

      .profile-drawer .password-button,
      .profile-drawer .drawer-logout {
        min-height: 48px !important;
        padding: 13px 16px !important;
        border-radius: 13px !important;
        font-size: 13.5px !important;
      }
      .profile-drawer .password-button { margin-top: 16px !important; }
      .profile-drawer .drawer-logout { margin-top: 9px !important; }

      @media (max-width: 620px) {
        .profile-overlay { padding: 14px !important; align-items: center !important; }
        .profile-drawer {
          width: 100% !important;
          max-height: calc(100vh - 28px) !important;
          padding: 21px !important;
          border-radius: 22px !important;
        }
        .drawer-header h2 { font-size: 21px !important; }
        .profile-drawer .profile-hero { padding: 21px 16px !important; }
        .profile-drawer .profile-hero p { max-width: 100% !important; overflow-wrap: anywhere !important; }
        .profile-drawer .info-row { align-items: flex-start !important; flex-direction: column !important; gap: 5px !important; }
        .profile-drawer .info-row strong { max-width: 100% !important; white-space: normal !important; overflow-wrap: anywhere !important; }
      }
      /* ===== ADMIN SIDEBAR EXACT MATCH TO OTHER ADMIN PAGES ===== */
      .sidebar{
        position:fixed !important;
        inset:0 auto 0 0 !important;
        width:270px !important;
        height:100vh !important;
        padding:24px 18px 18px !important;
        background:rgba(249,251,255,.92) !important;
        border-right:1px solid #e4e8f3 !important;
        display:flex !important;
        flex-direction:column !important;
        justify-content:space-between !important;
        z-index:30 !important;
        overflow-y:auto !important;
        overflow-x:hidden !important;
        backdrop-filter:none !important;
      }
      .brand{
        display:flex !important;
        align-items:center !important;
        gap:11px !important;
        margin:0 0 22px !important;
      }
      .brand-logo{
        width:42px !important;
        height:42px !important;
        border-radius:13px !important;
        font-size:18px !important;
      }
      .brand strong{
        display:block !important;
        font-size:17px !important;
        line-height:1.1 !important;
        letter-spacing:0 !important;
      }
      .brand span{
        display:block !important;
        font-size:10px !important;
        line-height:1.2 !important;
        letter-spacing:.12em !important;
        color:#66738e !important;
        font-weight:800 !important;
        margin-top:3px !important;
      }
      .role-card{
        margin:0 0 13px !important;
        padding:13px !important;
        display:flex !important;
        align-items:center !important;
        gap:10px !important;
        border:1px solid #dfe3ef !important;
        border-radius:15px !important;
        background:linear-gradient(110deg,rgba(226,234,255,.85),rgba(249,246,255,.9)) !important;
      }
      .role-icon{
        width:34px !important;
        height:34px !important;
        border-radius:10px !important;
        background:#e2e5ff !important;
        color:#7165f5 !important;
      }
      .role-card span{
        display:block !important;
        font-size:10px !important;
        line-height:1.2 !important;
        letter-spacing:.12em !important;
        color:#7b849a !important;
        font-weight:800 !important;
      }
      .role-card strong{
        display:block !important;
        font-size:13px !important;
        line-height:1.25 !important;
        margin-top:2px !important;
      }
      .menu{
        margin-top:0 !important;
        display:block !important;
      }
      .menu-title{
        margin:20px 8px 8px !important;
        color:#8a96ad !important;
        font-size:9px !important;
        line-height:1.2 !important;
        font-weight:900 !important;
        letter-spacing:.14em !important;
      }
      .menu-title.second{
        margin-top:20px !important;
      }
      .menu-item{
        width:100% !important;
        min-height:0 !important;
        padding:10px 9px !important;
        margin:2px 0 !important;
        display:flex !important;
        align-items:center !important;
        gap:10px !important;
        border:1px solid transparent !important;
        border-radius:11px !important;
        color:#60708b !important;
        text-align:left !important;
        font-size:13px !important;
        line-height:1.2 !important;
        font-weight:700 !important;
        background:transparent !important;
      }
      .menu-item i{
        width:18px !important;
        height:auto !important;
        flex:0 0 18px !important;
        display:inline-flex !important;
        align-items:center !important;
        justify-content:center !important;
        border-radius:0 !important;
        color:#71809a !important;
        font-size:12px !important;
        background:transparent !important;
      }
      .menu-item:hover{
        color:#283650 !important;
        border-color:transparent !important;
        background:#f1f4fb !important;
      }
      .menu-item.active{
        color:#26324a !important;
        border-color:#c9ccff !important;
        background:linear-gradient(90deg,#eef1ff,#f8f4ff) !important;
      }
      .sidebar-bottom{
        margin-top:auto !important;
        padding-top:18px !important;
        display:grid !important;
        gap:8px !important;
      }
      .sidebar-profile{
        padding:9px !important;
        border:1px solid #dfe3ef !important;
        border-radius:13px !important;
        background:rgba(255,255,255,.7) !important;
      }
      .sidebar-profile strong{
        font-size:12px !important;
      }
      .sidebar-profile small{
        font-size:10px !important;
      }
      .logout{
        font-size:11px !important;
      }
      .admin-shell{
        display:block !important;
      }
      .main{
        margin-left:270px !important;
        width:calc(100% - 270px) !important;
        min-width:0 !important;
      }
      @media(max-width:900px){
        .main{
          margin-left:0 !important;
          width:100% !important;
        }
      }

    `}</style>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import ThemeSwitcher from '../../../components/ThemeSwitcher'

type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  status: string | null
}

export default function SystemSettingsPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    checkAccess()
  }, [])

  async function checkAccess() {
    setLoading(true)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      router.replace('/login')
      return
    }

    setEmail(user.email ?? '')

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        avatar_url,
        role,
        status
      `)
      .eq('id', user.id)
      .maybeSingle()

    if (error || !data) {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }

    const currentProfile = data as Profile

    if (currentProfile.status !== 'active') {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }

    if (currentProfile.role !== 'super_admin') {
      router.replace('/admin')
      return
    }

    setProfile(currentProfile)
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const displayName =
    profile?.full_name?.trim() ||
    email.split('@')[0] ||
    'Super Admin'

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SA'

  if (loading) {
    return (
      <>
        <main className="loading-page">
          <ThemeSwitcher />

          <div className="loading-card">
            <div className="loading-logo">S</div>

            <div>
              <span>SUPER ADMIN</span>
              <h2>System Settings</h2>
              <p>Menyiapkan pengaturan platform...</p>
            </div>

            <div className="loader">
              <i />
            </div>
          </div>
        </main>

        <Styles />
      </>
    )
  }

  return (
    <>
      <div className="settings-shell">
        <ThemeSwitcher />

        {/* DESKTOP SIDEBAR */}
        <aside className="sidebar">
          <div>
            <Brand />

            <div className="role-card">
              <div className="role-icon">★</div>

              <div>
                <span>LOGGED IN AS</span>
                <strong>Super Admin</strong>
              </div>
            </div>

            <Navigation
              router={router}
            />
          </div>

          <div className="sidebar-bottom">
            <button
              className="account-card"
              onClick={() => router.push('/admin?profile=1')}
            >
              <Avatar
                url={profile?.avatar_url}
                initials={initials}
              />

              <span>
                <strong>{displayName}</strong>
                <small>Super Admin</small>
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

        {/* MOBILE SIDEBAR */}
        {sidebarOpen && (
          <div
            className="mobile-overlay"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="mobile-sidebar"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mobile-head">
                <Brand />

                <button
                  onClick={() => setSidebarOpen(false)}
                >
                  ×
                </button>
              </div>

              <Navigation
                router={router}
                onNavigate={() => setSidebarOpen(false)}
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

        {/* MAIN */}
        <main className="main">
          <header className="topbar">
            <div className="mobile-brand">
              <button
                className="mobile-menu"
                onClick={() => setSidebarOpen(true)}
              >
                ☰
              </button>

              <strong>System Settings</strong>
            </div>

            <button
              className="back-button"
              onClick={() => router.push('/admin')}
            >
              ← Dashboard
            </button>

            <div className="top-profile">
              <Avatar
                url={profile?.avatar_url}
                initials={initials}
              />

              <span>
                <strong>{displayName}</strong>
                <small>Super Admin</small>
              </span>
            </div>
          </header>

          <div className="content">
            {/* HERO */}
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  SUPER ADMIN • SYSTEM CONTROL
                </div>

                <h1>
                  System
                  <span> Settings.</span>
                </h1>

                <p>
                  Kelola branding, homepage, komunikasi,
                  integrasi dan konfigurasi global platform
                  dari satu tempat.
                </p>
              </div>

              <div className="hero-visual">
                <div className="visual-orb orb-one" />
                <div className="visual-orb orb-two" />

                <div className="visual-icon">
                  ⚙
                </div>

                <div>
                  <span>PLATFORM CONFIGURATION</span>
                  <strong>White-label Control Center</strong>
                  <small>
                    Semua konfigurasi utama platform
                    terpusat di sini.
                  </small>
                </div>
              </div>
            </section>

            {/* IMPORTANT */}
            <section className="notice">
              <div className="notice-icon">
                ◇
              </div>

              <div>
                <strong>
                  White-label Architecture
                </strong>

                <p>
                  Branding dan copywriting yang dapat
                  dikustomisasi akan disimpan sebagai
                  konfigurasi platform, bukan ditanam
                  permanen di halaman client.
                </p>
              </div>

              <span>
                SUPER ADMIN ONLY
              </span>
            </section>

            {/* WEBSITE */}
            <section className="settings-section">
              <SectionHeading
                eyebrow="WEBSITE & BRAND"
                title="Website Experience"
                description="Atur tampilan publik, branding dan pengalaman visitor."
              />

              <div className="settings-grid">
                <SettingCard
                  icon="⌂"
                  type="blue"
                  badge="READY"
                  title="Homepage & Marketplace"
                  description="Mode homepage, brand, logo, icon, hero copywriting, font, warna, marketplace dan Custom HTML."
                  action="Kelola Homepage"
                  onClick={() =>
                    router.push('/admin/settings/homepage')
                  }
                />

                <SettingCard
                  icon="◈"
                  type="purple"
                  badge="READY"
                  title="Platform Branding"
                  description="Identitas global, logo, favicon URL, appearance dan copywriting halaman login white-label."
                  action="Kelola Branding"
                  onClick={() =>
                    router.push('/admin/settings/branding')
                  }
                />

                <SettingCard
                  icon="✦"
                  type="pink"
                  badge="READY"
                  title="Appearance"
                  description="Theme global, gradient, warna interface, radius card dan visual preference."
                  action="Kelola Appearance"
                  onClick={() =>
                    router.push('/admin/settings/branding')
                  }
                />
              </div>
            </section>

            {/* COMMUNICATION */}
            <section className="settings-section">
              <SectionHeading
                eyebrow="COMMUNICATION"
                title="Notification & Messaging"
                description="Provider komunikasi menggunakan konfigurasi BYOK milik client."
              />

              <div className="settings-grid">
                <SettingCard
                  icon="◉"
                  type="green"
                  badge="READY"
                  title="WhatsApp Gateway"
                  description="Kelola provider komunikasi WhatsApp yang tersedia pada konfigurasi Commerce."
                  action="Kelola Provider"
                  onClick={() =>
                    router.push('/admin/settings/commerce')
                  }
                />

                <SettingCard
                  icon="✉"
                  type="orange"
                  badge="READY"
                  title="Email Provider"
                  description="Kelola provider email dan konfigurasi komunikasi pada Commerce Settings."
                  action="Kelola Provider"
                  onClick={() =>
                    router.push('/admin/settings/commerce')
                  }
                />

                <SettingCard
                  icon="♢"
                  type="cyan"
                  badge="READY"
                  title="Notifications"
                  description="Kelola template notifikasi, variable dan aktivitas notifikasi platform."
                  action="Kelola Notifications"
                  onClick={() =>
                    router.push('/admin/notifications')
                  }
                />
              </div>
            </section>

            {/* PLATFORM */}
            <section className="settings-section">
              <SectionHeading
                eyebrow="PLATFORM"
                title="System Configuration"
                description="Konfigurasi teknis dan operasional platform."
              />

              <div className="settings-grid">
                <SettingCard
                  icon="◇"
                  type="violet"
                  badge="READY"
                  title="Commerce & Payment Settings"
                  description="Atur checkout, order, currency, customer requirement, support dan konfigurasi commerce."
                  action="Kelola Commerce"
                  onClick={() =>
                    router.push('/admin/settings/commerce')
                  }
                />

                <SettingCard
                  icon="♛"
                  type="blue"
                  badge="ADMIN"
                  title="Administrators"
                  description="Kelola akun administrator dan struktur akses platform."
                  action="Buka Administrators"
                  onClick={() =>
                    router.push('/admin/administrators')
                  }
                />

                <SettingCard
                  icon="⌁"
                  type="red"
                  badge="SECURITY"
                  title="Security & Audit"
                  description="Area keamanan, monitoring dan aktivitas administratif."
                  action="Buka Security"
                  onClick={() =>
                    router.push('/admin/security')
                  }
                />
              </div>
            </section>

            {/* PROVIDER SUMMARY */}
            <section className="provider-panel">
              <div className="provider-copy">
                <div className="eyebrow">
                  PROVIDER ARCHITECTURE
                </div>

                <h2>
                  BYOK. Fleksibel. White-label.
                </h2>

                <p>
                  Client tidak diwajibkan menggunakan
                  provider komunikasi yang sama.
                  Provider dapat dipilih sesuai kebutuhan
                  tanpa mengubah source utama.
                </p>
              </div>

              <div className="provider-grid">
                <Provider
                  icon="W"
                  title="WhatsApp"
                  value="Fonnte / Starsender"
                />

                <Provider
                  icon="@"
                  title="Email"
                  value="Mailketing / SMTP"
                />

                <Provider
                  icon="S"
                  title="Auth Recovery"
                  value="Supabase Auth"
                />
              </div>
            </section>

            <footer>
              <span>
                © {new Date().getFullYear()} iMersSUPA
              </span>

              <span>
                Super Admin • System Settings
              </span>
            </footer>
          </div>
        </main>
      </div>

      <Styles />
    </>
  )
}

/* ============================================================
   COMPONENTS
============================================================ */

function Brand() {
  return (
    <div className="brand">
      <div className="brand-logo">
        S
      </div>

      <div>
        <strong>iMersSUPA</strong>
        <span>SUPER ADMIN</span>
      </div>
    </div>
  )
}

function Avatar({
  url,
  initials,
}: {
  url?: string | null
  initials: string
}) {
  return (
    <div className="avatar">
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

function Navigation({
  router,
  onNavigate,
}: {
  router: ReturnType<typeof useRouter>
  onNavigate?: () => void
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
        className="menu-item"
        onClick={() => go('/admin')}
      >
        <i>⌂</i>
        Dashboard
      </button>

      <button
        className="menu-item"
        onClick={() => go('/admin/members')}
      >
        <i>◎</i>
        Members
      </button>

      <button
        className="menu-item"
        onClick={() => go('/admin/products')}
      >
        <i>▣</i>
        Products
      </button>

      <button
        className="menu-item"
        onClick={() => go('/admin/content')}
      >
        <i>▶</i>
        Content
      </button>

      <button
        className="menu-item"
        onClick={() => go('/admin/access')}
      >
        <i>◇</i>
        Member Access
      </button>

      <div className="menu-title second">
        SUPER ADMIN
      </div>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin/administrators')
        }
      >
        <i>♛</i>
        Administrators
      </button>

      <button
        className="menu-item active"
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
          go('/admin/security')
        }
      >
        <i>◇</i>
        Security / Audit
      </button>

      <div className="menu-title second">
        ACCOUNT
      </div>

      <button
        className="menu-item"
        onClick={() =>
          go('/admin?profile=1')
        }
      >
        <i>◉</i>
        Profile
      </button>
    </nav>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="section-heading">
      <div className="eyebrow">
        {eyebrow}
      </div>

      <h2>{title}</h2>

      <p>{description}</p>
    </div>
  )
}

function SettingCard({
  icon,
  type,
  badge,
  title,
  description,
  action,
  onClick,
  disabled = false,
}: {
  icon: string
  type: string
  badge: string
  title: string
  description: string
  action: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      className={`setting-card ${type} ${
        disabled ? 'disabled' : ''
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="card-top">
        <div className="setting-icon">
          {icon}
        </div>

        <span className="badge">
          {badge}
        </span>
      </div>

      <div className="card-content">
        <h3>{title}</h3>

        <p>{description}</p>
      </div>

      <div className="card-action">
        <span>{action}</span>
        <b>→</b>
      </div>
    </button>
  )
}

function Provider({
  icon,
  title,
  value,
}: {
  icon: string
  title: string
  value: string
}) {
  return (
    <div className="provider">
      <div>{icon}</div>

      <span>
        <small>{title}</small>
        <strong>{value}</strong>
      </span>
    </div>
  )
}

/* ============================================================
   STYLES
============================================================ */

function Styles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
      }

      button,
      input,
      textarea,
      select {
        font: inherit;
      }

      .settings-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: 248px minmax(0, 1fr);
        color: var(--text-primary);
        background: var(--page-gradient);
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 23px 17px 17px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-right: 1px solid var(--border);
        background: var(--sidebar-bg);
        backdrop-filter: blur(20px);
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
        background: var(--primary-gradient);
        box-shadow:
          0 13px 30px rgba(79, 70, 229, .25);
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
        color: var(--text-muted);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 1.5px;
      }

      .role-card {
        margin-top: 25px;
        padding: 11px;
        display: flex;
        align-items: center;
        gap: 9px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--card-gradient);
      }

      .role-icon {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: #c4b5fd;
        background: rgba(99, 102, 241, .12);
      }

      .role-card > div:last-child {
        display: grid;
        gap: 2px;
      }

      .role-card span {
        color: var(--text-muted);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .role-card strong {
        font-size: 13px;
      }

      .menu {
        margin-top: 22px;
        display: grid;
        gap: 4px;
      }

      .menu-title {
        margin: 0 10px 7px;
        color: var(--text-soft);
        font-size: 11px;
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
        border: 1px solid transparent;
        border-radius: 11px;
        cursor: pointer;
        color: var(--text-muted);
        text-align: left;
        font-size: 13px;
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
        color: var(--accent-light);
        font-style: normal;
        background: rgba(99, 102, 241, .09);
      }

      .menu-item:hover,
      .menu-item.active {
        color: var(--text-primary);
        border-color: var(--border-strong);
        background: var(--card-gradient);
      }

      .sidebar-bottom {
        display: grid;
        gap: 8px;
      }

      .account-card {
        width: 100%;
        padding: 9px;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--border);
        border-radius: 13px;
        cursor: pointer;
        color: var(--text-primary);
        text-align: left;
        background: var(--card-gradient);
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
        font-size: 13px;
        font-weight: 950;
        background: var(--primary-gradient);
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .account-card > span,
      .top-profile > span {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .account-card strong,
      .top-profile strong {
        max-width: 130px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
      }

      .account-card small,
      .top-profile small {
        color: var(--text-muted);
        font-size: 10px;
      }

      .logout,
      .mobile-logout {
        padding: 9px;
        border: 1px solid rgba(239, 68, 68, .12);
        border-radius: 11px;
        cursor: pointer;
        color: var(--danger);
        font-size: 12px;
        font-weight: 800;
        background: rgba(127, 29, 29, .07);
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
        justify-content: space-between;
        gap: 15px;
        border-bottom: 1px solid var(--border);
        background: var(--topbar-bg);
        backdrop-filter: blur(20px);
      }

      .mobile-brand {
        display: none;
      }

      .back-button {
        padding: 9px 13px;
        border: 1px solid var(--border);
        border-radius: 11px;
        cursor: pointer;
        color: var(--text-secondary);
        font-size: 12px;
        font-weight: 800;
        background: var(--surface-gradient);
      }

      .top-profile {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .content {
        width: 100%;
        max-width: 1450px;
        margin: 0 auto;
        padding: 31px 28px 50px;
      }

      .hero {
        min-height: 245px;
        padding: 31px;
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns:
          minmax(0, 1.25fr)
          minmax(300px, .75fr);
        align-items: center;
        gap: 30px;
        border: 1px solid var(--border);
        border-radius: 25px;
        background:
          linear-gradient(
            125deg,
            rgba(59, 130, 246, .11),
            rgba(124, 58, 237, .12),
            rgba(236, 72, 153, .07)
          ),
          var(--card-gradient);
        box-shadow:
          0 25px 70px rgba(0, 0, 0, .07);
      }

      .hero:before {
        content: '';
        position: absolute;
        width: 320px;
        height: 320px;
        left: -140px;
        bottom: -230px;
        border-radius: 50%;
        background: rgba(59, 130, 246, .12);
        filter: blur(30px);
      }

      .eyebrow {
        color: var(--accent);
        font-size: 11px;
        font-weight: 950;
        letter-spacing: 1.5px;
      }

      .hero h1 {
        margin: 7px 0 9px;
        font-size: clamp(34px, 5vw, 55px);
        line-height: 1;
        letter-spacing: -2.3px;
      }

      .hero h1 span {
        background:
          linear-gradient(
            90deg,
            #38bdf8,
            #6366f1,
            #a855f7
          );
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .hero-copy > p {
        max-width: 620px;
        margin: 0;
        color: var(--text-muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .hero-visual {
        min-height: 170px;
        padding: 22px;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        gap: 16px;
        border: 1px solid var(--border);
        border-radius: 22px;
        background: var(--surface-gradient);
      }

      .hero-visual > div:not(.visual-orb) {
        position: relative;
        z-index: 2;
      }

      .visual-icon {
        width: 62px;
        height: 62px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 20px;
        color: #fff;
        font-size: 25px;
        background: var(--primary-gradient);
        box-shadow:
          0 17px 40px rgba(99, 102, 241, .25);
      }

      .hero-visual > div:last-child {
        display: grid;
        gap: 5px;
      }

      .hero-visual span {
        color: var(--accent);
        font-size: 10px;
        font-weight: 950;
        letter-spacing: 1px;
      }

      .hero-visual strong {
        font-size: 14px;
      }

      .hero-visual small {
        max-width: 220px;
        color: var(--text-muted);
        font-size: 11px;
        line-height: 1.5;
      }

      .visual-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(5px);
      }

      .orb-one {
        width: 130px;
        height: 130px;
        top: -60px;
        right: -30px;
        background: rgba(168, 85, 247, .14);
      }

      .orb-two {
        width: 100px;
        height: 100px;
        bottom: -50px;
        left: 30%;
        background: rgba(56, 189, 248, .12);
      }

      .notice {
        margin-top: 16px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1px solid rgba(99, 102, 241, .15);
        border-radius: 16px;
        background:
          linear-gradient(
            110deg,
            rgba(59, 130, 246, .07),
            rgba(139, 92, 246, .07)
          );
      }

      .notice-icon {
        width: 36px;
        height: 36px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 11px;
        color: var(--accent-light);
        background: rgba(99, 102, 241, .1);
      }

      .notice > div:nth-child(2) {
        flex: 1;
        display: grid;
        gap: 3px;
      }

      .notice strong {
        font-size: 13px;
      }

      .notice p {
        margin: 0;
        color: var(--text-muted);
        font-size: 11px;
        line-height: 1.5;
      }

      .notice > span {
        padding: 6px 8px;
        border-radius: 8px;
        color: #c4b5fd;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: .8px;
        background: rgba(99, 102, 241, .1);
      }

      .settings-section {
        padding-top: 34px;
      }

      .section-heading {
        margin-bottom: 14px;
      }

      .section-heading h2 {
        margin: 5px 0 4px;
        font-size: 19px;
        letter-spacing: -.4px;
      }

      .section-heading p {
        margin: 0;
        color: var(--text-muted);
        font-size: 12px;
      }

      .settings-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .setting-card {
        min-height: 225px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border);
        border-radius: 20px;
        cursor: pointer;
        color: var(--text-primary);
        text-align: left;
        transition:
          transform .22s ease,
          border-color .22s ease,
          box-shadow .22s ease;
      }

      .setting-card:hover:not(.disabled) {
        transform: translateY(-4px);
        border-color: var(--border-strong);
        box-shadow:
          0 20px 50px rgba(0, 0, 0, .08);
      }

      .setting-card.blue {
        background: var(--card-gradient-blue);
      }

      .setting-card.purple,
      .setting-card.violet {
        background: var(--card-gradient-purple);
      }

      .setting-card.green {
        background: var(--card-gradient-green);
      }

      .setting-card.pink,
      .setting-card.red {
        background: var(--card-gradient-pink);
      }

      .setting-card.orange {
        background:
          linear-gradient(
            135deg,
            rgba(245, 158, 11, .10),
            rgba(249, 115, 22, .05)
          ),
          var(--card-gradient);
      }

      .setting-card.cyan {
        background:
          linear-gradient(
            135deg,
            rgba(6, 182, 212, .10),
            rgba(59, 130, 246, .05)
          ),
          var(--card-gradient);
      }

      .setting-card.disabled {
        cursor: default;
        opacity: .78;
      }

      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .setting-icon {
        width: 45px;
        height: 45px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        color: var(--accent-light);
        font-size: 18px;
        background: rgba(99, 102, 241, .11);
      }

      .badge {
        padding: 5px 7px;
        border-radius: 7px;
        color: var(--accent-light);
        font-size: 5px;
        font-weight: 950;
        letter-spacing: .9px;
        background: rgba(99, 102, 241, .1);
      }

      .card-content {
        flex: 1;
        padding-top: 18px;
      }

      .card-content h3 {
        margin: 0 0 7px;
        font-size: 14px;
      }

      .card-content p {
        margin: 0;
        color: var(--text-muted);
        font-size: 12px;
        line-height: 1.65;
      }

      .card-action {
        padding-top: 17px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--accent);
        font-size: 11px;
        font-weight: 900;
      }

      .card-action b {
        font-size: 14px;
      }

      .provider-panel {
        margin-top: 35px;
        padding: 24px;
        display: grid;
        grid-template-columns:
          minmax(0, .8fr)
          minmax(0, 1.2fr);
        align-items: center;
        gap: 25px;
        border: 1px solid var(--border);
        border-radius: 22px;
        background:
          linear-gradient(
            115deg,
            rgba(59, 130, 246, .08),
            rgba(139, 92, 246, .08),
            rgba(236, 72, 153, .04)
          ),
          var(--card-gradient);
      }

      .provider-copy h2 {
        margin: 5px 0 7px;
        font-size: 18px;
      }

      .provider-copy p {
        max-width: 500px;
        margin: 0;
        color: var(--text-muted);
        font-size: 12px;
        line-height: 1.65;
      }

      .provider-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 9px;
      }

      .provider {
        padding: 13px;
        display: flex;
        align-items: center;
        gap: 9px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface-gradient);
      }

      .provider > div {
        width: 34px;
        height: 34px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: var(--accent-light);
        font-size: 13px;
        font-weight: 950;
        background: rgba(99, 102, 241, .1);
      }

      .provider > span {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .provider small {
        color: var(--text-muted);
        font-size: 10px;
      }

      .provider strong {
        font-size: 12px;
      }

      footer {
        margin-top: 36px;
        padding-top: 17px;
        display: flex;
        justify-content: space-between;
        gap: 15px;
        border-top: 1px solid var(--border);
        color: var(--text-soft);
        font-size: 11px;
      }

      .mobile-overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        background: rgba(0, 0, 0, .45);
        backdrop-filter: blur(4px);
      }

      .mobile-sidebar {
        width: min(310px, 88vw);
        height: 100%;
        padding: 20px;
        overflow-y: auto;
        background: var(--sidebar-bg);
        box-shadow:
          25px 0 70px rgba(0, 0, 0, .2);
      }

      .mobile-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .mobile-head > button {
        width: 35px;
        height: 35px;
        border: 1px solid var(--border);
        border-radius: 10px;
        cursor: pointer;
        color: var(--text-primary);
        background: var(--card-gradient);
      }

      .mobile-logout {
        width: 100%;
        margin-top: 20px;
      }

      .loading-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-primary);
        background: var(--page-gradient);
      }

      .loading-card {
        width: min(420px, calc(100vw - 40px));
        padding: 25px;
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 14px;
        border: 1px solid var(--border);
        border-radius: 22px;
        background: var(--card-gradient);
        box-shadow: var(--shadow);
      }

      .loading-logo {
        width: 55px;
        height: 55px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 17px;
        color: #fff;
        font-size: 20px;
        font-weight: 950;
        background: var(--primary-gradient);
      }

      .loading-card span {
        color: var(--accent);
        font-size: 10px;
        font-weight: 950;
        letter-spacing: 1px;
      }

      .loading-card h2 {
        margin: 3px 0;
        font-size: 16px;
      }

      .loading-card p {
        margin: 0;
        color: var(--text-muted);
        font-size: 12px;
      }

      .loader {
        grid-column: 1 / -1;
        height: 3px;
        overflow: hidden;
        border-radius: 99px;
        background: rgba(99, 102, 241, .1);
      }

      .loader i {
        width: 35%;
        height: 100%;
        display: block;
        border-radius: inherit;
        background: var(--primary-gradient);
        animation: loading 1s infinite ease-in-out;
      }

      @keyframes loading {
        from {
          transform: translateX(-100%);
        }

        to {
          transform: translateX(300%);
        }
      }

      @media (max-width: 1050px) {
        .settings-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .hero {
          grid-template-columns: 1fr;
        }

        .provider-panel {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 820px) {
        .settings-shell {
          display: block;
        }

        .sidebar {
          display: none;
        }

        .topbar {
          height: 65px;
          padding: 0 110px 0 16px;
        }

        .mobile-brand {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .mobile-menu {
          width: 35px;
          height: 35px;
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          color: var(--text-primary);
          background: var(--surface-gradient);
        }

        .mobile-brand strong {
          font-size: 13px;
        }

        .back-button {
          display: none;
        }

        .content {
          padding:
            22px 16px 40px;
        }

        .hero {
          padding: 23px;
        }
      }

      @media (max-width: 620px) {
        .settings-grid {
          grid-template-columns: 1fr;
        }

        .hero {
          min-height: 0;
        }

        .hero h1 {
          font-size: 36px;
        }

        .hero-visual {
          min-height: 145px;
        }

        .notice {
          align-items: flex-start;
        }

        .notice > span {
          display: none;
        }

        .provider-grid {
          grid-template-columns: 1fr;
        }

        .top-profile > span {
          display: none;
        }

        footer {
          display: grid;
        }
      }
    `}</style>
  )
}

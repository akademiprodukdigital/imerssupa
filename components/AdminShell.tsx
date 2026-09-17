'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import ThemeSwitcher from './ThemeSwitcher'

type AdminProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  status: string | null
}

type AdminShellProps = {
  children: ReactNode
  searchPlaceholder?: string
  onSearch?: (value: string) => void
  searchValue?: string
}

type NavItem = {
  label: string
  path: string
  icon: string
  superAdminOnly?: boolean
}

const MAIN_MENU: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: '⌂' },
  { label: 'Members', path: '/admin/members', icon: '◎' },
  { label: 'Products', path: '/admin/products', icon: '▣' },
  { label: 'Content', path: '/admin/content', icon: '▶' },
  { label: 'Member Access', path: '/admin/access', icon: '◇' },
  { label: 'Progress', path: '/admin/progress', icon: '↗' },
  { label: 'Resources', path: '/admin/resources', icon: '◆' },
]

const COMMERCE_MENU: NavItem[] = [
  { label: 'Orders & Transactions', path: '/admin/orders', icon: '▤' },
  { label: 'Payments', path: '/admin/payments', icon: '▥' },
  { label: 'Affiliate & Coupons', path: '/admin/affiliate', icon: '⌘' },
  { label: 'Notifications', path: '/admin/notifications', icon: '○' },
]

const SUPER_ADMIN_MENU: NavItem[] = [
  { label: 'Administrators', path: '/admin/administrators', icon: '♛', superAdminOnly: true },
  { label: 'System Settings', path: '/admin/settings', icon: '⚙', superAdminOnly: true },
  { label: 'Commerce Settings', path: '/admin/commerce-settings', icon: '◇', superAdminOnly: true },
  { label: 'Security / Audit', path: '/admin/security', icon: '◇', superAdminOnly: true },
]

export default function AdminShell({
  children,
  searchPlaceholder = 'Cari member, produk atau materi...',
  onSearch,
  searchValue,
}: AdminShellProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [internalSearch, setInternalSearch] = useState('')

  const search = searchValue ?? internalSearch

  useEffect(() => {
    void loadAdmin()
  }, [])

  async function loadAdmin() {
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
      .select('id, full_name, avatar_url, role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (
      error ||
      !data ||
      data.status !== 'active' ||
      (data.role !== 'admin' && data.role !== 'super_admin')
    ) {
      if (data?.role === 'member') {
        router.replace('/member')
      } else {
        await supabase.auth.signOut()
        router.replace('/login')
      }
      return
    }

    setProfile(data as AdminProfile)
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const displayName =
    profile?.full_name?.trim() || email.split('@')[0] || 'Administrator'

  const initials = useMemo(
    () =>
      displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'A',
    [displayName],
  )

  const isSuperAdmin = profile?.role === 'super_admin'

  function isActive(path: string) {
    if (path === '/admin') return pathname === '/admin'
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  function go(path: string) {
    setMobileOpen(false)
    router.push(path)
  }

  function changeSearch(value: string) {
    if (searchValue === undefined) setInternalSearch(value)
    onSearch?.(value)
  }

  function NavSection({
    title,
    items,
  }: {
    title: string
    items: NavItem[]
  }) {
    const visible = items.filter((item) => !item.superAdminOnly || isSuperAdmin)
    if (!visible.length) return null

    return (
      <>
        <div className="as-menu-title">{title}</div>
        {visible.map((item) => (
          <button
            key={item.path}
            type="button"
            className={`as-menu-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => go(item.path)}
          >
            <i>{item.icon}</i>
            <span>{item.label}</span>
          </button>
        ))}
      </>
    )
  }

  const Navigation = () => (
    <nav className="as-menu">
      <NavSection title="MAIN MENU" items={MAIN_MENU} />
      <NavSection title="COMMERCE" items={COMMERCE_MENU} />
      <NavSection title="SUPER ADMIN" items={SUPER_ADMIN_MENU} />

      <div className="as-menu-title">ACCOUNT</div>
      <button
        type="button"
        className={`as-menu-item ${isActive('/admin/profile') ? 'active' : ''}`}
        onClick={() => go('/admin/profile')}
      >
        <i>◉</i>
        <span>Profile</span>
      </button>
    </nav>
  )

  if (loading) {
    return (
      <>
        <main className="as-loading">
          <ThemeSwitcher />
          <div className="as-loading-box">
            <div className="as-brand-logo">S</div>
            <h2>iMersSUPA</h2>
            <p>Menyiapkan Admin...</p>
          </div>
        </main>
        <AdminShellStyles />
      </>
    )
  }

  return (
    <>
      <div className="as-shell">
        <ThemeSwitcher />

        <aside className="as-sidebar">
          <div className="as-sidebar-scroll">
            <Brand />

            <div className="as-role-card">
              <div className="as-role-icon">{isSuperAdmin ? '★' : '◆'}</div>
              <div>
                <span>LOGGED IN AS</span>
                <strong>{isSuperAdmin ? 'Super Admin' : 'Administrator'}</strong>
              </div>
            </div>

            <Navigation />
          </div>

          <div className="as-sidebar-bottom">
            <button
              type="button"
              className="as-sidebar-profile"
              onClick={() => go('/admin/profile')}
            >
              <Avatar url={profile?.avatar_url} initials={initials} />
              <span>
                <strong>{displayName}</strong>
                <small>{isSuperAdmin ? 'Super Admin' : 'Admin'}</small>
              </span>
            </button>

            <button type="button" className="as-logout" onClick={logout}>
              ↗ Keluar
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <div className="as-mobile-overlay" onClick={() => setMobileOpen(false)}>
            <aside
              className="as-mobile-sidebar"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="as-mobile-head">
                <Brand />
                <button type="button" onClick={() => setMobileOpen(false)}>
                  ×
                </button>
              </div>

              <div className="as-mobile-scroll">
                <div className="as-role-card">
                  <div className="as-role-icon">{isSuperAdmin ? '★' : '◆'}</div>
                  <div>
                    <span>LOGGED IN AS</span>
                    <strong>{isSuperAdmin ? 'Super Admin' : 'Administrator'}</strong>
                  </div>
                </div>
                <Navigation />
              </div>

              <button type="button" className="as-mobile-logout" onClick={logout}>
                Keluar dari Akun
              </button>
            </aside>
          </div>
        )}

        <main className="as-main">
          <header className="as-topbar">
            <div className="as-mobile-brand">
              <button
                type="button"
                className="as-mobile-menu"
                onClick={() => setMobileOpen(true)}
              >
                ☰
              </button>
              <strong>iMersSUPA</strong>
            </div>

            <div className="as-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder={searchPlaceholder}
              />
              {search && (
                <button type="button" onClick={() => changeSearch('')}>
                  ×
                </button>
              )}
            </div>

            <div className="as-top-actions">
              <button
                type="button"
                className="as-notification"
                title="Notification Center"
                onClick={() => go('/admin/notifications')}
              >
                ♢
                <i />
              </button>

              <button
                type="button"
                className="as-profile-button"
                onClick={() => go('/admin/profile')}
              >
                <Avatar url={profile?.avatar_url} initials={initials} />
                <span>
                  <strong>{displayName}</strong>
                  <small>{isSuperAdmin ? 'Super Admin' : 'Admin'}</small>
                </span>
              </button>
            </div>
          </header>

          <div className="as-content">{children}</div>
        </main>
      </div>

      <AdminShellStyles />
    </>
  )
}

function Brand() {
  return (
    <div className="as-brand">
      <div className="as-brand-logo">S</div>
      <div>
        <strong>iMersSUPA</strong>
        <span>ADMIN CONTROL</span>
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
    <div className="as-avatar">
      {url ? <img src={url} alt="Avatar" /> : initials}
    </div>
  )
}

function AdminShellStyles() {
  return (
    <style jsx global>{`
      .as-shell{min-height:100vh;display:grid;grid-template-columns:248px minmax(0,1fr);color:var(--text-primary);background:var(--page-gradient)}
      .as-sidebar{position:fixed;inset:0 auto 0 0;width:248px;height:100vh;padding:23px 17px 17px;display:flex;flex-direction:column;border-right:1px solid var(--border);background:var(--sidebar-bg);backdrop-filter:blur(20px);z-index:40;overflow:hidden}
      .as-sidebar-scroll{min-height:0;flex:1;overflow-y:auto;overflow-x:hidden;padding-right:3px;scrollbar-width:thin;scrollbar-color:rgba(99,102,241,.24) transparent}
      .as-sidebar-scroll::-webkit-scrollbar{width:5px}.as-sidebar-scroll::-webkit-scrollbar-track{background:transparent}.as-sidebar-scroll::-webkit-scrollbar-thumb{background:rgba(99,102,241,.22);border-radius:20px}
      .as-brand{display:flex;align-items:center;gap:10px}.as-brand-logo{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:14px;color:#fff;font-size:18px;font-weight:950;background:var(--primary-gradient);box-shadow:0 13px 30px rgba(79,70,229,.25)}
      .as-brand>div:last-child{display:grid;gap:2px}.as-brand strong{font-size:15px;letter-spacing:-.4px}.as-brand span{color:var(--text-muted);font-size:10px;font-weight:900;letter-spacing:1.3px}
      .as-role-card{margin-top:25px;padding:11px;display:flex;align-items:center;gap:9px;border:1px solid var(--border);border-radius:14px;background:var(--card-gradient)}
      .as-role-icon{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:10px;color:#c4b5fd;background:rgba(99,102,241,.12)}
      .as-role-card>div:last-child{display:grid;gap:2px}.as-role-card span{color:var(--text-muted);font-size:10px;font-weight:900;letter-spacing:1px}.as-role-card strong{font-size:12px}
      .as-menu{margin-top:22px;display:grid;gap:4px;padding-bottom:14px}.as-menu-title{margin:13px 10px 7px;color:var(--text-soft);font-size:10px;font-weight:950;letter-spacing:1.35px}.as-menu-title:first-child{margin-top:0}
      .as-menu-item{width:100%;padding:8px 10px;display:flex;align-items:center;gap:9px;border:1px solid transparent;border-radius:11px;cursor:pointer;color:var(--text-muted);text-align:left;font-size:13px;font-weight:750;background:transparent;transition:.2s ease}
      .as-menu-item i{width:27px;height:27px;flex:0 0 27px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:var(--accent-light);font-style:normal;background:rgba(99,102,241,.09)}
      .as-menu-item:hover,.as-menu-item.active{color:var(--text-primary);border-color:var(--border-strong);background:var(--card-gradient)}
      .as-sidebar-bottom{flex:0 0 auto;padding-top:10px;display:grid;gap:8px;background:var(--sidebar-bg)}
      .as-sidebar-profile{width:100%;padding:9px;display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:13px;cursor:pointer;color:var(--text-primary);text-align:left;background:var(--card-gradient)}
      .as-avatar{width:35px;height:35px;flex:0 0 auto;overflow:hidden;display:flex;align-items:center;justify-content:center;border-radius:11px;color:#fff;font-size:10px;font-weight:950;background:var(--primary-gradient)}
      .as-avatar img{width:100%;height:100%;object-fit:cover}.as-sidebar-profile>span,.as-profile-button>span{min-width:0;display:grid;gap:1px}.as-sidebar-profile strong,.as-profile-button strong{max-width:135px;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.as-sidebar-profile small,.as-profile-button small{color:var(--text-muted);font-size:11px}
      .as-logout{height:38px;border:1px solid rgba(239,68,68,.16);border-radius:11px;color:#dc2626;background:rgba(254,226,226,.58);font-size:12px;font-weight:850;cursor:pointer}
      .as-main{min-width:0;min-height:100vh;margin-left:248px}.as-topbar{height:64px;padding:0 28px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:30;border-bottom:1px solid var(--border);background:var(--topbar-bg);backdrop-filter:blur(18px)}
      .as-search{position:relative;width:min(390px,48vw);height:39px;padding:0 13px;display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:12px;background:var(--input-bg)}
      .as-search>span{color:var(--text-muted);font-size:15px}.as-search input{width:100%;border:0;outline:0;color:var(--text-primary);font-size:13px;background:transparent}.as-search input::placeholder{color:var(--text-soft)}.as-search button{border:0;color:var(--text-muted);background:transparent;cursor:pointer;font-size:18px}
      .as-top-actions{margin-left:auto;display:flex;align-items:center;gap:9px;padding-right:78px}.as-notification{position:relative;width:39px;height:39px;border:1px solid var(--border);border-radius:12px;color:var(--text-muted);background:var(--card-gradient);cursor:pointer}.as-notification i{position:absolute;right:8px;top:7px;width:5px;height:5px;border-radius:50%;background:#6366f1}
      .as-profile-button{max-width:210px;padding:5px 9px 5px 6px;display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:12px;color:var(--text-primary);text-align:left;background:var(--card-gradient);cursor:pointer}
      .as-content{min-width:0;padding:28px 34px 70px}.as-mobile-brand,.as-mobile-menu{display:none}.as-mobile-overlay{display:none}
      .as-loading{min-height:100vh;display:grid;place-items:center;background:var(--page-gradient)}.as-loading-box{text-align:center}.as-loading-box .as-brand-logo{margin:0 auto 12px}.as-loading-box h2{margin:0;font-size:20px}.as-loading-box p{margin:6px 0 0;color:var(--text-muted);font-size:13px}
      @media(max-width:900px){.as-shell{display:block}.as-sidebar{display:none}.as-main{margin-left:0}.as-topbar{padding:0 16px}.as-mobile-brand{display:flex;align-items:center;gap:9px}.as-mobile-menu{display:block;border:0;background:transparent;color:var(--text-primary);font-size:21px;cursor:pointer}.as-search{width:min(420px,calc(100vw - 230px))}.as-top-actions{padding-right:68px}.as-profile-button>span{display:none}.as-profile-button{padding:4px}.as-content{padding:22px 16px 60px}.as-mobile-overlay{position:fixed;inset:0;display:block;background:rgba(15,23,42,.34);z-index:100}.as-mobile-sidebar{width:min(310px,88vw);height:100%;padding:18px 15px;display:flex;flex-direction:column;background:var(--sidebar-bg);box-shadow:30px 0 80px rgba(15,23,42,.18)}.as-mobile-head{display:flex;align-items:flex-start;justify-content:space-between}.as-mobile-head>button{border:0;color:var(--text-muted);background:transparent;font-size:28px;cursor:pointer}.as-mobile-scroll{min-height:0;flex:1;overflow-y:auto;overflow-x:hidden}.as-mobile-logout{flex:0 0 auto;height:40px;border:1px solid rgba(239,68,68,.16);border-radius:11px;color:#dc2626;background:rgba(254,226,226,.58);font-size:13px;font-weight:850;cursor:pointer}}
      @media(max-width:600px){.as-topbar{height:58px;gap:8px}.as-mobile-brand strong{display:none}.as-search{width:calc(100vw - 150px)}.as-top-actions{padding-right:52px}.as-notification{display:none}.as-content{padding:18px 12px 50px}}
    `}</style>
  )
}

'use client'

import { ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import ThemeSwitcher from './ThemeSwitcher'

type MemberShellProps = {
  children: ReactNode
  email?: string
  displayName?: string
  active?: 'dashboard' | 'products' | 'learning' | 'resources' | 'profile'
}

export default function MemberShell({
  children,
  email = '',
  displayName,
  active = 'dashboard',
}: MemberShellProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const name = displayName || email.split('@')[0] || 'Member'
  const initial = name.trim().charAt(0).toUpperCase() || 'M'

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function go(path: string) {
    setMenuOpen(false)
    router.push(path)
  }

  const nav = (
    <>
      <button className={`ms-nav ${active === 'dashboard' ? 'active' : ''}`} onClick={() => go('/member')}>
        <span className="ms-nav-icon">⌂</span><span>Dashboard</span>
      </button>
      <button className={`ms-nav ${active === 'products' ? 'active' : ''}`} onClick={() => go('/member?view=products')}>
        <span className="ms-nav-icon">▣</span><span>Produk Saya</span>
      </button>
      <button className={`ms-nav ${active === 'learning' ? 'active' : ''}`} onClick={() => go('/member?view=learning')}>
        <span className="ms-nav-icon">▶</span><span>Lanjut Belajar</span>
      </button>
      <button className={`ms-nav ${active === 'resources' ? 'active' : ''}`} onClick={() => go('/member?view=resources')}>
        <span className="ms-nav-icon">◆</span><span>Resources</span>
      </button>
      <button className={`ms-nav ${active === 'profile' ? 'active' : ''}`} onClick={() => go('/member')}>
        <span className="ms-nav-icon">◎</span><span>Profile & Account</span>
      </button>
    </>
  )

  return (
    <div className="ms-shell">
      <ThemeSwitcher />

      <aside className="ms-sidebar">
        <div>
          <div className="ms-brand">
            <div className="ms-logo">S</div>
            <div>
              <div className="ms-brand-name">iMersSUPA</div>
              <div className="ms-brand-caption">MEMBER AREA</div>
            </div>
          </div>
          <div className="ms-label">MAIN MENU</div>
          <nav className="ms-nav-list">{nav}</nav>
        </div>

        <div className="ms-bottom">
          <div className="ms-profile">
            <div className="ms-avatar">{initial}</div>
            <div className="ms-profile-copy">
              <strong>{name}</strong>
              <span>{email || 'Member Area'}</span>
            </div>
          </div>
          <button className="ms-logout" onClick={logout}>↗ <span>Keluar</span></button>
        </div>
      </aside>

      {menuOpen && (
        <div className="ms-overlay" onClick={() => setMenuOpen(false)}>
          <aside className="ms-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="ms-drawer-head">
              <div className="ms-brand">
                <div className="ms-logo">S</div>
                <div>
                  <div className="ms-brand-name">iMersSUPA</div>
                  <div className="ms-brand-caption">MEMBER AREA</div>
                </div>
              </div>
              <button className="ms-close" onClick={() => setMenuOpen(false)}>×</button>
            </div>
            <div className="ms-label">MAIN MENU</div>
            <nav className="ms-nav-list">{nav}</nav>
          </aside>
        </div>
      )}

      <div className="ms-workspace">
        <header className="ms-topbar">
          <button className="ms-menu" onClick={() => setMenuOpen(true)}>☰</button>
          <button className="ms-search" onClick={() => router.push('/member')}>
            <span>⌕</span><span>Cari produk atau materi...</span>
          </button>
          <div className="ms-top-user">
            <div className="ms-avatar small">{initial}</div>
            <div><strong>{name}</strong><span>Member</span></div>
          </div>
        </header>
        <div className="ms-content">{children}</div>
      </div>

      <style jsx global>{`
        .ms-shell{min-height:100vh;background:radial-gradient(circle at 18% 0%,#dcecff 0%,#f6f4ff 43%,#f9f7ff 100%);color:#111827;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ms-sidebar{position:fixed;inset:0 auto 0 0;width:230px;padding:20px 15px 16px;display:flex;flex-direction:column;justify-content:space-between;background:rgba(255,255,255,.82);border-right:1px solid rgba(99,102,241,.12);backdrop-filter:blur(18px);z-index:40}.ms-brand{display:flex;align-items:center;gap:10px;padding:2px 0 22px}.ms-logo{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;color:#fff;font-size:17px;font-weight:900;background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 10px 24px rgba(79,70,229,.22)}.ms-brand-name{font-size:15px;font-weight:900;line-height:1.1}.ms-brand-caption,.ms-label{font-size:11px;font-weight:900;letter-spacing:1.35px;color:#64748b}.ms-label{margin:10px 8px 8px}.ms-nav-list{display:grid;gap:5px}.ms-nav{width:100%;min-height:44px;padding:8px 10px;display:flex;align-items:center;gap:10px;border:1px solid transparent;border-radius:12px;background:transparent;color:#5b6b83;font-size:13.5px;font-weight:800;text-align:left;cursor:pointer}.ms-nav:hover,.ms-nav.active{color:#312e81;border-color:rgba(99,102,241,.16);background:linear-gradient(135deg,rgba(219,234,254,.8),rgba(237,233,254,.82))}.ms-nav-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;color:#6366f1;background:rgba(99,102,241,.08);font-size:13px}.ms-bottom{display:grid;gap:8px}.ms-profile{display:flex;align-items:center;gap:9px;padding:9px;border:1px solid rgba(99,102,241,.13);border-radius:13px;background:rgba(255,255,255,.7)}.ms-avatar{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:900;background:linear-gradient(135deg,#2563eb,#7c3aed)}.ms-avatar.small{width:31px;height:31px}.ms-profile-copy,.ms-top-user>div:last-child{min-width:0;display:flex;flex-direction:column}.ms-profile-copy strong,.ms-top-user strong{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ms-profile-copy span,.ms-top-user span{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ms-logout{height:38px;border:1px solid rgba(239,68,68,.12);border-radius:11px;color:#dc2626;background:rgba(254,226,226,.62);font-size:12.5px;font-weight:850;cursor:pointer}.ms-workspace{min-height:100vh;margin-left:230px}.ms-topbar{height:64px;padding:0 28px;display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.68);border-bottom:1px solid rgba(99,102,241,.10);backdrop-filter:blur(16px);position:sticky;top:0;z-index:25}.ms-search{width:min(390px,48vw);height:39px;padding:0 14px;display:flex;align-items:center;gap:9px;border:1px solid rgba(99,102,241,.14);border-radius:12px;background:rgba(255,255,255,.55);color:#64748b;font-size:13px;cursor:pointer}.ms-top-user{margin-left:auto;margin-right:126px;display:flex;align-items:center;gap:8px}.ms-menu{display:none;border:0;background:transparent;font-size:22px;cursor:pointer}.ms-content{padding:28px 34px 70px}.ms-overlay{display:none}.ms-drawer{width:min(300px,88vw);height:100%;padding:18px;background:#fff}.ms-drawer-head{display:flex;align-items:flex-start;justify-content:space-between}.ms-close{border:0;background:transparent;font-size:28px;cursor:pointer;color:#64748b}
        @media(max-width:900px){.ms-sidebar{display:none}.ms-workspace{margin-left:0}.ms-menu{display:block}.ms-topbar{padding:0 16px}.ms-top-user{display:none}.ms-search{width:min(440px,calc(100vw - 80px))}.ms-content{padding:22px 16px 60px}.ms-overlay{position:fixed;inset:0;display:block;background:rgba(15,23,42,.34);z-index:100}.ms-drawer{box-shadow:30px 0 80px rgba(15,23,42,.18)}}
        @media(max-width:560px){.ms-content{padding:18px 12px 48px}.ms-topbar{height:58px}.ms-search{font-size:12px}.ms-nav{font-size:14px}}
      `}</style>
    </div>
  )
}

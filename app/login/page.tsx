'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import ThemeSwitcher from '../../components/ThemeSwitcher'

type Profile = {
  id: string
  full_name: string | null
  role: 'super_admin' | 'admin' | 'member' | string | null
  status: 'active' | 'inactive' | 'suspended' | string | null
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const [error, setError] = useState('')

  // ==========================================================
  // CHECK EXISTING SESSION
  // ==========================================================

  useEffect(() => {
    checkExistingSession()
  }, [])

  async function checkExistingSession() {
    setCheckingSession(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setCheckingSession(false)
      return
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('id, full_name, role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      setCheckingSession(false)
      return
    }

    const typedProfile = profile as Profile

    if (typedProfile.status !== 'active') {
      await supabase.auth.signOut()
      setCheckingSession(false)
      return
    }

    redirectByRole(typedProfile.role)
  }

  // ==========================================================
  // ROLE ROUTING
  // ==========================================================

  function redirectByRole(role: string | null) {
    if (role === 'super_admin' || role === 'admin') {
      router.replace('/admin')
      router.refresh()
      return
    }

    if (role === 'agency') {
      router.replace('/agency')
      router.refresh()
      return
    }

    router.replace('/member')
    router.refresh()
  }

  // ==========================================================
  // LOGIN
  // ==========================================================

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setError('Email wajib diisi.')
      return
    }

    if (!password) {
      setError('Password wajib diisi.')
      return
    }

    setLoading(true)

    const {
      data: authData,
      error: loginError,
    } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (loginError) {
      setError(
        getFriendlyError(loginError.message)
      )
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError(
        'Login gagal. Silakan coba kembali.'
      )
      setLoading(false)
      return
    }

    // ========================================================
    // GET PROFILE
    // ========================================================

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('id, full_name, role, status')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (profileError) {
      await supabase.auth.signOut()

      setError(
        'Profil akun tidak dapat diperiksa. Silakan coba kembali.'
      )

      setLoading(false)
      return
    }

    if (!profile) {
      await supabase.auth.signOut()

      setError(
        'Profil akun tidak ditemukan. Silakan hubungi administrator.'
      )

      setLoading(false)
      return
    }

    const typedProfile = profile as Profile

    // ========================================================
    // CHECK ACCOUNT STATUS
    // ========================================================

    if (typedProfile.status !== 'active') {
      await supabase.auth.signOut()

      if (typedProfile.status === 'suspended') {
        setError(
          'Akun Anda sedang ditangguhkan. Silakan hubungi administrator.'
        )
      } else if (
        typedProfile.status === 'inactive'
      ) {
        setError(
          'Akun Anda sedang tidak aktif. Silakan hubungi administrator.'
        )
      } else {
        setError(
          'Akun Anda belum dapat digunakan. Silakan hubungi administrator.'
        )
      }

      setLoading(false)
      return
    }

    // ========================================================
    // CHECK ROLE
    // ========================================================

    if (
      typedProfile.role !== 'super_admin' &&
      typedProfile.role !== 'admin' &&
      typedProfile.role !== 'agency' &&
      typedProfile.role !== 'member'
    ) {
      await supabase.auth.signOut()

      setError(
        'Role akun tidak valid. Silakan hubungi administrator.'
      )

      setLoading(false)
      return
    }

    // ========================================================
    // LOGIN SUCCESS → REDIRECT BY ROLE
    // ========================================================

    redirectByRole(typedProfile.role)
  }

  // ==========================================================
  // FRIENDLY ERROR
  // ==========================================================

  function getFriendlyError(message: string) {
    const normalized = message.toLowerCase()

    if (
      normalized.includes(
        'invalid login credentials'
      ) ||
      normalized.includes(
        'invalid credentials'
      )
    ) {
      return 'Email atau password salah.'
    }

    if (
      normalized.includes(
        'email not confirmed'
      )
    ) {
      return 'Email belum dikonfirmasi.'
    }

    if (
      normalized.includes(
        'too many requests'
      )
    ) {
      return 'Terlalu banyak percobaan login. Silakan coba kembali beberapa saat lagi.'
    }

    return message
  }

  // ==========================================================
  // LOADING SESSION
  // ==========================================================

  if (checkingSession) {
    return (
      <>
        <main className="loading-page">
          <div className="loading-card">
            <div className="brand-icon">
              S
            </div>

            <h2>iMersSUPA</h2>

            <p>
              Memeriksa akun...
            </p>

            <div className="loading-line">
              <span />
            </div>
          </div>
        </main>

        <LoginStyles />
      </>
    )
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <>
      <main className="login-page">
        <ThemeSwitcher />
        
        <div className="glow glow-one" />
        <div className="glow glow-two" />
        <div className="glow glow-three" />

        <div className="login-layout">

          {/* ==================================================
              LEFT SIDE
          ================================================== */}

          <section className="brand-side">
            <div className="brand-content">

              <div className="brand-header">
                <div className="brand-icon">
                  S
                </div>

                <div>
                  <div className="brand-name">
                    iMersSUPA
                  </div>

                  <div className="brand-caption">
                    MEMBERSHIP PLATFORM
                  </div>
                </div>
              </div>

              <div className="hero-badge">
                DIGITAL MEMBER EXPERIENCE
              </div>

              <h1>
                Semua produk digital.
                <br />

                <span>
                  Satu member area.
                </span>
              </h1>

              <p className="hero-description">
                Akses produk, materi pembelajaran,
                resource, progress belajar dan semua
                konten digital Anda dalam satu
                platform.
              </p>

              <div className="feature-grid">

                <div className="feature-card">
                  <div className="feature-icon">
                    ◇
                  </div>

                  <div>
                    <strong>
                      Secure Access
                    </strong>

                    <span>
                      Akses berdasarkan akun dan
                      entitlement.
                    </span>
                  </div>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">
                    ✓
                  </div>

                  <div>
                    <strong>
                      Learning Progress
                    </strong>

                    <span>
                      Progress belajar tersimpan
                      otomatis.
                    </span>
                  </div>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">
                    ▶
                  </div>

                  <div>
                    <strong>
                      Continue Learning
                    </strong>

                    <span>
                      Lanjut langsung ke materi
                      berikutnya.
                    </span>
                  </div>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">
                    ◆
                  </div>

                  <div>
                    <strong>
                      Digital Resources
                    </strong>

                    <span>
                      Bonus dan resource dalam satu
                      tempat.
                    </span>
                  </div>
                </div>

              </div>

              <div className="role-note">
                <span className="role-dot" />

                <span>
                  Satu halaman login untuk Member,
                  Agency, Admin dan Super Admin.
                </span>
              </div>

            </div>
          </section>

          {/* ==================================================
              LOGIN CARD
          ================================================== */}

          <section className="form-side">

            <div className="login-card">

              <div className="mobile-brand">
                <div className="mobile-logo">
                  S
                </div>

                <div>
                  <strong>
                    iMersSUPA
                  </strong>

                  <span>
                    MEMBERSHIP PLATFORM
                  </span>
                </div>
              </div>

              <div className="eyebrow">
                WELCOME BACK
              </div>

              <h2>
                Masuk ke akun Anda
              </h2>

              <p className="login-description">
                Masukkan email dan password untuk
                melanjutkan ke dashboard.
              </p>

              <form
                onSubmit={handleLogin}
                className="login-form"
              >

                {/* ============================================
                    EMAIL
                ============================================ */}

                <div className="form-group">
                  <label>
                    Email
                  </label>

                  <div className="input-box">
                    <div className="input-icon">
                      @
                    </div>

                    <input
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(
                          event.target.value
                        )
                      }
                      placeholder="nama@email.com"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* ============================================
                    PASSWORD
                ============================================ */}

                <div className="form-group">

                  <div className="password-heading">
                    <label>
                      Password
                    </label>

                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() =>
                        router.push(
                          '/forgot-password'
                        )
                      }
                    >
                      Lupa Password?
                    </button>
                  </div>

                  <div className="input-box">
                    <div className="input-icon">
                      ●
                    </div>

                    <input
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      placeholder="Masukkan password"
                      autoComplete="current-password"
                      disabled={loading}
                    />

                    <button
                      type="button"
                      className="show-password"
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current
                        )
                      }
                    >
                      {showPassword
                        ? 'SEMBUNYIKAN'
                        : 'LIHAT'}
                    </button>
                  </div>
                </div>

                {/* ============================================
                    ERROR
                ============================================ */}

                {error && (
                  <div className="error-message">
                    <div className="error-icon">
                      !
                    </div>

                    <div>
                      <strong>
                        Login belum berhasil
                      </strong>

                      <span>
                        {error}
                      </span>
                    </div>
                  </div>
                )}

                {/* ============================================
                    LOGIN BUTTON
                ============================================ */}

                <button
                  type="submit"
                  disabled={loading}
                  className="login-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Memproses Login...
                    </>
                  ) : (
                    <>
                      Masuk ke Dashboard
                      <span>→</span>
                    </>
                  )}
                </button>

              </form>

              {/* ==============================================
                  SECURITY
              ============================================== */}

              <div className="security-card">
                <div className="security-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    Secure Authentication
                  </strong>

                  <span>
                    Login dilindungi Supabase Auth
                    dan Row Level Security.
                  </span>
                </div>
              </div>

              <div className="login-footer">
                © {new Date().getFullYear()}{' '}
                iMersSUPA
              </div>

            </div>
          </section>

        </div>
      </main>

      <LoginStyles />
    </>
  )
}

// ============================================================
// CSS
// ============================================================

function LoginStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
      }

      body {
        color: #ffffff;
        background: #030712;
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
        -webkit-tap-highlight-color:
          transparent;
      }

      .login-page {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        background:
          radial-gradient(
            circle at 10% 0%,
            rgba(30, 64, 175, 0.34),
            transparent 37%
          ),
          radial-gradient(
            circle at 90% 100%,
            rgba(88, 28, 135, 0.28),
            transparent 38%
          ),
          linear-gradient(
            145deg,
            #030712,
            #070b18 48%,
            #080b19
          );
      }

      .glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(50px);
        pointer-events: none;
      }

      .glow-one {
        width: 420px;
        height: 420px;
        top: -270px;
        left: 15%;
        background:
          rgba(37, 99, 235, 0.2);
      }

      .glow-two {
        width: 480px;
        height: 480px;
        right: -300px;
        bottom: -220px;
        background:
          rgba(124, 58, 237, 0.2);
      }

      .glow-three {
        width: 280px;
        height: 280px;
        left: 48%;
        top: 40%;
        background:
          rgba(79, 70, 229, 0.08);
      }

      .login-layout {
        position: relative;
        z-index: 2;
        width: 100%;
        max-width: 1300px;
        min-height: 100vh;
        margin: 0 auto;
        display: grid;
        grid-template-columns:
          minmax(0, 1.15fr)
          minmax(380px, 0.85fr);
      }

      /* ==============================================
         BRAND SIDE
      ============================================== */

      .brand-side {
        padding: 55px 55px;
        display: flex;
        align-items: center;
      }

      .brand-content {
        width: 100%;
        max-width: 660px;
      }

      .brand-header {
        margin-bottom: 55px;
        display: flex;
        align-items: center;
        gap: 13px;
      }

      .brand-icon {
        width: 54px;
        height: 54px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 18px;
        color: #ffffff;
        font-size: 23px;
        font-weight: 950;
        background:
          linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
        box-shadow:
          0 18px 45px
          rgba(79, 70, 229, 0.3);
      }

      .brand-name {
        font-size: 20px;
        font-weight: 950;
        letter-spacing: -0.5px;
      }

      .brand-caption {
        margin-top: 2px;
        color: #64748b;
        font-size: 7px;
        font-weight: 950;
        letter-spacing: 1.8px;
      }

      .hero-badge {
        width: fit-content;
        padding: 7px 11px;
        border: 1px solid
          rgba(99, 102, 241, 0.15);
        border-radius: 999px;
        color: #a5b4fc;
        font-size: 8px;
        font-weight: 950;
        letter-spacing: 1.5px;
        background:
          linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.13),
            rgba(124, 58, 237, 0.09)
          );
      }

      .brand-side h1 {
        margin: 17px 0 18px;
        max-width: 650px;
        font-size:
          clamp(40px, 5vw, 68px);
        line-height: 1.02;
        letter-spacing: -2.5px;
      }

      .brand-side h1 span {
        background:
          linear-gradient(
            90deg,
            #93c5fd,
            #c4b5fd,
            #f0abfc
          );
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .hero-description {
        max-width: 570px;
        margin: 0;
        color: #94a3b8;
        font-size: 13px;
        line-height: 1.8;
      }

      .feature-grid {
        margin-top: 30px;
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .feature-card {
        min-height: 78px;
        padding: 13px;
        display: flex;
        align-items: center;
        gap: 11px;
        border: 1px solid
          rgba(255, 255, 255, 0.065);
        border-radius: 16px;
        background:
          linear-gradient(
            135deg,
            rgba(30, 64, 175, 0.11),
            rgba(88, 28, 135, 0.07),
            rgba(15, 23, 42, 0.5)
          );
        backdrop-filter: blur(12px);
      }

      .feature-icon {
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        color: #c4b5fd;
        font-weight: 900;
        background:
          linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.18),
            rgba(124, 58, 237, 0.18)
          );
      }

      .feature-card > div:last-child {
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .feature-card strong {
        color: #e2e8f0;
        font-size: 9px;
      }

      .feature-card span {
        color: #64748b;
        font-size: 7px;
        line-height: 1.45;
      }

      .role-note {
        margin-top: 23px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #475569;
        font-size: 8px;
      }

      .role-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow:
          0 0 12px
          rgba(34, 197, 94, 0.5);
      }

      /* ==============================================
         FORM SIDE
      ============================================== */

      .form-side {
        padding: 45px 35px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .login-card {
        width: 100%;
        max-width: 455px;
        padding: 36px 34px;
        border: 1px solid
          rgba(255, 255, 255, 0.095);
        border-radius: 28px;
        background:
          radial-gradient(
            circle at top right,
            rgba(79, 70, 229, 0.12),
            transparent 32%
          ),
          linear-gradient(
            145deg,
            rgba(30, 41, 59, 0.84),
            rgba(15, 23, 42, 0.92),
            rgba(30, 27, 75, 0.72)
          );
        box-shadow:
          0 35px 90px
          rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(22px);
      }

      .mobile-brand {
        display: none;
      }

      .eyebrow {
        color: #818cf8;
        font-size: 8px;
        font-weight: 950;
        letter-spacing: 1.7px;
      }

      .login-card h2 {
        margin: 7px 0 7px;
        font-size: 29px;
        letter-spacing: -0.9px;
      }

      .login-description {
        margin: 0;
        color: #64748b;
        font-size: 10px;
        line-height: 1.6;
      }

      .login-form {
        margin-top: 27px;
        display: grid;
        gap: 17px;
      }

      .form-group label {
        display: block;
        margin-bottom: 7px;
        color: #cbd5e1;
        font-size: 9px;
        font-weight: 850;
      }

      .password-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
      }

      .forgot-link {
        margin: 0 0 7px;
        padding: 0;
        border: 0;
        cursor: pointer;
        color: #a5b4fc;
        font-size: 8px;
        font-weight: 850;
        background: transparent;
      }

      .forgot-link:hover {
        color: #c4b5fd;
      }

      .input-box {
        min-height: 48px;
        display: flex;
        align-items: center;
        overflow: hidden;
        border: 1px solid
          rgba(148, 163, 184, 0.12);
        border-radius: 14px;
        background:
          linear-gradient(
            135deg,
            rgba(15, 23, 42, 0.78),
            rgba(30, 41, 59, 0.58)
          );
        transition:
          border-color 0.2s ease,
          box-shadow 0.2s ease;
      }

      .input-box:focus-within {
        border-color:
          rgba(99, 102, 241, 0.42);
        box-shadow:
          0 0 0 3px
          rgba(99, 102, 241, 0.07);
      }

      .input-icon {
        width: 45px;
        flex: 0 0 auto;
        color: #818cf8;
        text-align: center;
        font-size: 11px;
        font-weight: 950;
      }

      .input-box input {
        width: 100%;
        min-width: 0;
        padding: 14px 8px 14px 0;
        border: 0;
        outline: 0;
        color: #ffffff;
        font-size: 11px;
        background: transparent;
      }

      .input-box input::placeholder {
        color: #475569;
      }

      .input-box input:disabled {
        opacity: 0.6;
      }

      .show-password {
        align-self: stretch;
        padding: 0 13px;
        border: 0;
        cursor: pointer;
        color: #818cf8;
        font-size: 7px;
        font-weight: 950;
        background: transparent;
      }

      .show-password:hover {
        color: #c4b5fd;
      }

      .error-message {
        padding: 12px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        border: 1px solid
          rgba(239, 68, 68, 0.13);
        border-radius: 13px;
        color: #fecaca;
        background:
          linear-gradient(
            135deg,
            rgba(127, 29, 29, 0.22),
            rgba(69, 10, 10, 0.1)
          );
      }

      .error-icon {
        width: 26px;
        height: 26px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color: #fca5a5;
        font-size: 10px;
        font-weight: 950;
        background:
          rgba(239, 68, 68, 0.12);
      }

      .error-message > div:last-child {
        display: grid;
        gap: 3px;
      }

      .error-message strong {
        font-size: 9px;
      }

      .error-message span {
        color: #fca5a5;
        font-size: 8px;
        line-height: 1.45;
      }

      .login-button {
        width: 100%;
        min-height: 48px;
        padding: 12px 17px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        border: 0;
        border-radius: 14px;
        cursor: pointer;
        color: #ffffff;
        font-size: 10px;
        font-weight: 900;
        background:
          linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
        box-shadow:
          0 16px 38px
          rgba(79, 70, 229, 0.23);
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }

      .login-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow:
          0 20px 45px
          rgba(79, 70, 229, 0.3);
      }

      .login-button:disabled {
        cursor: wait;
        opacity: 0.65;
      }

      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid
          rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation:
          spin 0.75s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .security-card {
        margin-top: 20px;
        padding: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid
          rgba(34, 197, 94, 0.09);
        border-radius: 14px;
        background:
          linear-gradient(
            135deg,
            rgba(6, 78, 59, 0.17),
            rgba(15, 23, 42, 0.2)
          );
      }

      .security-icon {
        width: 31px;
        height: 31px;
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        color: #86efac;
        font-size: 10px;
        font-weight: 950;
        background:
          rgba(34, 197, 94, 0.1);
      }

      .security-card > div:last-child {
        display: grid;
        gap: 2px;
      }

      .security-card strong {
        color: #d1fae5;
        font-size: 8px;
      }

      .security-card span {
        color: #64748b;
        font-size: 7px;
        line-height: 1.4;
      }

      .login-footer {
        margin-top: 20px;
        color: #334155;
        text-align: center;
        font-size: 7px;
      }

      /* ==============================================
         LOADING
      ============================================== */

      .loading-page {
        min-height: 100vh;
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
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
        border: 1px solid
          rgba(255, 255, 255, 0.08);
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
        font-size: 9px;
      }

      .loading-line {
        width: 100%;
        height: 4px;
        margin-top: 20px;
        overflow: hidden;
        border-radius: 999px;
        background:
          rgba(255, 255, 255, 0.05);
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
        animation:
          loadingMove 1.1s
          infinite ease-in-out;
      }

      @keyframes loadingMove {
        0% {
          transform:
            translateX(-100%);
        }

        100% {
          transform:
            translateX(250%);
        }
      }

      /* ==============================================
         RESPONSIVE
      ============================================== */

      @media (max-width: 900px) {
        .login-layout {
          grid-template-columns: 1fr;
        }

        .brand-side {
          display: none;
        }

        .form-side {
          min-height: 100vh;
          padding: 25px 18px;
        }

        .login-card {
          max-width: 480px;
        }

        .mobile-brand {
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mobile-logo {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          font-size: 17px;
          font-weight: 950;
          background:
            linear-gradient(
              135deg,
              #2563eb,
              #7c3aed
            );
        }

        .mobile-brand > div:last-child {
          display: grid;
          gap: 2px;
        }

        .mobile-brand strong {
          font-size: 14px;
        }

        .mobile-brand span {
          color: #64748b;
          font-size: 6px;
          font-weight: 950;
          letter-spacing: 1.3px;
        }
      }

      @media (max-width: 480px) {
        .form-side {
          padding: 15px;
        }

        .login-card {
          padding: 28px 20px;
          border-radius: 23px;
        }

        .login-card h2 {
          font-size: 25px;
        }
      }
    `}</style>
  )
}

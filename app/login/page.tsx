'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

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
    checkSession()
  }, [])

  async function checkSession() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      router.replace('/member')
      return
    }

    setCheckingSession(false)
  }

  // ==========================================================
  // LOGIN
  // ==========================================================

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')

    const cleanEmail = email.trim()

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
      data,
      error: loginError,
    } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (loginError) {
      setError(getFriendlyError(loginError.message))
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Login gagal. Silakan coba kembali.')
      setLoading(false)
      return
    }

    // ========================================================
    // CHECK PROFILE STATUS
    // ========================================================

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', data.user.id)
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

    if (profile.status !== 'active') {
      await supabase.auth.signOut()

      if (profile.status === 'suspended') {
        setError(
          'Akun Anda sedang ditangguhkan. Silakan hubungi administrator.'
        )
      } else {
        setError(
          'Akun Anda belum aktif. Silakan hubungi administrator.'
        )
      }

      setLoading(false)
      return
    }

    // ========================================================
    // LOGIN SUCCESS
    // ========================================================
    // Untuk sementara semua akun yang berhasil login
    // masuk ke member area.
    //
    // Routing Super Admin / Admin akan kita pisahkan
    // saat dashboard admin dibangun.
    // ========================================================

    router.replace('/member')
    router.refresh()
  }

  // ==========================================================
  // FRIENDLY ERROR
  // ==========================================================

  function getFriendlyError(message: string) {
    const normalized = message.toLowerCase()

    if (
      normalized.includes('invalid login credentials') ||
      normalized.includes('invalid credentials')
    ) {
      return 'Email atau password salah.'
    }

    if (normalized.includes('email not confirmed')) {
      return 'Email belum dikonfirmasi.'
    }

    if (normalized.includes('too many requests')) {
      return 'Terlalu banyak percobaan login. Silakan coba kembali beberapa saat lagi.'
    }

    return message
  }

  // ==========================================================
  // CHECKING SESSION
  // ==========================================================

  if (checkingSession) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.brandIcon}>
            S
          </div>

          <div style={styles.loadingText}>
            Memeriksa sesi...
          </div>
        </div>
      </main>
    )
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <main style={styles.page}>
      <div style={styles.backgroundGlowOne}></div>
      <div style={styles.backgroundGlowTwo}></div>

      <div style={styles.wrapper}>

        {/* ====================================================
            BRAND SIDE
        ==================================================== */}

        <section style={styles.brandPanel}>
          <div style={styles.brandContent}>

            <div style={styles.brandHeader}>
              <div style={styles.brandIcon}>
                S
              </div>

              <div>
                <div style={styles.brandName}>
                  iMersSUPA
                </div>

                <div style={styles.brandSmall}>
                  MEMBER PLATFORM
                </div>
              </div>
            </div>

            <div style={styles.heroBadge}>
              DIGITAL MEMBER EXPERIENCE
            </div>

            <h1 style={styles.heroTitle}>
              Semua produk digital Anda.
              <br />
              <span style={styles.heroGradientText}>
                Dalam satu member area.
              </span>
            </h1>

            <p style={styles.heroDescription}>
              Akses produk, materi pembelajaran, resource,
              progress belajar, dan update terbaru dari satu
              dashboard yang aman.
            </p>

            <div style={styles.featureGrid}>
              <div style={styles.featureCard}>
                <div style={styles.featureIcon}>
                  ◇
                </div>

                <div>
                  <div style={styles.featureTitle}>
                    Secure Access
                  </div>

                  <div style={styles.featureText}>
                    Content sesuai akses akun Anda.
                  </div>
                </div>
              </div>

              <div style={styles.featureCard}>
                <div style={styles.featureIcon}>
                  ✓
                </div>

                <div>
                  <div style={styles.featureTitle}>
                    Learning Progress
                  </div>

                  <div style={styles.featureText}>
                    Progress tersimpan otomatis.
                  </div>
                </div>
              </div>

              <div style={styles.featureCard}>
                <div style={styles.featureIcon}>
                  ▶
                </div>

                <div>
                  <div style={styles.featureTitle}>
                    Continue Learning
                  </div>

                  <div style={styles.featureText}>
                    Lanjut dari materi berikutnya.
                  </div>
                </div>
              </div>

              <div style={styles.featureCard}>
                <div style={styles.featureIcon}>
                  ↗
                </div>

                <div>
                  <div style={styles.featureTitle}>
                    Digital Resources
                  </div>

                  <div style={styles.featureText}>
                    Materi dan resource dalam satu tempat.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================
            LOGIN SIDE
        ==================================================== */}

        <section style={styles.loginPanel}>
          <div style={styles.loginCard}>

            <div style={styles.mobileBrand}>
              <div style={styles.mobileBrandIcon}>
                S
              </div>

              <div>
                <div style={styles.mobileBrandName}>
                  iMersSUPA
                </div>

                <div style={styles.mobileBrandSmall}>
                  MEMBER PLATFORM
                </div>
              </div>
            </div>

            <div style={styles.loginEyebrow}>
              WELCOME BACK
            </div>

            <h2 style={styles.loginTitle}>
              Masuk ke akun Anda
            </h2>

            <p style={styles.loginDescription}>
              Gunakan email dan password yang terdaftar untuk
              mengakses member area.
            </p>

            <form
              onSubmit={handleLogin}
              style={styles.form}
            >

              {/* EMAIL */}

              <div>
                <label style={styles.label}>
                  Email
                </label>

                <div style={styles.inputWrapper}>
                  <div style={styles.inputIcon}>
                    @
                  </div>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="nama@email.com"
                    autoComplete="email"
                    disabled={loading}
                    style={styles.input}
                  />
                </div>
              </div>

              {/* PASSWORD */}

              <div>
                <div style={styles.passwordLabelRow}>
                  <label style={styles.label}>
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      router.push('/forgot-password')
                    }
                    style={styles.forgotButton}
                  >
                    Lupa Password?
                  </button>
                </div>

                <div style={styles.inputWrapper}>
                  <div style={styles.inputIcon}>
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
                      setPassword(event.target.value)
                    }
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    disabled={loading}
                    style={styles.passwordInput}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    style={styles.showPasswordButton}
                    aria-label={
                      showPassword
                        ? 'Sembunyikan password'
                        : 'Tampilkan password'
                    }
                  >
                    {showPassword
                      ? 'SEMBUNYIKAN'
                      : 'LIHAT'}
                  </button>
                </div>
              </div>

              {/* ERROR */}

              {error && (
                <div style={styles.errorBox}>
                  <div style={styles.errorIcon}>
                    !
                  </div>

                  <div>
                    <strong>
                      Login belum berhasil
                    </strong>

                    <div style={styles.errorText}>
                      {error}
                    </div>
                  </div>
                </div>
              )}

              {/* LOGIN */}

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.loginButton,
                  opacity: loading ? 0.65 : 1,
                  cursor: loading
                    ? 'wait'
                    : 'pointer',
                }}
              >
                {loading
                  ? 'Memproses Login...'
                  : 'Masuk ke Member Area →'}
              </button>
            </form>

            <div style={styles.securityNote}>
              <div style={styles.securityNoteIcon}>
                ✓
              </div>

              <div>
                <strong>
                  Secure Member Login
                </strong>

                <div style={styles.securityNoteText}>
                  Autentikasi akun dilindungi oleh Supabase Auth.
                </div>
              </div>
            </div>

            <div style={styles.footer}>
              © {new Date().getFullYear()} iMersSUPA
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

// ============================================================
// STYLES
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    overflow: 'hidden',
    color: '#ffffff',
    background:
      'radial-gradient(circle at 10% 0%, #172554 0%, #070b18 38%, #030712 100%)',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  backgroundGlowOne: {
    position: 'fixed',
    width: 500,
    height: 500,
    top: -260,
    left: -120,
    borderRadius: '50%',
    background: 'rgba(37,99,235,.22)',
    filter: 'blur(45px)',
    pointerEvents: 'none',
  },

  backgroundGlowTwo: {
    position: 'fixed',
    width: 520,
    height: 520,
    right: -240,
    bottom: -270,
    borderRadius: '50%',
    background: 'rgba(124,58,237,.20)',
    filter: 'blur(50px)',
    pointerEvents: 'none',
  },

  wrapper: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 1280,
    minHeight: '100vh',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(340px, 1fr))',
  },

  brandPanel: {
    display: 'flex',
    alignItems: 'center',
    padding: '60px 48px',
  },

  brandContent: {
    width: '100%',
    maxWidth: 650,
  },

  brandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    marginBottom: 60,
  },

  brandIcon: {
    width: 52,
    height: 52,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    color: '#ffffff',
    fontSize: 23,
    fontWeight: 950,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
    boxShadow:
      '0 15px 40px rgba(79,70,229,.35)',
  },

  brandName: {
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: '-.4px',
  },

  brandSmall: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: 1.7,
  },

  heroBadge: {
    display: 'inline-block',
    padding: '7px 11px',
    borderRadius: 999,
    color: '#a5b4fc',
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.4,
    border: '1px solid rgba(99,102,241,.15)',
    background:
      'linear-gradient(135deg, rgba(37,99,235,.13), rgba(124,58,237,.11))',
  },

  heroTitle: {
    margin: '18px 0 18px',
    maxWidth: 650,
    fontSize: 'clamp(38px, 5vw, 65px)',
    lineHeight: 1.04,
    letterSpacing: '-2px',
  },

  heroGradientText: {
    color: '#a5b4fc',
  },

  heroDescription: {
    maxWidth: 590,
    margin: 0,
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 1.8,
  },

  featureGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 11,
    marginTop: 32,
  },

  featureCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 17,
    border: '1px solid rgba(255,255,255,.07)',
    background:
      'linear-gradient(135deg, rgba(30,64,175,.11), rgba(88,28,135,.08), rgba(15,23,42,.58))',
  },

  featureIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    color: '#c4b5fd',
    fontWeight: 900,
    background:
      'linear-gradient(135deg, rgba(37,99,235,.20), rgba(124,58,237,.20))',
  },

  featureTitle: {
    fontSize: 11,
    fontWeight: 850,
  },

  featureText: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 9,
    lineHeight: 1.4,
  },

  loginPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '45px 30px',
  },

  loginCard: {
    width: '100%',
    maxWidth: 470,
    padding: '38px 34px',
    borderRadius: 30,
    border: '1px solid rgba(255,255,255,.10)',
    background:
      'linear-gradient(145deg, rgba(30,41,59,.82), rgba(15,23,42,.90), rgba(30,27,75,.72))',
    boxShadow:
      '0 35px 90px rgba(0,0,0,.38)',
    backdropFilter: 'blur(20px)',
  },

  mobileBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 30,
  },

  mobileBrandIcon: {
    width: 42,
    height: 42,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    fontSize: 18,
    fontWeight: 950,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
  },

  mobileBrandName: {
    fontSize: 15,
    fontWeight: 950,
  },

  mobileBrandSmall: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 7,
    fontWeight: 900,
    letterSpacing: 1.4,
  },

  loginEyebrow: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 1.6,
  },

  loginTitle: {
    margin: '7px 0 8px',
    fontSize: 29,
    letterSpacing: '-.8px',
  },

  loginDescription: {
    margin: 0,
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 1.65,
  },

  form: {
    display: 'grid',
    gap: 18,
    marginTop: 28,
  },

  label: {
    display: 'block',
    marginBottom: 8,
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 800,
  },

  passwordLabelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  forgotButton: {
    marginBottom: 8,
    padding: 0,
    border: 0,
    cursor: 'pointer',
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: 800,
    background: 'transparent',
  },

  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,.13)',
    background:
      'linear-gradient(135deg, rgba(15,23,42,.75), rgba(30,41,59,.62))',
  },

  inputIcon: {
    width: 44,
    flexShrink: 0,
    textAlign: 'center',
    color: '#818cf8',
    fontSize: 13,
    fontWeight: 900,
  },

  input: {
    width: '100%',
    minWidth: 0,
    padding: '14px 14px 14px 0',
    border: 0,
    outline: 'none',
    color: '#ffffff',
    fontSize: 13,
    background: 'transparent',
  },

  passwordInput: {
    width: '100%',
    minWidth: 0,
    padding: '14px 5px 14px 0',
    border: 0,
    outline: 'none',
    color: '#ffffff',
    fontSize: 13,
    background: 'transparent',
  },

  showPasswordButton: {
    alignSelf: 'stretch',
    padding: '0 13px',
    border: 0,
    cursor: 'pointer',
    color: '#818cf8',
    fontSize: 8,
    fontWeight: 900,
    background: 'transparent',
  },

  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 13,
    color: '#fecaca',
    border: '1px solid rgba(239,68,68,.13)',
    background:
      'linear-gradient(135deg, rgba(127,29,29,.22), rgba(69,10,10,.13))',
  },

  errorIcon: {
    width: 25,
    height: 25,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    color: '#fca5a5',
    fontWeight: 900,
    background: 'rgba(239,68,68,.13)',
  },

  errorText: {
    marginTop: 3,
    color: '#fca5a5',
    fontSize: 10,
    lineHeight: 1.5,
  },

  loginButton: {
    width: '100%',
    padding: '14px 18px',
    border: 0,
    borderRadius: 14,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 900,
    background:
      'linear-gradient(135deg, #2563eb, #7c3aed)',
    boxShadow:
      '0 15px 35px rgba(79,70,229,.23)',
  },

  securityNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(34,197,94,.10)',
    background:
      'linear-gradient(135deg, rgba(6,78,59,.18), rgba(15,23,42,.25))',
  },

  securityNoteIcon: {
    width: 31,
    height: 31,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    color: '#86efac',
    fontWeight: 900,
    background: 'rgba(34,197,94,.10)',
  },

  securityNoteText: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 9,
  },

  footer: {
    marginTop: 22,
    textAlign: 'center',
    color: '#475569',
    fontSize: 9,
  },

  loadingText: {
    marginTop: 15,
    color: '#94a3b8',
    fontSize: 12,
  },
}

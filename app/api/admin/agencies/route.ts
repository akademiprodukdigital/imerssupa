import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json(
        {
          error: 'Konfigurasi server Supabase belum lengkap.',
        },
        {
          status: 500,
        }
      )
    }

    const authHeader = request.headers.get('authorization') || ''

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : ''

    if (!token) {
      return NextResponse.json(
        {
          error: 'Unauthorized.',
        },
        {
          status: 401,
        }
      )
    }

    // =========================================================
    // VALIDASI SESSION USER YANG MEMANGGIL API
    // =========================================================

    const caller = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: authData,
      error: authError,
    } = await caller.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: 'Session tidak valid.',
        },
        {
          status: 401,
        }
      )
    }

    // =========================================================
    // SERVICE ROLE CLIENT
    // HANYA BERJALAN DI SERVER
    // =========================================================

    const admin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // =========================================================
    // PASTIKAN PEMANGGIL ADALAH SUPER ADMIN AKTIF
    // =========================================================

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from('profiles')
      .select('role,status')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (
      profileError ||
      profile?.role !== 'super_admin' ||
      profile?.status !== 'active'
    ) {
      return NextResponse.json(
        {
          error: 'Super Admin access required.',
        },
        {
          status: 403,
        }
      )
    }

    // =========================================================
    // AMBIL FORM
    // =========================================================

    const body = await request.json()

    const fullName = String(body.full_name || '').trim()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()

    const phone = String(body.phone || '').trim()
    const password = String(body.password || '')

    // =========================================================
    // VALIDASI
    // =========================================================

    if (!fullName) {
      return NextResponse.json(
        {
          error: 'Nama Agency wajib diisi.',
        },
        {
          status: 400,
        }
      )
    }

    if (!email) {
      return NextResponse.json(
        {
          error: 'Email Agency wajib diisi.',
        },
        {
          status: 400,
        }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: 'Password minimal 8 karakter.',
        },
        {
          status: 400,
        }
      )
    }

    // =========================================================
    // BUAT USER DI SUPABASE AUTH
    // =========================================================

    const {
      data: created,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,

      // Agency langsung dapat login.
      email_confirm: true,

      user_metadata: {
        full_name: fullName,
        phone,
      },
    })

    if (createError || !created.user) {
      return NextResponse.json(
        {
          error:
            createError?.message ||
            'Gagal membuat akun Agency.',
        },
        {
          status: 400,
        }
      )
    }

    const userId = created.user.id

    // =========================================================
    // BUAT / UPDATE PROFILE SEBAGAI AGENCY
    // =========================================================

    const {
      error: upsertError,
    } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName,
          phone: phone || null,
          role: 'agency',
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )

    // =========================================================
    // ROLLBACK AUTH JIKA PROFILE GAGAL
    // Supaya tidak ada akun setengah jadi.
    // =========================================================

    if (upsertError) {
      await admin.auth.admin.deleteUser(userId)

      return NextResponse.json(
        {
          error: `Profile Agency gagal dibuat: ${upsertError.message}`,
        },
        {
          status: 500,
        }
      )
    }

    // =========================================================
    // SUCCESS
    // =========================================================

    return NextResponse.json({
      ok: true,
      user_id: userId,
      message: 'Agency berhasil dibuat.',
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Terjadi kesalahan server.'

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    )
  }
}

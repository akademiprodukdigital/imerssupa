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
        { error: 'Konfigurasi server Supabase belum lengkap.' },
        { status: 500 }
      )
    }

    const authHeader =
      request.headers.get('authorization') || ''

    const token =
      authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : ''

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      )
    }

    // Client dengan JWT Super Admin yang sedang login.
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
          error: `Session tidak valid${
            authError?.message
              ? `: ${authError.message}`
              : '.'
          }`,
        },
        { status: 401 }
      )
    }

    // Validasi Super Admin menggunakan JWT caller.
    const {
      data: isSuperAdmin,
      error: roleError,
    } = await caller.rpc(
      'is_imerssupa_super_admin'
    )

    if (roleError) {
      return NextResponse.json(
        {
          error:
            `Gagal memvalidasi Super Admin: ${roleError.message}`,
        },
        { status: 500 }
      )
    }

    if (isSuperAdmin !== true) {
      return NextResponse.json(
        {
          error: 'Super Admin access required.',
        },
        { status: 403 }
      )
    }

    const body = await request.json()

    const fullName =
      String(body.full_name || '').trim()

    const email =
      String(body.email || '')
        .trim()
        .toLowerCase()

    const phone =
      String(body.phone || '').trim()

    const password =
      String(body.password || '')

    if (!fullName) {
      return NextResponse.json(
        {
          error:
            'Nama Agency / Pemilik wajib diisi.',
        },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        {
          error: 'Email Login wajib diisi.',
        },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            'Password Awal minimal 8 karakter.',
        },
        { status: 400 }
      )
    }

    // Secret key hanya dipakai untuk Supabase Auth Admin API.
    const admin = createClient(
      url,
      serviceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    // Buat Supabase Auth User.
    const {
      data: created,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,

      user_metadata: {
        full_name: fullName,
        phone,
      },
    })

    if (
      createError ||
      !created.user
    ) {
      return NextResponse.json(
        {
          error:
            `Supabase Auth gagal membuat Agency: ${
              createError?.message ||
              'Unknown error'
            }`,
        },
        { status: 400 }
      )
    }

    const userId =
      created.user.id

    // ======================================================
    // PROFILE AGENCY
    //
    // Tidak lagi direct admin.from('profiles').upsert().
    // Profile dibuat melalui SECURITY DEFINER RPC
    // dengan JWT Super Admin.
    // ======================================================

    const {
      error: profileError,
    } = await caller.rpc(
      'super_admin_create_agency_profile',
      {
        p_user_id: userId,
        p_full_name: fullName,
        p_phone: phone || null,
      }
    )

    if (profileError) {
      // Rollback Auth User.
      // Tidak meninggalkan Agency setengah jadi.
      await admin.auth.admin.deleteUser(
        userId
      )

      return NextResponse.json(
        {
          error:
            `Profile Agency gagal dibuat: ${profileError.message}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,

      user_id: userId,

      message:
        'Agency berhasil dibuat.',
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

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

    const authHeader = request.headers.get('authorization') || ''

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : ''

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      )
    }

    // ======================================================
    // CALLER CLIENT
    // Memakai JWT user yang sedang login.
    // ======================================================

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

    // ======================================================
    // VALIDASI SUPER ADMIN
    //
    // Penting:
    // Validasi memakai JWT caller supaya auth.uid()
    // terbaca dengan benar oleh Supabase.
    // ======================================================

    const {
      data: isSuperAdmin,
      error: roleError,
    } = await caller.rpc('is_imerssupa_super_admin')

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

    // ======================================================
    // FORM DATA
    // ======================================================

    const body = await request.json()

    const fullName = String(
      body.full_name || ''
    ).trim()

    const email = String(
      body.email || ''
    )
      .trim()
      .toLowerCase()

    const phone = String(
      body.phone || ''
    ).trim()

    const password = String(
      body.password || ''
    )

    if (!fullName) {
      return NextResponse.json(
        {
          error: 'Nama Agency / Pemilik wajib diisi.',
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
          error: 'Password Awal minimal 8 karakter.',
        },
        { status: 400 }
      )
    }

    // ======================================================
    // SERVICE ROLE CLIENT
    //
    // Hanya dipakai SERVER-SIDE untuk membuat Auth User.
    // Key ini TIDAK dikirim ke browser.
    // ======================================================

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

    // ======================================================
    // CREATE SUPABASE AUTH USER
    // ======================================================

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

    const userId = created.user.id

    // ======================================================
    // CREATE / UPDATE PROFILE AGENCY
    // ======================================================

    const {
      error: upsertError,
    } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,

          full_name: fullName,

          phone:
            phone ||
            null,

          role: 'agency',

          status: 'active',

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )

    // ======================================================
    // ROLLBACK
    //
    // Kalau profile gagal dibuat,
    // jangan meninggalkan Auth User setengah jadi.
    // ======================================================

    if (upsertError) {
      await admin.auth.admin.deleteUser(
        userId
      )

      return NextResponse.json(
        {
          error:
            `Profile Agency gagal dibuat: ${upsertError.message}`,
        },
        { status: 500 }
      )
    }

    // ======================================================
    // SUCCESS
    // ======================================================

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

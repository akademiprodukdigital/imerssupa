import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json(
        {
          error:
            'Konfigurasi server Supabase belum lengkap.',
        },
        { status: 500 }
      )
    }

    const authHeader =
      request.headers.get('authorization') || ''

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : ''

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      )
    }

    /*
     * Client ini memakai JWT Agency.
     * Jadi RPC Agency tetap berjalan sebagai Agency
     * yang sedang login, bukan sebagai service_role.
     */
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

    /*
     * Pastikan token benar-benar milik user
     * Supabase yang valid.
     */
    const {
      data: authData,
      error: authError,
    } = await caller.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: `Session Agency tidak valid${
            authError?.message
              ? `: ${authError.message}`
              : '.'
          }`,
        },
        { status: 401 }
      )
    }

    /*
     * Validasi bahwa user tersebut benar-benar
     * Agency aktif.
     */
    const {
      data: isAgency,
      error: agencyError,
    } = await caller.rpc('is_imerssupa_agency')

    if (agencyError) {
      return NextResponse.json(
        {
          error:
            `Gagal memvalidasi Agency: ` +
            agencyError.message,
        },
        { status: 500 }
      )
    }

    if (isAgency !== true) {
      return NextResponse.json(
        {
          error: 'Active Agency access required.',
        },
        { status: 403 }
      )
    }

    /*
     * Ambil data dari form Agency.
     */
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

    const productId = String(
      body.product_id || ''
    ).trim()

    /*
     * Validasi input.
     */
    if (!fullName) {
      return NextResponse.json(
        {
          error: 'Nama Member wajib diisi.',
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

    if (!productId) {
      return NextResponse.json(
        {
          error:
            'Product Access wajib dipilih.',
        },
        { status: 400 }
      )
    }

    /*
     * PRE-CHECK entitlement.
     *
     * Ini bukan pengaman quota utama.
     * STEP 42 tetap melakukan pengecekan ulang
     * dan lock quota saat grant dilakukan.
     */
    const {
      data: entitlements,
      error: entitlementError,
    } = await caller.rpc(
      'get_my_agency_entitlements'
    )

    if (entitlementError) {
      return NextResponse.json(
        {
          error:
            `Gagal memeriksa Product Entitlement: ` +
            entitlementError.message,
        },
        { status: 500 }
      )
    }

    const entitlement = (
      Array.isArray(entitlements)
        ? entitlements
        : []
    ).find(
      (row: any) =>
        row.product_id === productId &&
        row.status === 'active' &&
        (
          !row.expires_at ||
          new Date(
            row.expires_at
          ).getTime() > Date.now()
        ) &&
        Number(row.remaining_slots) > 0
    )

    if (!entitlement) {
      return NextResponse.json(
        {
          error:
            'Produk tidak tersedia, entitlement tidak aktif, atau slot Agency sudah habis.',
        },
        { status: 400 }
      )
    }

    /*
     * Service Role HANYA dipakai server-side
     * untuk membuat Supabase Auth User.
     *
     * Key ini tidak pernah dikirim ke browser.
     */
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

    /*
     * Buat Auth User Member.
     */
    const {
      data: created,
      error: createError,
    } =
      await admin.auth.admin.createUser({
        email,
        password,
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
            `Supabase Auth gagal membuat Member: ` +
            (
              createError?.message ||
              'Unknown error'
            ),
        },
        { status: 400 }
      )
    }

    const userId = created.user.id

    /*
     * Kalau salah satu proses berikutnya gagal,
     * Auth User yang baru dibuat dihapus lagi
     * supaya tidak meninggalkan akun gantung.
     */
    const rollback = async () => {
      await admin.auth.admin.deleteUser(
        userId
      )
    }

    /*
     * STEP 44:
     * buat profile role=member.
     */
    const {
      error: profileError,
    } = await caller.rpc(
      'agency_create_member_profile',
      {
        p_user_id: userId,
        p_full_name: fullName,
        p_phone: phone || null,
      }
    )

    if (profileError) {
      await rollback()

      return NextResponse.json(
        {
          error:
            `Profile Member gagal dibuat: ` +
            profileError.message,
        },
        { status: 500 }
      )
    }

    /*
     * STEP 42:
     * hubungkan Member ke Agency
     * yang sedang login.
     */
    const {
      error: attachError,
    } = await caller.rpc(
      'agency_attach_existing_member',
      {
        p_member_user_id: userId,
      }
    )

    if (attachError) {
      await rollback()

      return NextResponse.json(
        {
          error:
            `Member gagal dihubungkan ke Agency: ` +
            attachError.message,
        },
        { status: 500 }
      )
    }

    /*
     * STEP 42:
     * berikan Product Access.
     *
     * RPC inilah yang melakukan pengecekan
     * entitlement + slot Agency lagi.
     */
    const {
      error: grantError,
    } = await caller.rpc(
      'agency_grant_product_access',
      {
        p_member_user_id: userId,
        p_product_id: productId,
      }
    )

    if (grantError) {
      await rollback()

      return NextResponse.json(
        {
          error:
            `Product Access gagal diberikan: ` +
            grantError.message,
        },
        { status: 500 }
      )
    }

    /*
     * SELESAI.
     */
    return NextResponse.json({
      ok: true,
      user_id: userId,
      message:
        'Member berhasil dibuat dan Product Access aktif.',
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan server.',
      },
      { status: 500 }
    )
  }
}

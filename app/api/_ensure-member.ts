import { createClient } from '@supabase/supabase-js'

export type EnsureMemberInput = {
  email: string
  fullName: string
  phone?: string | null
}

export async function ensureMemberAccount(
  admin: any,
  input: EnsureMemberInput
) {
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim() || email.split('@')[0]
  const phone = input.phone?.trim() || null

  if (!email || !email.includes('@')) throw new Error('Email member tidak valid.')

  let page = 1
  let authUser: any = null

  while (!authUser) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    authUser = data.users.find((u:any) => (u.email || '').toLowerCase() === email) || null
    if (authUser || data.users.length < 1000) break
    page += 1
    if (page > 100) throw new Error('Pencarian member melebihi batas aman.')
  }

  let invited = false
  if (!authUser) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, phone: phone || '' },
    })
    if (error || !data.user) throw new Error(error?.message || 'Gagal membuat akun member.')
    authUser = data.user
    invited = true
  }

  const profileResult = await admin
    .from('profiles')
    .select('id,role,status')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profileResult.error) throw profileResult.error
  const existingProfile = profileResult.data as { id: string; role: string | null; status: string | null } | null

  // Role akun dan hak akses produk adalah dua hal berbeda.
  // Akun existing (member/agency/admin/super_admin) tidak pernah diubah rolenya saat membeli produk.
  if (!existingProfile) {
    const { error: insertError } = await admin.from('profiles').insert({
      id: authUser.id,
      full_name: fullName,
      phone,
      role: 'member',
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    if (insertError) throw insertError
  }

  return { userId: authUser.id, invited }
}

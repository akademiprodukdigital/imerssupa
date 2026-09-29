import { createClient } from '@supabase/supabase-js'

export type EnsureMemberInput = {
  email: string
  fullName: string
  phone?: string | null
}

export async function ensureMemberAccount(
  admin: ReturnType<typeof createClient>,
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

  const { data: existingProfile, error: profileReadError } = await admin
    .from('profiles')
    .select('id,role,status')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profileReadError) throw profileReadError
  if (existingProfile && existingProfile.role && existingProfile.role !== 'member') {
    throw new Error(`Email ${email} sudah dipakai akun ${existingProfile.role}; tidak diubah menjadi member.`)
  }

  const { error: upsertError } = await admin.from('profiles').upsert({
    id: authUser.id,
    full_name: fullName,
    phone,
    role: 'member',
    status: 'active',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (upsertError) throw upsertError
  return { userId: authUser.id, invited }
}

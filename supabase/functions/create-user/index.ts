import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors'

type ManagedUserBody = {
  action?: 'create' | 'update' | 'delete'
  uid?: string
  email?: string
  password?: string
  displayName?: string
  roleId?: string
  provinceId?: string
  cityId?: string
  districtId?: string
  villageId?: string
  rwId?: string
  rtId?: string
}

type ProfileScope = {
  id: string
  rw_id: string | null
  role_id: string
  master_roles: { code?: string } | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return Response.json({ ok: true }, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ message: 'Method tidak diizinkan.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authorization = req.headers.get('Authorization') ?? ''
  if (!supabaseUrl || !publishableKey || !secretKey || !authorization) {
    return json({ message: 'Konfigurasi atau sesi Supabase tidak lengkap.' }, 401)
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: callerData, error: callerError } = await userClient.auth.getUser()
  if (callerError || !callerData.user) return json({ message: 'Sesi tidak valid.' }, 401)

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('id, rw_id, role_id, master_roles!inner(code)')
    .eq('id', callerData.user.id)
    .single()
  if (callerProfileError || !callerProfile) return json({ message: 'Profil pengguna tidak ditemukan.' }, 403)

  let body: ManagedUserBody
  try {
    body = await req.json()
  } catch {
    return json({ message: 'Payload tidak valid.' }, 400)
  }

  const action = body.action ?? 'create'
  const caller = callerProfile as unknown as ProfileScope
  const callerRole = caller.master_roles?.code

  if (action === 'delete') {
    if (!body.uid) return json({ message: 'Pengguna tidak valid.' }, 400)
    if (body.uid === callerData.user.id) return json({ message: 'Akun yang sedang digunakan tidak dapat dihapus.' }, 400)
    const target = await getProfile(adminClient, body.uid)
    if (target?.master_roles?.code === 'superadmin') {
      return json({ message: 'Akun Superadmin tidak dapat dihapus.' }, 400)
    }
    if (!target || !canManage(callerRole, caller.rw_id, target.master_roles?.code, target.rw_id)) {
      return json({ message: 'Anda tidak dapat menghapus pengguna tersebut.' }, 403)
    }
    const { error } = await adminClient.auth.admin.deleteUser(body.uid)
    if (error) return json({ message: error.message }, 400)
    return json({ id: body.uid }, 200)
  }

  if (!body.email?.trim() || !body.displayName?.trim() || !body.roleId) {
    return json({ message: 'Email, nama, dan role wajib diisi.' }, 400)
  }
  if (action === 'create' && (!body.password || body.password.length < 8)) {
    return json({ message: 'Password minimal 8 karakter.' }, 400)
  }
  if (body.password && body.password.length < 8) return json({ message: 'Password minimal 8 karakter.' }, 400)

  const { data: role, error: roleError } = await adminClient
    .from('master_roles')
    .select('id, code')
    .eq('id', body.roleId)
    .single()
  if (roleError || !role) return json({ message: 'Role pengguna tidak valid.' }, 400)

  const email = body.email.trim().toLowerCase()
  const displayName = body.displayName.trim()
  const profilePayload = {
    email,
    display_name: displayName,
    role_id: role.id,
    province_id: body.provinceId || null,
    city_id: body.cityId || null,
    district_id: body.districtId || null,
    village_id: body.villageId || null,
    rw_id: body.rwId || null,
    rt_id: body.rtId || null,
  }

  if (action === 'create') {
    if (callerRole !== 'superadmin') return json({ message: 'Hanya Superadmin yang dapat membuat pengguna.' }, 403)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { display_name: displayName, full_name: displayName, name: displayName },
    })
    if (authError || !authData.user) return json({ message: authError?.message ?? 'Gagal membuat akun.' }, 400)
    const { error: insertError } = await adminClient.from('profiles').insert({ id: authData.user.id, ...profilePayload })
    if (insertError) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return json({ message: insertError.message }, 400)
    }
    return json({ id: authData.user.id }, 201)
  }

  if (action !== 'update' || !body.uid) return json({ message: 'Aksi tidak valid.' }, 400)
  const target = await getProfile(adminClient, body.uid)
  if (!target || !canManage(callerRole, caller.rw_id, target.master_roles?.code, target.rw_id)) {
    return json({ message: 'Anda tidak dapat mengubah pengguna tersebut.' }, 403)
  }
  if (!canManage(callerRole, caller.rw_id, role.code, body.rwId ?? null)) {
    return json({ message: 'Role atau wilayah pengguna tidak diizinkan.' }, 403)
  }

  const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(body.uid)
  if (authUserError || !authUser.user) return json({ message: authUserError?.message ?? 'Akun tidak ditemukan.' }, 404)
  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(body.uid, {
    email,
    email_confirm: true,
    ...(body.password ? { password: body.password } : {}),
    user_metadata: {
      ...authUser.user.user_metadata,
      display_name: displayName,
      full_name: displayName,
      name: displayName,
    },
  })
  if (authUpdateError) return json({ message: authUpdateError.message }, 400)

  const { error: profileUpdateError } = await adminClient.from('profiles').update(profilePayload).eq('id', body.uid)
  if (profileUpdateError) return json({ message: profileUpdateError.message }, 400)
  return json({ id: body.uid }, 200)
})

async function getProfile(client: ReturnType<typeof createClient>, uid: string) {
  const { data, error } = await client
    .from('profiles')
    .select('id, rw_id, role_id, master_roles!inner(code)')
    .eq('id', uid)
    .single()
  return error ? null : data as unknown as ProfileScope
}

function canManage(callerRole?: string, callerRwId?: string | null, targetRole?: string, targetRwId?: string | null) {
  if (callerRole === 'superadmin') return true
  return callerRole === 'ketua_rw'
    && ['ketua_rt', 'staff_rw', 'staff_rt'].includes(targetRole ?? '')
    && Boolean(callerRwId && callerRwId === targetRwId)
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

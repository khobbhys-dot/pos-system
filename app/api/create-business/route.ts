import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { shop_name, phone, owner_email } = await req.json()

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Create business
    const { data: business, error: bError } = await supabaseAdmin
      .from('business_info')
      .insert([{ shop_name, phone, owner_email, is_active: true }])
      .select()
      .single()
    
    if(bError) throw new Error(bError.message)

    // 2. Create login user
    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: owner_email,
      email_confirm: true,
      user_metadata: { business_id: business.id, role: 'business_owner' }
    })

    if(authError && !authError.message.includes('already exists')){
      throw new Error(authError.message)
    }

    // 3. Send invite email to set password
    await supabaseAdmin.auth.resetPasswordForEmail(owner_email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin-login`
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
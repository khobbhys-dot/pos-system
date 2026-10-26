import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request){
  try {
    const { old_email, new_email, new_password, business_id } = await req.json()
    if(!new_email || !new_password) return NextResponse.json({error:'Email and password required'},{status:400})

    const { data: list } = await supabaseAdmin.auth.admin.listUsers()
    const user = list.users.find(u => u.email?.toLowerCase() === old_email?.toLowerCase())

    if(!user){
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: new_email,
        password: new_password,
        email_confirm: true,
        user_metadata: { business_id }
      })
      if(error) throw error
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: new_email,
        password: new_password,
        email_confirm: true
      })
      if(error) throw error
    }

    await supabaseAdmin.from('business_info').update({ owner_email: new_email }).eq('id', business_id)

    return NextResponse.json({success:true})
  } catch(e:any){
    return NextResponse.json({error:e.message},{status:400})
  }
}
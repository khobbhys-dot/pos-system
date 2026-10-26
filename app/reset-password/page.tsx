'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ResetPassword(){
  const [newPass, setNewPass] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function updatePassword(){
    if(!newPass || newPass.length < 6){ alert('Password must be at least 6 chars'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setLoading(false)
    if(error){ alert(error.message); return }
    alert('Password updated! Login now')
    router.push('/admin-login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9] p-4">
      <div className="bg-white p-8 rounded-2xl shadow w-full max-w-sm">
        <h1 className="font-black text-xl text-center">Reset Password</h1>
        <p className="text-[11px] tracking-widest text-center text-slate-500 mb-6">ENTER NEW PASSWORD</p>
        <input value={newPass} onChange={e=>setNewPass(e.target.value)} type="password" placeholder="New Password (min 6 chars)" className="w-full border p-3 rounded-xl mb-5"/>
        <button onClick={updatePassword} disabled={loading} className="w-full bg-[#0f172a] text-white py-3 rounded-xl font-bold">
          {loading?'...':'Update Password'}
        </button>
      </div>
    </div>
  )
}
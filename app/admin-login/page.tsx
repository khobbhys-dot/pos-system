'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function AdminLogin(){
  const [tab, setTab] = useState<'owner' | 'cashier'>('owner')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [cashierPass, setCashierPass] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function loginOwner(){
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if(error){ alert(error.message); setLoading(false); return }
    
    const { data: biz } = await supabase.from('business_info').select('*').eq('owner_email', email).maybeSingle()
    if(!biz){ alert('No business found for this email'); setLoading(false); return }

    localStorage.setItem('business_id', String(biz.id))
    localStorage.setItem('business_name', biz.business_name || biz.shop_name || 'My Shop')
    localStorage.setItem('role', 'owner')
    localStorage.setItem('owner_email', email)
    
    router.push('/pos')
    setLoading(false)
  }

  async function resetOwnerPassword(){
    if(!email){ alert('Enter owner email first'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://pos-system-gold-ten.vercel.app/reset-password'
    })
    setLoading(false)
    if(error) alert(error.message)
    else alert('Reset link sent to ' + email + ' - Check inbox/spam')
  }

  async function loginCashier(){
    setLoading(true)
    // FIX: Check both staff and cashiers tables
    let staff:any = null

    const { data: staffData } = await supabase.from('staff').select('*').eq('username', username).eq('password_plain', cashierPass).eq('is_active', true).maybeSingle()
    if(staffData) staff = staffData

    if(!staff){
      const { data: cashierData } = await supabase.from('cashiers').select('*').eq('username', username).eq('password', cashierPass).maybeSingle()
      if(cashierData){
        staff = {
          business_id: cashierData.business_id,
          full_name: cashierData.name || cashierData.username,
          username: cashierData.username
        }
      }
    }
    
    if(!staff){ alert('Wrong username or password'); setLoading(false); return }

    localStorage.setItem('business_id', String(staff.business_id))
    localStorage.setItem('role', 'cashier')
    localStorage.setItem('staff_name', staff.full_name || staff.name || staff.username)
    localStorage.setItem('staff_username', staff.username)

    router.push('/pos')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9] p-4">
      <div className="bg-white p-8 rounded-2xl shadow w-full max-w-sm">
        <h1 className="font-black text-xl text-center">HANFLO</h1>
        <p className="text-[11px] tracking-widest text-center text-slate-500 mb-6">POS LOGIN</p>
        
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
          <button onClick={()=>setTab('owner')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab==='owner'?'bg-white shadow':''}`}>Owner</button>
          <button onClick={()=>setTab('cashier')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${tab==='cashier'?'bg-white shadow':''}`}>Cashier</button>
        </div>

        {tab==='owner' ? (
          <>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Owner Email" className="w-full border p-3 rounded-xl mb-3"/>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="w-full border p-3 rounded-xl mb-3"/>
            <button onClick={loginOwner} disabled={loading} className="w-full bg-[#0f172a] text-white py-3 rounded-xl font-bold">
              {loading?'...':'Login as Owner'}
            </button>
            <button onClick={resetOwnerPassword} disabled={loading} className="w-full text-xs text-slate-500 mt-3 underline">
              Forgot password?
            </button>
          </>
        ):(
          <>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Cashier Username" className="w-full border p-3 rounded-xl mb-3"/>
            <input value={cashierPass} onChange={e=>setCashierPass(e.target.value)} type="password" placeholder="Cashier Password" className="w-full border p-3 rounded-xl mb-5"/>
            <button onClick={loginCashier} disabled={loading} className="w-full bg-[#0f172a] text-white py-3 rounded-xl font-bold">
              {loading?'...':'Login as Cashier'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
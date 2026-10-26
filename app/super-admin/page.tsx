'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type Tab = 'dashboard' | 'businesses' | 'subscriptions' | 'revenue' | 'customers' | 'plans' | 'settings' | 'support'

export default function SuperAdminPage(){
  const [bizs, setBizs] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [ok, setOk] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [tab, setTab] = useState<Tab>('dashboard')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [newBiz, setNewBiz] = useState({shop_name:'', phone:'', owner_email:''})
  const [showReset, setShowReset] = useState(false)
  const [resetTarget, setResetTarget] = useState<any>(null)
  const [resetForm, setResetForm] = useState({owner_email:'', new_password:''})
  const [loadingReset, setLoadingReset] = useState(false)
  const [checking, setChecking] = useState(true)
  const [savingBiz, setSavingBiz] = useState(false) // NEW

  useEffect(()=>{
    checkAuth()
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session)=>{
      if(session?.user?.email) await verifySuperAdmin(session.user.email)
    })
    return ()=> listener.subscription.unsubscribe()
  },[])

  async function checkAuth(){
    const { data: { session } } = await supabase.auth.getSession()
    if(session?.user?.email){
      await verifySuperAdmin(session.user.email)
    }
    setChecking(false)
  }

  async function verifySuperAdmin(email: string){
    const { data } = await supabase.from('super_admins').select('*').eq('email', email.toLowerCase().trim()).single()
    if(data){
      setUserEmail(email)
      setOk(true)
      load()
    } else {
      await supabase.auth.signOut()
      alert(`Access Denied: ${email} is not a super admin.\nAdd it to super_admins table first.`)
      setOk(false)
    }
  }

  async function signInWithGoogle(){
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/super-admin' }
    })
    if(error) alert(error.message)
  }

  async function signOut(){
    await supabase.auth.signOut()
    setOk(false)
  }

  async function load(){
    const { data: b } = await supabase.from('business_info').select('*').order('id')
    const { data: s } = await supabase.from('sales').select('business_id,total,created_at')
    setBizs(b||[]); setSales(s||[])
  }

  const totalRev = sales.reduce((a:any,b:any)=>a+Number(b.total||0),0)
  const activeCount = bizs.filter(b=>b.is_active!==false).length
  const todaySales = sales.filter((s:any)=> new Date(s.created_at).toDateString()===new Date().toDateString()).reduce((a:any,b:any)=>a+Number(b.total||0),0)
  const filtered = bizs.filter((b:any)=>{
    const matchSearch = b.shop_name?.toLowerCase().includes(search.toLowerCase()) || b.owner_email?.toLowerCase().includes(search.toLowerCase())
    const isActive = b.is_active!==false
    const matchFilter = filterStatus==='all' || (filterStatus==='active'&&isActive) || (filterStatus==='inactive'&&!isActive)
    return matchSearch && matchFilter
  })

  // === FIXED: NOW CREATES BUSINESS + LOGIN + SENDS EMAIL ===
  async function saveBusiness(){
    if(!newBiz.shop_name.trim()) return alert('Enter shop name')
    if(!editing && !newBiz.owner_email.trim()) return alert('Enter owner email - he needs it to login')
    
    setSavingBiz(true)
    try {
      // If editing, just update business_info (don't create new auth)
      if(editing){
        const payload = { shop_name: newBiz.shop_name.trim(), phone: newBiz.phone.trim(), owner_email: newBiz.owner_email.trim() }
        const { error } = await supabase.from('business_info').update(payload).eq('id', editing.id)
        if(error) throw new Error(error.message)
        alert('Business updated!')
      } else {
        // NEW BUSINESS: Call backend API that creates business + auth user + sends invite email
        const res = await fetch('/api/create-business', { 
          method:'POST', 
          headers:{'Content-Type':'application/json'}, 
          body:JSON.stringify({ 
            shop_name: newBiz.shop_name.trim(),
            phone: newBiz.phone.trim(), 
            owner_email: newBiz.owner_email.trim() 
          }) 
        })
        const data = await res.json()
        if(!res.ok) throw new Error(data.error)
        alert(`✅ SUCCESS! Business created!\n\nLogin invite sent to: ${newBiz.owner_email}\nThey will get email to set password.`)
      }
      setShowAdd(false); setEditing(null); setNewBiz({shop_name:'',phone:'',owner_email:''}); load()
    } catch(err:any){
      alert(`❌ ${err.message}`)
    } finally {
      setSavingBiz(false)
    }
  }

  async function toggleActive(b:any){
    const { error } = await supabase.from('business_info').update({is_active: !(b.is_active!==false)}).eq('id', b.id)
    if(error) return alert('Add is_active column first: ALTER TABLE business_info ADD COLUMN is_active boolean default true')
    load()
  }
  function openEdit(b:any){ setEditing(b); setNewBiz({shop_name:b.shop_name, phone:b.phone||'', owner_email:b.owner_email||''}); setShowAdd(true) }
  function openAdd(){ setEditing(null); setNewBiz({shop_name:'',phone:'',owner_email:''}); setShowAdd(true) }
  function openReset(b:any){ setResetTarget(b); setResetForm({owner_email: b.owner_email||'', new_password: ''}); setShowReset(true) }
  async function handleReset(){
    if(!resetForm.owner_email.trim() || resetForm.new_password.length<6) return alert('Enter valid email & 6+ char password')
    setLoadingReset(true)
    try{
      const res = await fetch('/api/admin/reset-password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ old_email: resetTarget.owner_email, new_email: resetForm.owner_email.trim(), new_password: resetForm.new_password, business_id: resetTarget.id }) })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error)
      alert(`SUCCESS! New login: ${resetForm.owner_email}`); setShowReset(false); load()
    } catch(err:any){ alert(err.message) } finally{ setLoadingReset(false) }
  }

  const MenuItem = ({id, label}:{id:Tab, label:string}) => (<button onClick={()=>setTab(id)} className={`w-full text-left px-6 py-3 text-sm ${tab===id ? 'bg-[#1e3a8a] border-l-4 border-sky-400 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{label}</button>)

  if(checking) return <div className="min-h-screen flex items-center justify-center">Checking auth...</div>

  if(!ok) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9]">
      <div className="bg-white p-8 rounded-2xl shadow w-full max-w-sm text-center">
        <h1 className="font-black text-xl">HANFLO</h1><p className="text-[10px] tracking-[0.2em] text-slate-500 mb-6 font-semibold">SUPER ADMIN</p>
        <p className="text-sm text-slate-600 mb-6">Only authorized Gmail can access</p>
        <button onClick={signInWithGoogle} className="w-full bg-white border-2 border-slate-200 py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="google"/> Sign in with Google
        </button>
        <p className="text-[11px] text-slate-400 mt-4">Your Gmail must be added in super_admins table</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <div className="w-[250px] bg-[#0f172a] text-white flex flex-col">
        <div className="p-6 border-b border-slate-800"><div className="font-black text-xl">HANFLO</div><div className="text-[11px] text-slate-400 mt-1">SUPER ADMIN</div></div>
        <div className="mt-2"><MenuItem id="dashboard" label="Dashboard" /><MenuItem id="businesses" label="Businesses" /><MenuItem id="revenue" label="Revenue" /><MenuItem id="customers" label="Customers" /></div>
        <div className="mt-auto p-4 border-t border-slate-800 text-sm"><p className="font-bold truncate">{userEmail}</p><button onClick={signOut} className="mt-2 text-xs text-slate-400">Sign out</button></div>
      </div>
      <div className="flex-1 p-8 overflow-auto">
        <div className="flex justify-between mb-6"><h1 className="text-3xl font-bold capitalize">{tab}</h1>{tab==='businesses' && <button onClick={openAdd} className="bg-[#2563eb] text-white px-5 py-3 rounded-xl">Add New Business</button>}</div>
        {tab==='dashboard' && (<div className="grid grid-cols-4 gap-5"><div className="bg-white rounded-2xl p-6 border"><p className="text-sm text-slate-500">Total Businesses</p><p className="text-4xl font-bold mt-2">{bizs.length}</p></div><div className="bg-white rounded-2xl p-6 border"><p className="text-sm text-slate-500">Active</p><p className="text-4xl font-bold mt-2">{activeCount}</p></div><div className="bg-white rounded-2xl p-6 border"><p className="text-sm text-slate-500">Today Sales</p><p className="text-3xl font-bold mt-2">GHS {todaySales.toFixed(2)}</p></div><div className="bg-white rounded-2xl p-6 border"><p className="text-sm text-slate-500">Total Revenue</p><p className="text-3xl font-bold mt-2">GHS {totalRev.toFixed(2)}</p></div></div>)}
        {tab==='businesses' && (<div className="bg-white rounded-2xl border p-6"><div className="flex justify-between mb-4"><h2 className="font-bold">All Businesses ({filtered.length})</h2><div className="flex gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="border rounded-xl px-4 py-2"/><select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border rounded-xl px-4 py-2"><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div><table className="w-full text-sm"><thead><tr className="text-left border-b text-slate-500"><th className="py-3">Business</th><th>Owner</th><th>Status</th><th>Sales</th><th>Actions</th></tr></thead><tbody>{filtered.map((b:any)=>{const rev=sales.filter((s:any)=>s.business_id==b.id).reduce((a:any,c:any)=>a+Number(c.total||0),0); const isActive=b.is_active!==false; return <tr key={b.id} className="border-b hover:bg-slate-50"><td className="py-4 font-medium">{b.shop_name}</td><td>{b.owner_email||'—'}</td><td><button onClick={()=>toggleActive(b)} className={`${isActive?'bg-green-600':'bg-slate-400'} text-white px-3 py-1 rounded-full text-[11px]`}>{isActive?'Active':'Inactive'}</button></td><td className="font-bold">GHS {rev.toFixed(2)}</td><td className="flex gap-2"><button onClick={()=>openEdit(b)} className="border px-3 py-1 rounded-lg text-xs">Edit</button><button onClick={()=>openReset(b)} className="bg-slate-900 text-white px-3 py-1 rounded-lg text-xs">Reset Login</button></td></tr>})}</tbody></table></div>)}
        {showAdd && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl p-6 w-full max-w-md"><h2 className="font-bold text-xl mb-4">{editing?'Edit':'Add'} Business</h2><input placeholder="Shop Name *" value={newBiz.shop_name} onChange={e=>setNewBiz({...newBiz, shop_name:e.target.value})} className="w-full border p-3 rounded-xl mb-3"/><input placeholder="Phone" value={newBiz.phone} onChange={e=>setNewBiz({...newBiz, phone:e.target.value})} className="w-full border p-3 rounded-xl mb-3"/><input placeholder="Owner Email (for login) *" value={newBiz.owner_email} onChange={e=>setNewBiz({...newBiz, owner_email:e.target.value})} className="w-full border p-3 rounded-xl mb-5"/><div className="flex gap-2"><button onClick={()=>setShowAdd(false)} className="flex-1 border py-3 rounded-xl">Cancel</button><button onClick={saveBusiness} disabled={savingBiz} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">{savingBiz ? 'Creating & Sending Email...' : 'Save'}</button></div></div></div>)}
        {showReset && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl p-6 w-full max-w-md"><h2 className="font-bold text-xl mb-1">Reset Login</h2><p className="text-sm text-slate-500 mb-4">{resetTarget?.shop_name}</p><input value={resetForm.owner_email} onChange={e=>setResetForm({...resetForm, owner_email:e.target.value})} placeholder="New Email" className="w-full border p-3 rounded-xl mb-3 mt-1"/><input value={resetForm.new_password} onChange={e=>setResetForm({...resetForm, new_password:e.target.value})} placeholder="New Password Min 6" className="w-full border p-3 rounded-xl mb-5 mt-1"/><div className="flex gap-2"><button onClick={()=>setShowReset(false)} className="flex-1 border py-3 rounded-xl">Cancel</button><button onClick={handleReset} disabled={loadingReset} className="flex-1 bg-[#0f172a] text-white py-3 rounded-xl font-bold">{loadingReset?'Saving...':'Save Login'}</button></div></div></div>)}
      </div>
    </div>
  )
}
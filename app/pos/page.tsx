'use client'
import { useState, useEffect, useRef } from 'react'

type Product = { id: string, name: string, barcode?: string | null, price: number, stock: number, category?: string | null, image?: string | null }
type CartItem = Product & { qty: number }
type BusinessInfo = { shopName: string, slogan: string, address: string, phone: string, momo: string, tin: string, vatRate: number, serviceCharge: number }
type Customer = { phone: string, name: string, visits: number, totalSpent: number }

export default function HanFloPOS() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [payment, setPayment] = useState<'Cash'|'MoMo'|'Card'>('Cash')
  const [barcode, setBarcode] = useState('')
  const [role, setRole] = useState<'admin'|'cashier'|null>(null)
  const [logged, setLogged] = useState(false)
  const [user, setUser] = useState(''), [pass, setPass] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [offlineSales, setOfflineSales] = useState<any[]>([])
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newProd, setNewProd] = useState({ name:'', barcode:'', price:'', stock:'', category:'Drinks', image:'🛍️' })
  const [syncing, setSyncing] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({ name:'', barcode:'', price:'', stock:'', category:'Drinks', image:'🛍️' })
  const [uploading, setUploading] = useState(false)
  const [cashiers, setCashiers] = useState<any[]>([])
  const [newCashier, setNewCashier] = useState({username:'', password:'', name:''})
  const [showCashiers, setShowCashiers] = useState(false)
  const [showEditCashier, setShowEditCashier] = useState(false)
  const [editingCashier, setEditingCashier] = useState<any>(null)
  const [editCashierForm, setEditCashierForm] = useState({username:'', password:'', name:''})
  const [showDashboard, setShowDashboard] = useState(true)
  const [showBusiness, setShowBusiness] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [custPhone, setCustPhone] = useState('')
  const [custName, setCustName] = useState('')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [business, setBusiness] = useState<BusinessInfo>({
    shopName: 'HanFlo Tech Ghana Ltd',
    slogan: 'Your Trusted Retail Partner',
    address: 'Plot 12, Winneba Junction, Central Region, GH',
    phone: '+233 24 123 4567',
    momo: '059 123 4567 - HanFlo Tech',
    tin: 'TIN: C0001234567 | VAT Reg: 123456',
    vatRate: 15,
    serviceCharge: 0
  })

  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0)
  const vatAmount = subtotal * (business.vatRate/100)
  const total = subtotal + vatAmount + (subtotal * business.serviceCharge/100)

  function renderImage(img?: string | null){
    if(!img) return '🛍️'
    if(img.startsWith('http') || img.startsWith('https') || img.startsWith('data:image')) return <img src={img} alt="prod" className="w-full h-full object-cover" />
    return img
  }

  async function uploadImage(file: File): Promise<string> {
    setUploading(true)
    try{
      const { supabase } = await import('@/lib/supabase')
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g,'-').toLowerCase()
      const fileName = `${Date.now()}-${cleanName}`
      const { error } = await supabase.storage.from('products').upload(fileName, file)
      if(!error){
        const { data } = supabase.storage.from('products').getPublicUrl(fileName)
        setUploading(false)
        return data.publicUrl
      }
    }catch{}
    try{
      const compressed = await new Promise<string>((resolve)=>{
        const img = new Image()
        const reader = new FileReader()
        reader.onload = (ev)=>{
          img.onload = ()=>{
            const canvas = document.createElement('canvas')
            const MAX = 400
            let w = img.width, h = img.height
            if(w > h){ if(w > MAX){ h = h * MAX / w; w = MAX } }
            else{ if(h > MAX){ w = w * MAX / h; h = MAX } }
            canvas.width = w; canvas.height = h
            const ctx = canvas.getContext('2d')
            ctx?.drawImage(img, 0, 0, w, h)
            resolve(canvas.toDataURL('image/jpeg', 0.6))
          }
          img.src = ev.target?.result as string
        }
        reader.readAsDataURL(file)
      })
      setUploading(false)
      return compressed
    }catch(err:any){
      setUploading(false)
      throw err
    }
  }

  useEffect(()=>{
    const bid = localStorage.getItem('business_id')
    const storedRole = localStorage.getItem('role')
    const staffName = localStorage.getItem('staff_name')
    const ownerEmail = localStorage.getItem('owner_email')
    const staffUsername = localStorage.getItem('staff_username')
    if(bid){
      setLogged(true)
      if(storedRole === 'cashier'){
        setRole('cashier')
        setUser(staffUsername || staffName || 'cashier')
      } else {
        setRole('admin')
        setUser(ownerEmail || 'admin')
      }
    }
  }, [])

  useEffect(()=>{
    const handler = (e:any)=>{ e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    const savedBiz = localStorage.getItem('swift_business')
    if(savedBiz) setBusiness(JSON.parse(savedBiz))
    const savedCust = localStorage.getItem('swift_customers')
    if(savedCust) setCustomers(JSON.parse(savedCust))
    
    async function load(){
      try{
        const { supabase } = await import('@/lib/supabase')
        const storedBid = localStorage.getItem('business_id')
        const bidNumber = storedBid ? Number(storedBid) : null

        let prodQuery = supabase.from('products').select('*').order('name')
        if(bidNumber) prodQuery = prodQuery.eq('business_id', bidNumber)
        const { data } = await prodQuery
        if(data) setProducts(data.map((p:any)=>({ id:p.id, name:p.name, barcode:p.barcode, price:Number(p.price), stock:Number(p.stock), category:p.category||'General', image:p.image||'🛍️' })))
        
        let cashierQuery = supabase.from('cashiers').select('*').order('username')
        if(bidNumber) cashierQuery = cashierQuery.eq('business_id', bidNumber)
        const { data: cashierData } = await cashierQuery
        if(cashierData) setCashiers(cashierData)

        let salesQuery = supabase.from('sales').select('*').order('created_at', {ascending:false}).limit(100)
        if(bidNumber) salesQuery = salesQuery.eq('business_id', bidNumber)
        const { data: sales } = await salesQuery
        if(sales) setSalesHistory(sales)

        const { data: custData } = await supabase.from('customers').select('*').order('total_spent', {ascending:false}).limit(200)
        if(custData && custData.length>0){
          const mapped = custData.map((c:any)=>({ phone:c.phone, name:c.name, visits:c.visits, totalSpent:Number(c.total_spent) }))
          setCustomers(mapped)
          localStorage.setItem('swift_customers', JSON.stringify(mapped))
        }
        if(bidNumber){
          const { data: bizData } = await supabase.from('business_info').select('*').eq('id', bidNumber).single()
          if(bizData){
            const mappedBiz = { shopName: bizData.shop_name || bizData.business_name || '', slogan: bizData.slogan || '', address: bizData.address || '', phone: bizData.phone || '', momo: bizData.momo || '', tin: bizData.tin || '', vatRate: Number(bizData.vat_rate || 0), serviceCharge: Number(bizData.service_charge || 0) }
            setBusiness(mappedBiz)
            localStorage.setItem('swift_business', JSON.stringify(mappedBiz))
          }
        } else {
          const { data: bizData } = await supabase.from('business_info').select('*').eq('id',1).single()
          if(bizData){
            const mappedBiz = { shopName: bizData.shop_name || bizData.business_name || '', slogan: bizData.slogan || '', address: bizData.address || '', phone: bizData.phone || '', momo: bizData.momo || '', tin: bizData.tin || '', vatRate: Number(bizData.vat_rate || 0), serviceCharge: Number(bizData.service_charge || 0) }
            setBusiness(mappedBiz)
            localStorage.setItem('swift_business', JSON.stringify(mappedBiz))
          }
        }
      }catch{}
      setLoadingProducts(false)
    }
    load()
    const saved = localStorage.getItem('swift_offline_sales')
    if(saved) setOfflineSales(JSON.parse(saved))
    let buffer='', lastTime=Date.now()
    const onKey = (e: KeyboardEvent)=>{
      const active = document.activeElement as HTMLElement | null
      const isTyping = active && (active.tagName==='INPUT' || active.tagName==='TEXTAREA' || active.isContentEditable)
      if(isTyping){
        if(e.key==='Enter' && active===inputRef.current && buffer.length>3){
          handleBarcode(buffer); buffer=''
        }
        return
      }
      if(!e.key) return
      const now=Date.now()
      if(now-lastTime>300) buffer=''
      lastTime=now
      if(e.key==='Enter'&&buffer.length>3){ handleBarcode(buffer); buffer='' }
      else if(e.key.length===1) buffer+=e.key
    }
    window.addEventListener('keydown', onKey)
    return ()=>window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(()=>{
    const goOnline = ()=>{ if(offlineSales.length) syncToSupabase() }
    window.addEventListener('online', goOnline)
    return ()=>window.removeEventListener('online', goOnline)
  }, [offlineSales])

  useEffect(()=>{
    const interval = setInterval(()=>{
      if(typeof navigator !== 'undefined' && navigator.onLine && offlineSales.length>0 && !syncing){
        syncToSupabase()
      }
    }, 30000)
    return ()=>clearInterval(interval)
  }, [offlineSales, syncing])

  async function syncToSupabase(){
    if(!offlineSales.length) return
    setSyncing(true)
    try{
      const { supabase } = await import('@/lib/supabase')
      const storedBid = localStorage.getItem('business_id')
      const bidNumber = storedBid ? Number(storedBid) : null
      for(const sale of offlineSales){
        const { data: saleRow, error } = await supabase.from('sales').insert({
          total: sale.total,
          subtotal: sale.subtotal,
          vat_amount: sale.vatAmount ?? sale.vat_amount,
          payment_type: sale.payment_type,
          cashier_id: sale.cashier_id,
          customer_name: sale.customer_name || null,
          customer_phone: sale.customer_phone || null,
          items: sale.items,
          business_id: sale.business_id || bidNumber,
          created_at: sale.created_at
        }).select().single()
        
        if(error){
          console.log('Sale insert error:', error)
          continue
        }

        if(saleRow){
          const items = sale.items.map((i:any)=>({ 
            sale_id: saleRow.id, 
            product_id: i.id, 
            product_name: i.name,
            qty: i.qty, 
            price: i.price 
          }))
          await supabase.from('sale_items').insert(items)
          for(const it of sale.items){
            try{
              const { data: prod } = await supabase.from('products').select('stock').eq('id', it.id).single()
              if(prod){
                const newStock = Math.max(0, Number(prod.stock) - Number(it.qty))
                await supabase.from('products').update({ stock: newStock }).eq('id', it.id)
              }
            }catch{}
          }
        }
      }
      localStorage.removeItem('swift_offline_sales')
      setOfflineSales([])
      let salesQuery = supabase.from('sales').select('*').order('created_at', {ascending:false}).limit(100)
      if(bidNumber) salesQuery = salesQuery.eq('business_id', bidNumber)
      const { data: sales } = await salesQuery
      if(sales) setSalesHistory(sales)
    }catch(e:any){ console.log('Auto-sync failed, will retry:', e.message) }
    setSyncing(false)
  }

  function beep(){ try{ const ctx = new (window.AudioContext||(window as any).webkitAudioContext)(); const o=ctx.createOscillator(); o.frequency.value=900; o.connect(ctx.destination); o.start(); setTimeout(()=>o.stop(),120)}catch{} }
  function handleBarcode(code:string){
    const p = products.find(pr=> (pr.barcode&&pr.barcode===code) || pr.name.toLowerCase().includes(code.toLowerCase()))
    if(p){ addToCart(p); beep(); setBarcode('') } else setBarcode(code)
  }
  function addToCart(p:Product){
    if(p.stock<=0) return alert('Out of stock')
    setCart(c=>{
      const ex=c.find(i=>i.id===p.id)
      if(ex) return c.map(i=>i.id===p.id?{...i, qty:i.qty+1}:i)
      return [...c, {...p, qty:1}]
    })
  }

  async function checkout(){
    if(!cart.length) return
    if(subtotal < 0 || total < 0) return alert('Invalid total')
    const storedBid = localStorage.getItem('business_id')
    const bidNumber = storedBid ? Number(storedBid) : null
    const sale={ 
      id: Date.now().toString(), 
      subtotal, 
      vatAmount, 
      vat_amount: vatAmount,
      total, 
      payment_type:payment, 
      cashier_id:user, 
      customer_phone: custPhone || null, 
      customer_name: custName || null, 
      items:cart, 
      business_id: bidNumber,
      created_at:new Date().toISOString() 
    }
    
    if(custPhone){
      const existing = customers.find(c=>c.phone===custPhone)
      let updated: Customer[]
      if(existing){
        updated = customers.map(c=> c.phone===custPhone ? { ...c, visits: c.visits+1, totalSpent: c.totalSpent+total, name: custName||c.name } : c)
      } else {
        updated = [...customers, { phone: custPhone, name: custName||'Customer', visits:1, totalSpent: total }]
      }
      setCustomers(updated)
      localStorage.setItem('swift_customers', JSON.stringify(updated))
      try{
        const { supabase } = await import('@/lib/supabase')
        const existingCust = updated.find(c=>c.phone===custPhone)!
        await supabase.from('customers').upsert({ phone: existingCust.phone, name: existingCust.name, visits: existingCust.visits, total_spent: existingCust.totalSpent, updated_at: new Date().toISOString() }, {onConflict:'phone'})
      }catch(e){ console.log('Customer cloud save failed', e) }
    }

    const newOffline=[...offlineSales, sale]
    setOfflineSales(newOffline)
    localStorage.setItem('swift_offline_sales', JSON.stringify(newOffline))
    localStorage.setItem('swift_offline_backup_'+sale.id, JSON.stringify(sale))
    
    setProducts(ps=>ps.map(p=>{
      const inCart=cart.find(c=>c.id===p.id)
      return inCart?{...p, stock: Math.max(0, p.stock-inCart.qty)}:p
    }))
    try{
      const { supabase } = await import('@/lib/supabase')
      for(const item of cart){
        const prod = products.find(pp=>pp.id===item.id)
        if(prod){
          const newStock = Math.max(0, prod.stock - item.qty)
          await supabase.from('products').update({ stock: newStock }).eq('id', item.id)
        }
      }
    }catch(e){ console.log('Stock cloud update failed, will sync later', e) }

    setLastSale(sale)
    setShowReceipt(true)
    setCart([])
    setCustPhone(''); setCustName('')
    if(typeof navigator !== 'undefined' && navigator.onLine){
      setTimeout(()=>syncToSupabase(), 1000)
    }
  }

  function openEdit(p:Product){
    setEditing(p)
    setEditForm({ name:p.name, barcode:p.barcode||'', price:String(p.price), stock:String(p.stock), category:p.category||'General', image:p.image||'🛍️' })
    setShowEdit(true)
  }
  function openEditCashier(c:any){
    setEditingCashier(c)
    setEditCashierForm({username:c.username, password:c.password, name:c.name||''})
    setShowEditCashier(true)
  }
  function printBarcode(p:Product){
    const w = window.open('', '', 'width=400,height=400')
    if(!w) return
    w.document.write(`<html><body style="font-family:monospace;text-align:center;padding:20px"><h3>${p.name}</h3><div style="font-size:48px;letter-spacing:5px;margin:20px 0">*${p.barcode||p.id.slice(0,8)}*</div><div>${p.barcode||p.id.slice(0,8)}</div><div style="font-weight:bold;margin-top:10px">GHS ${p.price}</div><div style="font-size:10px;margin-top:10px">${business.shopName}</div><script>window.print();setTimeout(()=>window.close(),500)</script></body></html>`)
  }

  if(!logged){
    if(typeof window !== 'undefined'){
      const bid = localStorage.getItem('business_id')
      if(!bid){
        window.location.href = '/admin-login'
      }
    }
    return(
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-neutral-500 text-sm">Loading POS... If not redirected, <a href="/admin-login" className="text-[#d4af78] underline">go to login</a></div>
      </div>
    )
  }

  const categories=['All',...Array.from(new Set(products.map(p=>p.category||'General')))]
  const filtered=products.filter(p=> (cat==='All'||p.category===cat) && (p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode||'').includes(search)))
  const allSales = [...offlineSales, ...salesHistory]
  const todaySales = allSales.filter(s=> new Date(s.created_at).toDateString()===new Date().toDateString())
  const todayTotal = todaySales.reduce((sum,s)=>sum+Number(s.total||0),0)
  const cashierStats = cashiers.map(c=>{
    const s = allSales.filter(x=>x.cashier_id===c.username)
    return { ...c, count: s.length, total: s.reduce((a,b)=>a+Number(b.total||0),0) }
  })
  const loyalCustomers = customers.sort((a,b)=>b.totalSpent-a.totalSpent).slice(0,5)

  return(
    <div className="min-h-screen bg-[#080808] text-white p-3 flex gap-3">
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        <div className="flex gap-2 items-center bg-white/5 backdrop-blur p-3 rounded-2xl border border-white/10">
          <h1 className="text-[#d4af78] tracking-[4px] font-light">HanFloPOS</h1>
          <span className="text-[10px] bg-white/10 px-2 py-1 rounded-full">{role?.toUpperCase()} - {user}</span>
          <button onClick={syncToSupabase} disabled={syncing || !offlineSales.length} className={`text-[10px] px-2 py-1 rounded-full ml-2 border ${offlineSales.length?'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse':'bg-green-500/20 text-green-400 border-green-500/20'}`}>● {typeof navigator !== 'undefined' && navigator.onLine?'ONLINE':'OFFLINE'} {offlineSales.length?`(${offlineSales.length})`:''} {syncing?' Syncing...':''}</button>
          {deferredPrompt && <button onClick={()=>{deferredPrompt.prompt()}} className="text-[10px] bg-[#d4af78] text-black px-3 py-1 rounded-full font-bold ml-2">📲 Install App</button>}
          {role==='admin' && <button onClick={()=>setShowDashboard(!showDashboard)} className="text-[10px] bg-white/10 px-2 py-1 rounded-full ml-2">{showDashboard?'Products':'Dashboard'}</button>}
          <div className="ml-auto flex gap-2">
            <input ref={inputRef} value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleBarcode(barcode)} placeholder="Scan barcode" className="bg-black/50 border border-white/10 px-3 py-2 rounded-xl text-sm w-[220px] outline-none"/>
            <button onClick={()=>{
              localStorage.removeItem('business_id')
              localStorage.removeItem('role')
              localStorage.removeItem('staff_name')
              localStorage.removeItem('staff_username')
              localStorage.removeItem('owner_email')
              localStorage.removeItem('business_name')
              setLogged(false)
              window.location.href='/admin-login'
            }} className="text-neutral-500 text-sm">Logout</button>
          </div>
        </div>

        {role==='admin' && showDashboard ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-[#d4af78]/20 to-[#d4af78]/5 border border-[#d4af78]/20 p-4 rounded-2xl"><div className="text-[10px] text-neutral-400">TODAY SALES</div><div className="text-2xl font-black text-[#d4af78]">GHS {todayTotal.toFixed(2)}</div><div className="text-[10px] text-neutral-500">{todaySales.length} transactions</div></div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl"><div className="text-[10px] text-neutral-400">TOTAL SALES</div><div className="text-2xl font-black">GHS {allSales.reduce((s,x)=>s+Number(x.total||0),0).toFixed(2)}</div><div className="text-[10px] text-neutral-500">{allSales.length} total</div></div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl"><div className="text-[10px] text-neutral-400">LOW STOCK</div><div className="text-2xl font-black text-red-400">{products.filter(p=>p.stock<10).length}</div><div className="text-[10px] text-neutral-500">items &lt; 10</div></div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl"><div className="text-[10px] text-neutral-400">CUSTOMERS</div><div className="text-2xl font-black">{customers.length}</div><div className="text-[10px] text-neutral-500">cloud saved</div></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-[#d4af78] text-xs font-bold mb-3">Cashier Performance</div>
                <div className="space-y-2">
                  {cashierStats.map(c=>(
                    <div key={c.id} className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl text-xs">
                      <div><div className="font-bold">{c.username} - {c.name}</div><div className="text-[10px] text-neutral-500">{c.count} sales</div></div>
                      <div className="text-[#d4af78] font-bold">GHS {c.total.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-[#d4af78] text-xs font-bold mb-3">Top Loyal Customers</div>
                <div className="space-y-2">
                  {loyalCustomers.map(c=>(
                    <div key={c.phone} className="flex justify-between items-center bg-black/30 p-2.5 rounded-xl text-xs">
                      <div><div className="font-bold">{c.name} • {c.phone}</div><div className="text-[10px] text-neutral-500">{c.visits} visits</div></div>
                      <div className="text-[#d4af78] font-bold">GHS {c.totalSpent.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3"><div className="text-[#d4af78] text-xs font-bold">Business Settings (Cloud)</div><button onClick={()=>setShowBusiness(!showBusiness)} className="text-[10px] bg-white/10 px-2 py-1 rounded-full">{showBusiness?'Hide':'Edit'}</button></div>
              {showBusiness && (
                <div className="grid grid-cols-2 gap-2">
                  <input value={business.shopName || ''} onChange={e=>setBusiness({...business, shopName:e.target.value})} placeholder="Shop Name" className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
                  <input value={business.phone || ''} onChange={e=>setBusiness({...business, phone:e.target.value})} placeholder="Phone" className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
                  <input value={business.address || ''} onChange={e=>setBusiness({...business, address:e.target.value})} placeholder="Address" className="col-span-2 bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
                  <input value={business.momo || ''} onChange={e=>setBusiness({...business, momo:e.target.value})} placeholder="MoMo" className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
                  <input value={business.tin || ''} onChange={e=>setBusiness({...business, tin:e.target.value})} placeholder="TIN/VAT" className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
                  <div className="flex gap-2">
                    <div className="flex-1"><label className="text-[9px] text-neutral-400">VAT %</label><input type="number" value={business.vatRate} onChange={e=>{const v=Math.max(0,Number(e.target.value)); setBusiness({...business, vatRate:v})}} className="w-full bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/></div>
                    <div className="flex-1"><label className="text-[9px] text-neutral-400">Service %</label><input type="number" value={business.serviceCharge} onChange={e=>{const v=Math.max(0,Number(e.target.value)); setBusiness({...business, serviceCharge:v})}} className="w-full bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/></div>
                  </div>
                  <button onClick={async()=>{
                    localStorage.setItem('swift_business', JSON.stringify(business))
                    try{
                      const { supabase } = await import('@/lib/supabase')
                      const storedBid = localStorage.getItem('business_id')
                      const bidNumber = storedBid ? Number(storedBid) : 1
                      await supabase.from('business_info').upsert({ id: bidNumber, shop_name: business.shopName, business_name: business.shopName, slogan: business.slogan, address: business.address, phone: business.phone, momo: business.momo, tin: business.tin, vat_rate: business.vatRate, service_charge: business.serviceCharge, updated_at: new Date().toISOString() })
                      alert('Saved to cloud!')
                    }catch{ alert('Saved locally') }
                  }} className="col-span-2 bg-[#d4af78] text-black py-2 rounded-lg text-xs font-bold mt-2">Save to Cloud</button>
                </div>
              )}
              {!showBusiness && <div className="text-[11px] text-neutral-400">{business.shopName} • {business.address} • VAT {business.vatRate}%</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">{categories.map(c=><button key={c} onClick={()=>setCat(c)} className={`px-3 py-1.5 rounded-full text-xs border ${cat===c?'bg-[#d4af78] text-black':'bg-white/5 border-white/10 text-neutral-400'}`}>{c}</button>)}</div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product or scan..." className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-sm outline-none"/>
            {loadingProducts ? <div className="text-center text-neutral-500 mt-10">Loading...</div> : (
              <div className="grid grid-cols-4 gap-3 overflow-y-auto">
                {filtered.map(p=>(
                  <button key={p.id} onClick={()=>addToCart(p)} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 text-left disabled:opacity-30" disabled={p.stock<=0}>
                    <div className="flex justify-between text-[10px]"><span className={`px-2 py-0.5 rounded-full ${p.stock<10?'bg-red-500 text-white':'bg-[#d4af78] text-black'}`}>{p.stock} left</span><span className="text-[9px] text-neutral-500">{p.barcode?.slice(0,8)}</span></div>
                    <div className="w-full h-[70px] flex items-center justify-center my-2 overflow-hidden rounded-xl bg-black/30 text-3xl">{renderImage(p.image)}</div>
                    <div className="font-bold text-[13px] truncate">{p.name}</div>
                    <div className="text-[#d4af78] font-bold text-sm">GHS {p.price}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {role==='admin' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-2">
            <div className="flex justify-between items-center mb-3"><div className="text-[#d4af78] text-sm font-bold">Admin Panel</div><button onClick={()=>setShowAdd(true)} className="bg-[#d4af78] text-black px-3 py-1.5 rounded-full text-xs font-bold">+ Add Product</button></div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 mb-3">
              <div className="flex justify-between items-center">
                <div className="text-xs font-bold text-[#d4af78]">Team Members ({cashiers.length})</div>
                <button onClick={()=>setShowCashiers(!showCashiers)} className="text-[10px] bg-white/10 px-2 py-1 rounded-full">{showCashiers?'Hide':'Manage'}</button>
              </div>
              {showCashiers && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input value={newCashier.username} onChange={e=>setNewCashier({...newCashier, username:e.target.value})} placeholder="username" className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
                    <input value={newCashier.password} onChange={e=>setNewCashier({...newCashier, password:e.target.value})} placeholder="password" className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
                    <input value={newCashier.name} onChange={e=>setNewCashier({...newCashier, name:e.target.value})} placeholder="Full name" className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
                  </div>
                  <button onClick={async()=>{
                    if(!newCashier.username || !newCashier.password) return alert('Enter username & password')
                    try{
                      const { supabase } = await import('@/lib/supabase')
                      const storedBid = localStorage.getItem('business_id')
                      const bidNumber = storedBid ? Number(storedBid) : null
                      const { data, error } = await supabase.from('cashiers').insert({ username: newCashier.username, password: newCashier.password, name: newCashier.name, business_id: bidNumber }).select().single()
                      if(error) throw error
                      setCashiers([...cashiers, data])
                      setNewCashier({username:'', password:'', name:''})
                    }catch(e:any){ alert('Error: '+(e.message||JSON.stringify(e))) }
                  }} className="w-full bg-[#d4af78] text-black py-2 rounded-lg text-xs font-bold">+ Create Cashier Login</button>
                  <div className="space-y-1 max-h-[150px] overflow-y-auto">
                    {cashiers.map((c:any)=>
                      <div key={c.id} className="flex justify-between items-center bg-white/5 p-2 rounded-lg text-xs">
                        <span>{c.username} - {c.name}</span>
                        <div className="flex gap-1">
                          <button onClick={()=>openEditCashier(c)} className="bg-[#d4af78]/20 text-[#d4af78] px-2 py-0.5 rounded-full text-[10px]">Edit</button>
                          <button onClick={async()=>{
                            if(!confirm('Delete '+c.username+'?')) return
                            const { supabase } = await import('@/lib/supabase')
                            await supabase.from('cashiers').delete().eq('id', c.id)
                            setCashiers(cashiers.filter(x=>x.id!==c.id))
                          }} className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[10px]">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 mb-2">Products - Edit Price + Photo + Print Barcode</div>
            <div className="flex gap-2 flex-wrap">
              {products.map(p=><div key={p.id} className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-full pl-1 pr-2 py-1 text-xs"><div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">{renderImage(p.image)}</div><span className="max-w-[80px] truncate">{p.name}</span><span className="text-[#d4af78]">GHS {p.price}</span><button onClick={()=>openEdit(p)} className="bg-white/10 px-2 py-1 rounded-full text-[10px]">Edit</button><button onClick={()=>printBarcode(p)} className="bg-white/10 px-2 py-1 rounded-full text-[10px]">🏷️</button></div>)}
            </div>
            {showAdd && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur z-[200] flex items-center justify-center p-4">
                <div className="bg-[#151515] border border-[#d4af78]/30 rounded-2xl p-6 w-[400px]">
                  <div className="flex justify-between mb-4"><h3 className="text-[#d4af78] font-bold">Add Product</h3><button onClick={()=>setShowAdd(false)} className="w-7 h-7 bg-white/10 rounded-full">✕</button></div>
                  <div className="space-y-3">
                    <input value={newProd.name} onChange={e=>setNewProd({...newProd, name:e.target.value})} placeholder="Product Name" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={newProd.price} onChange={e=>{
                        const v = e.target.value
                        if(v!=='' && Number(v)<0) return
                        setNewProd({...newProd, price:v})
                      }} type="number" min="0" placeholder="Price GHS" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/>
                      <input value={newProd.stock} onChange={e=>{
                        const v = e.target.value
                        if(v!=='' && Number(v)<0) return
                        setNewProd({...newProd, stock:v})
                      }} type="number" min="0" placeholder="Stock" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/>
                    </div>
                    <input value={newProd.barcode} onChange={e=>setNewProd({...newProd, barcode:e.target.value})} placeholder="Barcode" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/>
                    <div className="bg-white/5 border border-dashed border-white/20 p-3 rounded-xl">
                      <div className="text-xs text-neutral-400 mb-2">Upload Photo</div>
                      <input type="file" accept="image/*" onChange={async e=>{ if(e.target.files?.[0]){ const url = await uploadImage(e.target.files[0]); setNewProd({...newProd, image:url}) } }} className="w-full text-xs"/>
                      {uploading && <div className="text-[11px] text-yellow-400 mt-2">Compressing...</div>}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-24 h-24 rounded-xl overflow-hidden bg-black/30 flex items-center justify-center">{renderImage(newProd.image)}</div>
                        {newProd.image && newProd.image !== '🛍️' && <button onClick={()=>setNewProd({...newProd, image:'🛍️'})} className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full text-xs">🗑️ Remove</button>}
                      </div>
                    </div>
                  </div>
                  <button disabled={uploading} onClick={async()=>{
                    if(!newProd.name || !newProd.price) return alert('Enter name & price')
                    if(Number(newProd.price) < 0 || Number(newProd.stock) < 0) return alert('Price and stock cannot be negative')
                    try{
                      const { supabase } = await import('@/lib/supabase')
                      const storedBid = localStorage.getItem('business_id')
                      const bidNumber = storedBid ? Number(storedBid) : null
                      const { data, error } = await supabase.from('products').insert({ name: newProd.name, price: Number(newProd.price), stock: Number(newProd.stock)||0, barcode: newProd.barcode||null, image: newProd.image, category: newProd.category, business_id: bidNumber }).select().single()
                      if(error) throw error
                      if(data) setProducts([...products, {...data, price:Number(data.price), stock:Number(data.stock), image: data.image}])
                      setNewProd({ name:'', barcode:'', price:'', stock:'', category:'Drinks', image:'🛍️' })
                      setShowAdd(false)
                    }catch(e:any){ alert('Add failed: '+(e.message||JSON.stringify(e))) }
                  }} className="w-full bg-[#d4af78] text-black py-3 rounded-xl font-bold mt-5">Add to Supabase</button>
                </div>
              </div>
            )}
            {showEdit && editing && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur z-[200] flex items-center justify-center p-4">
                <div className="bg-[#151515] border border-[#d4af78]/30 rounded-2xl p-6 w-[400px]">
                  <div className="flex justify-between mb-4"><h3 className="text-[#d4af78] font-bold">Edit Product</h3><button onClick={()=>setShowEdit(false)} className="w-7 h-7 bg-white/10 rounded-full">✕</button></div>
                  <div className="space-y-3">
                    <input value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} placeholder="Name" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-[10px] text-[#d4af78]">PRICE (GHS)</label><input value={editForm.price} onChange={e=>{
                        const v=e.target.value
                        if(v!=='' && Number(v)<0) return
                        setEditForm({...editForm, price:v})
                      }} type="number" min="0" step="0.01" className="w-full bg-white/5 border border-[#d4af78]/40 p-3 rounded-xl text-sm outline-none font-bold"/></div>
                      <div><label className="text-[10px] text-neutral-400">STOCK</label><input value={editForm.stock} onChange={e=>{
                        const v=e.target.value
                        if(v!=='' && Number(v)<0) return
                        setEditForm({...editForm, stock:v})
                      }} type="number" min="0" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/></div>
                    </div>
                    <input value={editForm.barcode} onChange={e=>setEditForm({...editForm, barcode:e.target.value})} placeholder="Barcode" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/>
                    <div className="bg-white/5 border border-dashed border-white/20 p-3 rounded-xl">
                      <div className="text-xs text-neutral-400 mb-2">Change Photo</div>
                      <input type="file" accept="image/*" onChange={async e=>{ if(e.target.files?.[0]){ const url = await uploadImage(e.target.files[0]); setEditForm({...editForm, image:url}) } }} className="w-full text-xs"/>
                      {uploading && <div className="text-[11px] text-yellow-400 mt-2">Compressing...</div>}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-24 h-24 rounded-xl overflow-hidden bg-black/30 flex items-center justify-center">{renderImage(editForm.image)}</div>
                        {editForm.image && editForm.image !== '🛍️' && <button onClick={()=>setEditForm({...editForm, image:'🛍️'})} className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full text-xs">🗑️ Remove Photo</button>}
                        <button onClick={()=>editing && printBarcode(editing)} className="bg-white/10 px-3 py-1.5 rounded-full text-xs">🏷️ Print Barcode</button>
                      </div>
                    </div>
                  </div>
                  <button disabled={uploading} onClick={async()=>{
                    if(Number(editForm.price) < 0 || Number(editForm.stock) < 0) return alert('Price and stock cannot be negative')
                    try{
                      const { supabase } = await import('@/lib/supabase')
                      const payload = { name: editForm.name, price: Number(editForm.price), stock: Number(editForm.stock), barcode: editForm.barcode || null, image: editForm.image }
                      if(payload.image === '🛍️' && editing?.image?.includes('supabase')){
                        try{ const fileName = editing.image.split('/').pop() || ''; if(fileName) await supabase.storage.from('products').remove([fileName]) }catch{}
                      }
                      const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
                      if(error) throw error
                      setProducts(ps=>ps.map(p=> p.id===editing.id ? { ...p, name: payload.name, price: payload.price, stock: payload.stock, barcode: payload.barcode, image: payload.image } : p))
                      setShowEdit(false)
                    }catch(e:any){ alert('Update failed: '+(e.message||JSON.stringify(e))) }
                  }} className="w-full bg-[#d4af78] text-black py-3 rounded-xl font-bold mt-5">Save Changes</button>
                </div>
              </div>
            )}
            {showEditCashier && editingCashier && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur z-[210] flex items-center justify-center p-4">
                <div className="bg-[#151515] border border-[#d4af78]/30 rounded-2xl p-6 w-[380px]">
                  <div className="flex justify-between mb-4"><h3 className="text-[#d4af78] font-bold">Edit Cashier</h3><button onClick={()=>setShowEditCashier(false)} className="w-7 h-7 bg-white/10 rounded-full">✕</button></div>
                  <div className="space-y-3">
                    <div><label className="text-[10px] text-[#d4af78]">USERNAME</label><input value={editCashierForm.username} onChange={e=>setEditCashierForm({...editCashierForm, username:e.target.value})} className="w-full bg-white/5 border border-[#d4af78]/40 p-3 rounded-xl text-sm outline-none font-bold"/></div>
                    <div><label className="text-[10px] text-neutral-400">PASSWORD</label><input value={editCashierForm.password} onChange={e=>setEditCashierForm({...editCashierForm, password:e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/></div>
                    <div><label className="text-[10px] text-neutral-400">FULL NAME</label><input value={editCashierForm.name} onChange={e=>setEditCashierForm({...editCashierForm, name:e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm outline-none"/></div>
                  </div>
                  <button onClick={async()=>{
                    try{
                      const { supabase } = await import('@/lib/supabase')
                      const payload = { username: editCashierForm.username, password: editCashierForm.password, name: editCashierForm.name }
                      const { error } = await supabase.from('cashiers').update(payload).eq('id', editingCashier.id)
                      if(error) throw error
                      setCashiers(cs=>cs.map(c=> c.id===editingCashier.id ? { ...c, ...payload } : c))
                      setShowEditCashier(false)
                    }catch(e:any){ alert('Update failed: '+(e.message||JSON.stringify(e))) }
                  }} className="w-full bg-[#d4af78] text-black py-3 rounded-xl font-bold mt-5">Save Cashier Changes</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-[380px] bg-white/[0.08] backdrop-blur-[30px] border border-[#d4af78]/20 rounded-[24px] p-4 flex flex-col">
        <h2 className="text-[#d4af78] tracking-[2px] mb-3">👜 CART ({cart.reduce((s,i)=>s+i.qty,0)})</h2>
        <div className="bg-black/30 border border-white/10 p-2.5 rounded-xl mb-3 space-y-2">
          <div className="text-[10px] text-[#d4af78] font-bold">Customer (Cloud Loyalty)</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={custPhone} onChange={e=>setCustPhone(e.target.value)} placeholder="Phone: 024..." className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
            <input value={custName} onChange={e=>setCustName(e.target.value)} placeholder="Name" className="bg-white/5 border border-white/10 p-2 rounded-lg text-xs outline-none"/>
          </div>
          {custPhone && customers.find(c=>c.phone===custPhone) && <div className="text-[10px] text-green-400">⭐ Loyal: {customers.find(c=>c.phone===custPhone)?.visits} visits</div>}
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.map(i=>(
            <div key={i.id} className="flex gap-3 bg-black/30 border border-white/5 p-2.5 rounded-xl">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center text-xl">{renderImage(i.image)}</div>
              <div className="flex-1"><div className="text-[13px] font-bold">{i.name}</div><div className="text-[11px] text-neutral-500">GHS {i.price} x {i.qty}</div></div>
              <div className="flex flex-col gap-1"><button onClick={()=>setCart(c=>c.map(x=>x.id===i.id?{...x, qty:x.qty+1}:x))} className="w-6 h-6 bg-[#d4af78]/20 text-[#d4af78] rounded">+</button><button onClick={()=>setCart(c=>c.flatMap(x=> x.id===i.id? (x.qty>1?[{...x, qty:x.qty-1}]:[]):[x]))} className="w-6 h-6 bg-white/10 rounded">-</button></div>
              <div className="text-[#d4af78] font-bold text-sm">GHS {i.price*i.qty}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-[#d4af78]/20 pt-3 mt-3 space-y-1">
          <div className="flex justify-between text-[12px] text-neutral-400"><span>Subtotal</span><span>GHS {subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-[11px] text-neutral-400"><span>VAT ({business.vatRate}%)</span><span>GHS {vatAmount.toFixed(2)}</span></div>
          <div className="flex justify-between font-black text-lg pt-2 border-t border-white/10"><span>Total</span><span className="text-[#d4af78]">GHS {total.toFixed(2)}</span></div>
          <div className="grid grid-cols-3 gap-2 mt-3">{(['Cash','MoMo','Card'] as const).map(m=><button key={m} onClick={()=>setPayment(m)} className={`py-2.5 rounded-xl text-xs font-bold border ${payment===m?'bg-[#d4af78] text-black':'bg-white/5 border-white/10 text-neutral-400'}`}>{m}</button>)}</div>
          <button onClick={checkout} className="w-full bg-gradient-to-r from-[#d4af78] to-[#f3e5c7] text-black py-3.5 rounded-xl font-black mt-3">CHECKOUT</button>
          <div className="text-[9px] text-neutral-500 text-center mt-1">Stock auto-updates to cloud • No data loss</div>
        </div>
      </div>

     {showReceipt && lastSale && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur z-[100] flex items-center justify-center p-4">
        <div id="print-receipt" className="bg-white text-black w-[350px] p-6 rounded-xl text-[11px] font-mono max-h-[90vh] overflow-y-auto">
          <div className="text-center border-b-2 border-black pb-3 mb-3">
            <div className="font-black tracking-[3px] text-[18px]">{business.shopName}</div>
            <div className="text-[9px] italic">{business.slogan}</div>
            <div className="text-[8px] mt-2 leading-4">{business.address}<br/>Tel: {business.phone}<br/>MoMo: {business.momo}</div>
            <div className="text-[7px] mt-2 font-bold border border-black px-2 py-1 inline-block">{business.tin}</div>
          </div>
          <div className="text-[9px] space-y-1 border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between"><span>Date:</span><span>{new Date(lastSale.created_at).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Receipt #:</span><span>#{lastSale.id.slice(-8).toUpperCase()}</span></div>
            <div className="flex justify-between"><span>Cashier:</span><span>{lastSale.cashier_id}</span></div>
            <div className="flex justify-between"><span>Payment:</span><span>{lastSale.payment_type}</span></div>
            {lastSale.customer_phone && (
              <>
                <div className="flex justify-between"><span>Customer:</span><span>{lastSale.customer_name || 'Customer'}</span></div>
                <div className="flex justify-between"><span>Phone:</span><span>{lastSale.customer_phone}</span></div>
              </>
            )}
          </div>
          <div className="border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between font-bold text-[9px] mb-1"><span>ITEM</span><span>AMT</span></div>
            {lastSale.items.map((c:any,i:number)=>
              <div key={i} className="flex justify-between py-1 text-[10px]">
                <span className="w-[70%] truncate">{c.name} x{c.qty} @ {c.price}</span>
                <span>GHS {(c.price*c.qty).toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="space-y-1 border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between"><span>Subtotal</span><span>GHS {lastSale.subtotal?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>VAT ({business.vatRate}%)</span><span>GHS {(lastSale.vatAmount ?? lastSale.vat_amount)?.toFixed(2)}</span></div>
            {business.serviceCharge > 0 && <div className="flex justify-between"><span>Service ({business.serviceCharge}%)</span><span>GHS {(lastSale.subtotal * business.serviceCharge/100).toFixed(2)}</span></div>}
            <div className="flex justify-between font-black text-[14px] border-t-2 border-black pt-2 mt-2"><span>TOTAL</span><span>GHS {lastSale.total.toFixed(2)}</span></div>
          </div>
          <div className="text-center text-[8px] space-y-1 pt-2">
            <div className="font-bold">Thank you for shopping at {business.shopName}!</div>
            <div>Goods sold are not returnable</div>
            <div className="mt-3 border-t border-black pt-2">
              <div>Powered by HanFlo Tech Ghana</div>
              <div className="text-[7px] mt-1">www.hanflotech.com.gh | Support: 0245 647 659</div>
              <div className="mt-2 font-bold text-[9px] tracking-[2px]">*** CUSTOMER COPY ***</div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 print:hidden">
            <button onClick={()=>window.print()} className="flex-1 bg-black text-white py-2.5 rounded-lg font-bold">🖨️ Print</button>
            <button onClick={()=>setShowReceipt(false)} className="flex-1 bg-[#d4af78] text-black py-2.5 rounded-lg font-bold">Done</button>
          </div>
        </div>
      </div>
     )}
    </div>
  )
}
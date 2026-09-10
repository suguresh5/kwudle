'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { KwudleLogo } from '@/components/ui/KwudleLogo'

const NAV1 = [
  {href:'/dashboard',label:'Command Center',icon:'⚡'},
  {href:'/dashboard/funnel',label:'Funnel',icon:'⬡'},
  {href:'/dashboard/heatmap',label:'Heatmap',icon:'▦'},
  {href:'/dashboard/suggestions',label:'Suggestions',icon:'⟡'},
]
const NAV2 = [
  {href:'/dashboard/sessions',label:'Sessions',icon:'◉'},
  {href:'/dashboard/deployments',label:'Deployments',icon:'⊞'},
  {href:'/dashboard/logs',label:'Logs',icon:'◫'},
  {href:'/dashboard/alerts',label:'Alerts',icon:'⚑'},
]

export function Sidebar({ user }: { user?: {email:string;name?:string} }) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(()=>setMounted(true),[])

  const handleLogout = async () => {
    await fetch('/api/auth/me',{method:'DELETE'})
    router.push('/login')
  }

  return (
    <aside style={{ width:'220px',flexShrink:0,height:'100vh',display:'flex',flexDirection:'column',background:'var(--glass-bg)',borderRight:'1px solid var(--border)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',position:'sticky',top:0 }}>
      <div style={{ padding:'20px 16px 16px',borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>
          <div style={{ width:'32px',height:'32px',borderRadius:'9px',background:'linear-gradient(135deg,#3b82f6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(59,130,246,0.3)',flexShrink:0 }}>
            <KwudleLogo size={16} />
          </div>
          <div>
            <div style={{ fontSize:'14px',fontWeight:'700',color:'var(--text)',letterSpacing:'-0.3px' }}>Kwudle</div>
            <div style={{ fontSize:'10px',color:'var(--text-3)',marginTop:'-1px' }}>Observability v3</div>
          </div>
        </div>
      </div>
      <nav style={{ flex:1,padding:'12px 10px',overflowY:'auto' }}>
        <div className="section-label" style={{ paddingLeft:'8px',marginBottom:'6px' }}>Analytics</div>
        {NAV1.map(({href,label,icon})=>(
          <Link key={href} href={href} className={`nav-item${pathname===href?' active':''}`}>
            <span style={{ fontSize:'13px',width:'18px',textAlign:'center',flexShrink:0 }}>{icon}</span>{label}
          </Link>
        ))}
        <div className="section-label" style={{ paddingLeft:'8px',marginTop:'20px',marginBottom:'6px' }}>Platform</div>
        {NAV2.map(({href,label,icon})=>(
          <Link key={href} href={href} className={`nav-item${pathname===href?' active':''}`}>
            <span style={{ fontSize:'13px',width:'18px',textAlign:'center',flexShrink:0 }}>{icon}</span>{label}
          </Link>
        ))}
      </nav>
      <div style={{ padding:'10px',borderTop:'1px solid var(--border)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',marginBottom:'4px' }}>
          <span style={{ fontSize:'13px',color:'var(--text-2)' }}>{mounted&&resolvedTheme==='dark'?'🌙 Dark':'☀️ Light'}</span>
          <button onClick={()=>setTheme(resolvedTheme==='dark'?'light':'dark')} style={{ width:'40px',height:'22px',borderRadius:'11px',border:'none',cursor:'pointer',background:mounted&&resolvedTheme==='dark'?'#3b82f6':'#e2e8f0',position:'relative',transition:'background 0.2s' }}>
            <div style={{ position:'absolute',top:'3px',left:mounted&&resolvedTheme==='dark'?'21px':'3px',width:'16px',height:'16px',borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
          </button>
        </div>
        {user&&<div style={{ display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',borderRadius:'10px',background:'var(--bg-2)' }}>
          <div style={{ width:'28px',height:'28px',borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#3b82f6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <span style={{ fontSize:'12px',fontWeight:'600',color:'white' }}>{(user.name||user.email)[0].toUpperCase()}</span>
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:'12px',fontWeight:'500',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user.name||user.email.split('@')[0]}</div>
            <div style={{ fontSize:'10px',color:'var(--text-3)' }}>Pro plan</div>
          </div>
          <button onClick={handleLogout} title="Sign out" style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'14px',padding:'2px' }}>⇥</button>
        </div>}
      </div>
    </aside>
  )
}

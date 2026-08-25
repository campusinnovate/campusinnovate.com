'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiActivity,FiBarChart2,FiBell,FiBookOpen,FiBriefcase,FiChevronDown,FiDollarSign,FiFileText,FiGrid,FiLogOut,FiTrendingUp,FiUser } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type Access={membership_status:string;permissions:string[];full_name?:string|null;position_name?:string|null};
const items=[
 {label:'Dashboard',href:'/ruang-kawan/dashboard/',icon:FiGrid,any:[]},
 {label:'My Activity',href:'/ruang-kawan/activity/',icon:FiActivity,any:['activity.view_self']},
 {label:'Marketing',href:'/ruang-kawan/marketing/',icon:FiTrendingUp,any:['marketing.view','content_plan.view','pipeline.view']},
 {label:'Project',href:'/ruang-kawan/projects/',icon:FiBriefcase,any:['projects.view']},
 {label:'KPI',href:'/ruang-kawan/kpi/',icon:FiBarChart2,any:['kpi.view_self']},
 {label:'Documents',href:'/ruang-kawan/documents/',icon:FiBookOpen,any:['documents.view']},
 {label:'Reports',href:'/ruang-kawan/reports/',icon:FiFileText,any:['reports.view_self']},
 {label:'Finance',href:'/ruang-kawan/finance/',icon:FiDollarSign,any:['finance.view']},
];

export default function WorkspaceMiniNav(){
 const pathname=usePathname();const[access,setAccess]=useState<Access|null>(null);const[email,setEmail]=useState('');const[hidden,setHidden]=useState(false);const[profileOpen,setProfileOpen]=useState(false);const lastScroll=useRef(0);const menuRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;async function load(){const supabase=createClient();const{data:{session}}=await supabase.auth.getSession();if(!session)return;const{data}=await supabase.rpc('get_my_access');const value=(Array.isArray(data)?data[0]:data)as Access|null;if(active&&value?.membership_status==='active'){setAccess(value);setEmail(session.user.email??'')}}void load();return()=>{active=false}},[]);
 useEffect(()=>{function onScroll(){const next=window.scrollY;if(window.innerWidth>760)setHidden(next>lastScroll.current&&next>110);lastScroll.current=next}function onMove(event:MouseEvent){if(event.clientY<18)setHidden(false)}function onKey(event:KeyboardEvent){if(event.key==='Escape')setProfileOpen(false)}function onClick(event:MouseEvent){if(menuRef.current&&!menuRef.current.contains(event.target as Node))setProfileOpen(false)}window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('mousemove',onMove);window.addEventListener('keydown',onKey);document.addEventListener('mousedown',onClick);return()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('mousemove',onMove);window.removeEventListener('keydown',onKey);document.removeEventListener('mousedown',onClick)}},[]);
 const visible=useMemo(()=>items.filter(item=>item.any.length===0||item.any.some(permission=>access?.permissions?.includes(permission))),[access]);
 if(!access||pathname==='/ruang-kawan'||pathname.startsWith('/ruang-kawan/callback'))return null;
 const activeFor=(href:string)=>href==='/ruang-kawan/dashboard/'?pathname.startsWith('/ruang-kawan/dashboard'):href==='/ruang-kawan/marketing/'?['/ruang-kawan/marketing','/ruang-kawan/content-plan','/ruang-kawan/pipeline'].some(route=>pathname.startsWith(route)):pathname.startsWith(href.slice(0,-1));
 async function signOut(){await createClient().auth.signOut();window.location.replace('/ruang-kawan/')}
 return <nav className="rk-mini-nav" data-hidden={hidden} aria-label="Navigasi utama Ruang Kawan"><div className="rk-mini-nav-inner">
  <Link className="rk-nav-brand" href="/ruang-kawan/dashboard/" aria-label="Ruang Kawan"><span>CI</span><strong>Ruang Kawan</strong></Link>
  <div className="rk-nav-modules">{visible.map(item=>{const Icon=item.icon;return <Link key={item.href} href={item.href} data-active={activeFor(item.href)}><Icon/><span>{item.label}</span></Link>})}</div>
  <div className="rk-nav-account">
   {access.permissions.includes('notifications.view_self')?<Link className="rk-nav-notification" href="/ruang-kawan/notifications/" data-active={pathname.startsWith('/ruang-kawan/notifications')} aria-label="Notifikasi"><FiBell/></Link>:null}
   <div ref={menuRef}><button className="rk-nav-profile" aria-expanded={profileOpen} onClick={()=>setProfileOpen(value=>!value)}><span><FiUser/></span><b>{access.full_name?.split(' ')[0]||'Profil'}</b><FiChevronDown/></button>{profileOpen?<div className="rk-profile-dropdown"><header><strong>{access.full_name||email}</strong><small>{access.position_name||email}</small></header><Link href="/ruang-kawan/profile/" onClick={()=>setProfileOpen(false)}><FiUser/> Profil & akun</Link><button onClick={()=>void signOut()}><FiLogOut/> Keluar</button></div>:null}</div>
  </div>
 </div></nav>
}

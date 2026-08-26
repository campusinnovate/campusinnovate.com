'use client';

import {useEffect,useState} from 'react';
import {FiBell,FiBellOff,FiLoader} from 'react-icons/fi';
import {createClient} from '@/lib/supabase/client';

function applicationKey(value:string){const padding='='.repeat((4-value.length%4)%4);const raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(character=>character.charCodeAt(0)));}

const PRODUCTION_VAPID_PUBLIC_KEY='BG51t598E4402xWP6wSYwykvhDj38rZ-1zPDongHExNWK8wHnxW5BPO_3Ozz7z-MtE_XBFs527znqHuPKWf9ygw';

export default function PushNotificationControl(){const[supported,setSupported]=useState(false);const[subscription,setSubscription]=useState<PushSubscription|null>(null);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY??PRODUCTION_VAPID_PUBLIC_KEY;
useEffect(()=>{if(!('serviceWorker'in navigator)||!('PushManager'in window))return;setSupported(true);void navigator.serviceWorker.register('/ruang-kawan-sw.js',{scope:'/ruang-kawan/',updateViaCache:'none'}).then(async registration=>setSubscription(await registration.pushManager.getSubscription())).catch(()=>setMessage('Service worker notifikasi belum dapat dipasang.'));},[]);
async function enable(){if(!publicKey){setMessage('VAPID public key belum dikonfigurasi pada website.');return;}setBusy(true);setMessage('');try{const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Izin notifikasi belum diberikan pada browser.');const registration=await navigator.serviceWorker.ready;const next=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(publicKey)});const json=next.toJSON();const result=await createClient().rpc('save_push_subscription',{subscription:{...json,userAgent:navigator.userAgent},device_name:navigator.platform});if(result.error)throw result.error;setSubscription(next);setMessage('Notifikasi perangkat aktif.');}catch(error){setMessage(error instanceof Error?error.message:'Notifikasi belum dapat diaktifkan.');}finally{setBusy(false);}}
async function disable(){if(!subscription)return;setBusy(true);const endpoint=subscription.endpoint;await subscription.unsubscribe();await createClient().rpc('remove_push_subscription',{endpoint_value:endpoint});setSubscription(null);setMessage('Notifikasi perangkat dinonaktifkan.');setBusy(false);}
if(!supported)return <section className="rk-push-control"><FiBellOff/><div><strong>Push notification tidak didukung</strong><p>Gunakan browser modern atau pasang Ruang Kawan sebagai PWA.</p></div></section>;
return <section className="rk-push-control" data-active={Boolean(subscription)}><FiBell/><div><strong>{subscription?'Notifikasi perangkat aktif':'Aktifkan notifikasi perangkat'}</strong><p>{message||'Terima assignment, mention, review, KPI, dan meeting meskipun tab sedang ditutup.'}</p></div><button disabled={busy} onClick={()=>void(subscription?disable():enable())}>{busy?<FiLoader/>:subscription?'Nonaktifkan':'Aktifkan'}</button></section>}

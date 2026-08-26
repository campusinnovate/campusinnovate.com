'use client';

import {useEffect} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/client';

type NotificationRow={id:string;title:string;message:string|null;action_url:string|null};

export default function RuangKawanNotificationProvider(){useEffect(()=>{let active=true;const supabase=createClient();let channel:RealtimeChannel|null=null;void(async()=>{const session=(await supabase.auth.getSession()).data.session;if(!session)return;const membershipId=String((await supabase.rpc('current_membership_id')).data??'');if(!membershipId)return;const refresh=async()=>{const result=await supabase.rpc('notification_center_workspace');if(!result.error&&active)window.dispatchEvent(new CustomEvent('kawan-notification-unread',{detail:{count:Number((result.data as {unread?:number}|null)?.unread??0)}}));};await refresh();channel=supabase.channel(`rk-notifications:${membershipId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`recipient_membership_id=eq.${membershipId}`},({new:row})=>{const item=row as NotificationRow;void refresh();if(document.visibilityState!=='visible'&&'Notification'in window&&Notification.permission==='granted'){void navigator.serviceWorker.ready.then(registration=>registration.showNotification(item.title,{body:item.message??'Ada pembaruan pekerjaan.',icon:'/assets/brand/campus-innovate-official.png',tag:item.id,data:{url:item.action_url??'/ruang-kawan/notifications/'}}));}}).subscribe();})();return()=>{active=false;if(channel)void supabase.removeChannel(channel);}},[]);return null;}

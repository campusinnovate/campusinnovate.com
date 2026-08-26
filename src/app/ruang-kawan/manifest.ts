import type { MetadataRoute } from 'next';

export default function manifest():MetadataRoute.Manifest{return{
  name:'Ruang Kawan · Campus Innovate',short_name:'Ruang Kawan',description:'Workspace internal Kawan Inovasi.',
  start_url:'/ruang-kawan/dashboard/',scope:'/ruang-kawan/',display:'standalone',background_color:'#fff8e9',theme_color:'#12345b',
  icons:[{src:'/assets/brand/campus-innovate-official.png',sizes:'any',type:'image/png',purpose:'any'}],
};}

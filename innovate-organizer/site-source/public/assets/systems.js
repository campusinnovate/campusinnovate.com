'use strict';
// Image media can be replaced with a real video source without changing the card layout.
const systemProjects = [
 {id:'klh-score',title:'Live Scoring KLH/BPLH',type:'Event engagement',description:'Papan skor untuk melihat perolehan poin dan posisi tim selama fun games. Panitia dan peserta mengikuti klasemen yang sama.',features:['Skor per permainan','Klasemen tim','Tampilan layar acara'],media:{type:'image',src:'assets/system-klh-score.webp'},images:[],logo:'assets/client-klh-bplh.webp'},
 {id:'ipb-leap',title:'IPB Leap',type:'Program management',description:'Platform program yang menyatukan informasi kegiatan, komunitas, dan akses peserta. Materi program lebih mudah ditemukan dalam satu tempat.',features:['Informasi kegiatan','Akses peserta','Komunikasi program'],media:{type:'image',src:'assets/system-ipb-leap.webp'},images:['assets/system-ipb-leap-hero.webp','assets/system-ipb-leap-contact.webp'],logo:'assets/system-ipb-leap-logo.webp'},
 {id:'itinerary',title:'Itinerary Digital',type:'Panduan peserta · demo',description:'Panduan acara yang bisa dibuka di ponsel: jadwal, lokasi, persiapan, dan kontak panitia. Peserta punya rujukan yang sama sepanjang kegiatan.',features:['Rundown','Lokasi & persiapan','Kontak panitia'],media:{type:'image',src:'assets/system-itinerary.webp'},images:[],portrait:true,url:'/itinerary/'}
];
const digitalProjects = [
 {id:'ylos',title:'YLOS 2026',type:'Website event · Campus Innovate',description:'Website acara untuk informasi program dan pengalaman digital peserta YLOS.',features:['Informasi program','Profil pembicara','Alur pendaftaran'],media:{type:'image',src:'assets/system-ylos.webp'},images:[]},
 {id:'coreva',title:'COREVA',type:'Organization SaaS · Campus Innovate',description:'Sistem untuk mengelola operasional organisasi dalam satu ruang kerja digital.',features:['Program kerja','Informasi organisasi','Dashboard'],media:{type:'image',src:'assets/system-coreva.webp'},images:[]},
 {id:'ipb-connect',title:'IPB Connect',type:'Prototipe web · DPPKHA IPB',description:'Prototipe platform yang menghubungkan alumni dengan layanan DPPKHA IPB University.',features:['Profil alumni','Layanan institusi','Informasi karier'],media:{type:'image',src:'assets/system-ipb-connect.webp'},images:[]},
 {id:'optima',title:'Optima',type:'CRM & website · Campus Innovate',description:'Pengembangan CRM dan website untuk informasi pelanggan dan pengelolaan hubungan pelanggan.',features:['Informasi pelanggan','Tindak lanjut','Dashboard'],media:{type:'image',src:'assets/system-optima.webp'},images:[]}
];
function systemCard(item) {
 return '<article class="system-card"><div class="system-screen'+(item.portrait?' is-phone':'')+'">'+photo(item.media.src,item.title+' — cuplikan tampilan')+'</div><div class="system-card-content"><p class="system-tag">'+e(item.type)+'</p><h4>'+e(item.title)+'</h4><p>'+e(item.description)+'</p><ul class="system-feature-list">'+item.features.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul><button class="text-button" type="button" data-system="'+e(item.id)+'" aria-haspopup="dialog" aria-controls="system-dialog" aria-label="'+e('Lihat tampilan '+item.title)+'">Lihat tampilan</button></div></article>';
}
$('system-projects').innerHTML=systemProjects.map(systemCard).join('');
$('digital-projects').innerHTML=digitalProjects.map(systemCard).join('');
document.addEventListener('click',event=>{
 const target=event.target.closest?.('[data-system]');if(!target)return;
 const item=[...systemProjects,...digitalProjects].find(x=>x.id===target.dataset.system);if(!item)return;
 const media=item.media.type==='video'?'<video controls playsinline preload="none" poster="'+e(item.media.poster||'')+'"><source src="'+e(item.media.src)+'" type="video/mp4"></video>': '<div class="system-dialog-image'+(item.portrait?' is-phone':'')+'">'+photo(item.media.src,item.title+' — cuplikan tampilan',true)+'</div>';
 $('system-body').innerHTML='<p class="system-tag">'+e(item.type)+'</p><h2 id="system-title">'+e(item.title)+'</h2><p>'+e(item.description)+'</p>'+media+item.images.map(src=>'<div class="system-dialog-image">'+photo(src,item.title+' — cuplikan tampilan')+'</div>').join('')+'<h3>Yang dibantu sistem ini</h3>'+list(item.features)+(item.url?'<p><a class="button button-outline" href="'+e(item.url)+'" target="_blank" rel="noopener">Buka demo itinerary</a></p>':'')+'<p class="fine">Pilihan teknologi, penyiapan, dan biayanya dikonfirmasi di proposal.</p>';
 translateSiteTree($('system-body'));$('system-dialog').showModal();
});
$('system-dialog').addEventListener('close',()=>{$('system-body').querySelectorAll('video').forEach(v=>v.pause());});
$('stats-toggle').addEventListener('click',()=>{
 const paused=$('stats-toggle').getAttribute('aria-pressed')!=='true';
 $('stats-toggle').setAttribute('aria-pressed',String(paused));$('hero-stats').dataset.paused=String(paused);
 $('stats-toggle').setAttribute('aria-label',paused?'Putar animasi angka':'Jeda animasi angka');translateSiteTree($('stats-toggle'));
});

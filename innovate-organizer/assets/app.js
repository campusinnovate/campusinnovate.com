"use strict";
const services = [
  {name:"Conferences", description:"Konferensi yang mempertemukan ide, orang, dan peluang.", formats:["Konferensi nasional dan internasional","Simposium dan forum","Seminar"], scope:["Konsep dan perencanaan","Koordinasi pembicara dan sesi","Registrasi dan alur peserta","Koordinasi teknis dan produksi","Operasional hari-H"], digital:["Registrasi online dan QR check-in","Live Q&A dan polling sesi","E-sertifikat dan laporan kehadiran"]},
  {name:"Corporate Events", description:"Rapat dan acara institusi dengan agenda, tamu, dan teknis yang terkoordinasi.", formats:["Corporate meeting","Town hall dan kick-off","Rapat kerja","Acara institusi"], scope:["Pengaturan venue dan ruangan","Kesiapan presentasi dan teknis","Koordinasi agenda dan tamu","Operasional hari-H"], digital:["RSVP dan QR check-in tamu","Pengingat WhatsApp dan email","Live polling saat town hall"]},
  {name:"Team Experiences", description:"Outing dan aktivitas tim yang dirancang sesuai tujuan dan karakter peserta.", formats:["Company outing","Gathering dan retreat","Outbound","Team building"], scope:["Konsep pengalaman dan desain aktivitas","Koordinasi venue dan logistik","Fasilitator dan tim aktivitas","Operasional dan keselamatan di lapangan"], digital:["Registrasi dan data peserta","Kuis dan permainan interaktif","Survei umpan balik peserta"]},
  {name:"Learning Events", description:"Pelatihan dan workshop dengan administrasi yang rapi, dari pendaftaran sampai sertifikat.", formats:["Pelatihan","Workshop","Trainer dan materi melalui mitra, sesuai permintaan"], scope:["Jadwal dan administrasi peserta","Kesiapan venue dan peralatan","Logistik trainer","Koordinasi hari-H"], digital:["Administrasi peserta online","E-sertifikat otomatis","Evaluasi pelatihan digital"]},
  {name:"Event Support", description:"Tim spesialis untuk bagian acara yang perlu didukung. Penugasan dan hasil kerja mengikuti brief yang disepakati.", formats:["Dukungan per fungsi","Penambahan kru acara"], scope:["Desain dan produksi kreatif","Dokumentasi foto dan video","Registrasi dan administrasi","Fasilitator outing","Guest liaison dan panggung","Kru dan operasional lapangan"], digital:["Registrasi dan check-in digital","Checklist dan pembagian tugas","Laporan kehadiran"]}
];
const toolkit = [
  ["Planning & Coordination","Tim bisa memantau progres, melihat pembagian tugas, dan mengecek kesiapan acara dari satu alur kerja.",["Dashboard progres","Pembagian tugas","Checklist digital"]],
  ["Participant Administration","Kelola data peserta dari pendaftaran hingga kedatangan di venue.",["Form registrasi","Basis data peserta","QR check-in"]],
  ["Communication & Engagement","Jaga peserta tetap mendapat informasi dan beri ruang untuk berinteraksi saat acara.",["Pengingat WhatsApp dan email","Live polls","Q&A","Kuis"]],
  ["Evaluation & Reporting","Kumpulkan umpan balik dan dokumentasikan hasil acara untuk tim penyelenggara.",["Survei","E-sertifikat","Laporan kehadiran"]],
  ["Custom Event Needs","Sesuaikan website dan alur kerja dengan kebutuhan acara yang disepakati.",["Website acara","Alur kerja kustom"]]
];
const eventScope = ["Perencanaan dan konsep","Keterlibatan peserta","Operasional lapangan","Pelaksanaan acara"];
const teamScope = ["Desain aktivitas","Keterlibatan peserta","Operasional lapangan","Pelaksanaan acara"];
const projects = [
  [14,"wunproq","WUNPROQ 2026",2026,"Konferensi","World University Network for Productive Waqf","Full Event Management",["Pengelolaan acara","Pengalaman peserta","Materi komunikasi pendukung","Event branding","Branding dan pengelolaan media sosial"]],
  [15,"astra","Astra International Tbk",2026,"Korporat","Simbolis Serah Terima Hunian Layak Huni Astra di Garut","Full Event Management",["Konsep dan rundown seremoni","Pengelolaan serah terima simbolis","Koordinasi venue, panggung, dan tamu","Peresmian Ecobiz Desa Sejahtera Astra"]],
  [16,"lpa2i","LPA2I IPB University",2026,"Institusi","Pengelolaan acara dari konsep hingga pelaksanaan","Full Event Management",eventScope],
  [17,"noortura","Noortura",2026,"Korporat","Noortura Open House","Full Event Management",eventScope],
  [18,"gim","PT Geo Investama Mandiri",2026,"Pelatihan","Pengelolaan acara pelatihan perusahaan","Training Event Management",["Perencanaan dan koordinasi jadwal","Keterlibatan peserta","Kesiapan venue dan teknis","Operasional pelatihan"]],
  [19,"dpkkha","DPKKHA IPB University",2025,"Institusi","Acara institusi kampus","Full Event Management",eventScope],
  [20,"dpma","DPMA IPB University",2025,"Institusi","Seremoni peluncuran ekspor dan acara institusi","Export Launching Ceremony",["Pengelolaan tamu dan acara","Pengalaman peserta","Operasional lapangan"]],
  [21,"ucam","University College Agroscience Malaysia",2025,"Institusi","Kunjungan institusi internasional","Visitor Management",["Alur kunjungan","Keterlibatan peserta","Operasional lapangan","Pelaksanaan acara"]],
  [22,"klhk","Kementerian LHK",2025,"Team building","Pelatihan peningkatan kapasitas untuk instansi pemerintah","Capacity Building",teamScope],
  [23,"unbin","Universitas Bina Niaga Indonesia",2025,"Pelatihan","Pelatihan public speaking bagi komunitas kampus","Public Speaking Training",["Perencanaan pelatihan","Pengelolaan sesi public speaking","Keterlibatan peserta","Pelaksanaan pelatihan"]],
  [24,"pustarhut","PUSTARHUT",2024,"Team building","Program peningkatan kapasitas","Capacity Building",teamScope],
  [25,"see","Student Entrepreneur Expo IPB",2024,"Institusi","Expo kewirausahaan mahasiswa","Event Management",["Keterlibatan peserta","Operasional lapangan","Pelaksanaan acara"]],
  [26,"wmk","Wirausaha Merdeka IPB",2024,"Team building","Capacity building dan outbound bagi peserta","Capacity Building & Outbound",teamScope]
].map(([id,client,title,year,category,description,scope,deliverables])=>({
  id,client,title,year,category,description,scope,deliverables,
  image: [15, 16, 20].includes(id) ? null : "assets/project-"+id+".webp"
}));

const $ = id => document.getElementById(id);
const whatsappBase = "https://wa.me/6285882514394";
const whatsappGreeting = "Halo Innovate Organizer, saya ingin berdiskusi tentang acara.";
function whatsappUrl(message) {
  return whatsappBase + "?text=" + encodeURIComponent(message);
}
function updateWhatsAppLink(link) {
  const context = link.dataset.whatsapp;
  const greeting = translateSiteText(whatsappGreeting);
  const topic = translateSiteText("Topik yang ingin saya diskusikan");
  link.href = whatsappUrl(context ? greeting + "\n" + topic + ": " + translateSiteText(context) : greeting);
}
function addWhatsAppLink(container, context) {
  const link = document.createElement("a");
  link.className = "button whatsapp-cta whatsapp-inline";
  link.textContent = "Chat via WhatsApp";
  link.target = "_blank";
  link.rel = "noopener";
  link.dataset.whatsapp = context;
  updateWhatsAppLink(link);
  container.append(link);
}
document.querySelectorAll("[data-whatsapp]").forEach(updateWhatsAppLink);
$("site-language").addEventListener("change", () => {
  queueMicrotask(() => document.querySelectorAll("[data-whatsapp]").forEach(updateWhatsAppLink));
});

const list = items => "<ul>"+items.map(item=>"<li>"+item+"</li>").join("")+"</ul>";
const serviceSelect = $("brief-service");
services.forEach(({name})=>serviceSelect.add(new Option(name,name)));
serviceSelect.add(new Option("Lainnya","Lainnya"));
const serviceCards = $("service-cards");
const serviceDetail = $("service-detail");
const servicePhotos = ["opening-02", "opening-11", "opening-09", "opening-04", "opening-01"];
const serviceButtons = services.map((service, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "service-card";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "service-detail");
  button.innerHTML = '<img src="assets/' + servicePhotos[index] + '.webp" alt="" loading="lazy" decoding="async">' +
    '<span class="card-index">' + String(index + 1).padStart(2, "0") + '</span>' +
    '<span class="service-card-copy"><span class="service-prefix" translate="no">Innovate For</span>' +
    '<strong>' + service.name + '</strong><span class="service-summary">' + service.formats[0] + '</span></span>' +
    '<span class="service-more" aria-hidden="true">+</span>';
  button.addEventListener("click", () => selectService(index));
  serviceCards.append(button);
  return button;
});
function selectService(index) {
  const expanded = serviceButtons[index].getAttribute("aria-expanded") === "true";
  serviceButtons.forEach((button, i) => {
    const selected = !expanded && i === index;
    button.setAttribute("aria-expanded", String(selected));
    button.querySelector(".service-more").textContent = selected ? "−" : "+";
  });
  serviceDetail.hidden = expanded;
  if (expanded) return;
  const service = services[index];
  serviceDetail.innerHTML = '<div class="service-detail-copy"><button type="button" class="service-close" aria-label="Tutup detail">×</button>' +
    '<p class="eyebrow" translate="no">Innovate For</p><h3 id="service-title">' + service.name + '</h3><p>' + service.description + '</p>' +
    '<div class="detail-grid"><div><h4>Format acara</h4>' + list(service.formats) + '</div><div><h4>Cakupan tim</h4>' + list(service.scope) + '</div><div class="digital-card"><h4>Digital touch</h4>' + list(service.digital) + '</div></div>' +
    '</div>';
  serviceDetail.querySelector(".service-close").addEventListener("click", () => {
    selectService(index);
    serviceButtons[index].focus();
  });
  if (serviceDetail.getBoundingClientRect().top > window.innerHeight - 120) {
    serviceDetail.scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "instant" : "smooth" });
  }
}

const principles = [
  ["Tech", "Teknologi di setiap layanan", "Kami pakai alat digital untuk mempermudah pengalaman peserta dan kerja panitia.", ["Registrasi online", "QR check-in", "Laporan acara"]],
  ["Smart", "Alur terstruktur, tim fleksibel", "Kami susun tim dan alur kerja sesuai kebutuhan tiap acara.", ["Petakan kebutuhan", "Bagi peran tim", "Jalankan acara"]],
  ["Event Partners", "Mitra dari awal sampai evaluasi", "Kami kerja bareng klien dari ide pertama hingga evaluasi.", ["Susun konsep", "Koordinasi acara", "Evaluasi bersama"]]
];
$("principle-cards").innerHTML = principles.map(([name, title, description, steps]) =>
  '<article class="principle-card"><p class="eyebrow">' + name + '</p><h3>' + title + '</h3><p>' + description + '</p>' +
  '<ol class="principle-flow">' + steps.map(step => '<li>' + step + '</li>').join("") + '</ol></article>'
).join("");

const toolkitSymbols = [
  '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11m4-6h4m-4 3h2"/>',
  '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M8 12h8m-6-2 2 2 3-3"/>',
  '<path d="M4 5h16v11h-7l-5 4v-4H4zM8 10h8m-8 3h4"/>',
  '<path d="M4 4v16h16M8 16v-4m4 4V9m4 7V6"/>',
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18m-12 3-2 2 2 2m6-4 2 2-2 2"/>'
];
$("toolkit-cards").innerHTML = toolkit.map(([title, description, features], index) =>
  '<article class="tool-card"><div class="tool-card-head"><svg viewBox="0 0 24 24" aria-hidden="true">' +
  toolkitSymbols[index] + '</svg><p class="eyebrow">Digital toolkit / 0' + (index + 1) + '</p></div><h3>' + title + '</h3><p>' + description + '</p>' +
  '<ul class="tool-tags">' + features.map(item => '<li>' + item + '</li>').join("") + '</ul></article>'
).join("");

const projectPhotoSizes = {
  14: [640, 427], 17: [1100, 733], 18: [1100, 825], 19: [706, 325],
  21: [706, 325], 22: [1100, 619], 23: [1100, 619], 24: [1100, 825],
  25: [706, 325], 26: [1100, 733]
};
function projectLogo(project) {
  return '<span class="project-logo"><img src="' + clientLogoUrl(project.client) +
    '" alt="" loading="lazy" decoding="async"></span>';
}
function projectThumbnail(project) {
  if (!project.image) return "";
  const [width, height] = projectPhotoSizes[project.id];
  return '<img src="' + project.image + '" alt="" loading="lazy" decoding="async" width="' + width + '" height="' + height + '">';
}
const filters = ["Semua","Konferensi","Korporat","Institusi","Pelatihan","Team building"];
for(const name of filters) {
  const button=document.createElement("button");
  button.type="button";
  button.textContent=name;
  button.dataset.filter=name;
  button.addEventListener("click",()=>renderProjects(name));
  $("filters").append(button);
}
function renderProjects(category) {
  const filtered=projects.filter(project=>category==="Semua"||project.category===category)
    .sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)));
  $("projects").innerHTML=filtered.map(p=>
    '<button type="button" class="project'+(p.image ? '' : ' project-text-only')+'" data-project="'+p.id+'">'+
    projectThumbnail(p)+'<span class="project-text"><span class="project-topline">'+projectLogo(p)+'<span class="project-meta">'+p.category+' · '+p.year+'</span></span><strong>'+p.title+'</strong><span class="project-action">Lihat proyek →</span></span></button>'
  ).join("");
  $("filters").querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.filter===category)));
}
renderProjects("Semua");

const featuredProjects = [
  [14, "WUNPROQ 2026"], [17, "Noortura"], [18, "LiDAR Batch 1"],
  [19, "DPKKHA IPB"], [22, "KLHK"], [23, "Universitas Bina Niaga"],
  [21], [24], [25], [26]
];
const featuredGrid = $("featured-grid");
const opening = $("home");
const openingMosaic = $("opening-mosaic");
const extraPhotos = ["01", "02", "03", "04", "05", "07", "08", "09", "11", "12", "13"];
const mosaicPhotos = [...projects.map(project => project.image).filter(Boolean),
  ...extraPhotos.map(number => "assets/opening-" + number + ".webp")];
mosaicPhotos.forEach((_, index) => {
  const image = new Image();
  image.src = mosaicPhotos[index * 8 % mosaicPhotos.length];
  image.alt = "";
  image.decoding = "async";
  openingMosaic.append(image);
});
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

if (!reducedMotion.matches && "IntersectionObserver" in window) {
  const flowObserver = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.add("is-visible");
      flowObserver.unobserve(target);
    });
  }, { threshold: .30 });
  document.querySelectorAll(".principle-card").forEach(card => flowObserver.observe(card));
}

featuredProjects.forEach(([id, caption]) => {
  const project = projects.find(item => item.id === id);
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "featured-tile";
  tile.dataset.project = String(id);
  tile.setAttribute("aria-label", "Lihat proyek " + project.title);
  const photo = caption ? "assets/featured-" + id + ".webp" : project.image;
  tile.innerHTML = '<img src="' + photo + '" alt="" decoding="async" loading="lazy"><span class="featured-caption"><strong>' + (caption || project.title) + '</strong><span aria-hidden="true">→</span></span>';
  featuredGrid.append(tile);
});

let scheduled = false;
const header = document.querySelector(".header");

function syncOpening() {
  scheduled = false;
  if (reducedMotion.matches) return;
  const distance = header.offsetHeight - opening.getBoundingClientRect().top;
  const runway = opening.offsetHeight - opening.firstElementChild.offsetHeight;
  const fade = Math.max(0, Math.min(1, (distance / runway - .17) / .8));
  opening.style.setProperty("--opening", 1 - fade);
}

function layoutOpening() {
  opening.style.setProperty("--nav-height", header.offsetHeight + "px");
  if (reducedMotion.matches) opening.style.removeProperty("--opening");
  syncOpening();
}

window.addEventListener("scroll", () => {
  if (scheduled || reducedMotion.matches) return;
  scheduled = true;
  requestAnimationFrame(syncOpening);
}, { passive: true });
window.addEventListener("resize", layoutOpening);
reducedMotion.addEventListener("change", layoutOpening);
new ResizeObserver(layoutOpening).observe(header);
layoutOpening();

function clientLogoUrl(slug) {
  return "assets/client-" + slug + ".webp";
}

const clientLogos = [
  [
    "ucam",
    "University College Agroscience Malaysia"
  ],
  [
    "dpma",
    "DPMA IPB University"
  ],
  [
    "klhk",
    "Kementerian Lingkungan Hidup dan Kehutanan"
  ],
  [
    "lpa2i",
    "LPA2I IPB University"
  ],
  [
    "see",
    "Student Entrepreneur Expo"
  ],
  [
    "unbin",
    "Universitas Bina Niaga Indonesia"
  ],
  [
    "pustarhut",
    "PUSTARHUT"
  ],
  [
    "cda",
    "CDA IPB University"
  ],
  [
    "wmk",
    "Wirausaha Merdeka IPB"
  ],
  [
    "institusi",
    "Mitra institusi daerah"
  ],
  [
    "wunproq",
    "WUNPROQ"
  ],
  [
    "vkpenta",
    "VK Penta"
  ],
  [
    "dpkkha",
    "DPKKHA IPB University"
  ],
  [
    "bri",
    "Bank Rakyat Indonesia"
  ],
  [
    "bni",
    "Bank Negara Indonesia"
  ],
  [
    "wakaf",
    "Wakaf IPB University"
  ],
  [
    "gim",
    "PT Geo Investama Mandiri"
  ],
  [
    "optima",
    "Optima"
  ],
  [
    "noortura",
    "Noortura"
  ],
  [
    "aio",
    "AIO Villa Lombok"
  ],
  [
    "modlaci",
    "Modlaci"
  ],
  [
    "trendy",
    "Trendy AI"
  ],
  [
    "tirta",
    "Tirta Pakuan"
  ]
];
const clientTrack = $("client-track");
const clientWindow = $("client-window");
const clientPause = $("clients-pause");
const logoGroup = document.createElement("ul");
logoGroup.className = "client-group";
for (const [slug, name] of clientLogos) {
  const item = document.createElement("li");
  const logo = document.createElement("img");
  logo.src = clientLogoUrl(slug);
  logo.alt = name;
  item.append(logo);
  logoGroup.append(item);
}
const repeatingGroup = logoGroup.cloneNode(true);
repeatingGroup.setAttribute("aria-hidden", "true");
clientTrack.append(logoGroup, repeatingGroup);

clientPause.addEventListener("click", () => {
  const paused = clientWindow.classList.toggle("is-paused");
  const label = paused ? "Putar logo klien" : "Jeda pergerakan logo";
  clientPause.textContent = paused ? "▶" : "II";
  clientPause.setAttribute("aria-label", label);
  clientPause.title = label;
});
const projectDialog=$("project-dialog");
const briefDialog=$("brief-dialog");
document.addEventListener("click",event=>{
  const close=event.target.closest("[data-close]");
  if(close) close.closest("dialog").close();
  const projectButton=event.target.closest("[data-project]");
  if(projectButton) {
    const p=projects.find(project=>project.id===Number(projectButton.dataset.project));
    $("project-body").innerHTML='<p class="eyebrow">'+p.category+' · '+p.year+'</p><h2 id="project-title">'+p.title+'</h2><p class="fine">'+p.description+'</p>'+(p.image ? '<img src="'+p.image+'" alt="Dokumentasi '+p.title+'">' : '')+'<span class="tag">'+p.scope+'</span><ul class="project-scope">'+p.deliverables.map(item=>"<li>"+item+"</li>").join("")+'</ul><p class="fine">Pengalaman proyek Campus Innovate.</p>';
    addWhatsAppLink($("project-body"), p.title);
    projectDialog.showModal();
  }
  const briefButton=event.target.closest("[data-brief]");
  if(briefButton) {
    if(briefButton.dataset.brief) serviceSelect.value=briefButton.dataset.brief;
    $("brief-result").hidden=true;
    briefDialog.showModal();
  }
});
$("brief-form").addEventListener("input",()=>{$("brief-result").hidden=true;});
$("brief-form").addEventListener("submit",event=>{
  event.preventDefault();
  const form=new FormData(event.currentTarget);
  const fields=[["Nama dan organisasi","nama"],["Jenis acara","layanan"],["Tanggal","tanggal"],["Peserta","peserta"],["Lokasi dan kebutuhan","catatan"]];
  const details=fields.map(([label,key])=>[translateSiteText(label),key === "layanan" ? serviceSelect.selectedOptions[0].textContent : String(form.get(key)||"").trim()]).filter(([,value])=>value).map(([label,value])=>label+": "+value);
  const message=[translateSiteText(whatsappGreeting),"",...details].join("\n");
  $("brief-link").href=whatsappUrl(message);
  $("brief-result").hidden=false;
  $("brief-link").focus();
});
const menu=document.querySelector(".menu");
const navigation=$("navigation");
menu.addEventListener("click",()=>{
  const open=navigation.classList.toggle("open");
  menu.setAttribute("aria-expanded",String(open));
});
navigation.addEventListener("click",event=>{
  if(event.target.closest("a")) {
    navigation.classList.remove("open");
    menu.setAttribute("aria-expanded","false");
  }
});

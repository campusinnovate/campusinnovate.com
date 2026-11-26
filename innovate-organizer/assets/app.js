"use strict";

const IO_DATA = {
  stats: null,
  clientLogos: [
    { name: "Stripmate", src: "assets/stripmate-logo.webp" },
    { name: "Kementerian Lingkungan Hidup / Badan Pengendalian Lingkungan Hidup (KLH/BPLH)", src: "assets/client-klh-bplh.webp" },
    { name: "Badan Perakitan dan Modernisasi Pertanian (BRMP)", src: "assets/client-brmp.webp", wide: true },
    { name: "Astra International Tbk", src: "assets/client-astra.webp" },
    { name: "Noortura", src: "assets/client-noortura.webp" },
    { name: "PT Geo Investama Mandiri", src: "assets/client-gim.webp" },
    { name: "LPA2I IPB University", src: "assets/client-lpa2i.webp" },
    { name: "Kementerian Lingkungan Hidup dan Kehutanan", src: "assets/client-klhk.webp" },
    { name: "WUNPROQ", src: "assets/client-wunproq.webp" },
    { name: "Badan Informasi Geospasial", src: "assets/client-big.webp" },
    { name: "IPB University", src: "assets/client-ipb.webp" },
    { name: "University College Agroscience Malaysia", src: "assets/client-ucam.webp" },
    { name: "DPMA IPB University", src: "assets/client-dpma.webp" },
    { name: "Student Entrepreneur Expo", src: "assets/client-see.webp" },
    { name: "Universitas Bina Niaga Indonesia", src: "assets/client-unbin.webp" },
    { name: "PUSTARHUT", src: "assets/client-pustarhut.webp" },
    { name: "CDA IPB University", src: "assets/client-cda.webp" },
    { name: "Wirausaha Merdeka IPB", src: "assets/client-wmk.webp" },
    { name: "Mitra institusi daerah", src: "assets/client-institusi.webp" },
    { name: "VK Penta", src: "assets/client-vkpenta.webp" },
    { name: "DPKKHA IPB University", src: "assets/client-dpkkha.webp" },
    { name: "Bank Rakyat Indonesia", src: "assets/client-bri.webp" },
    { name: "Bank Negara Indonesia", src: "assets/client-bni.webp" },
    { name: "Wakaf IPB University", src: "assets/client-wakaf.webp" },
    { name: "Optima", src: "assets/client-optima.webp" },
    { name: "AIO Villa Lombok", src: "assets/client-aio.webp" },
    { name: "Modlaci", src: "assets/client-modlaci.webp" },
    { name: "Trendy AI", src: "assets/client-trendy.webp" },
    { name: "Tirta Pakuan", src: "assets/client-tirta.webp" }
  ],
  testimonials: [],
  caseStudies: [],
  replyNote: null,
  email: "innovatecampus@gmail.com",
  reportDays: null,
  benefitScreenshots: []
};

const services = [
  {
    id: "gathering", title: "Gathering & Outing Kantor", option: "Gathering & Outing",
    headline: "Event Organizer Gathering Kantor di Jabodetabek", photo: "opening-09",
    description: "Acara kebersamaan tim yang seru, tertata, dan tanpa repot buat panitia internal.",
    scope: ["Venue & akomodasi", "Rundown", "MC & hiburan", "Transportasi", "Registrasi online"],
    message: "Halo, saya ingin konsultasi acara gathering kantor."
  },
  {
    id: "team-building", title: "Team Building", option: "Team Building",
    headline: "Event Organizer Team Building di Jabodetabek", photo: "project-22",
    description: "Aktivitas yang dirancang sesuai tujuan tim, dari kolaborasi sampai kepemimpinan.",
    scope: ["Konsep aktivitas", "Fasilitator", "Perlengkapan", "Dokumentasi", "Laporan peserta"],
    message: "Halo, saya ingin konsultasi acara team building."
  },
  {
    id: "seminar", title: "Seminar & Konferensi", option: "Seminar & Konferensi",
    headline: "Event Organizer Seminar & Konferensi di Jabodetabek", photo: "featured-14",
    description: "Acara ilmiah atau bisnis dengan alur registrasi dan sesi yang tertib.",
    scope: ["Registrasi online", "QR check-in", "Manajemen pembicara", "Sesi paralel", "Sertifikat digital"],
    message: "Halo, saya ingin konsultasi acara seminar/konferensi."
  },
  {
    id: "corporate", title: "Acara Perusahaan", option: "Acara Perusahaan",
    headline: "Event Organizer Acara Perusahaan di Jabodetabek", photo: "project-17",
    description: "Peluncuran produk, anniversary, rapat kerja, hingga awarding night.",
    scope: ["Konsep acara", "Produksi panggung", "Vendor", "Koordinasi hari-H", "Laporan acara"],
    message: "Halo, saya ingin konsultasi acara perusahaan."
  },
  {
    id: "pelatihan", title: "Pelatihan & Workshop", option: "Pelatihan & Workshop",
    headline: "Event Organizer Pelatihan & Workshop di Jabodetabek", photo: "project-18",
    description: "Program belajar yang terukur, dari pendaftaran sampai evaluasi peserta.",
    scope: ["Pendaftaran", "Absensi digital", "Materi", "Evaluasi pre/post-test", "Sertifikat"],
    message: "Halo, saya ingin konsultasi acara pelatihan/workshop."
  }
];

const benefits = [
  ["Registrasi online, tanpa rekap manual.", "Peserta mendaftar lewat link. Data langsung tersusun, jadi panitia tidak perlu merapikan spreadsheet satu per satu.", "M8 3h8l3 3v15H5V3h3zm0 6h8m-8 4h8m-8 4h5"],
  ["Check-in pakai QR, tanpa antrean panjang.", "Peserta cukup menunjukkan kode QR di meja registrasi. Jumlah kehadiran terlihat secara langsung.", "M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5m4-3 3 3 5-6"],
  ["Progres persiapan yang bisa dipantau.", "Anda bisa melihat checklist, pembagian tugas, dan kesiapan vendor tanpa harus menanyakan update berkali-kali.", "M3 5h18v14H3zM3 9h18m-12 0v10m4-6h4m-4 3h3"],
  ["Laporan acara yang siap dibawa ke atasan.", "Setelah acara, Anda menerima rekap kehadiran, dokumentasi, dan feedback peserta dalam satu laporan.", "M4 4v16h16m-12-4v-4m4 4V9m4 7V6"]
];

const partners = [
  ["Full-Service", "Anda ingin terima beres", "Kami susun konsep, urus vendor, jalankan hari-H, dan serahkan laporan acara."],
  ["Selected Service", "Panitia internal sudah ada", "Kami pegang fungsi tertentu yang disepakati, misalnya registrasi digital, dokumentasi, atau produksi panggung."],
  ["Team Support", "Butuh tambahan tenaga", "Kami sediakan personel terlatih untuk peran tertentu, seperti usher, registrasi, LO, atau tim lapangan."]
];

const steps = [
  ["Diskusi kebutuhan", "Kita sepakati tujuan acara, profil peserta, jadwal, dan anggaran."],
  ["Konsep & penawaran", "Anda menerima konsep, rundown awal, dan rincian biaya."],
  ["Persiapan", "Tim, vendor, materi, dan sistem digital disiapkan. Progres bisa Anda pantau."],
  ["Hari-H", "Kami jalankan acara dan tangani kendala di lapangan."],
  ["Evaluasi & laporan", "Anda menerima laporan acara, dokumentasi, dan feedback peserta."]
];

const eventScope = ["Perencanaan dan konsep","Keterlibatan peserta","Operasional lapangan","Pelaksanaan acara"];
const teamScope = ["Desain aktivitas","Keterlibatan peserta","Operasional lapangan","Pelaksanaan acara"];
const projects = [
  [29,"stripmate","Trekking & Hiking bersama Innovate Organizer",2026,"Trekking & Hiking","Tim Innovate Organizer berpengalaman mendampingi trekking ke berbagai gunung dan curug, termasuk perjalanan bersama Stripmate.","Pengalaman rute trekking",["Gunung Luhur","Gunung Sumbing","Cisadon","Kawah Ratu","Gunung Merbabu","Gunung Lawu","Gunung Gede","Curug-curug di Bogor"],"Portofolio perjalanan",["assets/stripmate-kawah-ratu-group.webp"],{brandLogo:"assets/stripmate-logo.webp",image:"assets/stripmate-sumbing-group.webp",galleryCaption:"Dokumentasi perjalanan Innovate Organizer bersama Stripmate",contactMessage:"Halo Innovate Organizer, saya ingin konsultasi kegiatan trekking untuk rombongan.",contactLabel:"Diskusikan rencana trekking Anda"}],
  [28,"klh-bplh","KLH/BPLH",2026,"Team building","Fun games bersama tim KLH/BPLH","Fun Games",["Aktivitas kebersamaan peserta","Dokumentasi kegiatan"],"November 2026",["assets/klh-bplh-2026-2.webp","assets/klh-bplh-2026-3.webp"]],
  [27,"brmp","Badan Perakitan dan Modernisasi Pertanian",2026,"Pelatihan","Dukungan kegiatan pelatihan","Support Training",["Dukungan pelaksanaan pelatihan","Dokumentasi kegiatan"],"Oktober 2026",["assets/brmp-training-session.webp","assets/brmp-training-team.webp"],{image:"assets/brmp-training-group.webp"}],
  [14,"wunproq","WUNPROQ 2026",2026,"Konferensi","World University Network for Productive Waqf","Full Event Management",["Pengelolaan acara","Pengalaman peserta","Materi komunikasi pendukung","Event branding","Branding dan pengelolaan media sosial"]],
  [15,"astra","Astra International Tbk",2026,"Korporat","Peresmian Ecobiz Desa Sejahtera Astra di Garut","Full Event Management",["Konsep dan rundown seremoni","Koordinasi venue, panggung, dan tamu","Peresmian Ecobiz Desa Sejahtera Astra"]],
  [17,"noortura","Noortura",2026,"Korporat","Noortura Open House","Full Event Management",eventScope],
  [18,"gim","PT Geo Investama Mandiri",2026,"Pelatihan","LiDAR Batch 1","Training Event Management",["Perencanaan dan koordinasi jadwal","Keterlibatan peserta","Kesiapan venue dan teknis","Operasional pelatihan"]],
  [19,"dpkkha","DPKKHA IPB University",2025,"Institusi","Acara institusi kampus","Full Event Management",eventScope],
  [20,"dpma","DPMA IPB University",2025,"Institusi","Seremoni peluncuran ekspor dan acara institusi","Export Launching Ceremony",["Pengelolaan tamu dan acara","Pengalaman peserta","Operasional lapangan"]],
  [21,"ucam","University College Agroscience Malaysia",2025,"Institusi","Kunjungan institusi internasional","Visitor Management",["Alur kunjungan","Keterlibatan peserta","Operasional lapangan","Pelaksanaan acara"]],
  [22,"klhk","Kementerian LHK",2025,"Team building","Pelatihan peningkatan kapasitas untuk instansi pemerintah","Capacity Building",teamScope],
  [23,"unbin","Universitas Bina Niaga Indonesia",2025,"Pelatihan","Pelatihan public speaking bagi komunitas kampus","Public Speaking Training",["Perencanaan pelatihan","Pengelolaan sesi public speaking","Keterlibatan peserta","Pelaksanaan pelatihan"]],
  [24,"pustarhut","PUSTARHUT",2024,"Team building","Program peningkatan kapasitas","Capacity Building",teamScope],
  [25,"see","Student Entrepreneur Expo IPB",2024,"Institusi","Expo kewirausahaan mahasiswa","Event Management",["Keterlibatan peserta","Operasional lapangan","Pelaksanaan acara"]],
  [26,"wmk","Wirausaha Merdeka IPB",2024,"Team building","Capacity building dan outbound bagi peserta","Capacity Building & Outbound",teamScope]
].map(([id,client,title,year,category,description,scope,deliverables,period,gallery = [],details = {}])=>({
  id,client,title,year,category,description,scope,deliverables,period,gallery,
  image: id === 28 ? "assets/klh-bplh-group-2026.webp" : "assets/project-" + id + ".webp",
  ...details
}));

const $ = id => document.getElementById(id);
const t = translateSiteText;
const greeting = "Halo Innovate Organizer, saya ingin konsultasi acara.";
const defaultHeadline = "Lagi menyiapkan acara di Jabodetabek? Kami bantu.";
const whatsappBase = "https://wa.me/6285882514394";
const conversionId = "AW-18473450758/iaLBCN-i35AdEIb66ehE";
const whatsappUrl = message => whatsappBase + "?text=" + encodeURIComponent(message);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const e = escapeHtml;
const list = items => "<ul>" + items.map(item => "<li>" + e(item) + "</li>").join("") + "</ul>";
const number = index => String(index + 1).padStart(2, "0");
const imageDimensions = {"assets/astra-ecobiz-2.webp":[1000,563],"assets/astra-ecobiz-3.webp":[450,800],"assets/brmp-training-2026-2.webp":[1440,960],"assets/brmp-training-2026-3.webp":[1440,959],"assets/brmp-training-group.webp":[1600,1065],"assets/brmp-training-session.webp":[1600,1066],"assets/brmp-training-team.webp":[1600,1066],"assets/client-aio.webp":[258,52],"assets/client-astra.webp":[320,90],"assets/client-big.webp":[320,149],"assets/client-bni.webp":[181,78],"assets/client-bri.webp":[164,86],"assets/client-brmp.webp":[720,157],"assets/client-cda.webp":[155,94],"assets/client-dpkkha.webp":[320,75],"assets/client-dpma.webp":[408,105],"assets/client-gim.webp":[191,102],"assets/client-institusi.webp":[96,123],"assets/client-ipb.webp":[230,160],"assets/client-klh-bplh.webp":[200,198],"assets/client-klhk.webp":[124,122],"assets/client-lpa2i.webp":[394,100],"assets/client-modlaci.webp":[202,79],"assets/client-noortura.webp":[153,110],"assets/client-optima.webp":[177,85],"assets/client-pustarhut.webp":[266,54],"assets/client-see.webp":[150,130],"assets/client-tirta.webp":[132,133],"assets/client-trendy.webp":[214,79],"assets/client-ucam.webp":[128,122],"assets/client-unbin.webp":[141,141],"assets/client-vkpenta.webp":[141,118],"assets/client-wakaf.webp":[225,95],"assets/client-wmk.webp":[107,95],"assets/client-wunproq.webp":[241,98],"assets/clients.webp":[1250,499],"assets/cover.webp":[852,1000],"assets/featured-14.webp":[1800,1202],"assets/featured-17.webp":[1800,1200],"assets/featured-18.webp":[1600,1200],"assets/featured-19.webp":[706,325],"assets/featured-22.webp":[1800,1013],"assets/featured-23.webp":[1800,1013],"assets/klh-bplh-2026-2.webp":[960,1440],"assets/klh-bplh-2026-3.webp":[960,1440],"assets/klh-bplh-group-2026.webp":[1800,1200],"assets/logo.webp":[125,98],"assets/og-image.jpg":[1200,630],"assets/opening-01.webp":[1100,619],"assets/opening-02.webp":[640,427],"assets/opening-03.webp":[640,360],"assets/opening-04.webp":[640,427],"assets/opening-05.webp":[640,427],"assets/opening-07.webp":[640,427],"assets/opening-08.webp":[640,360],"assets/opening-09.webp":[640,427],"assets/opening-11.webp":[640,480],"assets/opening-12.webp":[640,480],"assets/opening-13.webp":[640,427],"assets/project-14.webp":[640,427],"assets/project-15.webp":[1200,676],"assets/project-16.webp":[1040,780],"assets/project-17.webp":[1100,733],"assets/project-18.webp":[1100,825],"assets/project-19.webp":[706,325],"assets/project-20.webp":[1200,675],"assets/project-21.webp":[706,325],"assets/project-22.webp":[1100,619],"assets/project-23.webp":[1100,619],"assets/project-24.webp":[1100,825],"assets/project-25.webp":[706,325],"assets/project-26.webp":[1100,733],"assets/project-27.webp":[1440,959],"assets/project-28.webp":[1440,960],"assets/project-29.webp":[1440,960],"assets/service-1.webp":[512,512],"assets/service-2.webp":[512,512],"assets/service-3.webp":[512,512],"assets/service-4.webp":[512,512],"assets/service-5.webp":[512,512],"assets/service-hall.webp":[512,512],"assets/stripmate-kawah-ratu-group.webp":[1440,1800],"assets/stripmate-logo.webp":[557,200],"assets/stripmate-outdoor-2.webp":[1400,1400],"assets/stripmate-sumbing-group.webp":[1800,1013],"assets/stripmate-trekking-2.webp":[1080,1440],"assets/stripmate-trekking-3.webp":[1080,1440],"assets/stripmate-trekking-cover.webp":[1080,1440]};
const photo = (src, alt = "") => {
  const dimensions = imageDimensions[src];
  const size = dimensions ? ' width="' + dimensions[0] + '" height="' + dimensions[1] + '"' : "";
  return '<img src="' + e(src) + '" alt="' + e(alt) + '"' + size + ' loading="lazy" decoding="async">';
};

function updateWhatsAppLink(link, message = link.dataset.wa) {
  link.href = whatsappUrl(t(message));
  link.target = "_blank";
  link.rel = "noopener";
}

function trackWhatsAppConversion() {
  if (typeof gtag === "function") {
    gtag("event", "conversion", { send_to: conversionId, transport_type: "beacon" });
  }
}

$("service-cards").innerHTML = services.map((service, index) =>
  '<article class="service-card" id="' + service.id + '">' +
    '<div class="service-photo">' + photo("assets/" + service.photo + ".webp") + '<span>' + number(index) + '</span></div>' +
    '<div class="card-body"><h3>' + e(service.title) + '</h3><p>' + e(service.description) + '</p>' +
    '<h4>Yang kami tangani</h4>' + list(service.scope) +
    '<a class="button button-whatsapp service-cta" data-wa="' + e(service.message) + '">Konsultasikan acara ini →</a></div></article>'
).join("");

$("benefit-cards").innerHTML = benefits.map(([title, description, symbol], index) =>
  '<article class="benefit-card"><div class="benefit-art"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + symbol + '"></path></svg></div>' +
  '<h3>' + e(title) + '</h3><p>' + e(description) + '</p>' +
  (index === 3 && IO_DATA.reportDays != null ? '<p id="report-days"></p>' : '') + '</article>'
).join("");
$("benefit-cards").querySelectorAll(".benefit-art").forEach((slot, index) => {
  const number = index + 1;
  if (!IO_DATA.benefitScreenshots.includes(number)) return;
  const image = new Image();
  image.alt = "";
  image.decoding = "async";
  image.addEventListener("load", () => slot.replaceChildren(image), { once: true });
  image.src = "assets/benefit-" + number + ".webp";
});

$("partner-cards").innerHTML = partners.map(([title, audience, description], index) =>
  '<article class="partner-card"><span class="step-number" aria-hidden="true">' + number(index) +
  '</span><h3>' + e(title) + '</h3><p class="audience">' + e(audience) + '</p><p>' + e(description) + '</p></article>'
).join("");
$("process-steps").innerHTML = steps.map(([title, description], index) =>
  '<li><span class="step-number" aria-hidden="true">' + number(index) + '</span><h3>' + e(title) + '</h3><p>' + e(description) + '</p></li>'
).join("");

const lpaCaption = "Foto tim Campus Innovate";
const astraGallery = ["assets/astra-ecobiz-2.webp", "assets/astra-ecobiz-3.webp"];
const featured = [28, 27, 29, 15];
const allProjects = [
  ...featured.map(id => projects.find(project => project.id === id)),
  ...projects.filter(project => !featured.includes(project.id))
];

function projectCard(project) {
  const caption = project.id === 16 ? lpaCaption : project.title + " — " + (project.period || project.year);
  const image = project.image ? '<div class="project-image">' + photo(project.image, caption) + '</div>' : '';
  return '<article class="project-card">' + image + '<div class="card-body"><p class="project-meta"><span>' + e(project.category) + '</span> · ' + '<span>' + e(project.period || project.year) + '</span>' +
    '</p><h3>' + e(project.title) + '</h3><p>' + e(project.description) +
    '</p><button class="text-button" type="button" aria-haspopup="dialog" aria-controls="project-dialog" aria-label="' + e("Lihat proyek " + project.title) + '" data-project="' + project.id + '">Lihat proyek →</button></div></article>';
}

function caseStudyCard(study) {
  const facts = [study.client, study.type, study.participants, study.location].filter(Boolean);
  return '<article class="project-card">' +
    (study.image ? '<div class="project-image">' + photo(study.image) + '</div>' : '') +
    '<div class="card-body"><p class="project-meta">' + facts.map(fact => '<span>' + e(fact) + '</span>').join(' · ') +
    '</p><h3>' + e(study.title) + '</h3><dl class="case-details">' +
    [["Tantangan", study.challenge], ["Yang kami lakukan", study.action], ["Hasil", study.result]]
      .filter(([, value]) => value).map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + e(value) + '</dd></div>').join("") +
    '</dl></div></article>';
}

const studies = IO_DATA.caseStudies.slice(0, 4);
$("projects").innerHTML = studies.length ? studies.map(caseStudyCard).join("") : allProjects.slice(0, 4).map(projectCard).join("");
$("projects-more").innerHTML = (studies.length ? allProjects : allProjects.slice(4)).map(projectCard).join("");
$("more-projects").hidden = !$("projects-more").children.length;
$("testimonials").innerHTML = IO_DATA.testimonials.slice(0, 2).map(item =>
  '<figure><blockquote>' + e(item.quote) + '</blockquote><figcaption>' +
  [item.name, item.role, item.company].filter(Boolean).map(value => '<span>' + e(value) + '</span>').join(' · ') +
  '</figcaption></figure>'
).join("");
$("testimonials").hidden = !$("testimonials").children.length;

const logos = IO_DATA.clientLogos;
const logoGroup = (items, duplicate = false) => '<ul class="logo-group"' + (duplicate ? ' aria-hidden="true"' : '') + '>' + items.map(logo => '<li title="' + e(logo.name) + '"' + (logo.wide ? ' class="client-logo-wide"' : '') + '>' + photo(logo.src, duplicate ? "" : logo.name) + '</li>').join("") + '</ul>';
const logoRows = [logos.slice(0, Math.ceil(logos.length / 2)), logos.slice(Math.ceil(logos.length / 2))];
$("client-logos").innerHTML = logoRows.filter(row => row.length).map((row, index) => '<div class="logo-marquee' + (index ? ' logo-marquee-reverse' : '') + '"><div class="logo-track">' + logoGroup(row) + logoGroup(row, true) + '</div></div>').join("");
$("logo-toggle").addEventListener("click", () => {
  const paused = $("logo-toggle").getAttribute("aria-pressed") !== "true";
  $("logo-toggle").setAttribute("aria-pressed", String(paused));
  $("logo-toggle").setAttribute("aria-label", paused ? "Putar logo klien" : "Jeda pergerakan logo");
  translateSiteTree($("logo-toggle"));
  $("client-logos").dataset.paused = String(paused);
});
$("trust-logos").hidden = !logos.length;
$("trust-stats").hidden = !IO_DATA.stats;
$("trust").hidden = !logos.length && !IO_DATA.stats;
$("reply-note").hidden = !IO_DATA.replyNote;
$("brief-email").hidden = !IO_DATA.email;
if (IO_DATA.email) {
  const emailLink = $("brief-email").querySelector("a");
  emailLink.textContent = IO_DATA.email;
  emailLink.href = "mailto:" + IO_DATA.email;
}

const selector = $("brief-jenis");
[...services.map(service => service.option), "Lainnya"].forEach(option => selector.add(new Option(option, option)));
const requestedService = new URLSearchParams(location.search).get("acara")?.toLowerCase();
const variant = services.find(service => service.id === requestedService);
const portfolioDefault = "Dari gathering kantor sampai konferensi internasional.";
let briefTypeEdited = false;
selector.addEventListener("change", () => { briefTypeEdited = true; });

function updateLocalizedContent() {
  const active = siteLanguage === "id" ? variant : null;
  $("hero-headline").textContent = active ? active.headline : t(defaultHeadline);
  document.querySelectorAll("[data-wa]").forEach(link => updateWhatsAppLink(link));
  updateWhatsAppLink($("hero-wa"), active ? active.message : greeting);
  for (const service of services) $(service.id).classList.toggle("is-highlight", service === active);
  if (!briefTypeEdited) selector.value = active?.option || "";

  if (IO_DATA.replyNote) $("reply-note").textContent = t(IO_DATA.replyNote);
  if (IO_DATA.stats) {
    const { events, participants, years } = IO_DATA.stats;
    $("trust-stats").textContent = t("{events}+ acara · {participants}+ peserta · {years} tahun pengalaman")
      .replace("{events}", events).replace("{participants}", participants).replace("{years}", years);
  }
  const counts = IO_DATA.caseStudies.map(study => study.participants).filter(value => Number.isFinite(value) && value > 0);
  $("portfolio-lede").textContent = counts.length > 1
    ? t("Dari gathering {min} orang sampai konferensi {max} peserta.")
      .replace("{min}", Math.min(...counts)).replace("{max}", Math.max(...counts))
    : t(portfolioDefault);
  if (IO_DATA.reportDays != null) {
    $("report-days").textContent = t("Dikirim paling lambat {days} hari kerja setelah acara.").replace("{days}", IO_DATA.reportDays);
  }
}

document.addEventListener("DOMContentLoaded", updateLocalizedContent);
$("site-language").addEventListener("change", () => queueMicrotask(updateLocalizedContent));

document.addEventListener("click", event => {
  const link = event.target.closest?.('a[href^="https://wa.me/"]');
  if (link) trackWhatsAppConversion();

  const projectButton = event.target.closest?.("[data-project]");
  if (!projectButton) return;
  const project = projects.find(item => item.id === Number(projectButton.dataset.project));
  if (!project) return;
  const caption = project.id === 16 ? lpaCaption : (project.galleryCaption || "Dokumentasi");
  $("project-body").innerHTML = '<p class="eyebrow">' + e(project.category) + '</p><h2 id="project-title">' + e(project.title) +
    '</h2>' + (project.period ? '<p class="project-period">' + e(project.period) + '</p>' : '') + '<p>' + e(project.description) + '</p>' +
    (project.brandLogo ? '<div class="project-brand">' + photo(project.brandLogo, project.title) + '</div>' : '') +
    (project.image ? '<figure' + (project.portrait ? ' class="project-portrait"' : '') + '>' + photo(project.image, caption) + (project.id === 16 || project.galleryCaption ? '<figcaption>' + e(caption) + '</figcaption>' : '') + '</figure>' : '') +
    ((project.id === 15 ? astraGallery : project.gallery).length ? '<div class="project-gallery">' + (project.id === 15 ? astraGallery : project.gallery).map(src => photo(src, project.galleryCaption || project.title + ' — ' + t('Dokumentasi'))).join("") + '</div>' : '') +
    '<h3>' + e(project.scope) + '</h3>' + list(project.deliverables) +
    '<a class="button button-gold" data-wa="' + e(project.contactMessage || greeting) + '">' + e(project.contactLabel || "Konsultasi Gratis via WhatsApp") + '</a>';
  $("project-body").querySelectorAll("[data-wa]").forEach(link => updateWhatsAppLink(link));
  translateSiteTree($("project-body"));
  $("project-dialog").showModal();
}, true);

$("brief-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const fields = [["Nama/perusahaan", "nama"], ["Jenis acara", "jenis"], ["Tanggal", "tanggal"],
    ["Peserta", "jumlah"], ["Lokasi & kebutuhan", "kebutuhan"]];
  const details = fields.map(([label, key]) => {
    const value = String(form.get(key) || "").trim();
    return t(label) + ": " + (value ? (key === "jenis" ? t(value) : value) : "-");
  });
  trackWhatsAppConversion();
  window.open(whatsappUrl([t(greeting), ...details].join("\n")), "_blank", "noopener");
});

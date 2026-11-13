"use strict";

const IO_DATA = {
  stats: null,
  clientLogos: [
    { name: "Astra International Tbk", src: "assets/client-astra.webp" },
    { name: "Noortura", src: "assets/client-noortura.webp" },
    { name: "PT Geo Investama Mandiri", src: "assets/client-gim.webp" },
    { name: "LPA2I IPB University", src: "assets/client-lpa2i.webp" },
    { name: "Kementerian Lingkungan Hidup dan Kehutanan", src: "assets/client-klhk.webp" },
    { name: "WUNPROQ", src: "assets/client-wunproq.webp" }
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
  [14,"wunproq","WUNPROQ 2026",2026,"Konferensi","World University Network for Productive Waqf","Full Event Management",["Pengelolaan acara","Pengalaman peserta","Materi komunikasi pendukung","Event branding","Branding dan pengelolaan media sosial"]],
  [15,"astra","Astra International Tbk",2026,"Korporat","Peresmian Ecobiz Desa Sejahtera Astra di Garut","Full Event Management",["Konsep dan rundown seremoni","Koordinasi venue, panggung, dan tamu","Peresmian Ecobiz Desa Sejahtera Astra"]],
  [16,"lpa2i","LPA2I IPB University",2026,"Institusi","Pengelolaan acara dari konsep hingga pelaksanaan","Full Event Management",eventScope],
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
].map(([id,client,title,year,category,description,scope,deliverables])=>({
  id,client,title,year,category,description,scope,deliverables,
  image: id === 20 ? null : "assets/project-"+id+".webp"
}));

const $ = id => document.getElementById(id);
const t = translateSiteText;
const greeting = "Halo Innovate Organizer, saya ingin konsultasi acara.";
const defaultHeadline = "Event Organizer di Jabodetabek. Acaranya rapi, datanya lengkap.";
const whatsappBase = "https://wa.me/6285882514394";
const conversionId = "AW-18473450758/iaLBCN-i35AdEIb66ehE";
const whatsappUrl = message => whatsappBase + "?text=" + encodeURIComponent(message);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const e = escapeHtml;
const list = items => "<ul>" + items.map(item => "<li>" + e(item) + "</li>").join("") + "</ul>";
const number = index => String(index + 1).padStart(2, "0");
const photo = (src, alt = "") => '<img src="' + e(src) + '" alt="' + e(alt) + '" loading="lazy" decoding="async">';

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
    '<a class="button button-outline-dark service-cta" data-wa="' + e(service.message) + '">Konsultasikan acara ini →</a></div></article>'
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
const featured = [15, 17, 16, 14];
const allProjects = [
  ...featured.map(id => projects.find(project => project.id === id)),
  ...projects.filter(project => !featured.includes(project.id))
];

function projectCard(project) {
  const caption = project.id === 16 ? lpaCaption : "";
  return '<article class="project-card"><div class="project-image">' +
    photo(project.image || "assets/client-" + project.client + ".webp", caption) +
    (caption ? '<p class="photo-caption">' + caption + '</p>' : '') +
    '</div><div class="card-body"><p class="project-meta"><span>' + e(project.category) + '</span> · ' + project.year +
    '</p><h3>' + e(project.title) + '</h3><p>' + e(project.description) +
    '</p><button class="text-button" type="button" data-project="' + project.id + '">Lihat proyek →</button></div></article>';
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

const logos = IO_DATA.clientLogos.slice(0, 6);
$("client-logos").innerHTML = logos.map(logo => "<li>" + photo(logo.src, logo.name) + "</li>").join("");
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
  const caption = project.id === 16 ? lpaCaption : "Dokumentasi";
  $("project-body").innerHTML = '<p class="eyebrow">' + e(project.category) + '</p><h2 id="project-title">' + e(project.title) +
    '</h2><p>' + e(project.description) + '</p>' +
    (project.image ? '<figure>' + photo(project.image, caption) + (project.id === 16 ? '<figcaption>' + caption + '</figcaption>' : '') + '</figure>' : '') +
    (project.id === 15 ? '<div class="project-gallery">' + astraGallery.map(src => photo(src, "Dokumentasi")).join("") + '</div>' : '') +
    '<h3>' + e(project.scope) + '</h3>' + list(project.deliverables) +
    '<a class="button button-gold" data-wa="' + e(greeting) + '">Konsultasi Gratis via WhatsApp</a>';
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

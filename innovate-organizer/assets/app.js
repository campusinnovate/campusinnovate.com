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
    "id": "seminar",
    "title": "Konferensi & Seminar",
    "option": "Seminar & Konferensi",
    "headline": "Event Organizer Konferensi & Seminar di Jabodetabek",
    "photo": "featured-14",
    "description": "Konferensi nasional/internasional, simposium, dan forum.",
    "scope": [
      "Konsep acara",
      "Koordinasi pembicara & sesi",
      "Alur peserta",
      "Produksi teknis"
    ],
    "digital": "Registrasi & check-in QR, live Q&A & polling, e-sertifikat.",
    "message": "Halo, saya ingin konsultasi acara seminar/konferensi."
  },
  {
    "id": "corporate",
    "title": "Acara Korporat & Institusi",
    "option": "Acara Perusahaan",
    "headline": "Event Organizer Acara Korporat & Institusi di Jabodetabek",
    "photo": "project-15",
    "description": "Rapat, town hall, kick-off, dan acara kelembagaan.",
    "scope": [
      "Venue & ruang",
      "Kesiapan presentasi",
      "Agenda acara",
      "Koordinasi tamu"
    ],
    "digital": "RSVP & QR tamu, pengingat WA/email, live polling.",
    "message": "Halo, saya ingin konsultasi acara perusahaan."
  },
  {
    "id": "team-building",
    "title": "Team Experiences",
    "option": "Team Building",
    "headline": "Event Organizer Team Experiences di Jabodetabek",
    "photo": "klh-bplh-group-2026",
    "description": "Outing, gathering, retreat, outbound, dan team building.",
    "scope": [
      "Rancangan aktivitas",
      "Venue & vendor",
      "Fasilitator",
      "Keselamatan lapangan"
    ],
    "optional": "Perjalanan & akomodasi (opsional).",
    "digital": "Data peserta, kuis & games interaktif, survei feedback.",
    "message": "Halo, saya ingin konsultasi acara team building."
  },
  {
    "id": "pelatihan",
    "title": "Pelatihan & Workshop",
    "option": "Pelatihan & Workshop",
    "headline": "Event Organizer Pelatihan & Workshop di Jabodetabek",
    "photo": "brmp-training-session",
    "description": "Tim Anda fokus belajar, kami urus acaranya.",
    "scope": [
      "Administrasi jadwal & peserta",
      "Venue & peralatan",
      "Logistik trainer"
    ],
    "optional": "Trainer & materi tersedia secara opsional lewat mitra.",
    "digital": "E-sertifikat otomatis, evaluasi digital.",
    "message": "Halo, saya ingin konsultasi acara pelatihan/workshop."
  },
  {
    "id": "event-support",
    "title": "Event Support",
    "option": "Event Support",
    "headline": "Tim Event Support di Jabodetabek",
    "photo": "brmp-training-team",
    "description": "Tim spesialis untuk bagian acara yang Anda butuhkan.",
    "scope": [
      "Registrasi",
      "Dokumentasi foto/video",
      "Desain",
      "LO & panggung",
      "Fasilitator outing & kru lapangan"
    ],
    "digital": "Operator registrasi, check-in, atau sistem acara sesuai lingkup kerja.",
    "message": "Halo, saya ingin tanya layanan Event Support."
  }
];

const benefits = [
  ["Registrasi online, tanpa rekap manual.", "Peserta mendaftar lewat link. Data langsung tersusun, jadi panitia tidak perlu merapikan spreadsheet satu per satu.", "M8 3h8l3 3v15H5V3h3zm0 6h8m-8 4h8m-8 4h5"],
  ["Check-in pakai QR, tanpa antrean panjang.", "Peserta cukup menunjukkan kode QR di meja registrasi. Jumlah kehadiran terlihat secara langsung.", "M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5m4-3 3 3 5-6"],
  ["Progres persiapan yang bisa dipantau.", "Anda bisa melihat checklist, pembagian tugas, dan kesiapan vendor tanpa harus menanyakan update berkali-kali.", "M3 5h18v14H3zM3 9h18m-12 0v10m4-6h4m-4 3h3"],
  ["Laporan acara yang siap dibawa ke atasan.", "Setelah acara, Anda menerima rekap kehadiran, dokumentasi, dan feedback peserta dalam satu laporan.", "M4 4v16h16m-12-4v-4m4 4V9m4 7V6"]
];

benefits.push(["Peserta terlibat, bukan cuma hadir.", "Pengingat WA/email, live polling, Q&A, dan kuis membantu peserta mengikuti dan ikut berinteraksi selama acara.", "M4 4h16v12H9l-5 4V4zm4 5h8m-8 4h5"]);

const partners = [
  ["Full-Service", "Anda ingin terima beres", "Kami susun konsep, urus vendor, jalankan hari-H, dan serahkan laporan acara."],
  ["Selected Service", "Panitia internal sudah ada", "Kami pegang fungsi tertentu yang disepakati, misalnya registrasi digital, dokumentasi, atau produksi panggung."],
  ["Team Support", "Butuh tambahan tenaga", "Kami sediakan personel terlatih untuk peran tertentu, seperti usher, registrasi, LO, atau tim lapangan."]
];

const steps = [
  [
    "Pahami",
    "Tujuan, peserta, kebutuhan, dan anggaran."
  ],
  [
    "Rencanakan",
    "Konsep, ruang lingkup, dan timeline."
  ],
  [
    "Siapkan",
    "Tim, vendor, materi, dan kesiapan teknis."
  ],
  [
    "Jalankan",
    "Operasional hari-H dan penanganan kendala."
  ],
  [
    "Tutup",
    "Evaluasi, serah terima, dan administrasi proyek."
  ]
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


const portfolioDetails = {"28":{"description":"Fun games untuk tim KLH/BPLH, dari aktivitas kelompok sampai sesi kebersamaan dan dokumentasi acara.","facts":[["Periode","November 2026"],["Format","Fun games & team building"],["Yang ditangani","Aktivitas peserta dan dokumentasi kegiatan"]]},"27":{"description":"Tim Innovate Organizer mendukung pelaksanaan pelatihan BRMP, termasuk kegiatan pembukaan, sesi belajar, dan penutupan.","facts":[["Periode","Oktober 2026"],["Peran","Support Training"],["Yang ditangani","Dukungan pelaksanaan dan dokumentasi pelatihan"]]},"15":{"description":"Peresmian Ecobiz Desa Sejahtera Astra di Garut. Kami menangani konsep dan rundown seremoni, koordinasi kebutuhan acara, serta alur tamu di lokasi.","facts":[["Lokasi","Garut"],["Format","Seremoni peresmian"],["Yang ditangani","Konsep, rundown, koordinasi venue, panggung, dan tamu"]]},"17":{"description":"Noortura Open House bertema Return to Your Rhythm, 26 September 2026 di Swiss-Belcourt Bogor. Dukungan acara menghubungkan aktivitas keluarga, website acara, RSVP digital, dan dokumentasi.","period":"26 September 2026","facts":[["Tanggal","26 September 2026"],["Lokasi","Swiss-Belcourt Bogor"],["Yang ditangani","Alur aktivitas keluarga, website acara, RSVP digital, dan dokumentasi"]]},"18":{"description":"Dukungan pelatihan Processing Data LiDAR Batch 1 untuk PT Geo Investama Mandiri pada 2–4 September 2026. Kegiatan mencakup sesi praktik DJI Terra dan TerraSolid serta dokumentasi proses belajar.","scope":"Support Training","period":"2–4 September 2026","facts":[["Durasi","3 hari · 2–4 September 2026"],["Materi kegiatan","Pengolahan data LiDAR, DJI Terra & TerraSolid"],["Yang ditangani","Dukungan pelaksanaan dan dokumentasi pelatihan"]]},"14":{"description":"Pengelolaan konferensi World University Network for Productive Waqf: alur acara, pengalaman peserta, identitas visual, dan materi komunikasi pendukung.","facts":[["Format","Konferensi internasional"],["Yang ditangani","Event management, pengalaman peserta, branding, dan media sosial"]]},"29":{"facts":[["Format","Trekking & hiking rombongan"],["Pengalaman rute","Gunung Luhur, Sumbing, Cisadon, Kawah Ratu, Merbabu, Lawu, Gede, dan curug di Bogor"],["Tim","Innovate Organizer bersama komunitas Stripmate"]]},"24":{"description":"Kegiatan capacity building untuk tim PUSTARHUT. Cakupan kerja meliputi desain aktivitas, keterlibatan peserta, koordinasi lapangan, dan pelaksanaan kegiatan."},"26":{"description":"Capacity building dan outbound untuk peserta Wirausaha Merdeka IPB. Tim mengatur aktivitas kelompok, mendampingi peserta, dan mengoordinasikan pelaksanaan di lapangan."},"23":{"description":"Pelatihan public speaking untuk komunitas Universitas Bina Niaga Indonesia, dengan pengelolaan sesi, keterlibatan peserta, dan pelaksanaan kegiatan."},"19":{"description":"Pengelolaan acara DPKKHA IPB University, mencakup koordinasi kegiatan, alur peserta, dan pelaksanaan di lokasi."},"20":{"description":"Dukungan seremoni peluncuran ekspor DPMA IPB University: pengelolaan tamu, alur acara, pengalaman peserta, dan koordinasi lapangan."},"21":{"description":"Pengelolaan kunjungan institusi UCAM Malaysia: menyusun alur kunjungan, mendampingi peserta, dan mengoordinasikan agenda di lokasi."},"22":{"description":"Capacity building untuk instansi pemerintah, dengan desain aktivitas kelompok, pendampingan peserta, dan koordinasi pelaksanaan lapangan."},"25":{"description":"Pengelolaan Student Entrepreneur Expo IPB, dari persiapan operasional, alur peserta, sampai pelaksanaan kegiatan di lokasi."}};
for (const project of projects) Object.assign(project, portfolioDetails[project.id] || {});


const portfolioPhotos = {"15":["assets/gallery-astra-1.webp","assets/gallery-astra-2.webp","assets/gallery-astra-3.webp","assets/gallery-astra-4.webp","assets/gallery-astra-5.webp","assets/gallery-astra-6.webp","assets/gallery-astra-7.webp","assets/gallery-astra-8.webp"],"27":["assets/gallery-brmp-closing-1.webp","assets/gallery-brmp-closing-2.webp","assets/gallery-brmp-closing-3.webp","assets/gallery-brmp-opening-1.webp","assets/gallery-brmp-opening-2.webp","assets/gallery-brmp-opening-3.webp","assets/gallery-brmp-opening-4.webp"],"28":["assets/gallery-klh-edited-1.webp","assets/gallery-klh-edited-2.webp","assets/gallery-klh-edited-3.webp","assets/gallery-klh-edited-4.webp","assets/gallery-klh-edited-5.webp","assets/gallery-klh-edited-6.webp","assets/gallery-klh-edited-7.webp"],"17":["assets/gallery-noortura-direct-1.webp","assets/gallery-noortura-direct-10.webp","assets/gallery-noortura-direct-2.webp","assets/gallery-noortura-direct-3.webp","assets/gallery-noortura-direct-4.webp","assets/gallery-noortura-direct-5.webp","assets/gallery-noortura-direct-6.webp","assets/gallery-noortura-direct-7.webp","assets/gallery-noortura-direct-8.webp","assets/gallery-noortura-direct-9.webp"],"24":["assets/gallery-pustarhut-1.webp","assets/gallery-pustarhut-10.webp","assets/gallery-pustarhut-2.webp","assets/gallery-pustarhut-3.webp","assets/gallery-pustarhut-4.webp","assets/gallery-pustarhut-5.webp","assets/gallery-pustarhut-6.webp","assets/gallery-pustarhut-7.webp","assets/gallery-pustarhut-9.webp"],"29":["assets/gallery-strip-luhur-1.webp","assets/gallery-strip-luhur-2.webp","assets/gallery-strip-luhur-3.webp","assets/gallery-strip-luhur-4.webp","assets/gallery-strip-luhur-5.webp","assets/gallery-strip-luhur-6.webp","assets/gallery-strip-luhur-7.webp","assets/gallery-strip-luhur-8.webp"],"18":["assets/gallery-lidar-2.webp","assets/gallery-lidar-3.webp","assets/gallery-lidar-4.webp","assets/gallery-lidar-5.webp","assets/gallery-lidar-6.webp","assets/gallery-lidar-7.webp"],"26":["assets/gallery-wmk-participants-1.webp","assets/gallery-wmk-participants-10.webp","assets/gallery-wmk-participants-2.webp","assets/gallery-wmk-participants-3.webp","assets/gallery-wmk-participants-4.webp","assets/gallery-wmk-participants-5.webp","assets/gallery-wmk-participants-6.webp","assets/gallery-wmk-participants-7.webp","assets/gallery-wmk-participants-8.webp","assets/gallery-wmk-participants-9.webp"],"14":["assets/gallery-wunproq-1.webp","assets/gallery-wunproq-2.webp","assets/gallery-wunproq-3.webp","assets/gallery-wunproq-4.webp","assets/gallery-wunproq-5.webp","assets/gallery-wunproq-6.webp","assets/gallery-wunproq-7.webp","assets/gallery-wunproq-8.webp","assets/gallery-wunproq-9.webp"]};
for (const project of projects) {
  const prior = project.id === 15 ? ["assets/astra-ecobiz-2.webp", "assets/astra-ecobiz-3.webp"] : project.gallery;
  project.gallery = [...new Set([...prior, ...(portfolioPhotos[project.id] || [])])].filter(src => src !== project.image);
}


const portfolioRefresh = {"14":{"description":"World University Network for Productive Waqf. Full event management, termasuk branding acara dan materi komunikasi.","scope":"Full Event Management","format":"Konferensi internasional","audience":"Delegasi & peserta konferensi"},"15":{"description":"Serah terima simbolis Hunian Layak Huni dan peresmian Ecobiz Desa Sejahtera Astra, Garut.","scope":"Full Event Management","format":"Seremoni serah terima & peresmian","audience":"Tamu undangan & pemangku kepentingan","deliverables":["Konsep & rundown seremoni","Koordinasi venue dan panggung","Koordinasi tamu"]},"27":{"description":"Event support Training ISO 9001 Lead Auditor & Sertifikasi BNSP.","scope":"Event Support","format":"Pelatihan & sertifikasi","audience":"Peserta pelatihan BRMP","deliverables":["Manajemen peserta","Venue & logistik","Operasional acara"]},"28":{"description":"Fun games dan team building pegawai KLH/BPLH.","scope":"Team Experiences","format":"Fun games & team building","audience":"Pegawai KLH/BPLH","deliverables":["Konsep permainan","Fasilitasi kelompok"]},"17":{"format":"Open house","audience":"Keluarga & calon orang tua murid"},"18":{"format":"Pelatihan LiDAR Batch 1","audience":"Peserta pelatihan Geo Investama"},"19":{"format":"Acara institusi","audience":"Komunitas institusi IPB"},"20":{"format":"Seremoni peluncuran ekspor","audience":"Tamu undangan & mitra institusi"},"21":{"format":"Kunjungan institusi","audience":"Delegasi UCAM Malaysia"},"22":{"format":"Capacity building","audience":"Pegawai instansi pemerintah"},"23":{"format":"Pelatihan public speaking","audience":"Komunitas kampus"},"24":{"format":"Capacity building","audience":"Tim PUSTARHUT"},"25":{"format":"Expo kewirausahaan","audience":"Wirausaha mahasiswa & pengunjung"},"26":{"format":"Capacity building & outbound","audience":"Peserta Wirausaha Merdeka IPB"},"29":{"format":"Trekking & hiking","audience":"Rombongan & komunitas Stripmate"}};
for (const project of projects) Object.assign(project, portfolioRefresh[project.id] || {});
projects.push({id:16,client:"lpa2i",title:"LPA2I IPB University",year:2026,category:"Institusi",description:"Pengelolaan acara dari konsep hingga pelaksanaan.",scope:"Full Event Management",format:"Acara institusi",audience:"Komunitas institusi IPB",deliverables:eventScope,gallery:[],image:null});


projects.push({"id":30,"client":"big","title":"Badan Informasi Geospasial · SQL Batch 1","year":2026,"category":"Pelatihan","description":"Dukungan pelaksanaan pelatihan SQL Batch 1 di Badan Informasi Geospasial, termasuk dokumentasi sesi kelas, praktik, dan interaksi peserta.","scope":"Support Training","format":"Pelatihan SQL Batch 1","audience":"Peserta pelatihan Badan Informasi Geospasial","deliverables":["Dukungan kegiatan di lokasi","Dokumentasi sesi belajar dan praktik"],"gallery":["assets/sql-batch-1-2.webp","assets/sql-batch-1-3.webp","assets/sql-batch-1-4.webp","assets/sql-batch-1-5.webp","assets/sql-batch-1-6.webp","assets/sql-batch-1-7.webp","assets/sql-batch-1-8.webp","assets/sql-batch-1-9.webp","assets/sql-batch-1-10.webp"],"image":"assets/sql-batch-1-1.webp"});
projects.push({"id":31,"client":"big","title":"Badan Informasi Geospasial · SQL Batch 2","year":2026,"category":"Pelatihan","description":"Dukungan pelaksanaan pelatihan SQL Batch 2 di Badan Informasi Geospasial, termasuk dokumentasi sesi kelas, praktik, dan interaksi peserta.","scope":"Support Training","format":"Pelatihan SQL Batch 2","audience":"Peserta pelatihan Badan Informasi Geospasial","deliverables":["Dukungan kegiatan di lokasi","Dokumentasi sesi belajar dan praktik"],"gallery":["assets/sql-batch-2-2.webp","assets/sql-batch-2-3.webp","assets/sql-batch-2-4.webp","assets/sql-batch-2-5.webp","assets/sql-batch-2-6.webp","assets/sql-batch-2-7.webp","assets/sql-batch-2-8.webp","assets/sql-batch-2-9.webp","assets/sql-batch-2-10.webp"],"image":"assets/sql-batch-2-1.webp"});

for (const project of projects) {
  if (project.id === 14) project.image = "assets/featured-14.webp";
  const logo = IO_DATA.clientLogos.find(item=>item.src === "assets/client-"+project.client+".webp");
  if (logo && !project.brandLogo) project.brandLogo = logo.src;
}

const $ = id => document.getElementById(id);
const t = translateSiteText;
const greeting = "Halo Innovate Organizer, saya ingin konsultasi acara.";
const defaultHeadline = "Acara kantor dan institusi di Jabodetabek, beres dari konsep sampai laporan.";
const whatsappBase = "https://wa.me/6285882514394";
const whatsappUrl = message => whatsappBase + "?text=" + encodeURIComponent(message);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const e = escapeHtml;
const list = items => "<ul>" + items.map(item => "<li>" + e(item) + "</li>").join("") + "</ul>";
const number = index => String(index + 1).padStart(2, "0");
const imageDimensions = {"assets/astra-ecobiz-2.webp":[1000,563],"assets/astra-ecobiz-3.webp":[450,800],"assets/brmp-training-2026-2.webp":[1440,960],"assets/brmp-training-2026-3.webp":[1440,959],"assets/brmp-training-group.webp":[1600,1065],"assets/brmp-training-session.webp":[1600,1066],"assets/brmp-training-team.webp":[1600,1066],"assets/client-aio.webp":[258,52],"assets/client-astra.webp":[320,90],"assets/client-big.webp":[320,149],"assets/client-bni.webp":[181,78],"assets/client-bri.webp":[164,86],"assets/client-brmp.webp":[720,157],"assets/client-cda.webp":[155,94],"assets/client-dpkkha.webp":[320,75],"assets/client-dpma.webp":[408,105],"assets/client-gim.webp":[191,102],"assets/client-institusi.webp":[96,123],"assets/client-ipb.webp":[230,160],"assets/client-klh-bplh.webp":[200,198],"assets/client-klhk.webp":[124,122],"assets/client-lpa2i.webp":[394,100],"assets/client-modlaci.webp":[202,79],"assets/client-noortura.webp":[153,110],"assets/client-optima.webp":[177,85],"assets/client-pustarhut.webp":[266,54],"assets/client-see.webp":[150,130],"assets/client-tirta.webp":[132,133],"assets/client-trendy.webp":[214,79],"assets/client-ucam.webp":[128,122],"assets/client-unbin.webp":[141,141],"assets/client-vkpenta.webp":[141,118],"assets/client-wakaf.webp":[225,95],"assets/client-wmk.webp":[107,95],"assets/client-wunproq.webp":[241,98],"assets/clients.webp":[1250,499],"assets/cover.webp":[852,1000],"assets/featured-14.webp":[1800,1202],"assets/featured-17.webp":[1800,1200],"assets/featured-18.webp":[1600,1200],"assets/featured-19.webp":[706,325],"assets/featured-22.webp":[1800,1013],"assets/featured-23.webp":[1800,1013],"assets/gallery-astra-1.webp":[1400,788],"assets/gallery-astra-2.webp":[1400,788],"assets/gallery-astra-3.webp":[1400,788],"assets/gallery-astra-4.webp":[1400,788],"assets/gallery-astra-5.webp":[1400,788],"assets/gallery-astra-6.webp":[1400,788],"assets/gallery-astra-7.webp":[1400,788],"assets/gallery-astra-8.webp":[788,1400],"assets/gallery-brmp-closing-1.webp":[1400,933],"assets/gallery-brmp-closing-2.webp":[1400,933],"assets/gallery-brmp-closing-3.webp":[1400,933],"assets/gallery-brmp-opening-1.webp":[1400,933],"assets/gallery-brmp-opening-2.webp":[1400,933],"assets/gallery-brmp-opening-3.webp":[1400,933],"assets/gallery-brmp-opening-4.webp":[1400,933],"assets/gallery-klh-edited-1.webp":[1400,933],"assets/gallery-klh-edited-2.webp":[933,1400],"assets/gallery-klh-edited-3.webp":[1400,933],"assets/gallery-klh-edited-4.webp":[1400,933],"assets/gallery-klh-edited-5.webp":[933,1400],"assets/gallery-klh-edited-6.webp":[1400,933],"assets/gallery-klh-edited-7.webp":[1400,933],"assets/gallery-lidar-2.webp":[1120,1400],"assets/gallery-lidar-3.webp":[1120,1400],"assets/gallery-lidar-4.webp":[1120,1400],"assets/gallery-lidar-5.webp":[1120,1400],"assets/gallery-lidar-6.webp":[1120,1400],"assets/gallery-lidar-7.webp":[1120,1400],"assets/gallery-noortura-direct-1.webp":[1400,933],"assets/gallery-noortura-direct-10.webp":[1400,933],"assets/gallery-noortura-direct-2.webp":[1400,933],"assets/gallery-noortura-direct-3.webp":[1400,933],"assets/gallery-noortura-direct-4.webp":[1400,933],"assets/gallery-noortura-direct-5.webp":[1400,933],"assets/gallery-noortura-direct-6.webp":[1400,933],"assets/gallery-noortura-direct-7.webp":[1400,933],"assets/gallery-noortura-direct-8.webp":[1400,933],"assets/gallery-noortura-direct-9.webp":[1400,933],"assets/gallery-pustarhut-1.webp":[1400,1050],"assets/gallery-pustarhut-10.webp":[788,1400],"assets/gallery-pustarhut-2.webp":[1050,1400],"assets/gallery-pustarhut-3.webp":[1050,1400],"assets/gallery-pustarhut-4.webp":[1400,788],"assets/gallery-pustarhut-5.webp":[1050,1400],"assets/gallery-pustarhut-6.webp":[1400,788],"assets/gallery-pustarhut-7.webp":[1400,788],"assets/gallery-pustarhut-9.webp":[1400,788],"assets/gallery-strip-luhur-1.webp":[1050,1400],"assets/gallery-strip-luhur-2.webp":[787,1400],"assets/gallery-strip-luhur-3.webp":[1050,1400],"assets/gallery-strip-luhur-4.webp":[1050,1400],"assets/gallery-strip-luhur-5.webp":[1050,1400],"assets/gallery-strip-luhur-6.webp":[1050,1400],"assets/gallery-strip-luhur-7.webp":[790,1400],"assets/gallery-strip-luhur-8.webp":[787,1400],"assets/gallery-wmk-participants-1.webp":[1400,933],"assets/gallery-wmk-participants-10.webp":[1400,933],"assets/gallery-wmk-participants-2.webp":[1400,933],"assets/gallery-wmk-participants-3.webp":[1400,933],"assets/gallery-wmk-participants-4.webp":[1400,933],"assets/gallery-wmk-participants-5.webp":[1400,933],"assets/gallery-wmk-participants-6.webp":[1400,933],"assets/gallery-wmk-participants-7.webp":[1400,933],"assets/gallery-wmk-participants-8.webp":[1400,933],"assets/gallery-wmk-participants-9.webp":[1400,933],"assets/gallery-wunproq-1.webp":[1400,788],"assets/gallery-wunproq-2.webp":[1400,788],"assets/gallery-wunproq-3.webp":[788,1400],"assets/gallery-wunproq-4.webp":[1400,788],"assets/gallery-wunproq-5.webp":[1400,788],"assets/gallery-wunproq-6.webp":[1400,788],"assets/gallery-wunproq-7.webp":[1400,788],"assets/gallery-wunproq-8.webp":[1400,788],"assets/gallery-wunproq-9.webp":[1400,788],"assets/klh-bplh-2026-2.webp":[960,1440],"assets/klh-bplh-2026-3.webp":[960,1440],"assets/klh-bplh-group-2026.webp":[1800,1200],"assets/logo.webp":[125,98],"assets/opening-01.webp":[1100,619],"assets/opening-02.webp":[640,427],"assets/opening-03.webp":[640,360],"assets/opening-04.webp":[640,427],"assets/opening-05.webp":[640,427],"assets/opening-07.webp":[640,427],"assets/opening-08.webp":[640,360],"assets/opening-09.webp":[640,427],"assets/opening-11.webp":[640,480],"assets/opening-12.webp":[640,480],"assets/opening-13.webp":[640,427],"assets/project-14.webp":[640,427],"assets/project-15.webp":[1200,676],"assets/project-16.webp":[1040,780],"assets/project-17.webp":[1100,733],"assets/project-18.webp":[1100,825],"assets/project-19.webp":[706,325],"assets/project-20.webp":[1200,675],"assets/project-21.webp":[706,325],"assets/project-22.webp":[1100,619],"assets/project-23.webp":[1100,619],"assets/project-24.webp":[1100,825],"assets/project-25.webp":[706,325],"assets/project-26.webp":[1100,733],"assets/project-27.webp":[1440,959],"assets/project-28.webp":[1440,960],"assets/project-29.webp":[1440,960],"assets/service-1.webp":[512,512],"assets/service-2.webp":[512,512],"assets/service-3.webp":[512,512],"assets/service-4.webp":[512,512],"assets/service-5.webp":[512,512],"assets/service-hall.webp":[512,512],"assets/sql-batch-1-1.webp":[933,1400],"assets/sql-batch-1-10.webp":[1400,933],"assets/sql-batch-1-2.webp":[1400,933],"assets/sql-batch-1-3.webp":[1400,933],"assets/sql-batch-1-4.webp":[933,1400],"assets/sql-batch-1-5.webp":[1400,933],"assets/sql-batch-1-6.webp":[1400,933],"assets/sql-batch-1-7.webp":[933,1400],"assets/sql-batch-1-8.webp":[1400,933],"assets/sql-batch-1-9.webp":[1400,933],"assets/sql-batch-2-1.webp":[1400,934],"assets/sql-batch-2-10.webp":[1400,934],"assets/sql-batch-2-2.webp":[1400,934],"assets/sql-batch-2-3.webp":[1400,934],"assets/sql-batch-2-4.webp":[1400,934],"assets/sql-batch-2-5.webp":[1400,934],"assets/sql-batch-2-6.webp":[1400,934],"assets/sql-batch-2-7.webp":[1400,934],"assets/sql-batch-2-8.webp":[1400,934],"assets/sql-batch-2-9.webp":[1400,934],"assets/stripmate-kawah-ratu-group.webp":[1440,1800],"assets/stripmate-logo.webp":[557,200],"assets/stripmate-outdoor-2.webp":[1400,1400],"assets/stripmate-sumbing-group.webp":[1800,1013],"assets/stripmate-trekking-2.webp":[1080,1440],"assets/stripmate-trekking-3.webp":[1080,1440],"assets/stripmate-trekking-cover.webp":[1080,1440],"assets/system-coreva.webp":[1014,484],"assets/system-ipb-connect.webp":[1014,484],"assets/system-ipb-leap-contact.webp":[820,461],"assets/system-ipb-leap-hero.webp":[820,461],"assets/system-ipb-leap-logo.webp":[83,180],"assets/system-ipb-leap.webp":[820,461],"assets/system-itinerary.webp":[480,760],"assets/system-klh-score.webp":[1230,692],"assets/system-optima.webp":[1014,484],"assets/system-ylos.webp":[1014,484],"assets/testimonial-klhk-poster.webp":[960,540],"assets/testimonial-wmk-poster.webp":[960,540]};
const photo = (src, alt = "", eager = false) => {
  const dimensions = imageDimensions[src];
  const size = dimensions ? ' width="' + dimensions[0] + '" height="' + dimensions[1] + '"' : "";
  return '<img src="' + e(src) + '" alt="' + e(alt) + '"' + size + ' loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async">';
};

function updateWhatsAppLink(link, message = link.dataset.wa) {
  link.href = whatsappUrl(t(message));
  link.target = "_blank";
  link.rel = "noopener";
}


$("service-cards").innerHTML = services.map((service, index) =>
  '<article class="service-card" id="' + service.id + '">' +
    '<div class="service-photo">' + photo("assets/" + service.photo + ".webp", service.title, index < 3) + '<span>' + number(index) + '</span></div>' +
    '<div class="card-body"><h3>' + e(service.title) + '</h3><p>' + e(service.description) + '</p>' +
    '<h4>Yang kami tangani</h4>' + list(service.scope) +
    (service.optional ? '<p class="service-option">' + e(service.optional) + '</p>' : '') +
    '<div class="service-digital"><h4>Sentuhan digital</h4><p>' + e(service.digital) + '</p></div>' +
    '<a class="button button-whatsapp service-cta" data-wa="' + e(service.message) + '">Chat WhatsApp</a></div></article>'
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
const featured = [14, 15, 27, 28];
const allProjects = [
  ...featured.map(id => projects.find(project => project.id === id)),
  ...projects.filter(project => !featured.includes(project.id))
];

function projectCard(project) {
  const caption = project.title + " — " + (project.period || project.year);
  const logo = IO_DATA.clientLogos.find(item => item.src === "assets/client-" + project.client + ".webp") || IO_DATA.clientLogos.find(item => item.name === "Stripmate" && project.client === "stripmate");
  const brand = logo ? '<div class="project-client-logo">' + photo(logo.src, logo.name) + '</div>' : '';
  const image = project.image ? '<div class="project-image">' + photo(project.image, caption, featured.includes(project.id)) + brand + '</div>' : '<div class="project-logo-cover">' + brand + '</div>';
  const thumbs = project.gallery.slice(0,3);
  const facts = [["Layanan",project.scope],["Bentuk acara",project.format || project.category],[project.participants ? "Peserta" : "Profil peserta",project.participants ? project.participants + " orang" : project.audience]];
  return '<article class="project-card">' + image +
    (thumbs.length ? '<div class="project-preview">' + thumbs.map((src,i) => photo(src,project.title + " — dokumentasi " + (i+2))).join('') + '</div>' : '') +
    '<div class="card-body"><p class="project-meta">' + e(project.period || project.year) + '</p><h3>' + e(project.title) + '</h3><p>' + e(project.description) + '</p><dl class="portfolio-facts">' + facts.filter(([,v])=>v).map(([label,value])=>'<div><dt>'+e(label)+'</dt><dd>'+e(value)+'</dd></div>').join('') + '</dl><p class="gallery-count">' + ((project.image ? 1 : 0) + project.gallery.length ? e(String((project.image ? 1 : 0) + project.gallery.length)) + ' <span>foto dokumentasi</span>' : '<span>Profil proyek institusi</span>') + '</p><button class="text-button" type="button" aria-haspopup="dialog" aria-controls="project-dialog" aria-label="' + e("Lihat proyek " + project.title) + '" data-project="' + project.id + '">Lihat detail proyek</button></div></article>';
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
const variant = services.find(service => service.id === (requestedService === "gathering" ? "team-building" : requestedService));
const portfolioDefault = "Dari gathering kantor sampai konferensi internasional.";
let briefTypeEdited = false;
selector.addEventListener("change", () => { briefTypeEdited = true; });

function updateLocalizedContent() {
  const active = siteLanguage === "id" ? variant : null;
  const headlineText = active ? active.headline : t(defaultHeadline);
  const headline = $("hero-headline");
  headline.classList.toggle("hero-two-lines", headlineText === defaultHeadline);
  if (headlineText === defaultHeadline) {
    headline.replaceChildren();
    const lines = ["Acara kantor dan institusi di Jabodetabek,", "beres dari konsep sampai laporan."];
    lines.forEach((text, index) => {
      if (index) headline.append(document.createTextNode(" "));
      const span = document.createElement("span"); span.className = "hero-line"; span.textContent = text; headline.append(span);
    });
  } else headline.textContent = headlineText;
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
  const projectButton = event.target.closest?.("[data-project]");
  if (!projectButton) return;
  const project = projects.find(item => item.id === Number(projectButton.dataset.project));
  if (!project) return;
  const caption = project.id === 16 ? lpaCaption : (project.galleryCaption || "Dokumentasi");
  $("project-body").innerHTML = '<p class="eyebrow">' + e(project.category) + '</p><h2 id="project-title">' + e(project.title) +
    '</h2>' + (project.period ? '<p class="project-period">' + e(project.period) + '</p>' : '') + '<p>' + e(project.description) + '</p>' +
    ([["Layanan", project.scope], ["Bentuk acara", project.format || project.category], [project.participants ? "Peserta" : "Profil peserta", project.participants ? project.participants + " orang" : project.audience], ...(project.facts || []).filter(([label])=>!["Format","Peran","Yang ditangani"].includes(label))].length ? '<dl class="project-facts">' + [["Layanan", project.scope], ["Bentuk acara", project.format || project.category], [project.participants ? "Peserta" : "Profil peserta", project.participants ? project.participants + " orang" : project.audience], ...(project.facts || []).filter(([label])=>!["Format","Peran","Yang ditangani"].includes(label))].filter(([,value])=>value).map(([label,value]) => '<div><dt>' + e(label) + '</dt><dd>' + e(value) + '</dd></div>').join('') + '</dl>' : '') +
    (project.brandLogo ? '<div class="project-brand">' + photo(project.brandLogo, project.title) + '</div>' : '') +
    (project.image ? '<figure' + (project.portrait ? ' class="project-portrait"' : '') + '>' + photo(project.image, caption, true) + (project.id === 16 || project.galleryCaption ? '<figcaption>' + e(caption) + '</figcaption>' : '') + '</figure>' : '') +
    (project.gallery.length ? '<div class="project-gallery">' + project.gallery.map((src, index) => photo(src, (project.galleryCaption || project.title + ' — ' + t('Dokumentasi')) + ' ' + (index + 2), index < 2)).join("") + '</div>' : '') +
    '<h3>' + e(project.scope) + '</h3>' + list(project.deliverables) +
    '<a class="button button-whatsapp" data-tracking-location="project-' + project.id + '" data-wa="' + e(project.contactMessage || greeting) + '">' + e(project.contactLabel || "Konsultasi Gratis via WhatsApp") + '</a>';
  $("project-body").querySelectorAll("[data-wa]").forEach(link => updateWhatsAppLink(link));
  translateSiteTree($("project-body"));
  $("project-dialog").showModal();
}, true);


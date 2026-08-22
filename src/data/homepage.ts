export const navigation = [
  { label: 'Home', href: '/home#home' },
  { label: 'About', href: '/home#about' },
  { label: 'Our Service', href: '/home#services' },
  { label: 'Workfolio', href: '/home#workfolio' },
  { label: 'Kawan Inovasi', href: '/home#kawan-inovasi' },
  { label: 'Community', href: '/home#community' },
  { label: 'Contact', href: '/home#contact' },
] as const;

export const clientMarks = [
  { name: 'IPB University', logo: '/assets/logos/logo-ipb.png' },
  { name: 'Kementerian Lingkungan Hidup dan Kehutanan', logo: '/assets/logos/logo-klhk.png' },
  { name: 'WUNPROQ', logo: '/assets/site-2026/logos/wunproq.png' },
  { name: 'Wakaf IPB University', logo: '/assets/site-2026/logos/wakaf-ipb.png' },
  { name: 'Bank Rakyat Indonesia', logo: '/assets/site-2026/logos/bri.png' },
  { name: 'Bank Negara Indonesia', logo: '/assets/site-2026/logos/bni.png' },
] as const;

export const solutions = [
  {
    id: 'event-experience',
    number: '01',
    title: 'Event & Experience Management',
    description: 'Educational events, MICE, capacity building, outbound, study trips, and hybrid experiences designed around clear outcomes.',
    image: '/assets/site-2026/capacity-building.jpg',
  },
  {
    id: 'program-development',
    number: '02',
    title: 'Program Development',
    description: 'Collaborative programs for youth and student development, from leadership summits to institutional partnerships.',
    image: '/assets/site-2026/cda-ipb-aerial.jpg',
  },
  {
    id: 'digital-system',
    number: '03',
    title: 'Digital System Development',
    description: 'Web platforms, organizational systems, workflow tools, event systems, LMS, and thoughtful UI/UX design.',
    image: '/assets/site-2026/mentoring-workshop.jpg',
  },
  {
    id: 'training-development',
    number: '04',
    title: 'Training & Development',
    description: 'Leadership, public speaking, personal branding, career, and student development programs that strengthen practical skills.',
    image: '/assets/site-2026/ldks-program.jpg',
  },
  {
    id: 'creative-media',
    number: '05',
    title: 'Creative & Media Production',
    description: 'Brand identity, graphic design, social content, event documentation, motion, video, and campaign production.',
    image: '/assets/site-2026/cda-ipb-activity.jpg',
  },
] as const;

export const serviceDetails = [
  {
    id: 'event-experience',
    number: '01',
    title: 'Event & Experience Management',
    headline: 'From concept to experience.',
    description: 'Campus Innovate helps institutions shape and deliver purposeful events—from the first concept and participant journey to operations, production, and final execution.',
    image: '/assets/site-2026/hero-team.jpg',
    imageAlt: 'Campus Innovate team delivering an event experience',
    variant: 'image-left',
    capabilities: [
      { title: 'Strategy & Concept', items: ['Event concept', 'Theme & format', 'Participant journey', 'Experience flow'] },
      { title: 'Event Management', items: ['Venue & vendor coordination', 'Registration', 'Logistics', 'Operational management'] },
      { title: 'Experience Design', items: ['Engagement activities', 'Participant interaction', 'Learning & audience experience'] },
      { title: 'Event Production', items: ['Production coordination', 'Technical requirements', 'Event collateral', 'Documentation'] },
      { title: 'Event Formats', items: ['Educational events', 'MICE', 'Capacity building', 'Outbound, study trip & hybrid events'] },
    ],
    approach: ['Shape the purpose', 'Design the journey', 'Deliver the experience'],
    projects: [
      { client: 'WUNPROQ', title: 'World University Network for Productive Waqf', service: 'Full Event Management + Social Media & Branding', image: '/assets/site-2026/hero-team.jpg', logo: '/assets/site-2026/logos/wunproq.png' },
    ],
  },
  {
    id: 'program-development',
    number: '02',
    title: 'Program Development',
    headline: 'Ideas structured into meaningful programs.',
    description: 'An event is a moment. A program is a structured journey. We help turn an objective into a relevant participant journey that institutions can implement and develop.',
    image: '/assets/site-2026/cda-ipb-aerial.jpg',
    imageAlt: 'Campus Innovate educational program viewed from above',
    variant: 'image-right',
    capabilities: [
      { title: 'Research & Needs', items: ['Participant context', 'Needs & objectives', 'Program relevance'] },
      { title: 'Concept & Framework', items: ['Program concept', 'Program structure', 'Implementation direction'] },
      { title: 'Program Journey', items: ['Participant journey', 'Experience sequence', 'Program implementation'] },
      { title: 'Youth & Leadership', items: ['Youth development', 'Student programs', 'Leadership programs'] },
      { title: 'Collaboration & Community', items: ['Institutional collaboration', 'Community development', 'Exposure-style programs'] },
    ],
    approach: ['Understand the need', 'Structure the journey', 'Support implementation'],
    projects: [
      { client: 'YLOS 2026', title: 'Youth Leader Organization Summit', service: 'Program information, speakers, registration & participant access', image: '/assets/site-2026/mentoring-workshop.jpg', logo: '/assets/site-2026/logos/ylos.png' },
    ],
  },
  {
    id: 'digital-system',
    number: '03',
    title: 'Digital System Development',
    headline: 'Systems that make ideas work.',
    description: 'Beyond websites, Campus Innovate builds digital systems and products that help programs and organizations operate with clearer access, workflows, administration, and participant experiences.',
    image: '/assets/site-2026/mentoring-workshop.jpg',
    imageAlt: 'Campus Innovate collaborative digital development activity',
    variant: 'technology',
    capabilities: [
      { title: 'Digital Experience', items: ['Corporate & event websites', 'Landing pages', 'Registration & booking experiences'] },
      { title: 'Management Systems', items: ['Admin & dashboard', 'Workflow systems', 'Organizational & data management'] },
      { title: 'Integrated Platforms', items: ['SSO', 'User management', 'Event & learning platforms'] },
      { title: 'Digital Products', items: ['Custom web application', 'SaaS solution', 'Multi-platform solution'] },
    ],
    approach: ['Map the workflow', 'Build the system', 'Enable the operation'],
    projects: [
      { client: 'DPMA IPB University', title: 'Organizational Digital System', service: 'SSO + Web Blasting System', image: '/assets/site-2026/cda-ipb-aerial.jpg', logo: '/assets/logos/logo-ipb.png' },
      { client: 'YLOS 2026', title: 'Youth Leader Organization Summit', service: 'Full Stack Event Web', image: '/assets/site-2026/mentoring-workshop.jpg', logo: '/assets/site-2026/logos/ylos.png' },
    ],
  },
  {
    id: 'training-development',
    number: '04',
    title: 'Training & Development',
    headline: 'Developing people beyond the classroom.',
    description: 'Training is designed as a capability-development solution: aligned with the audience, competency needs, organization objectives, format, duration, and expected outcomes.',
    image: '/assets/site-2026/klhk-capacity-building.jpg',
    imageAlt: 'Campus Innovate training and capacity building activity',
    variant: 'learning',
    capabilities: [
      { title: 'Leadership', items: ['Leadership', 'Team leadership', 'Organizational leadership'] },
      { title: 'Communication', items: ['Public speaking', 'Presentation', 'Communication & personal branding'] },
      { title: 'Career & Professional', items: ['Career preparation', 'Workplace readiness', 'Professional capability'] },
      { title: 'Student & Youth', items: ['Student development', 'Youth development', 'Organization & capacity building'] },
      { title: 'Customized Learning', items: ['Audience & competency needs', 'Objective, format & duration', 'Expected outcomes'] },
    ],
    approach: ['Clarify the capability', 'Design the learning', 'Strengthen practical growth'],
    projects: [
      { client: 'Kementerian Lingkungan Hidup dan Kehutanan', title: 'Public Speaking Training', service: 'Training & Development', image: '/assets/site-2026/klhk-capacity-building.jpg', logo: '/assets/logos/logo-klhk.png' },
    ],
  },
  {
    id: 'creative-media',
    number: '05',
    title: 'Creative & Media Production',
    headline: 'Ideas deserve to be seen and remembered.',
    description: 'Creative and media production is the communication layer that gives programs, events, organizations, and campaigns a clear identity and a stronger way to reach people.',
    image: '/assets/site-2026/cda-ipb-activity.jpg',
    imageAlt: 'Campus Innovate creative program documentation',
    variant: 'creative',
    capabilities: [
      { title: 'Brand & Identity', items: ['Brand, program & event identity', 'Visual guideline'] },
      { title: 'Graphic & Communication', items: ['Key visual', 'Publication, presentation & event assets'] },
      { title: 'Content', items: ['Social media content', 'Campaign content', 'Creative content direction'] },
      { title: 'Documentation & Production', items: ['Photography & event documentation', 'Video, aftermovie & motion graphic'] },
      { title: 'Campaign & Media', items: ['Creative campaign concept', 'Campaign assets', 'Integrated media production'] },
    ],
    approach: ['Define the identity', 'Create the communication', 'Amplify the idea'],
    projects: [
      { client: 'WUNPROQ', title: 'World University Network for Productive Waqf', service: 'Social Media & Branding', image: '/assets/site-2026/hero-team.jpg', logo: '/assets/site-2026/logos/wunproq.png' },
    ],
  },
] as const;

export const selectedWork = [
  {
    client: 'WUNPROQ',
    title: 'World University Network for Productive Waqf',
    year: '2026',
    service: 'Full Event Management + Social Media & Branding',
    description: 'End-to-end conference delivery supported by event branding and digital communication.',
    image: '/assets/site-2026/hero-team.jpg',
    logo: '/assets/site-2026/logos/wunproq.png',
  },
  {
    client: 'Kementerian Lingkungan Hidup dan Kehutanan',
    title: 'Public Speaking Training',
    year: '2025',
    service: 'Training & Development',
    description: 'A practical communication program designed to strengthen confidence and public speaking skills.',
    image: '/assets/site-2026/klhk-capacity-building.jpg',
    logo: '/assets/logos/logo-klhk.png',
  },
  {
    client: 'YLOS 2026',
    title: 'Youth Leader Organization Summit',
    year: '2026',
    service: 'Full Stack Event Web',
    description: 'A complete digital event platform for program information, speakers, registration, and participant access.',
    image: '/assets/site-2026/mentoring-workshop.jpg',
    logo: '/assets/site-2026/logos/ylos.png',
  },
  {
    client: 'DPMA IPB University',
    title: 'Organizational Digital System',
    year: '2026',
    service: 'SSO + Web Blasting System',
    description: 'A secure operational platform that centralizes access, administration, and institutional workflows.',
    image: '/assets/site-2026/cda-ipb-aerial.jpg',
    logo: '/assets/logos/logo-ipb.png',
  },
] as const;

export type WorkfolioProject = {
  slug: string;
  title: string;
  client: string;
  year: string;
  logo?: string;
  logoText?: string;
  image: string;
  imageAlt: string;
  services: readonly string[];
  description: string;
};

export const workfolioProjects: readonly WorkfolioProject[] = [
  {
    slug: 'wunproq',
    title: 'World University Network for Productive Waqf',
    client: 'WUNPROQ',
    year: '2026',
    logo: '/assets/site-2026/logos/wunproq.png',
    image: '/images/workfolio/wunproq/cover.jpg',
    imageAlt: 'WUNPROQ conference delivered by Campus Innovate',
    services: ['Event & Experience', 'Creative & Media'],
    description: 'End-to-end conference delivery covering event management, participant experience, event branding, and supporting communication materials.',
  },
  {
    slug: 'public-speaking-universitas-bina-niaga',
    title: 'Public Speaking Training',
    client: 'Universitas Bina Niaga',
    year: '2025',
    logo: '/images/workfolio/public-speaking/logo.jpg',
    image: '/images/workfolio/public-speaking/cover.jpg',
    imageAlt: 'Campus Innovate Public Speaking Training at Universitas Bina Niaga',
    services: ['Training & Development'],
    description: 'A practical learning experience designed to strengthen public speaking confidence, communication skills, and presentation capability.',
  },
  {
    slug: 'ylos-2026',
    title: 'Youth Leader Organization Summit',
    client: 'YLOS 2026',
    year: '2026',
    logo: '/assets/site-2026/logos/ylos.png',
    image: '/images/workfolio/ylos-2026/cover.jpg',
    imageAlt: 'YLOS 2026 full-stack event website interface',
    services: ['Digital System'],
    description: 'A full-stack event web supporting program information and the participant digital experience throughout YLOS 2026.',
  },
  {
    slug: 'dpma-ipb-organizational-system',
    title: 'Organizational Digital System',
    client: 'DPMA IPB University',
    year: '2026',
    logo: '/assets/logos/logo-ipb.png',
    image: '/images/workfolio/dpma-ipb/cover.jpg',
    imageAlt: 'DPMA IPB organizational dashboard and web blasting system',
    services: ['Digital System'],
    description: 'An organizational digital solution combining SSO and web-based communication capabilities for institutional access and communication workflows.',
  },
  {
    slug: 'pustarhut-capacity-building',
    title: 'PUSTARHUT Capacity Building',
    client: 'PUSTARHUT',
    year: '2024',
    logo: '/images/workfolio/pustarhut/logo.jpg',
    image: '/images/workfolio/pustarhut/cover.jpg',
    imageAlt: 'PUSTARHUT capacity building activity delivered by Campus Innovate',
    services: ['Event & Experience'],
    description: 'Capacity-building activity managed as an engaging participant experience for the PUSTARHUT team.',
  },
  {
    slug: 'see-ipb',
    title: 'Student Entrepreneur Expo',
    client: 'SEE IPB',
    year: '2024',
    logo: '/images/workfolio/see-ipb/logo.jpg',
    image: '/images/workfolio/see-ipb/cover.jpg',
    imageAlt: 'Student Entrepreneur Expo IPB event documentation',
    services: ['Event & Experience'],
    description: 'Event management for the Student Entrepreneur Expo, supporting the activity from operational preparation through on-site delivery.',
  },
  {
    slug: 'wirausaha-merdeka-ipb',
    title: 'Wirausaha Merdeka IPB',
    client: 'IPB University',
    year: '2024',
    logo: '/images/workfolio/wirausaha-merdeka/logo.jpg',
    image: '/images/workfolio/wirausaha-merdeka/cover.jpg',
    imageAlt: 'Wirausaha Merdeka IPB capacity building and outbound activity',
    services: ['Event & Experience'],
    description: 'Capacity building and outbound delivery designed around coordinated activities and participant engagement.',
  },
  {
    slug: 'dpkkha-ipb',
    title: 'DPKKHA IPB Event Management',
    client: 'DPKKHA IPB',
    year: '2025',
    logo: '/assets/logos/logo-ipb.png',
    image: '/images/workfolio/dpkkha-ipb/cover.jpg',
    imageAlt: 'DPKKHA IPB event management activity delivered by Campus Innovate',
    services: ['Event & Experience'],
    description: 'Full event management supporting activity coordination, participant experience, and on-site delivery for DPKKHA IPB.',
  },
  {
    slug: 'ucam-malaysia',
    title: 'UCAM Malaysia Visitor Management',
    client: 'University College Agroscience Malaysia',
    year: '2025',
    logo: '/images/workfolio/ucam-malaysia/logo.jpg',
    image: '/images/workfolio/ucam-malaysia/cover.jpg',
    imageAlt: 'UCAM Malaysia visitor management activity with IPB University',
    services: ['Event & Experience'],
    description: 'Visitor management supporting the official UCAM Malaysia activity and its coordinated institutional agenda.',
  },
  {
    slug: 'bri-event-promotional-banner',
    title: 'Event Promotional Banner',
    client: 'Bank Rakyat Indonesia',
    year: '2025',
    logo: '/assets/site-2026/logos/bri-clean.webp',
    image: '/images/workfolio/bri/cover.jpg',
    imageAlt: 'BRI event promotional banner produced by Campus Innovate',
    services: ['Creative & Media'],
    description: 'Promotional banner production developed for BRI event communication and visual publication needs.',
  },
  {
    slug: 'bni-motion-bumper',
    title: 'Business Meeting Motion Bumper',
    client: 'Bank Negara Indonesia',
    year: '2025',
    logo: '/assets/site-2026/logos/bni-clean.webp',
    image: '/images/workfolio/bni/cover.jpg',
    imageAlt: 'BNI Business Meeting motion bumper produced by Campus Innovate',
    services: ['Creative & Media'],
    description: 'Motion bumper production created for BNI Business Meeting event communication and on-screen presentation.',
  },
  {
    slug: 'eco-bank',
    title: 'Eco Bank Digital Platform',
    client: 'Eco Bank',
    year: '2026',
    logo: '/images/workfolio/eco-bank/logo.jpg',
    image: '/images/workfolio/eco-bank/cover.jpg',
    imageAlt: 'Eco Bank digital platform interface',
    services: ['Digital System'],
    description: 'An integrated digital ecosystem combining SSO, dashboard, landing page, and administration system in one connected platform.',
  },
  {
    slug: 'moolagi',
    title: 'MOOLAGI',
    client: 'MOOLAGI',
    year: '2025',
    logo: '/images/workfolio/moolagi/logo.jpg',
    image: '/images/workfolio/moolagi/cover.jpg',
    imageAlt: 'MOOLAGI landing page interface',
    services: ['Digital System'],
    description: 'A focused landing page experience developed to communicate the brand and create a clear digital user journey.',
  },
  {
    slug: 'aio-villa-lombok',
    title: 'Villa Booking Platform',
    client: 'AIO Villa Lombok',
    year: '2025',
    logoText: 'AIO Villa Lombok',
    image: '/images/workfolio/aio-villa/cover.jpg',
    imageAlt: 'AIO Villa Lombok web booking interface',
    services: ['Digital System'],
    description: 'A full-stack villa website with an integrated booking experience connecting property information and guest interactions.',
  },
  {
    slug: 'trendy-ai',
    title: 'Trendy AI Platform',
    client: 'Trendy AI',
    year: '2026',
    logo: '/images/workfolio/trendy-ai/logo.jpg',
    image: '/images/workfolio/trendy-ai/cover.jpg',
    imageAlt: 'Trendy AI full-stack web application interface',
    services: ['Digital System'],
    description: 'A full-stack AI web application developed as a functional digital product with an integrated user-facing experience.',
  },
  {
    slug: 'coreva',
    title: 'COREVA SaaS Platform',
    client: 'COREVA',
    year: '2026',
    logoText: 'COREVA',
    image: '/images/workfolio/coreva/cover.jpg',
    imageAlt: 'COREVA multiplatform SaaS web interface',
    services: ['Digital System'],
    description: 'A multiplatform SaaS web solution developed as a scalable digital product for connected digital workflows.',
  },
];

export const kawanPrinciples = [
  { number: '01', title: 'Bekerja Bersama', copy: 'Kolaborasi dan kontribusi di setiap bidang.' },
  { number: '02', title: 'Terus Belajar', copy: 'Mencari cara kerja dan sistem yang lebih baik.' },
  { number: '03', title: 'Berani Memperbaiki', copy: 'Menyelesaikan masalah dengan terbuka dan terus berkembang.' },
  { number: '04', title: 'Ciptakan Dampak', copy: 'Menghadirkan pekerjaan dan pengalaman yang bermakna.' },
] as const;

export const kawanLife = [
  { title: 'Planning', copy: 'Menyatukan tujuan, ide, dan langkah kerja.', image: '/images/kawan-inovasi/planning.jpg' },
  { title: 'Preparing', copy: 'Menyiapkan detail bersama sebelum hari pelaksanaan.', image: '/images/kawan-inovasi/preparing.jpg' },
  { title: 'Executing', copy: 'Hadir, beradaptasi, dan memberi yang terbaik di lapangan.', image: '/images/kawan-inovasi/executing.jpg' },
  { title: 'Learning', copy: 'Belajar dari proses, umpan balik, dan satu sama lain.', image: '/images/kawan-inovasi/learning.jpg' },
  { title: 'Celebrating', copy: 'Mengapresiasi perjalanan dan dampak yang tercipta.', image: '/images/kawan-inovasi/celebrating.jpg' },
] as const;

export type EmployeeStory = {
  quote: string;
  name: string;
  role: string;
  photo?: string;
};

export const employeeStories: readonly EmployeeStory[] = [];

export type ClientStory = {
  quote: string;
  name: string;
  position: string;
  institution: string;
  logo?: string;
};

export const clientStories: readonly ClientStory[] = [];

export type Vacancy = {
  title: string;
  category: 'Project & Program' | 'Creative' | 'Technology' | 'General Support';
  location: string;
  type: string;
  applyUrl: string;
};

// Only verified, currently open roles should be added here.
export const vacancies: readonly Vacancy[] = [];

export type Community = {
  id: 'stripmate' | 'organization-hub' | 'ylos';
  number: string;
  name: string;
  category: string;
  description: string;
  headline: string;
  detailDescription: string;
  logo: string;
  cover: string;
  supportImage: string;
  themes: readonly { title: string; copy: string }[];
  joinUrl: string | null;
  websiteUrl: string | null;
  showJoinCTA: boolean;
  showDetail: boolean;
};

export const communities: readonly Community[] = [
  {
    id: 'stripmate',
    number: '01',
    name: 'Stripmate',
    category: 'Outdoor & Travel Community',
    description: 'A community built around shared journeys, outdoor experiences, and meaningful connections.',
    headline: 'Explore, experience, and connect.',
    detailDescription: 'Stripmate mempertemukan orang melalui perjalanan, pengalaman outdoor, eksplorasi, dan momen kebersamaan yang bermakna.',
    logo: '/assets/site-2026/logos/stripmate.png',
    cover: '/images/community/stripmate-cover.jpg',
    supportImage: '/images/community/stripmate-support.jpg',
    themes: [
      { title: 'Explore', copy: 'Menemukan tempat dan pengalaman bersama.' },
      { title: 'Experience', copy: 'Berbagi aktivitas dan momen di luar rutinitas.' },
      { title: 'Connect', copy: 'Membangun koneksi melalui perjalanan yang dibagikan.' },
    ],
    joinUrl: 'https://chat.whatsapp.com/Evt9fPwjYAUAZX4h8RXO2n?mode=gi_t',
    websiteUrl: 'https://stripmate.id',
    showJoinCTA: true,
    showDetail: true,
  },
  {
    id: 'organization-hub',
    number: '02',
    name: 'Organization Hub',
    category: 'Organizational Development Community',
    description: 'A learning and exchange space for people who build organizations.',
    headline: 'Bertukar gagasan. Membangun organisasi yang lebih baik.',
    detailDescription: 'Organization Hub adalah ruang belajar dan bertukar pengalaman bagi orang-orang yang membangun organisasi, memimpin kolaborasi, dan mencari cara kerja yang lebih baik.',
    logo: '/assets/site-2026/logos/organization-hub.png',
    cover: '/images/community/organization-hub-cover.jpg',
    supportImage: '/images/community/organization-hub-support.jpg',
    themes: [
      { title: 'Learn', copy: 'Mempelajari organisasi, kepemimpinan, sistem, dan cara kerja.' },
      { title: 'Exchange', copy: 'Berbagi perspektif, pengalaman, praktik, dan pembelajaran.' },
      { title: 'Build', copy: 'Membawa insight kembali untuk membangun organisasi yang lebih baik.' },
    ],
    joinUrl: 'https://chat.whatsapp.com/HohCnHsmNLIAdvEx6IXT7w?mode=gi_t',
    websiteUrl: null,
    showJoinCTA: true,
    showDetail: true,
  },
  {
    id: 'ylos',
    number: '03',
    name: 'YLOS',
    category: 'Youth Leadership Community',
    description: 'A youth leadership ecosystem for learning, connection, and meaningful action.',
    headline: 'Tempat pemimpin muda belajar, terhubung, dan bergerak.',
    detailDescription: 'YLOS menghadirkan ekosistem kepemimpinan muda yang mempertemukan pembelajaran, hubungan antarpemimpin, pengalaman, dan ruang untuk mengubah insight menjadi aksi bermakna.',
    logo: '/assets/site-2026/logos/ylos.png',
    cover: '/images/community/ylos-cover.jpg',
    supportImage: '/images/community/ylos-support.jpg',
    themes: [
      { title: 'Learn', copy: 'Mengembangkan wawasan dan pengalaman belajar kepemimpinan.' },
      { title: 'Connect', copy: 'Terhubung dengan peers, speakers, collaborators, dan ecosystem.' },
      { title: 'Act', copy: 'Mendorong pembelajaran menjadi kontribusi dan inisiatif bermakna.' },
    ],
    joinUrl: null,
    websiteUrl: 'https://ylos.site/',
    showJoinCTA: false,
    showDetail: true,
  },
];

export const approach = [
  { number: '01', title: 'Meaningful Programs', copy: 'Programs begin with the real purpose, people, and context behind every brief.' },
  { number: '02', title: 'Effective Organizational Systems', copy: 'Clear workflows and digital tools help institutions move with confidence.' },
  { number: '03', title: 'Engaging Learning Experience', copy: 'Participation, reflection, and practice turn activities into lasting learning.' },
  { number: '04', title: 'Continuous Skill Development', copy: 'Capability grows through relevant practice, feedback, and continued support.' },
] as const;

export const corevaLaunch = {
  product: 'COREVA',
  url: 'https://corevacampusinnovate.com',
  domain: 'corevacampusinnovate.com',
  previewImage: '/images/workfolio/coreva/cover.jpg',
  category: 'Digital System Development',
  tags: ['Digital Product', 'SaaS Platform', 'Built by Campus Innovate'],
} as const;

export const digitalCapabilities = [
  'Web Platforms',
  'Admin Systems',
  'Dashboards',
  'Event Platforms',
  'Digital Experiences',
] as const;

export const collaborators = [
  'Universities',
  'Schools',
  'Student Organizations',
  'Educational Communities',
  'Government & Private Institutions',
] as const;

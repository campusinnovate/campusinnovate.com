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
  { name: 'IPB University', logo: '/assets/site-2026/logos/normalized/ipb.png' },
  { name: 'Kementerian Lingkungan Hidup dan Kehutanan', logo: '/assets/site-2026/logos/normalized/klhk.png' },
  { name: 'WUNPROQ', logo: '/assets/site-2026/logos/normalized/wunproq.png' },
  { name: 'Wakaf IPB University', logo: '/assets/site-2026/logos/normalized/wakaf-ipb.png' },
  { name: 'Bank Rakyat Indonesia', logo: '/assets/site-2026/logos/normalized/bri.png' },
  { name: 'Bank Negara Indonesia', logo: '/assets/site-2026/logos/normalized/bni.png' },
  { name: 'Universitas Bina Niaga', logo: '/assets/site-2026/logos/normalized/unbin.png' },
  { name: 'Student Entrepreneur Expo', logo: '/assets/site-2026/logos/normalized/see.png' },
  { name: 'Career Development and Assessment IPB', logo: '/assets/site-2026/logos/cda-drive.jpg' },
  { name: 'LP2AI IPB', logo: '/assets/site-2026/logos/normalized/lp2ai.png' },
  { name: 'Wirausaha Merdeka IPB', logo: '/assets/site-2026/logos/normalized/wmk.png' },
  { name: 'DPKKHA IPB', logo: '/assets/site-2026/logos/normalized/dpkkha.png' },
  { name: 'University College Agroscience Malaysia', logo: '/assets/site-2026/logos/normalized/ucam.png' },
  { name: 'DPMA IPB', logo: '/assets/site-2026/logos/normalized/dpma.png' },
  { name: 'PUSTARHUT', logo: '/assets/site-2026/logos/pustarhut-drive.jpg' },
  { name: 'VK Penta', logo: '/assets/site-2026/logos/normalized/vk-penta.png' },
  { name: 'Trendy AI', logo: '/assets/site-2026/logos/normalized/trendy.png' },
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
      { client: 'WUNPROQ', title: 'World University Network for Productive Waqf', service: 'Full Event Management + Social Media & Branding', image: '/images/workfolio/wunproq/gallery-01.webp', logo: '/assets/site-2026/logos/normalized/wunproq.png' },
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
    image: '/images/workfolio/dpma-ipb/gallery-02.webp',
    imageAlt: 'Digital management system developed by Campus Innovate',
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
    image: '/images/workfolio/public-speaking/gallery-04.webp',
    imageAlt: 'Campus Innovate public speaking training session',
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
      { client: 'Universitas Bina Niaga', title: 'Public Speaking Training', service: 'Training & Development', image: '/images/workfolio/public-speaking/gallery-04.webp', logo: '/assets/site-2026/logos/normalized/unbin.png' },
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
      { client: 'WUNPROQ', title: 'World University Network for Productive Waqf', service: 'Social Media & Branding', image: '/images/workfolio/wunproq/gallery-06.webp', logo: '/assets/site-2026/logos/normalized/wunproq.png' },
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
    logo: '/assets/site-2026/logos/normalized/wunproq.png',
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
  gallery?: readonly string[];
  logoSurface?: 'light' | 'soft' | 'dark';
  services: readonly string[];
  description: string;
};

export const workfolioProjects: readonly WorkfolioProject[] = [
  {
    slug: 'wunproq',
    title: 'World University Network for Productive Waqf',
    client: 'WUNPROQ',
    year: '2026',
    logo: '/assets/site-2026/logos/normalized/wunproq.png',
    image: '/images/workfolio/wunproq/gallery-01.webp',
    gallery: ['/images/workfolio/wunproq/gallery-01.webp', '/images/workfolio/wunproq/gallery-06.webp', '/images/workfolio/wunproq/gallery-07.webp', '/images/workfolio/wunproq/gallery-08.webp', '/images/workfolio/wunproq/gallery-02.webp', '/images/workfolio/wunproq/gallery-03.webp', '/images/workfolio/wunproq/gallery-04.webp'],
    logoSurface: 'light',
    imageAlt: 'WUNPROQ conference delivered by Campus Innovate',
    services: ['Event & Experience', 'Creative & Media'],
    description: 'End-to-end conference delivery covering event management, participant experience, event branding, and supporting communication materials.',
  },
  {
    slug: 'public-speaking-universitas-bina-niaga',
    title: 'Public Speaking Training',
    client: 'Universitas Bina Niaga',
    year: '2025',
    logo: '/assets/site-2026/logos/normalized/unbin.png',
    image: '/images/workfolio/public-speaking/cover.webp',
    gallery: ['/images/workfolio/public-speaking/gallery-01.webp', '/images/workfolio/public-speaking/gallery-02.webp', '/images/workfolio/public-speaking/gallery-03.webp', '/images/workfolio/public-speaking/gallery-04.webp'],
    logoSurface: 'soft',
    imageAlt: 'Campus Innovate Public Speaking Training at Universitas Bina Niaga',
    services: ['Training & Development'],
    description: 'A practical learning experience designed to strengthen public speaking confidence, communication skills, and presentation capability.',
  },
  {
    slug: 'klhk-capacity-building',
    title: 'KLHK Capacity Building & Outbound',
    client: 'Kementerian Lingkungan Hidup dan Kehutanan',
    year: '2026',
    logo: '/assets/site-2026/logos/normalized/klhk.png',
    image: '/images/workfolio/klhk/cover.webp',
    gallery: ['/images/workfolio/klhk/gallery-02.webp', '/images/workfolio/klhk/gallery-01.webp'],
    logoSurface: 'soft',
    imageAlt: 'KLHK capacity building and outbound delivered by Campus Innovate',
    services: ['Event & Experience', 'Training & Development'],
    description: 'A coordinated capacity-building and outbound experience covering activity design, participant engagement, field operations, and event delivery.',
  },
  {
    slug: 'ylos-2026',
    title: 'Youth Leader Organization Summit',
    client: 'YLOS 2026',
    year: '2026',
    logo: '/assets/site-2026/logos/normalized/ylos.png',
    image: '/images/workfolio/ylos-2026/gallery-01.webp',
    gallery: ['/images/workfolio/ylos-2026/gallery-01.webp', '/images/workfolio/ylos-2026/gallery-02.webp', '/images/workfolio/ylos-2026/gallery-03.webp', '/images/workfolio/ylos-2026/gallery-04.webp'],
    logoSurface: 'light',
    imageAlt: 'YLOS 2026 full-stack event website interface',
    services: ['Digital System'],
    description: 'A full-stack event web supporting program information and the participant digital experience throughout YLOS 2026.',
  },
  {
    slug: 'dpma-ipb-organizational-system',
    title: 'Organizational Digital System',
    client: 'DPMA IPB University',
    year: '2026',
    logo: '/assets/site-2026/logos/normalized/dpma.png',
    image: '/images/workfolio/dpma-ipb/gallery-02.webp',
    gallery: ['/images/workfolio/dpma-ipb/gallery-02.webp', '/images/workfolio/dpma-ipb/gallery-03.webp', '/images/workfolio/dpma-ipb/gallery-04.webp', '/images/workfolio/dpma-ipb/gallery-01.webp'],
    logoSurface: 'light',
    imageAlt: 'DPMA IPB organizational dashboard and web blasting system',
    services: ['Digital System'],
    description: 'An organizational digital solution combining SSO and web-based communication capabilities for institutional access and communication workflows.',
  },
  {
    slug: 'pustarhut-capacity-building',
    title: 'PUSTARHUT Capacity Building',
    client: 'PUSTARHUT',
    year: '2024',
    logo: '/assets/site-2026/logos/normalized/pustarhut.png',
    image: '/images/workfolio/pustarhut/gallery-01.webp',
    gallery: ['/images/workfolio/pustarhut/gallery-01.webp', '/images/workfolio/pustarhut/gallery-02.webp', '/images/workfolio/pustarhut/gallery-03.webp', '/images/workfolio/pustarhut/gallery-04.webp'],
    imageAlt: 'PUSTARHUT capacity building activity delivered by Campus Innovate',
    services: ['Event & Experience'],
    description: 'Capacity-building activity managed as an engaging participant experience for the PUSTARHUT team.',
  },
  {
    slug: 'see-ipb',
    title: 'Student Entrepreneur Expo',
    client: 'SEE IPB',
    year: '2024',
    logo: '/assets/site-2026/logos/normalized/see.png',
    image: '/images/workfolio/see-ipb/gallery-01.webp',
    gallery: ['/images/workfolio/see-ipb/gallery-01.webp', '/images/workfolio/see-ipb/gallery-02.webp'],
    imageAlt: 'Student Entrepreneur Expo IPB event documentation',
    services: ['Event & Experience'],
    description: 'Event management for the Student Entrepreneur Expo, supporting the activity from operational preparation through on-site delivery.',
  },
  {
    slug: 'wirausaha-merdeka-ipb',
    title: 'Wirausaha Merdeka IPB',
    client: 'IPB University',
    year: '2024',
    logo: '/assets/site-2026/logos/normalized/wmk.png',
    image: '/images/workfolio/wirausaha-merdeka/cover.webp',
    gallery: ['/images/workfolio/wirausaha-merdeka/gallery-01.webp', '/images/workfolio/wirausaha-merdeka/gallery-02.webp', '/images/workfolio/wirausaha-merdeka/gallery-03.webp', '/images/workfolio/wirausaha-merdeka/gallery-04.webp'],
    logoSurface: 'soft',
    imageAlt: 'Wirausaha Merdeka IPB capacity building and outbound activity',
    services: ['Event & Experience'],
    description: 'Capacity building and outbound delivery designed around coordinated activities and participant engagement.',
  },
  {
    slug: 'dpkkha-ipb',
    title: 'DPKKHA IPB Event Management',
    client: 'DPKKHA IPB',
    year: '2025',
    logo: '/assets/site-2026/logos/normalized/dpkkha.png',
    image: '/images/workfolio/dpkkha-ipb/gallery-01.webp',
    gallery: ['/images/workfolio/dpkkha-ipb/gallery-01.webp', '/images/workfolio/dpkkha-ipb/gallery-02.webp'],
    imageAlt: 'DPKKHA IPB event management activity delivered by Campus Innovate',
    services: ['Event & Experience'],
    description: 'Full event management supporting activity coordination, participant experience, and on-site delivery for DPKKHA IPB.',
  },
  {
    slug: 'ucam-malaysia',
    title: 'UCAM Malaysia Visitor Management',
    client: 'University College Agroscience Malaysia',
    year: '2025',
    logo: '/assets/site-2026/logos/normalized/ucam.png',
    image: '/images/workfolio/ucam-malaysia/gallery-03.webp',
    gallery: ['/images/workfolio/ucam-malaysia/gallery-03.webp', '/images/workfolio/ucam-malaysia/gallery-01.webp', '/images/workfolio/ucam-malaysia/gallery-02.webp', '/images/workfolio/ucam-malaysia/gallery-04.webp'],
    imageAlt: 'UCAM Malaysia visitor management activity with IPB University',
    services: ['Event & Experience'],
    description: 'Visitor management supporting the official UCAM Malaysia activity and its coordinated institutional agenda.',
  },
  {
    slug: 'bri-event-promotional-banner',
    title: 'Event Promotional Banner',
    client: 'Bank Rakyat Indonesia',
    year: '2025',
    logo: '/assets/site-2026/logos/normalized/bri.png',
    image: '/images/workfolio/bri/gallery-01.webp',
    gallery: ['/images/workfolio/bri/gallery-01.webp', '/images/workfolio/bri/gallery-02.webp', '/images/workfolio/bri/gallery-03.webp', '/images/workfolio/bri/gallery-04.webp'],
    imageAlt: 'BRI event promotional banner produced by Campus Innovate',
    services: ['Creative & Media'],
    description: 'Promotional banner production developed for BRI event communication and visual publication needs.',
  },
  {
    slug: 'bni-motion-bumper',
    title: 'Business Meeting Motion Bumper',
    client: 'Bank Negara Indonesia',
    year: '2025',
    logo: '/assets/site-2026/logos/normalized/bni.png',
    image: '/images/workfolio/bni/gallery-02.webp',
    gallery: ['/images/workfolio/bni/gallery-02.webp', '/images/workfolio/bni/gallery-01.webp', '/images/workfolio/bni/gallery-03.webp', '/images/workfolio/bni/gallery-04.webp'],
    imageAlt: 'BNI Business Meeting motion bumper produced by Campus Innovate',
    services: ['Creative & Media'],
    description: 'Motion bumper production created for BNI Business Meeting event communication and on-screen presentation.',
  },
  {
    slug: 'eco-bank',
    title: 'Eco Bank Digital Platform',
    client: 'Eco Bank',
    year: '2026',
    logo: '/images/workfolio/eco-bank/logo-drive.png',
    image: '/images/workfolio/eco-bank/gallery-01.webp',
    gallery: ['/images/workfolio/eco-bank/gallery-01.webp', '/images/workfolio/eco-bank/gallery-02.webp', '/images/workfolio/eco-bank/gallery-03.webp', '/images/workfolio/eco-bank/gallery-04.webp'],
    logoSurface: 'soft',
    imageAlt: 'Eco Bank digital platform interface',
    services: ['Digital System'],
    description: 'An integrated digital ecosystem combining SSO, dashboard, landing page, and administration system in one connected platform.',
  },
  {
    slug: 'moolagi',
    title: 'MOOLAGI',
    client: 'MOOLAGI',
    year: '2025',
    logo: '/images/workfolio/moolagi/logo-drive.png',
    image: '/images/workfolio/moolagi/gallery-01.webp',
    gallery: ['/images/workfolio/moolagi/gallery-01.webp', '/images/workfolio/moolagi/gallery-02.webp', '/images/workfolio/moolagi/gallery-03.webp', '/images/workfolio/moolagi/gallery-04.webp'],
    logoSurface: 'soft',
    imageAlt: 'MOOLAGI landing page interface',
    services: ['Digital System'],
    description: 'A focused landing page experience developed to communicate the brand and create a clear digital user journey.',
  },
  {
    slug: 'aio-villa-lombok',
    title: 'Villa Booking Platform',
    client: 'AIO Villa Lombok',
    year: '2025',
    logo: '/images/workfolio/aio-villa/logo-drive.png',
    image: '/images/workfolio/aio-villa/gallery-04.webp',
    gallery: ['/images/workfolio/aio-villa/gallery-04.webp', '/images/workfolio/aio-villa/gallery-01.webp', '/images/workfolio/aio-villa/gallery-02.webp', '/images/workfolio/aio-villa/gallery-03.webp'],
    logoSurface: 'light',
    imageAlt: 'AIO Villa Lombok web booking interface',
    services: ['Digital System'],
    description: 'A full-stack villa website with an integrated booking experience connecting property information and guest interactions.',
  },
  {
    slug: 'trendy-ai',
    title: 'Trendy AI Platform',
    client: 'Trendy AI',
    year: '2026',
    logo: '/assets/site-2026/logos/normalized/trendy.png',
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
    image: '/images/workfolio/coreva/gallery-01.webp',
    gallery: ['/images/workfolio/coreva/gallery-01.webp', '/images/workfolio/coreva/gallery-02.webp', '/images/workfolio/coreva/gallery-03.webp', '/images/workfolio/coreva/gallery-04.webp'],
    logoSurface: 'dark',
    imageAlt: 'COREVA multiplatform SaaS web interface',
    services: ['Digital System'],
    description: 'A multiplatform SaaS web solution developed as a scalable digital product for connected digital workflows.',
  },
];

export const kawanPrinciples = [
  { number: '01', title: 'Work Together', copy: 'Collaboration and contribution in every field.' },
  { number: '02', title: 'Keep Learning', copy: 'Seeking better ways of working and systems.' },
  { number: '03', title: 'Dare to Improve', copy: 'Solving problems openly and continuously evolving.' },
  { number: '04', title: 'Create Impact', copy: 'Delivering meaningful work and experiences.' },
] as const;

export const kawanLife = [
  { title: 'Planning', copy: 'Uniting goals, ideas, and action steps.', image: '/images/kawan-inovasi/planning.jpg' },
  { title: 'Preparing', copy: 'Preparing details together ahead of execution day.', image: '/images/kawan-inovasi/preparing.jpg' },
  { title: 'Executing', copy: 'Being present, adapting, and delivering the best on the ground.', image: '/images/kawan-inovasi/executing.jpg' },
  { title: 'Learning', copy: 'Learning from the process, feedback, and one another.', image: '/images/kawan-inovasi/learning.jpg' },
  { title: 'Celebrating', copy: 'Appreciating the journey and the impact created.', image: '/images/kawan-inovasi/celebrating.jpg' },
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
    detailDescription: 'Stripmate brings people together through travel, outdoor experiences, exploration, and meaningful moments of connection.',
    logo: '/assets/site-2026/logos/community-clean/stripmate.svg',
    cover: '/images/community/stripmate-cover.jpg',
    supportImage: '/images/community/stripmate-support.jpg',
    themes: [
      { title: 'Explore', copy: 'Discovering places and shared experiences.' },
      { title: 'Experience', copy: 'Sharing activities and moments beyond the daily routine.' },
      { title: 'Connect', copy: 'Building connections through shared journeys.' },
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
    headline: 'Exchange ideas. Build better organizations.',
    detailDescription: 'Organization Hub is a space for learning and sharing experiences for people who build organizations, lead collaborations, and seek better ways of working.',
    logo: '/assets/site-2026/logos/community-clean/organization-hub.svg',
    cover: '/images/community/organization-hub-cover.jpg',
    supportImage: '/images/community/organization-hub-support.jpg',
    themes: [
      { title: 'Learn', copy: 'Studying organizations, leadership, systems, and ways of working.' },
      { title: 'Exchange', copy: 'Sharing perspectives, experiences, practices, and learnings.' },
      { title: 'Build', copy: 'Bringing insights back to build better organizations.' },
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
    headline: 'A space for young leaders to learn, connect, and take action.',
    detailDescription: 'YLOS delivers a youth leadership ecosystem that brings together learning, peer relationships, experiences, and a space to turn insights into meaningful actions.',
    logo: '/assets/site-2026/logos/community-clean/ylos.svg',
    cover: '/images/community/ylos-cover.jpg',
    supportImage: '/images/community/ylos-support.jpg',
    themes: [
      { title: 'Learn', copy: 'Developing leadership insights and learning experiences.' },
      { title: 'Connect', copy: 'Connecting with peers, speakers, collaborators, and the ecosystem.' },
      { title: 'Act', copy: 'Driving learning into meaningful contributions and initiatives.' },
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

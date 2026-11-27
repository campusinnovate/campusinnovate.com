"use strict";

const localeRows = `
Pilih bahasa|Choose language|اختر اللغة|选择语言
Lewati navigasi|Skip navigation|تجاوز التنقل|跳过导航
Navigasi utama|Main navigation|التنقل الرئيسي|主导航
Innovate Organizer, beranda|Innovate Organizer, home|إنوفيت أورغنايزر، الرئيسية|Innovate Organizer 首页
by Campus Innovate|by Campus Innovate|من Campus Innovate|Campus Innovate 旗下
Menu|Menu|القائمة|菜单
Layanan|Services|الخدمات|服务
Teknologi|Technology|التقنيات|数字技术
Workfolio|Portfolio|أعمالنا|案例
Cara kerja|How we work|آلية العمل|执行流程
Diskusikan acara|Discuss your event|ناقش فعاليتك معنا|洽谈活动
EVENT PLANNING & MANAGEMENT|EVENT PLANNING & MANAGEMENT|تخطيط وإدارة الفعاليات|活动策划与管理
Tech-Smart|Tech-Smart|التقني|数字化
Event Partners.|Event Partners.|شريك فعالياتك.|活动合作伙伴。
Jenis acara|Event type|نوع الفعالية|活动类型
Conferences|Conferences|المؤتمرات|会议会展
Corporate|Corporate|فعاليات الشركات|企业活动
Team Experience|Team Experience|تجارب الفرق|团队体验
Lihat layanan|Explore services|استعرض الخدمات|查看服务
Our Services|Our Services|خدماتنا|我们的服务
About Us|About Us|من نحن|关于我们
How We Work|How We Work|آلية العمل|服务流程
Portfolio|Portfolio|أعمالنا|案例
Hubungi Innovate Organizer via WhatsApp|Contact Innovate Organizer on WhatsApp|تواصل مع Innovate Organizer عبر واتساب|通过 WhatsApp 联系 Innovate Organizer
Pilih format acara untuk melihat cakupan tim dan opsi dukungan digital.|Choose an event format to see what the team covers and which digital tools are available.|اختر نوع الفعالية للاطلاع على نطاق عمل الفريق وخيارات الدعم الرقمي.|选择活动类型，查看团队服务范围及数字化支持选项。
Jenis layanan|Service types|أنواع الخدمات|服务类别
Tentang kami|About us|نبذة عنا|关于我们
Born from tech.|Born from tech.|انطلقنا من التقنية.|源于技术。
Built for events.|Built for events.|وتخصصنا في الفعاليات.|专注活动。
Innovate Organizer adalah unit event planning & management Campus Innovate. Kami merancang acara bersama klien, mengelola pelaksanaannya, dan menyiapkan bahan evaluasi setelah acara.|Innovate Organizer is Campus Innovate’s event planning and management unit. We design events with our clients, run them on the ground, and prepare materials for the post-event review.|إنوفيت أورغنايزر هي وحدة تخطيط وإدارة الفعاليات لدى Campus Innovate. نصمم الفعاليات مع عملائنا، وندير تنفيذها، ونعدّ مواد التقييم بعد انتهائها.|Innovate Organizer 是 Campus Innovate 旗下的活动策划与管理团队。我们与客户共同设计活动，负责现场执行，并准备活动复盘材料。
Makna Tech-Smart Event Partners|What Tech-Smart Event Partners means|معنى الشراكة التقنية في الفعاليات|我们的数字化活动合作理念
Our clients|Our clients|عملاؤنا|我们的客户
Event, digital, kreatif, dan pelatihan.|Events, digital, creative, and training.|فعاليات وتقنيات وإبداع وتدريب.|活动、数字化、创意与培训。
Jeda pergerakan logo|Pause client logos|أوقف حركة شعارات العملاء مؤقتًا|暂停客户标志滚动
Putar logo klien|Play client logos|شغّل حركة شعارات العملاء|播放客户标志滚动
PORTOFOLIO ACARA|EVENT PORTFOLIO|معرض الفعاليات|活动案例
Semua proyek|All projects|كل المشاريع|全部项目
Pilih foto untuk melihat proyek.|Select a photo to view the project.|اختر صورة لعرض المشروع.|点击照片查看项目。
Kantor Campus Innovate|Campus Innovate office|مكتب Campus Innovate|Campus Innovate 办公室
Galeri proyek pilihan|Gallery of selected projects|معرض المشاريع المختارة|精选项目图库
Showcase|Showcase|أبرز أعمالنا|精选展示
Navigasi galeri|Gallery navigation|التنقل في المعرض|展示导航
Semua foto|All photos|كل الصور|全部照片
Fokus foto sebelumnya|Focus the previous photo|ركّز على الصورة السابقة|聚焦上一张照片
Fokus foto berikutnya|Focus the next photo|ركّز على الصورة التالية|聚焦下一张照片
Digital toolkit|Digital toolkit|الأدوات الرقمية|数字工具箱
Every event,|Every event,|كل فعالية،|让每一场活动
digitally smarter.|digitally smarter.|أذكى بالتقنية.|更智能。
Lihat dukungan digital yang bisa dipakai di tiap tahap acara.|See the digital tools available at each stage of an event.|اطّلع على الأدوات الرقمية المتاحة في كل مرحلة من الفعالية.|了解活动各阶段可使用的数字化工具。
Pilihan teknologi, ketersediaan, pengaturan, dan biaya dikonfirmasi dalam proposal.|Technology options, availability, and costs are confirmed in the proposal.|نؤكد الخيارات التقنية وتوافرها وتكاليفها في العرض.|技术选项、可用性及费用以方案为准。
Selected experience|Selected experience|خبرات مختارة|精选案例
Our|Our|معرض|精选
Proyek pilihan yang dikerjakan Campus Innovate. Buka proyek untuk melihat peran tim kami.|Explore selected Campus Innovate projects and see how our team contributed.|استعرض مشاريع مختارة نفذتها Campus Innovate وتعرّف على دور فريقنا فيها.|浏览 Campus Innovate 的精选项目，点击查看团队在项目中的职责。
Filter proyek|Filter projects|تصفية المشاريع|筛选项目
Delivery process|Delivery process|مراحل التنفيذ|活动执行流程
Lima langkah.|Five steps.|خمس خطوات.|五个步骤。
Satu alur yang jelas.|One clear process.|ومسار عمل واضح.|一套清晰流程。
Dari memahami kebutuhan sampai serah terima dan evaluasi.|From understanding your needs to handover and evaluation.|من فهم احتياجاتك إلى التسليم والتقييم.|从了解需求到交付与复盘。
Understand|Understand|فهم الاحتياجات|了解需求
Sepakati tujuan, audiens, kebutuhan, dan anggaran.|Agree on goals, audience, requirements, and budget.|نتفق على الأهداف والجمهور والاحتياجات والميزانية.|明确目标、受众、需求及预算。
Plan|Plan|التخطيط|制定方案
Susun konsep, ruang lingkup, jadwal, dan rencana pelaksanaan.|Define the concept, scope, schedule, and execution plan.|نضع الفكرة ونطاق العمل والجدول الزمني وخطة التنفيذ.|制定活动概念、服务范围、日程与执行方案。
Prepare|Prepare|التحضير|筹备
Siapkan tim, vendor, materi, dan kebutuhan teknis.|Prepare the team, vendors, materials, and technical requirements.|نجهّز الفريق والموردين والمواد والمتطلبات الفنية.|落实团队、供应商、材料及技术准备。
Deliver|Deliver|التنفيذ|现场执行
Kelola operasional hari-H dan tangani kendala lapangan.|Run event-day operations and resolve on-site issues.|ندير العمليات يوم الفعالية ونعالج التحديات الميدانية.|负责活动当天的运营并处理现场问题。
Close|Close|الإغلاق والتقييم|收尾与复盘
Evaluasi acara, lakukan serah terima, dan tuntaskan administrasi.|Review the event, complete the handover, and close out administration.|نقيّم الفعالية ونسلّم المخرجات ونستكمل الإجراءات الإدارية.|复盘活动、完成交付并结清行政事项。
Model kerja sama|Ways to partner|نماذج التعاون|合作模式
Pilih cara kerja sama|Choose how to work with us|اختر طريقة التعاون|选择合作方式
Full-Service Management|Full-Service Management|إدارة متكاملة للفعالية|全案活动管理
Kami mengembangkan konsep dan mengelola persiapan hingga acara selesai.|We develop the concept and manage preparations through to event close.|نطوّر الفكرة وندير التحضيرات حتى اختتام الفعالية.|我们负责从概念策划、筹备到活动结束的全程管理。
Selected Service|Selected Service|خدمة حسب الاختيار|单项服务
Kami menangani fungsi yang disepakati, misalnya registrasi atau dokumentasi.|We manage the agreed functions, such as registration or documentation.|نتولى المهام المتفق عليها، مثل التسجيل أو التوثيق.|我们负责商定的单项工作，例如报名或影像记录。
Team Support|Team Support|دعم الفريق|人员支持
Kami menyiapkan personel untuk peran tertentu sesuai pembagian tanggung jawab.|We provide staff for specific roles based on the agreed responsibilities.|نوفر أفرادًا لأدوار محددة وفق توزيع المسؤوليات المتفق عليه.|我们按分工为指定岗位提供人员支持。
Mari mulai|Let’s get started|لنبدأ|开始合作
Let’s plan your|Let’s plan your|لنخطط معًا|一起策划
next event!|next event!|لفعاليتك القادمة!|您的下一场活动！
Ceritakan ide, jadwal, dan kebutuhan acara. Kami bantu menyusun langkah selanjutnya.|Tell us your ideas, timeline, and event requirements. We’ll help you plan the next steps.|أخبرنا بفكرتك وجدولك واحتياجات فعاليتك، وسنساعدك في تحديد الخطوات التالية.|告诉我们您的想法、时间和活动需求，我们将协助安排下一步。
Isi brief acara|Fill in an event brief|املأ موجز الفعالية|填写活动需求
Kembali ke atas|Back to top|العودة إلى الأعلى|返回顶部
Tutup proyek|Close project|أغلق المشروع|关闭项目
Tutup brief|Close brief|أغلق الموجز|关闭需求表
Tutup detail|Close details|أغلق التفاصيل|关闭详情
Brief acara|Event brief|موجز الفعالية|活动需求
Isi informasi yang sudah ada untuk menyiapkan pesan WhatsApp.|Enter the information you have to prepare a WhatsApp message.|أدخل المعلومات المتاحة لإعداد رسالة واتساب.|填写已有信息以生成 WhatsApp 消息。
Nama dan organisasi|Name and organization|الاسم والمؤسسة|姓名与机构
Nama · Perusahaan atau institusi|Name · Company or institution|الاسم · الشركة أو المؤسسة|姓名 · 公司或机构
Pilih jenis acara|Choose an event type|اختر نوع الفعالية|选择活动类型
Perkiraan tanggal|Estimated date|التاريخ المتوقع|预计日期
Jumlah peserta|Number of attendees|عدد المشاركين|参与人数
Contoh 100|Example: 100|مثال: 100|例如 100
Lokasi dan kebutuhan|Location and requirements|الموقع والاحتياجات|地点与需求
Kota, venue, tujuan acara, atau kebutuhan tim|City, venue, goals, or staffing needs|المدينة أو المكان أو الهدف أو احتياجات الفريق|城市、场地、活动目标或人员需求
Siapkan pesan WhatsApp|Prepare WhatsApp message|جهّز رسالة واتساب|生成 WhatsApp 消息
Buka WhatsApp|Open WhatsApp|افتح واتساب|打开 WhatsApp
Lainnya|Other|أخرى|其他
Chat via WhatsApp|Chat on WhatsApp|راسلنا عبر واتساب|通过 WhatsApp 联系
Topik yang ingin saya diskusikan|Topic I’d like to discuss|الموضوع الذي أود مناقشته|我想咨询的主题
Portofolio acara|Event portfolio|أعمال الفعاليات|活动案例
Halo Innovate Organizer, saya ingin berdiskusi tentang acara.|Hello Innovate Organizer, I’d like to discuss an event.|مرحبًا Innovate Organizer، أود مناقشة فعالية معكم.|您好 Innovate Organizer，我想与您洽谈一场活动。
Corporate Events|Corporate Events|فعاليات الشركات|企业活动
Team Experiences|Team Experiences|تجارب الفرق|团队体验
Learning Events|Learning Events|الفعاليات التدريبية|学习与培训
Event Support|Event Support|دعم الفعاليات|活动支持
Format acara|Event formats|أنواع الفعاليات|活动形式
Cakupan tim|Team scope|نطاق عمل الفريق|团队服务范围
Digital touch|Digital tools|الدعم الرقمي|数字化支持
Diskusikan layanan|Discuss this service|ناقش هذه الخدمة|洽谈此服务
Konferensi yang mempertemukan ide, orang, dan peluang.|Conferences that bring ideas, people, and opportunities together.|مؤتمرات تجمع الأفكار والأشخاص والفرص.|汇聚观点、人脉与合作机会的会议。
Konferensi nasional dan internasional|National and international conferences|مؤتمرات محلية ودولية|国内及国际会议
Simposium dan forum|Symposia and forums|ندوات ومنتديات|研讨会与论坛
Seminar|Seminars|حلقات دراسية|专题讲座
Konsep dan perencanaan|Concept and planning|التصميم والتخطيط|概念策划与规划
Koordinasi pembicara dan sesi|Speaker and session coordination|تنسيق المتحدثين والجلسات|演讲嘉宾与议程协调
Registrasi dan alur peserta|Registration and attendee flow|التسجيل وتنظيم حركة المشاركين|报名及参会动线
Koordinasi teknis dan produksi|Technical and production coordination|التنسيق الفني والإنتاجي|技术与制作协调
Operasional hari-H|Event-day operations|عمليات يوم الفعالية|活动当天运营
Registrasi online dan QR check-in|Online registration and QR check-in|التسجيل الإلكتروني والدخول برمز QR|在线报名与二维码签到
Live Q&A dan polling sesi|Live Q&A and session polling|أسئلة وأجوبة مباشرة واستطلاعات الجلسات|实时问答与环节投票
E-sertifikat dan laporan kehadiran|E-certificates and attendance reports|شهادات إلكترونية وتقارير حضور|电子证书与出席报告
Rapat dan acara institusi dengan agenda, tamu, dan teknis yang terkoordinasi.|Meetings and institutional events with coordinated agendas, guests, and technical logistics.|اجتماعات وفعاليات مؤسسية بتنسيق متكامل للبرنامج والضيوف والجوانب الفنية.|统一协调议程、宾客及技术环节的企业和机构活动。
Corporate meeting|Corporate meetings|اجتماعات الشركات|企业会议
Town hall dan kick-off|Town halls and kickoffs|اجتماعات عامة واجتماعات انطلاق|全员大会及启动会
Rapat kerja|Work meetings|اجتماعات عمل|工作会议
Acara institusi|Institutional events|فعاليات مؤسسية|机构活动
Pengaturan venue dan ruangan|Venue and room setup|تجهيز المكان والقاعات|场地与会场布置
Kesiapan presentasi dan teknis|Presentation and technical readiness|جاهزية العروض والتجهيزات الفنية|演示及技术准备
Koordinasi agenda dan tamu|Agenda and guest coordination|تنسيق البرنامج والضيوف|议程与宾客协调
RSVP dan QR check-in tamu|RSVP and guest QR check-in|تأكيد الحضور وتسجيل الدخول برمز QR|出席确认与宾客二维码签到
Pengingat WhatsApp dan email|WhatsApp and email reminders|تذكيرات عبر واتساب والبريد الإلكتروني|WhatsApp 与邮件提醒
Live polling saat town hall|Live polling during town halls|استطلاعات مباشرة أثناء الاجتماعات العامة|全员大会实时投票
Outing dan aktivitas tim yang dirancang sesuai tujuan dan karakter peserta.|Outings and team activities designed around your goals and participants.|رحلات وأنشطة جماعية تُصمم وفق أهدافك وطبيعة المشاركين.|按活动目标及参与者特点设计的团建与外出活动。
Company outing|Company outings|رحلات الشركات|企业外出活动
Gathering dan retreat|Gatherings and retreats|لقاءات وخلوات الفرق|团队聚会与营地活动
Outbound|Outdoor activities|أنشطة خارجية|户外拓展
Team building|Team building|بناء الفرق|团队建设
Konsep pengalaman dan desain aktivitas|Experience concept and activity design|تصميم التجربة والأنشطة|体验策划与活动设计
Koordinasi venue dan logistik|Venue and logistics coordination|تنسيق الموقع والخدمات اللوجستية|场地与后勤协调
Fasilitator dan tim aktivitas|Facilitators and activity crew|الميسّرون وفريق الأنشطة|引导员与活动团队
Operasional dan keselamatan di lapangan|On-site operations and safety|العمليات الميدانية والسلامة|现场运营与安全
Registrasi dan data peserta|Registration and participant data|التسجيل وبيانات المشاركين|报名及参与者数据
Kuis dan permainan interaktif|Interactive quizzes and games|مسابقات وألعاب تفاعلية|互动问答与游戏
Survei umpan balik peserta|Participant feedback surveys|استبيانات آراء المشاركين|参与者反馈调查
Pelatihan dan workshop dengan administrasi yang rapi, dari pendaftaran sampai sertifikat.|Training and workshops with organized administration from enrollment to certification.|دورات وورش عمل بإدارة منظمة من التسجيل إلى إصدار الشهادات.|从报名到证书发放，全流程管理的培训与工作坊。
Pelatihan|Training|التدريب|培训
Workshop|Workshops|ورش العمل|工作坊
Trainer dan materi melalui mitra, sesuai permintaan|Trainers and materials through partners on request|مدربون ومواد تدريبية عبر الشركاء عند الطلب|可按需通过合作伙伴安排讲师和教材
Jadwal dan administrasi peserta|Scheduling and attendee administration|الجدولة وإدارة المشاركين|日程与学员管理
Kesiapan venue dan peralatan|Venue and equipment preparation|تجهيز المكان والمعدات|场地与设备准备
Logistik trainer|Trainer logistics|لوجستيات المدربين|讲师后勤
Koordinasi hari-H|Event-day coordination|تنسيق يوم الفعالية|活动当天协调
Administrasi peserta online|Online attendee administration|إدارة المشاركين إلكترونيًا|在线学员管理
E-sertifikat otomatis|Automated e-certificates|شهادات إلكترونية آلية|自动发放电子证书
Evaluasi pelatihan digital|Digital training evaluation|تقييم التدريب رقميًا|数字化培训评估
Tim spesialis untuk bagian acara yang perlu didukung. Penugasan dan hasil kerja mengikuti brief yang disepakati.|Specialist staff for the areas where you need support. Assignments and deliverables follow the agreed brief.|فرق متخصصة لدعم الجوانب التي تحتاجها، بمهام ومخرجات وفق الموجز المتفق عليه.|为需要支持的活动环节提供专业团队，任务及交付按商定需求执行。
Dukungan per fungsi|Support by function|دعم لمهام محددة|单项职能支持
Penambahan kru acara|Additional event crew|طاقم إضافي للفعالية|活动人员增援
Desain dan produksi kreatif|Design and creative production|التصميم والإنتاج الإبداعي|设计与创意制作
Dokumentasi foto dan video|Photo and video documentation|التوثيق بالصور والفيديو|摄影与摄像记录
Registrasi dan administrasi|Registration and administration|التسجيل والإدارة|报名与行政管理
Fasilitator outing|Outing facilitators|ميسّرو الرحلات|户外活动引导员
Guest liaison dan panggung|Guest liaison and stage support|التنسيق مع الضيوف ودعم المسرح|宾客联络与舞台支持
Kru dan operasional lapangan|On-site crew and operations|الطاقم والعمليات الميدانية|现场人员与运营
Registrasi dan check-in digital|Digital registration and check-in|التسجيل وتسجيل الدخول رقميًا|数字化报名与签到
Checklist dan pembagian tugas|Checklists and task assignments|قوائم التحقق وتوزيع المهام|检查清单与任务分工
Laporan kehadiran|Attendance reports|تقارير الحضور|出席报告
Tech|Tech|التقنية|数字技术
Smart|Smart|التنظيم الذكي|智能执行
Event Partners|Event Partners|شركاء الفعاليات|活动合作伙伴
Teknologi di setiap layanan|Technology in every service|التقنية في كل خدمة|数字技术融入每项服务
Kami pakai alat digital untuk mempermudah pengalaman peserta dan kerja panitia.|We use digital tools to simplify the experience for attendees and organizers.|نستخدم أدوات رقمية لتسهيل تجربة المشاركين وعمل المنظمين.|我们用数字工具简化参会体验与组织工作。
Registrasi online|Online registration|التسجيل الإلكتروني|在线报名
QR check-in|QR check-in|الدخول برمز QR|二维码签到
Laporan acara|Event reporting|تقارير الفعاليات|活动报告
Alur terstruktur, tim fleksibel|Structured workflow, flexible team|مسار منظم وفريق مرن|流程清晰，团队灵活
Kami susun tim dan alur kerja sesuai kebutuhan tiap acara.|We shape the team and workflow around each event’s needs.|نشكل الفريق وننظم العمل وفق احتياجات كل فعالية.|我们按每场活动的需求配置团队与流程。
Petakan kebutuhan|Map requirements|حدد الاحتياجات|梳理需求
Bagi peran tim|Assign team roles|وزّع أدوار الفريق|分配团队职责
Jalankan acara|Run the event|نفّذ الفعالية|执行活动
Mitra dari awal sampai evaluasi|A partner from concept to review|شريك من الفكرة إلى التقييم|从构思到复盘的合作伙伴
Kami kerja bareng klien dari ide pertama hingga evaluasi.|We work with clients from the first idea to the post-event review.|نعمل مع العملاء من الفكرة الأولى إلى تقييم الفعالية.|我们与客户从初步构思合作到活动复盘。
Susun konsep|Develop the concept|ضع التصور|制定概念
Koordinasi acara|Coordinate the event|نسّق الفعالية|协调活动
Evaluasi bersama|Review together|قيّموا معًا|共同复盘
Planning & Coordination|Planning & Coordination|التخطيط والتنسيق|规划与协调
Tim bisa memantau progres, melihat pembagian tugas, dan mengecek kesiapan acara dari satu alur kerja.|Track progress, assignments, and event readiness in one workflow.|يمكن للفريق متابعة التقدم وتوزيع المهام وجاهزية الفعالية في مسار عمل واحد.|在同一工作流程中跟踪进度、任务分工与活动准备情况。
Dashboard progres|Progress dashboard|لوحة متابعة التقدم|进度看板
Pembagian tugas|Task assignments|توزيع المهام|任务分工
Checklist digital|Digital checklists|قوائم تحقق رقمية|数字检查清单
Participant Administration|Participant Administration|إدارة المشاركين|参与者管理
Kelola data peserta dari pendaftaran hingga kedatangan di venue.|Manage attendee data from registration through arrival at the venue.|أدر بيانات المشاركين من التسجيل حتى الوصول إلى الموقع.|管理从报名到抵达场地的参与者数据。
Form registrasi|Registration form|نموذج التسجيل|报名表
Basis data peserta|Attendee database|قاعدة بيانات المشاركين|参与者数据库
Communication & Engagement|Communication & Engagement|التواصل والتفاعل|沟通与互动
Jaga peserta tetap mendapat informasi dan beri ruang untuk berinteraksi saat acara.|Keep attendees informed and give them ways to interact during the event.|أطلع المشاركين على المستجدات ووفّر لهم فرصًا للتفاعل أثناء الفعالية.|及时通知参与者，并在活动期间提供互动机会。
Live polls|Live polls|استطلاعات مباشرة|实时投票
Q&A|Q&A|أسئلة وأجوبة|问答
Kuis|Quizzes|مسابقات|互动问答
Evaluation & Reporting|Evaluation & Reporting|التقييم والتقارير|评估与报告
Kumpulkan umpan balik dan dokumentasikan hasil acara untuk tim penyelenggara.|Collect feedback and document outcomes for the organizing team.|اجمع الملاحظات ووثّق نتائج الفعالية لفريق التنظيم.|为主办团队收集反馈并记录活动成果。
Survei|Surveys|استبيانات|问卷调查
E-sertifikat|E-certificates|شهادات إلكترونية|电子证书
Custom Event Needs|Custom Event Needs|احتياجات الفعاليات الخاصة|定制活动需求
Sesuaikan website dan alur kerja dengan kebutuhan acara yang disepakati.|Tailor websites and workflows to the agreed event requirements.|خصّص الموقع ومسار العمل وفق احتياجات الفعالية المتفق عليها.|按商定的活动需求定制网站及工作流程。
Website acara|Event website|موقع الفعالية|活动网站
Alur kerja kustom|Custom workflows|مسارات عمل مخصصة|定制工作流程
Semua|All|الكل|全部
Konferensi|Conference|مؤتمرات|会议
Korporat|Corporate|شركات|企业
Institusi|Institutional|مؤسسات|机构
proyek|projects|مشروع|个项目
Lihat proyek|View project|عرض المشروع|查看项目
Dokumentasi|Documentation|توثيق|项目照片
Pengalaman proyek Campus Innovate.|Campus Innovate project experience.|من خبرات Campus Innovate في تنفيذ المشاريع.|Campus Innovate 项目经验。
World University Network for Productive Waqf|World University Network for Productive Waqf|الشبكة العالمية للجامعات للوقف الإنتاجي|全球大学生产性公益基金网络
Pengelolaan acara|Event management|إدارة الفعالية|活动管理
Pengalaman peserta|Attendee experience|تجربة المشاركين|参会体验
Materi komunikasi pendukung|Supporting communication materials|مواد تواصل داعمة|配套传播材料
Event branding|Event branding|هوية الفعالية|活动品牌设计
Branding dan pengelolaan media sosial|Branding and social media management|الهوية وإدارة وسائل التواصل الاجتماعي|品牌与社交媒体管理
Simbolis Serah Terima Hunian Layak Huni Astra di Garut|Astra’s ceremonial handover of adequate housing in Garut|حفل تسليم مساكن ملائمة ضمن مبادرة أسترا في غاروت|Astra 在 Garut 举行的宜居住房交付仪式
Konsep dan rundown seremoni|Ceremony concept and run of show|تصميم الحفل وجدول فقراته|仪式策划与流程安排
Pengelolaan serah terima simbolis|Ceremonial handover management|إدارة التسليم الرمزي|象征性交付管理
Koordinasi venue, panggung, dan tamu|Venue, stage, and guest coordination|تنسيق المكان والمسرح والضيوف|场地、舞台与宾客协调
Peresmian Ecobiz Desa Sejahtera Astra|Launch of Astra’s Ecobiz Desa Sejahtera initiative|افتتاح مبادرة Ecobiz Desa Sejahtera التابعة لأسترا|Astra Ecobiz Desa Sejahtera 项目启动
Pengelolaan acara dari konsep hingga pelaksanaan|Event management from concept through delivery|إدارة الفعالية من الفكرة إلى التنفيذ|从策划到执行的活动管理
Noortura Open House|Noortura Open House|اليوم المفتوح لدى Noortura|Noortura 开放日
Pengelolaan acara pelatihan perusahaan|Corporate training event management|إدارة فعالية تدريبية للشركة|企业培训活动管理
Acara institusi kampus|University institutional event|فعالية مؤسسية جامعية|高校机构活动
Seremoni peluncuran ekspor dan acara institusi|Export launch ceremony and institutional event|حفل إطلاق التصدير وفعالية مؤسسية|出口启动仪式及机构活动
Kunjungan institusi internasional|International institutional visit|زيارة مؤسسية دولية|国际机构访问
Pelatihan peningkatan kapasitas untuk instansi pemerintah|Capacity-building training for a government institution|تدريب لبناء القدرات لجهة حكومية|政府机构能力建设培训
Pelatihan public speaking bagi komunitas kampus|Public speaking training for the campus community|تدريب على الخطابة للمجتمع الجامعي|面向高校群体的公众演讲培训
Program peningkatan kapasitas|Capacity-building program|برنامج بناء القدرات|能力建设项目
Expo kewirausahaan mahasiswa|Student entrepreneurship expo|معرض ريادة الأعمال الطلابية|学生创业博览会
Capacity building dan outbound bagi peserta|Capacity building and outdoor activities for participants|بناء القدرات وأنشطة خارجية للمشاركين|面向参与者的能力建设与户外拓展
Perencanaan dan konsep|Planning and concept|التخطيط والتصور|规划与概念策划
Keterlibatan peserta|Participant engagement|تفاعل المشاركين|参与者互动
Operasional lapangan|On-site operations|العمليات الميدانية|现场运营
Pelaksanaan acara|Event delivery|تنفيذ الفعالية|活动执行
Desain aktivitas|Activity design|تصميم الأنشطة|活动设计
Perencanaan dan koordinasi jadwal|Planning and schedule coordination|التخطيط وتنسيق الجدول|规划与日程协调
Kesiapan venue dan teknis|Venue and technical readiness|جاهزية المكان والتجهيزات الفنية|场地与技术准备
Operasional pelatihan|Training operations|عمليات التدريب|培训运营
Pengelolaan tamu dan acara|Guest and event management|إدارة الضيوف والفعالية|宾客与活动管理
Alur kunjungan|Visit itinerary|مسار الزيارة|参访流程
Perencanaan pelatihan|Training planning|تخطيط التدريب|培训规划
Pengelolaan sesi public speaking|Public speaking session management|إدارة جلسات الخطابة|公众演讲环节管理
Pelaksanaan pelatihan|Training delivery|تنفيذ التدريب|培训实施
Full Event Management|Full Event Management|إدارة الفعاليات المتكاملة|全流程活动管理
Training Event Management|Training Event Management|إدارة الفعاليات التدريبية|培训活动管理
Export Launching Ceremony|Export Launch Ceremony|حفل إطلاق التصدير|出口启动仪式
Visitor Management|Visitor Management|إدارة الزوار|访客管理
Capacity Building|Capacity Building|بناء القدرات|能力建设
Public Speaking Training|Public Speaking Training|التدريب على الخطابة|公众演讲培训
Event Management|Event Management|إدارة الفعاليات|活动管理
Capacity Building & Outbound|Capacity Building & Outdoor Activities|بناء القدرات والأنشطة الخارجية|能力建设与户外拓展
Innovate Organizer, unit event planning & management Campus Innovate untuk konferensi, acara korporat, team building, pelatihan, dan event support di Jabodetabek.|Innovate Organizer is Campus Innovate’s event planning and management unit for conferences, corporate events, team building, training, and event support in Greater Jakarta.|إنوفيت أورغنايزر وحدة Campus Innovate لتخطيط وإدارة المؤتمرات وفعاليات الشركات وبناء الفرق والتدريب ودعم الفعاليات في جاكرتا الكبرى.|Innovate Organizer 是 Campus Innovate 旗下的活动策划与管理团队，为大雅加达地区提供会议、企业活动、团建、培训及现场支持。
`;

const siteLocales = ["id", "en", "ar", "zh"];
const siteCopy = Object.fromEntries(localeRows.trim().split("\n").map(line => {
  const [source, ...translations] = line.split("|");
  return [source, translations];
}));
let siteLanguage = "id";
try {
  const saved = localStorage.getItem("innovate-language");
  if (siteLocales.includes(saved)) siteLanguage = saved;
} catch {}
const textOrigins = new WeakMap();
const attributeOrigins = new WeakMap();
const translatableAttributes = ["aria-label", "title", "placeholder", "alt"];

function translateSiteText(source) {
  if (siteLanguage === "id") return source;
  const key = source.trim().replace(/\s+/g, " ");
  const column = siteLocales.indexOf(siteLanguage) - 1;
  let translation = siteCopy[key]?.[column];
  if (!translation) {
    const numberPrefix = key.match(/^(\d+ \/ )(.+)$/);
    const numberSuffix = key.match(/^(.+?)( \/ \d+| · \d{4})$/);
    const projectCount = key.match(/^(\d+) proyek$/);
    const arrow = key.match(/^(.+?) ([↑↓→↗])$/);
    const prefix = key.match(/^(Dokumentasi|Lihat proyek) (.+)$/);
    if (numberPrefix) translation = numberPrefix[1] + translateSiteText(numberPrefix[2]);
    else if (numberSuffix) translation = translateSiteText(numberSuffix[1]) + numberSuffix[2];
    else if (projectCount) translation = projectCount[1] + " " + (column === 0 && projectCount[1] === "1" ? "project" : siteCopy.proyek[column]);
    else if (arrow) translation = translateSiteText(arrow[1]) + " " + (siteLanguage === "ar" && arrow[2] === "→" ? "←" : arrow[2]);
    else if (prefix && siteCopy[prefix[1]]?.[column]) translation = siteCopy[prefix[1]][column] + " " + prefix[2];
    else return source;
  }
  return source.match(/^\s*/)[0] + translation + source.match(/\s*$/)[0];
}
function updateTranslation(cache, key, current, write) {
  const previous = cache.get(key);
  const source = previous?.last === current ? previous.source : current;
  const last = translateSiteText(source);
  cache.set(key, { source, last });
  if (last !== current) write(last);
}
function translateSiteNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.parentElement?.closest('script, style, textarea, #site-language, [translate="no"]')) return;
    if (node.data.trim()) updateTranslation(textOrigins, node, node.data, next => { node.data = next; });
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  for (const name of translatableAttributes) {
    const value = node.getAttribute(name);
    if (!value) continue;
    if (!attributeOrigins.has(node)) attributeOrigins.set(node, new Map());
    updateTranslation(attributeOrigins.get(node), name, value, next => node.setAttribute(name, next));
  }
}
function translateSiteTree(root) {
  translateSiteNode(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) translateSiteNode(walker.currentNode);
}
function applySiteLanguage() {
  document.documentElement.lang = siteLanguage === "zh" ? "zh-Hans" : siteLanguage;
  document.documentElement.dir = siteLanguage === "ar" ? "rtl" : "ltr";
  const titles = {
    id: "Jasa Event Organizer Jabodetabek | Innovate Organizer",
    en: "Event Organizer in Greater Jakarta | Innovate Organizer",
    ar: "تنظيم الفعاليات في جاكرتا الكبرى | Innovate Organizer",
    zh: "大雅加达活动策划 | Innovate Organizer"
  };
  document.title = titles[siteLanguage] || titles.id;
  document.querySelector('meta[property="og:title"]').content = document.title;
  document.querySelector('meta[property="og:locale"]').content = { id: "id_ID", en: "en_US", ar: "ar_SA", zh: "zh_CN" }[siteLanguage];
  translateSiteTree(document.body);
  const description = document.querySelector('meta[name="description"]');
  updateTranslation(textOrigins, description, description.content, next => { description.content = next; });
}
document.addEventListener("DOMContentLoaded", () => {
  const selector = document.getElementById("site-language");
  selector.value = siteLanguage;
  applySiteLanguage();
  selector.addEventListener("change", () => {
    siteLanguage = selector.value;
    try { localStorage.setItem("innovate-language", siteLanguage); } catch {}
    applySiteLanguage();
  });
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "childList") record.addedNodes.forEach(translateSiteTree);
      else translateSiteNode(record.target);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: translatableAttributes });
});

const landingCopy = `
Trekking & Hiking bersama Innovate Organizer|Trekking & Hiking with Innovate Organizer|رحلات المشي الجبلي مع Innovate Organizer|与 Innovate Organizer 一起徒步登山
Trekking & Hiking|Trekking & Hiking|المشي الجبلي|徒步登山
Tim Innovate Organizer berpengalaman mendampingi trekking ke berbagai gunung dan curug, termasuk perjalanan bersama Stripmate.|The Innovate Organizer team has experience accompanying mountain and waterfall treks, including trips with Stripmate.|يتمتع فريق Innovate Organizer بخبرة في مرافقة رحلات المشي إلى الجبال والشلالات، بما فيها الرحلات مع Stripmate.|Innovate Organizer 团队拥有陪同山地及瀑布徒步的经验，包括与 Stripmate 一起开展的旅行。
Pengalaman rute trekking|Trekking route experience|مسارات سبق لنا مرافقة المشاركين فيها|已有带队经验的徒步路线
Portofolio perjalanan|Trip portfolio|سجل الرحلات|旅行案例
Gunung Luhur|Mount Luhur|جبل لوهور|Luhur 山
Gunung Sumbing|Mount Sumbing|جبل سومبينغ|Sumbing 山
Cisadon|Cisadon|تشيسادون|Cisadon
Kawah Ratu|Kawah Ratu|كاواه راتو|Kawah Ratu
Gunung Merbabu|Mount Merbabu|جبل ميربابو|Merbabu 山
Gunung Lawu|Mount Lawu|جبل لاوو|Lawu 山
Gunung Gede|Mount Gede|جبل غيدي|Gede 山
Curug-curug di Bogor|Waterfalls around Bogor|شلالات بوغور|茂物周边瀑布
Dokumentasi perjalanan Innovate Organizer bersama Stripmate|Photos from Innovate Organizer trips with Stripmate|صور رحلات Innovate Organizer مع Stripmate|Innovate Organizer 与 Stripmate 的旅行实拍
Diskusikan rencana trekking Anda|Discuss your trekking plans|ناقش خطة رحلة المشي معنا|洽谈您的徒步计划
Halo Innovate Organizer, saya ingin konsultasi kegiatan trekking untuk rombongan.|Hi Innovate Organizer, I’d like to discuss a group trekking activity.|مرحبًا Innovate Organizer، أود الاستفسار عن رحلة مشي جماعية.|您好 Innovate Organizer，我想咨询团体徒步活动。
Oktober 2026|October 2026|أكتوبر 2026|2026年10月
November 2026|November 2026|نوفمبر 2026|2026年11月
Dukungan kegiatan pelatihan|Training event support|دعم أنشطة التدريب|培训活动支持
Dukungan pelaksanaan pelatihan|Support for training delivery|دعم تنفيذ التدريب|培训实施支持
Dokumentasi kegiatan|Event photo documentation|توثيق الفعالية بالصور|活动影像记录
Fun games bersama tim KLH/BPLH|Fun games with the KLH/BPLH team|ألعاب ترفيهية مع فريق KLH/BPLH|KLH/BPLH 团队趣味游戏
Aktivitas kebersamaan peserta|Group activities for participants|أنشطة جماعية للمشاركين|参与者集体活动
Support Training|Training Support|دعم التدريب|培训支持
Fun Games|Fun Games|ألعاب ترفيهية|趣味游戏
Innovate Organizer · by Campus Innovate|Innovate Organizer · by Campus Innovate
Event organizer untuk gathering, team building, seminar, dan acara perusahaan di Jabodetabek. Registrasi online, QR check-in, dan laporan acara digital.|Event organizer for gatherings, team building, seminars, and corporate events across Greater Jakarta. Online registration, QR check-in, and digital event reporting.
Lagi menyiapkan acara di Jabodetabek? Kami bantu.|Planning an event in Greater Jakarta? We can help.|هل تحضّر لفعالية في جاكرتا الكبرى؟ يمكننا مساعدتك.|正在筹备大雅加达地区的活动？我们来帮您。
Kami bantu urus acara Anda, dari menyusun konsep sampai hari-H. Peserta bisa daftar online dan check-in pakai QR. Setelah acara, kami kirim rekap kehadiran dan masukan peserta.|We’ll help you plan the event and run it on the day. Guests can register online and check in with a QR code. Afterwards, we’ll send you the attendance numbers and guest feedback.|نساعدك في التخطيط للفعالية وتنفيذها. يمكن للضيوف التسجيل عبر الإنترنت وتسجيل الحضور برمز QR. وبعد الفعالية نرسل لك أعداد الحضور وملاحظات الضيوف.|我们协助您筹划活动，并负责当天执行。来宾可在线报名、扫码签到。活动结束后，我们会发给您出席人数和来宾反馈。
Konsultasi Gratis via WhatsApp|Free consultation on WhatsApp
Isi Brief Acara|Fill in the event brief
Dipercaya oleh:|Trusted by:
{events}+ acara · {participants}+ peserta · {years} tahun pengalaman|{events}+ events · {participants}+ participants · {years} years of experience
Portofolio|Portfolio
Acara apa yang sedang Anda siapkan?|What kind of event are you planning?
Pilih jenis acara untuk melihat apa yang kami tangani. Setiap paket bisa disesuaikan dengan jumlah peserta dan anggaran.|Explore what we cover for each event type. We tailor each package to your group size and budget.
Gathering & Outing Kantor|Company Gatherings & Outings
Gathering & Outing|Gatherings & Outings
Event Organizer Gathering Kantor di Jabodetabek|Company Gathering Organizer in Greater Jakarta
Event Organizer Team Building di Jabodetabek|Team Building Organizer in Greater Jakarta
Event Organizer Seminar & Konferensi di Jabodetabek|Seminar & Conference Organizer in Greater Jakarta
Event Organizer Acara Perusahaan di Jabodetabek|Corporate Event Organizer in Greater Jakarta
Event Organizer Pelatihan & Workshop di Jabodetabek|Training & Workshop Organizer in Greater Jakarta
Team Building|Team Building
Seminar & Konferensi|Seminars & Conferences
Acara Perusahaan|Corporate Events
Pelatihan & Workshop|Training & Workshops
Acara kebersamaan tim yang seru, tertata, dan tanpa repot buat panitia internal.|Enjoyable, well-organized team outings with less work for your internal team.
Aktivitas yang dirancang sesuai tujuan tim, dari kolaborasi sampai kepemimpinan.|Activities tailored to your team goals, from collaboration to leadership.
Acara ilmiah atau bisnis dengan alur registrasi dan sesi yang tertib.|Academic or business events with organized registration and sessions.
Peluncuran produk, anniversary, rapat kerja, hingga awarding night.|Product launches, anniversaries, company meetings, and awards nights.
Program belajar yang terukur, dari pendaftaran sampai evaluasi peserta.|Structured learning programs, from enrollment to participant evaluation.
Yang kami tangani|What we handle
Venue & akomodasi|Venue & accommodation
Rundown|Run of show
MC & hiburan|Host & entertainment
Transportasi|Transportation
Konsep aktivitas|Activity concept
Fasilitator|Facilitators
Perlengkapan|Equipment
Dokumentasi|Photography and video
Laporan peserta|Participant reporting
Manajemen pembicara|Speaker management
Sesi paralel|Parallel sessions
Sertifikat digital|Digital certificates
Konsep acara|Event concept
Produksi panggung|Stage production
Vendor|Vendors
Koordinasi hari-H|On-site coordination
Pendaftaran|Enrollment
Absensi digital|Digital attendance
Materi|Materials
Evaluasi pre/post-test|Pre- and post-training assessments
Sertifikat|Certificates
Konsultasikan acara ini →|Discuss this event →
Butuh dukungan untuk bagian tertentu saja, seperti registrasi, dokumentasi, atau tim lapangan? Kami juga melayani Event Support.|Need help with registration, photo and video coverage, or on-site staffing? Our Event Support team can help.
Tanya via WhatsApp|Ask us on WhatsApp
Halo Innovate Organizer, saya ingin konsultasi acara.|Hi Innovate Organizer, I’d like to discuss an event.
Halo, saya ingin konsultasi acara gathering kantor.|Hi, I’d like to discuss a company gathering.
Halo, saya ingin konsultasi acara team building.|Hi, I’d like to discuss a team building event.
Halo, saya ingin konsultasi acara seminar/konferensi.|Hi, I’d like to discuss a seminar or conference.
Halo, saya ingin konsultasi acara perusahaan.|Hi, I’d like to discuss a corporate event.
Halo, saya ingin konsultasi acara pelatihan/workshop.|Hi, I’d like to discuss a training session or workshop.
Halo, saya ingin tanya layanan Event Support.|Hi, I’d like to ask about your Event Support services.
Halo, saya ingin diskusi model kerja sama yang cocok untuk acara saya.|Hi, I’d like to discuss which service model fits my event.
Pembeda kami|What sets us apart
EO yang lahir dari tim teknologi.|An event organizer built by a technology team.
Innovate Organizer adalah unit event dari Campus Innovate, perusahaan teknologi dan digital. Karena itu setiap acara yang kami pegang berjalan dengan sistem: peserta lebih nyaman, panitia lebih ringan, dan Anda punya data lengkap setelah acara selesai.|Innovate Organizer is the events division of Campus Innovate, a digital technology company. We use structured workflows to make events easier for guests and organizers, and give you clear data after the event.
Registrasi online, tanpa rekap manual.|Online registration, with attendee records organized automatically.
Peserta mendaftar lewat link. Data langsung tersusun, jadi panitia tidak perlu merapikan spreadsheet satu per satu.|Guests sign up through a link. Records are organized as they come in, saving your team spreadsheet work.
Check-in pakai QR, tanpa antrean panjang.|QR check-in to keep queues moving.
Peserta cukup menunjukkan kode QR di meja registrasi. Jumlah kehadiran terlihat secara langsung.|Guests show their QR code at the desk, and your team can see the attendance count in real time.
Progres persiapan yang bisa dipantau.|Track preparation progress.
Anda bisa melihat checklist, pembagian tugas, dan kesiapan vendor tanpa harus menanyakan update berkali-kali.|See checklists, task assignments, and vendor readiness without chasing updates.
Laporan acara yang siap dibawa ke atasan.|An event report ready to share with leadership.
Setelah acara, Anda menerima rekap kehadiran, dokumentasi, dan feedback peserta dalam satu laporan.|After the event, get attendance figures, documentation, and participant feedback in one report.
Dikirim paling lambat {days} hari kerja setelah acara.|Delivered within {days} business days after the event.
Teknologinya kami yang urus. Anda cukup fokus ke tamu dan tujuan acara.|We handle the technology so you can focus on your guests and goals.
Pilihan fitur digital disesuaikan dengan kebutuhan dan anggaran setiap acara.|Digital features are tailored to each event’s needs and budget.
Acara yang sudah kami jalankan|Events we’ve delivered
Dari gathering kantor sampai konferensi internasional.|From company gatherings to international conferences.
Dari gathering {min} orang sampai konferensi {max} peserta.|From gatherings of {min} people to conferences with {max} participants.
Tantangan|Challenge
Yang kami lakukan|What we did
Hasil|Result
Lihat semua proyek ↓|See all projects ↓
Foto tim Campus Innovate|Campus Innovate team photo
Peresmian Ecobiz Desa Sejahtera Astra di Garut|Launch of Astra’s Ecobiz Desa Sejahtera initiative in Garut
Pilih cara kerja sama yang pas|Choose the support that fits your event
Mau diserahkan penuh atau cukup dibantu di bagian tertentu, keduanya bisa.|We can manage the entire event or support specific parts of it.
Full-Service|Full-Service
Selected Service|Selected Service
Team Support|Team Support
Anda ingin terima beres|You want end-to-end delivery
Panitia internal sudah ada|You already have an internal event team
Butuh tambahan tenaga|You need extra staff
Kami susun konsep, urus vendor, jalankan hari-H, dan serahkan laporan acara.|We develop the concept, manage vendors, run the event, and deliver the report.
Kami pegang fungsi tertentu yang disepakati, misalnya registrasi digital, dokumentasi, atau produksi panggung.|We handle agreed functions such as digital registration, photo and video coverage, or stage production.
Kami sediakan personel terlatih untuk peran tertentu, seperti usher, registrasi, LO, atau tim lapangan.|We provide trained staff for roles such as ushering, registration, liaison, and on-site operations.
Diskusikan model yang cocok →|Discuss the right service model →
Lima langkah, satu alur yang jelas|Five steps from planning to reporting
Diskusi kebutuhan|Discuss your requirements
Kita sepakati tujuan acara, profil peserta, jadwal, dan anggaran.|We agree on your goals, attendees, schedule, and budget.
Konsep & penawaran|Concept & proposal
Anda menerima konsep, rundown awal, dan rincian biaya.|You receive a concept, draft schedule, and cost breakdown.
Persiapan|Preparation
Tim, vendor, materi, dan sistem digital disiapkan. Progres bisa Anda pantau.|We prepare the team, vendors, materials, and digital tools. You can follow the progress.
Hari-H|Event day
Kami jalankan acara dan tangani kendala di lapangan.|We run the event and handle issues on site.
Evaluasi & laporan|Evaluation & reporting
Anda menerima laporan acara, dokumentasi, dan feedback peserta.|You receive the event report, documentation, and participant feedback.
Brief acara|Event brief
Ceritakan acara Anda, kami siapkan langkah berikutnya.|Tell us about your event so we can plan the next step.
Isi seperlunya saja. Form ini menyusun pesan WhatsApp untuk Anda, tinggal kirim.|Share the details you have. We’ll turn them into a WhatsApp message ready for you to send.
Nama & perusahaan|Name & company
Nama/perusahaan|Name/company
Tanggal|Date
Peserta|Participants
Contoh: Rina, PT Maju Bersama|Example: Rina, PT Maju Bersama
Pilih jenis acara|Choose an event type
Perkiraan tanggal|Estimated date
Contoh: pertengahan Februari 2027|Example: mid-February 2027
Contoh: 150|Example: 150
Lokasi & kebutuhan|Location & requirements
Contoh: Bogor, butuh venue + registrasi online|Example: Bogor, need a venue and online registration
Kirim via WhatsApp →|Send via WhatsApp →
Lebih suka langsung chat?|Prefer to chat directly?
Buka WhatsApp|Open WhatsApp
Atau email ke|Or email
Innovate Organizer, unit event dari Campus Innovate|Innovate Organizer, the events division of Campus Innovate
Melayani acara di Jakarta, Bogor, Depok, Tangerang, dan Bekasi.|Serving events in Jakarta, Bogor, Depok, Tangerang, and Bekasi.
`;

for (const row of landingCopy.trim().split("\n")) {
  const [source, english, arabic, chinese] = row.split("|");
  const previous = siteCopy[source] || [];
  siteCopy[source] = [english, arabic ?? previous[1], chinese ?? previous[2]];
}

for (const row of "Proyek|Projects|مشاريع|项目\nKlien & partner|Clients & partners|عملاء وشركاء|客户与合作伙伴\nPilihan jenis acara|Event formats|أنواع الفعاليات|活动类型\nPengalaman kami|Our experience|خبرتنا|我们的经验\nPengalaman tim Campus Innovate, termasuk Innovate Organizer.|Experience of the Campus Innovate team, including Innovate Organizer.|خبرة فريق Campus Innovate، بما فيه Innovate Organizer.|Campus Innovate 团队（含 Innovate Organizer）的项目经验。\nfoto dokumentasi|event photos|صور الفعالية|活动照片\nSebelum mulai|Before we begin|قبل أن نبدأ|开始之前\nYang sering ditanyakan|Frequently asked questions|أسئلة شائعة|常见问题\nSetiap acara punya kebutuhan sendiri. Ini gambaran awal sebelum kita diskusi.|Every event has different needs. Here is what to know before we talk.|لكل فعالية احتياجاتها. إليك معلومات أولية قبل أن نتحدث.|每场活动需求各异，先了解这些信息，再与我们沟通。\nMinimal pesertanya berapa?|Is there a minimum group size?|هل يوجد حد أدنى للمشاركين؟|有最低人数要求吗？\nJumlah peserta disesuaikan dengan format dan tujuan acara. Ceritakan perkiraan jumlah rombongan Anda; kami bantu pilih aktivitas dan kebutuhan tim yang sesuai.|Group size depends on the event format and goals. Tell us your estimated numbers and we will suggest suitable activities and staffing.|يعتمد العدد على شكل الفعالية وأهدافها. أخبرنا بالعدد المتوقع لنقترح الأنشطة والفريق المناسبين.|人数根据活动形式和目标确定。告诉我们预计人数，我们会建议合适的活动与人员安排。\nBisa mengadakan acara di luar Jabodetabek?|Can you support events outside Greater Jakarta?|هل تدعمون فعاليات خارج جاكرتا الكبرى؟|可以在大雅加达地区以外举办吗？\nSampaikan kota atau destinasi yang Anda tuju. Kami cek kebutuhan perjalanan, kesiapan tim, dan biaya pendukungnya sebelum menyepakati pelaksanaan.|Tell us your city or destination. We will check travel requirements, team availability, and related costs before confirming the event.|أخبرنا بالمدينة أو الوجهة لنراجع احتياجات السفر وتوفر الفريق والتكاليف قبل التأكيد.|请提供城市或目的地。确认承接前，我们会核实出行需求、团队安排和相关费用。\nBerapa lama waktu persiapannya?|How much preparation time is needed?|كم يستغرق التحضير؟|需要提前多久准备？\nWaktu persiapan mengikuti skala acara, ketersediaan venue, dan kebutuhan produksi. Hubungi kami dengan tanggal rencana acara agar jadwal persiapannya bisa dibahas sejak awal.|Timing depends on event scale, venue availability, and production needs. Share your planned date so we can agree on a preparation schedule early.|يعتمد الوقت على حجم الفعالية وتوفر المكان ومتطلبات الإنتاج. شاركنا الموعد المخطط لنحدد جدول التحضير مبكراً.|准备时间取决于活动规模、场地和制作需求。请尽早提供计划日期，以便商定筹备安排。\nBagaimana sistem pembayaran dan DP?|How do payments and deposits work?|كيف يتم الدفع والعربون؟|付款和定金如何安排？\nNominal DP, tahapan pembayaran, dan waktu pelunasan disepakati per acara. Rinciannya dicantumkan dalam penawaran sebelum kerja sama berjalan.|The deposit, payment stages, and final payment date are agreed for each event and included in the proposal before work begins.|نتفق على العربون ومراحل الدفع وموعد السداد لكل فعالية وترد التفاصيل في العرض قبل البدء.|定金金额、付款阶段和尾款时间按活动商定，并在合作开始前写入报价。\nBisa dibantu sebagian saja?|Can you handle only part of our event?|هل يمكنكم دعم جزء من الفعالية؟|可以只负责部分工作吗？\nBisa. Kami dapat mengelola seluruh acara, menangani bagian tertentu, atau menyediakan tim pendukung sesuai lingkup kerja yang disepakati.|Yes. We can manage the whole event, take on selected tasks, or provide support staff within the agreed scope.|نعم، يمكننا إدارة الفعالية كاملة أو مهام محددة أو توفير فريق دعم وفق النطاق المتفق عليه.|可以。我们可按商定范围负责整场活动、指定环节或提供支持人员。\nBrief Anda tersimpan di website. Setelah itu, lanjutkan percakapannya lewat WhatsApp.|Your brief is saved on the website. Then continue the conversation on WhatsApp.|يُحفظ ملخص طلبك في الموقع، ثم تابع المحادثة عبر واتساب.|需求将保存在网站，随后可通过 WhatsApp 继续沟通。\nNomor WhatsApp|WhatsApp number|رقم واتساب|WhatsApp 号码\nContoh: 0858 1234 5678|Example: 0858 1234 5678|مثال: 0858 1234 5678|例如：0858 1234 5678\nSaya setuju detail brief dan kontak disimpan oleh Innovate Organizer untuk menindaklanjuti kebutuhan acara ini.|I agree that Innovate Organizer may store my brief and contact details to follow up on this event request.|أوافق على حفظ Innovate Organizer تفاصيل الطلب والاتصال لمتابعة هذه الفعالية.|我同意 Innovate Organizer 保存需求与联系方式，用于跟进本次活动咨询。\nSimpan brief & lanjut ke WhatsApp|Save brief & continue to WhatsApp|احفظ الطلب وتابع عبر واتساب|保存需求并继续到 WhatsApp\nMenyimpan brief…|Saving your brief…|جارٍ حفظ الطلب…|正在保存需求…\nBrief tersimpan. Lanjutkan di WhatsApp dan tekan Kirim untuk memulai percakapan.|Brief saved. Continue in WhatsApp and press Send to start the conversation.|تم حفظ الطلب. تابع في واتساب واضغط إرسال لبدء المحادثة.|需求已保存。请前往 WhatsApp 并点击发送以开始对话。\nBrief belum tersimpan. Coba lagi, atau hubungi kami lewat tombol WhatsApp.|Your brief could not be saved. Try again or contact us using the WhatsApp button.|لم يُحفظ الطلب. حاول مجدداً أو تواصل معنا عبر زر واتساب.|需求未保存。请重试，或通过 WhatsApp 按钮联系我们。\nLanjutkan ke WhatsApp|Continue to WhatsApp|المتابعة إلى واتساب|继续到 WhatsApp\nCerita peserta|Participant stories|تجارب المشاركين|参与者分享\nPengalaman mereka, langsung dari acaranya|Hear from participants at the event|استمع إلى المشاركين في الفعالية|听听现场参与者的感受\nCuplikan dari dokumentasi kegiatan Campus Innovate.|Clips from Campus Innovate event documentation.|مقاطع من توثيق فعاليات Campus Innovate.|视频来自 Campus Innovate 活动记录。\nPeserta kegiatan KLHK|KLHK event participants|مشاركو فعالية KLHK|KLHK 活动参与者\nPeserta Wirausaha Merdeka IPB|Wirausaha Merdeka IPB participants|مشاركو Wirausaha Merdeka IPB|Wirausaha Merdeka IPB 参与者\nPeriode|Period|الفترة|时间\nFormat|Format|الشكل|形式\nLokasi|Location|الموقع|地点\nPeran|Role|الدور|负责内容\nDurasi|Duration|المدة|时长\nYang ditangani|Scope of work|نطاق العمل|工作范围\nMateri kegiatan|Training topics|موضوعات التدريب|培训内容\n3 hari · 2–4 September 2026|3 days · 2–4 September 2026|3 أيام · 2–4 سبتمبر 2026|3 天 · 2026年9月2日至4日\n".trim().split("\n")) { const [source, ...translations] = row.split("|"); siteCopy[source] = translations; }

// November brand and event-system copy.
for (const row of "Our System|Our System|أنظمتنا|我们的系统\nAcara kantor dan institusi di Jabodetabek, beres dari konsep sampai laporan.|Corporate and institutional events in Greater Jakarta, from concept to final report.|فعاليات الشركات والمؤسسات في جاكرتا الكبرى، من الفكرة إلى التقرير الختامي.|大雅加达企业与机构活动，从策划到报告全程协助。\nKami unit event dari Campus Innovate, tim yang setiap hari membangun sistem digital. Karena itu setiap acara datang dengan registrasi online, check-in QR, dan laporan yang siap dibawa ke atasan.|We are Campus Innovate’s events division, backed by a team that builds digital systems every day. Our events bring online registration, QR check-in, and reports ready to share with your leadership.|نحن قسم الفعاليات في Campus Innovate، ويدعمنا فريق يبني أنظمة رقمية يومياً. لذلك نوفر التسجيل الإلكتروني وتسجيل الحضور برمز QR وتقارير جاهزة للإدارة.|我们是 Campus Innovate 旗下活动团队，背后是日常开发数字系统的技术团队。因此，活动配备线上报名、二维码签到，以及可提交管理层的报告。\nNegara|Countries|دول|国家\nIndonesia & Malaysia|Indonesia & Malaysia|إندونيسيا وماليزيا|印度尼西亚与马来西亚\nRekam jejak tim Campus Innovate, induk Innovate Organizer.|The track record of Campus Innovate, Innovate Organizer’s parent team.|سجل فريق Campus Innovate، الفريق الأم لـ Innovate Organizer.|Campus Innovate 团队的项目经验，Innovate Organizer 源于此团队。\nJeda animasi angka|Pause number animation|إيقاف حركة الأرقام|暂停数字动画\nPutar animasi angka|Resume number animation|تشغيل حركة الأرقام|继续数字动画\nLima lini layanan, satu janji: setiap acara punya sentuhan teknologi.|Five service lines, one promise: technology in every event.|خمسة مسارات للخدمات ووعد واحد: لمسة تقنية في كل فعالية.|五大服务方向，同一承诺：让每场活动融入科技。\nPilih dukungan yang pas untuk tujuan acara Anda. Tim, lingkup kerja, dan teknologi disiapkan sesuai kebutuhan.|Choose support that fits your event goals. We tailor the team, scope, and technology to your needs.|اختر الدعم المناسب لأهداف فعاليتك. نجهز الفريق ونطاق العمل والتقنية حسب الاحتياجات.|选择符合活动目标的支持，团队、工作范围和技术均按需求安排。\nKonferensi & Seminar|Conferences & Seminars|المؤتمرات والندوات|会议与研讨会\nKonferensi nasional/internasional, simposium, dan forum.|National and international conferences, symposia, and forums.|مؤتمرات وطنية ودولية وندوات ومنتديات.|国内外会议、专题研讨与论坛。\nKonsep acara|Event concept|تصور الفعالية|活动方案\nKoordinasi pembicara & sesi|Speaker & session coordination|تنسيق المتحدثين والجلسات|嘉宾与场次协调\nAlur peserta|Participant flow|مسار المشاركين|参与者流程\nProduksi teknis|Technical production|الإنتاج التقني|技术制作\nSentuhan digital|Digital support|الدعم الرقمي|数字化支持\nRegistrasi & check-in QR, live Q&A & polling, e-sertifikat.|Registration & QR check-in, live Q&A & polling, digital certificates.|التسجيل والحضور برمز QR، والأسئلة والتصويت المباشر، والشهادات الرقمية.|线上报名与二维码签到、实时问答与投票、电子证书。\nAcara Korporat & Institusi|Corporate & Institutional Events|فعاليات الشركات والمؤسسات|企业与机构活动\nRapat, town hall, kick-off, dan acara kelembagaan.|Meetings, town halls, kick-offs, and institutional events.|اجتماعات ولقاءات عامة وفعاليات انطلاق ومناسبات مؤسسية.|会议、全员大会、启动会与机构活动。\nVenue & ruang|Venue & spaces|المكان والقاعات|场地与空间\nKesiapan presentasi|Presentation readiness|جاهزية العروض|演示准备\nAgenda acara|Event agenda|جدول الفعالية|活动议程\nKoordinasi tamu|Guest coordination|تنسيق الضيوف|来宾协调\nRSVP & QR tamu, pengingat WA/email, live polling.|Guest RSVP & QR passes, WhatsApp/email reminders, live polling.|تأكيد الحضور ورموز QR للضيوف، وتذكيرات واتساب والبريد، والتصويت المباشر.|来宾报名与二维码凭证、WhatsApp/邮件提醒、实时投票。\nTeam Experiences|Team Experiences|تجارب الفرق|团队体验\nOuting, gathering, retreat, outbound, dan team building.|Outings, gatherings, retreats, outdoor activities, and team building.|رحلات وتجمعات وخلوات وأنشطة خارجية وبناء فرق.|团队出游、聚会、休整、户外活动与团建。\nRancangan aktivitas|Activity design|تصميم الأنشطة|活动设计\nVenue & vendor|Venue & vendors|المكان والموردون|场地与供应商\nFasilitator|Facilitators|الميسرون|活动引导师\nKeselamatan lapangan|On-site safety|السلامة الميدانية|现场安全\nPerjalanan & akomodasi (opsional).|Travel & accommodation (optional).|السفر والإقامة (اختياري).|交通与住宿（可选）。\nData peserta, kuis & games interaktif, survei feedback.|Participant records, interactive quizzes & games, feedback surveys.|بيانات المشاركين ومسابقات وألعاب تفاعلية واستبيانات آراء.|参与者资料、互动问答与游戏、反馈调查。\nTim Anda fokus belajar, kami urus acaranya.|Your team focuses on learning. We handle the event.|يركز فريقك على التعلم، ونتولى نحن تنظيم الفعالية.|您的团队专心学习，活动安排交给我们。\nAdministrasi jadwal & peserta|Schedule & participant administration|إدارة الجداول والمشاركين|日程与学员管理\nVenue & peralatan|Venue & equipment|المكان والمعدات|场地与设备\nLogistik trainer|Trainer logistics|تجهيزات المدربين|讲师后勤\nTrainer & materi tersedia secara opsional lewat mitra.|Trainers & learning materials are optionally available through partners.|المدربون والمواد التعليمية متاحون اختيارياً عبر شركائنا.|可通过合作伙伴另选讲师与培训材料。\nE-sertifikat otomatis, evaluasi digital.|Automated digital certificates and digital evaluations.|شهادات رقمية آلية وتقييم رقمي.|自动电子证书与数字化评估。\nTim spesialis untuk bagian acara yang Anda butuhkan.|Specialist teams for the parts of your event that need support.|فرق متخصصة للأجزاء التي تحتاج إلى دعم في فعاليتك.|为您需要支持的活动环节提供专业团队。\nDokumentasi foto/video|Photo/video documentation|توثيق الصور والفيديو|摄影摄像记录\nDesain|Design|التصميم|设计\nLO & panggung|Liaison & stage support|تنسيق الضيوف ودعم المسرح|嘉宾联络与舞台支持\nFasilitator outing & kru lapangan|Outing facilitators & field crew|ميسرو الرحلات والطواقم الميدانية|出游引导师与现场执行人员\nOperator registrasi, check-in, atau sistem acara sesuai lingkup kerja.|Registration, check-in, or event-system operators within the agreed scope.|مشغلو التسجيل والحضور وأنظمة الفعاليات وفق النطاق المتفق عليه.|按商定范围提供报名、签到或活动系统操作人员。\nChat WhatsApp|Chat on WhatsApp|تحدث عبر واتساب|WhatsApp 咨询\nLatar belakang teknologi kami dibawa ke cara merencanakan acara, bekerja bersama panitia, dan mendampingi peserta.|Our technology background shapes how we plan events, work with organizers, and support participants.|تنعكس خبرتنا التقنية في تخطيط الفعاليات والتعاون مع المنظمين ودعم المشاركين.|技术背景融入我们的活动策划、组委会协作和参与者服务。\nTeknologi di setiap layanan, dari registrasi online, check-in QR, engagement, sampai laporan akhir.|Technology in every service, from online registration and QR check-in to engagement and final reporting.|تقنية في كل خدمة، من التسجيل الإلكتروني والحضور برمز QR إلى التفاعل والتقرير النهائي.|技术融入每项服务，从线上报名、二维码签到，到互动与最终报告。\nKerja terstruktur, tim fleksibel. Bisa satu tim penuh, satu fungsi spesialis, atau tambahan kru.|Structured work, flexible teams. Choose a full team, one specialist function, or extra crew.|عمل منظم وفرق مرنة: فريق كامل أو وظيفة متخصصة أو طاقم إضافي.|工作有章法，团队可灵活配置：完整团队、单项专业职能或增援人员。\nPartner, bukan sekadar vendor. Kami ikut merancang dari ide pertama sampai evaluasi.|A partner throughout the process. We help shape the event from the first idea to evaluation.|شريك طوال المسار. نشارك في تصميم الفعالية من الفكرة الأولى إلى التقييم.|全程合作伙伴，从最初构想到最终复盘，一起规划。\nPeserta terlibat, bukan cuma hadir.|Participants take part, beyond attendance.|المشاركون يتفاعلون إلى جانب الحضور.|让参与者投入其中。\nPengingat WA/email, live polling, Q&A, dan kuis membantu peserta mengikuti dan ikut berinteraksi selama acara.|WhatsApp/email reminders, live polling, Q&A, and quizzes help participants follow and interact throughout the event.|تساعد تذكيرات واتساب والبريد والتصويت والأسئلة والمسابقات المشاركين على المتابعة والتفاعل.|WhatsApp/邮件提醒、实时投票、问答与小测验，帮助参与者了解进程并积极互动。\nPilihan teknologi, penyiapan, dan biayanya dikonfirmasi di proposal.|Technology choices, setup, and costs are confirmed in the proposal.|تُؤكد الخيارات التقنية والتجهيزات والتكاليف في العرض.|技术选项、准备工作与费用将在方案中确认。\nSistem yang mengikuti alur acara Anda.|Systems shaped around your event flow.|أنظمة تواكب مسار فعاليتك.|围绕活动流程设计系统。\nAcara yang rapi perlu informasi yang rapi juga. Kami membangun sistem untuk membantu panitia menyiapkan acara, mendampingi peserta, dan merangkum hasilnya.|A well-run event needs well-organized information. We build systems that help organizers prepare, support participants, and summarize results.|تحتاج الفعالية المنظمة إلى معلومات منظمة. نبني أنظمة تساعد المنظمين على التحضير ودعم المشاركين وتلخيص النتائج.|有序的活动也需要有序的信息。我们构建系统，帮助组委会筹备、服务参与者并汇总成果。\nSatu sumber informasi|One source of information|مصدر موحد للمعلومات|统一信息来源\nData peserta, jadwal, dan kebutuhan acara lebih mudah ditelusuri. Panitia tidak perlu mencari versi terbaru di banyak chat.|Participant data, schedules, and event requirements are easier to find, without chasing the latest version across chats.|يسهل العثور على بيانات المشاركين والجداول والمتطلبات دون البحث عن آخر نسخة في محادثات متعددة.|参与者资料、日程与活动需求更容易查找，无需在多个群聊中寻找最新版本。\nKoordinasi lebih jelas|Clearer coordination|تنسيق أوضح|协调更清晰\nPeserta tahu agenda dan persiapan. Tim tahu informasi yang perlu dibagikan, sehingga pertanyaan berulang bisa dikurangi.|Participants know the agenda and preparation steps. Teams know what to share, helping reduce repeated questions.|يعرف المشاركون الجدول والاستعدادات، ويعرف الفريق ما ينبغي مشاركته، مما يقلل الأسئلة المتكررة.|参与者清楚议程和准备事项，团队明确需发布的信息，从而减少重复询问。\nPeserta ikut terlibat|Participants get involved|المشاركون يتفاعلون|参与者积极投入\nPolling, Q&A, kuis, atau live scoring memberi peserta cara untuk ikut ambil bagian selama acara.|Polls, Q&A, quizzes, or live scoring give participants ways to take part during the event.|يتيح التصويت والأسئلة والمسابقات والنتائج المباشرة طرقاً للمشاركة أثناء الفعالية.|投票、问答、小测验或实时计分，为参与者提供多种互动方式。\nHasilnya bisa ditinjau|Results can be reviewed|نتائج قابلة للمراجعة|成果可供复盘\nRekap kehadiran, hasil aktivitas, dan feedback menjadi bahan evaluasi serta laporan setelah acara.|Attendance summaries, activity results, and feedback support evaluation and reporting after the event.|تدعم ملخصات الحضور ونتائج الأنشطة والآراء التقييم والتقرير بعد الفعالية.|签到汇总、活动结果和反馈，为活动后的评估与报告提供依据。\nDari kebutuhan ke sistem|From needs to systems|من الاحتياجات إلى الأنظمة|从需求到系统\nDirancang bersama, diuji sebelum dipakai.|Designed together. Tested before use.|نصمم معاً ونختبر قبل الاستخدام.|共同设计，使用前充分测试。\nSistem bisa sesederhana panduan peserta, atau menghubungkan beberapa alur kerja dalam satu platform.|A system can be a simple participant guide or connect several workflows in one platform.|قد يكون النظام دليلاً بسيطاً للمشارك أو منصة تربط عدة مسارات عمل.|系统可以是一份简明参与者指南，也可连接平台中的多个工作流程。\nPetakan alur|Map the flow|تحديد المسار|梳理流程\nKami mulai dari tujuan acara, profil peserta, dan cara kerja panitia.|We start with event goals, participant profiles, and organizer workflows.|نبدأ بأهداف الفعالية وملفات المشاركين وطريقة عمل المنظمين.|从活动目标、参与者情况和组委会工作方式开始。\nPilih yang diperlukan|Choose what is needed|اختيار المطلوب|选择所需功能\nFitur dipilih untuk membantu kebutuhan acara, dengan ruang lingkup dan biaya yang disepakati.|Features address event needs within an agreed scope and cost.|نختار الميزات لتلبية احتياجات الفعالية ضمن نطاق وتكلفة متفق عليهما.|根据活动需求选择功能，并商定范围与费用。\nRancang & bangun|Design & build|التصميم والبناء|设计与开发\nKami susun tampilan, alur pengguna, dan data yang perlu dikelola.|We design the interface, user journey, and data to manage.|نصمم الواجهة ومسار المستخدم والبيانات المطلوب إدارتها.|规划界面、用户流程和需要管理的数据。\nUji sebelum digunakan|Test before use|الاختبار قبل الاستخدام|使用前测试\nTim mencoba skenario acara dan menyiapkan operator serta alur cadangan.|The team tests event scenarios and prepares operators and backup procedures.|يختبر الفريق سيناريوهات الفعالية ويجهز المشغلين والمسار البديل.|团队测试活动场景，准备操作人员与备用流程。\nRekap & serahkan|Summarize & hand over|التلخيص والتسليم|汇总与交付\nData dan hasil diserahkan sesuai format serta lingkup kerja yang disepakati.|Data and results are handed over in the agreed format and scope.|تُسلم البيانات والنتائج وفق الشكل والنطاق المتفق عليهما.|数据与成果按商定格式和范围交付。\nSistem event & program|Event & program systems|أنظمة الفعاليات والبرامج|活动与项目系统\nContoh yang sudah kami rancang|Examples we have designed|نماذج صممناها|我们设计过的实例\nCuplikan tampilan asli dari pekerjaan tim Campus Innovate dan Innovate Organizer.|Actual interface excerpts from Campus Innovate and Innovate Organizer projects.|لقطات فعلية من أعمال Campus Innovate وInnovate Organizer.|来自 Campus Innovate 与 Innovate Organizer 项目的真实界面截图。\nPortofolio sistem Campus Innovate lainnya|More Campus Innovate system projects|مشاريع أنظمة أخرى لـ Campus Innovate|Campus Innovate 的其他系统项目\nContoh berikut menunjukkan pengalaman tim induk kami dalam membangun sistem digital. Lingkupnya mengikuti kebutuhan masing-masing klien.|These examples show our parent team’s digital-system experience. Each scope follows the client’s needs.|توضح هذه الأمثلة خبرة فريقنا الأم في الأنظمة الرقمية، بنطاق يناسب كل عميل.|以下案例展示母团队开发数字系统的经验，各项目范围按客户需求确定。\nLihat tampilan|View interface|عرض الواجهة|查看界面\nYang dibantu sistem ini|What this system supports|ما يدعمه هذا النظام|系统支持的工作\nBuka demo itinerary|Open itinerary demo|فتح نموذج برنامج الرحلة|打开行程演示\nTutup tampilan sistem|Close system preview|إغلاق معاينة النظام|关闭系统预览\nLayanan|Service|الخدمة|服务\nBentuk acara|Event format|شكل الفعالية|活动形式\nProfil proyek institusi|Institutional project profile|ملف المشروع المؤسسي|机构项目简介\nLihat detail proyek|View project details|عرض تفاصيل المشروع|查看项目详情\nDari memahami kebutuhan sampai menutup proyek.|From understanding needs to project closeout.|من فهم الاحتياجات إلى إغلاق المشروع.|从了解需求到项目收尾。\nPahami|Understand|الفهم|了解\nTujuan, peserta, kebutuhan, dan anggaran.|Goals, participants, requirements, and budget.|الأهداف والمشاركون والاحتياجات والميزانية.|目标、参与者、需求与预算。\nRencanakan|Plan|التخطيط|计划\nKonsep, ruang lingkup, dan timeline.|Concept, scope, and timeline.|الفكرة ونطاق العمل والجدول الزمني.|方案、范围与时间表。\nSiapkan|Prepare|التحضير|准备\nTim, vendor, materi, dan kesiapan teknis.|Team, vendors, materials, and technical readiness.|الفريق والموردون والمواد والجاهزية التقنية.|团队、供应商、材料与技术准备。\nJalankan|Deliver|التنفيذ|执行\nOperasional hari-H dan penanganan kendala.|Event-day operations and issue resolution.|عمليات يوم الفعالية ومعالجة التحديات.|活动当天执行与问题处理。\nTutup|Close out|الإغلاق|收尾\nEvaluasi, serah terima, dan administrasi proyek.|Evaluation, handover, and project administration.|التقييم والتسليم وإدارة وثائق المشروع.|评估、交付与项目行政工作。\nAcara berikutnya|Your next event|فعاليتك القادمة|下一场活动\nMari rencanakan acara Anda berikutnya.|Let’s plan your next event.|لنخطط لفعاليتك القادمة.|一起规划您的下一场活动。\nCeritakan idenya, kami bantu bentuk konsep, persiapan, sampai pelaksanaannya.|Share your idea. We help shape the concept, preparations, and delivery.|شاركنا فكرتك لنساعدك في بناء التصور والتحضير والتنفيذ.|分享您的想法，我们协助形成方案、完成筹备并执行。\nAcara tertata. Peserta terhubung. Panitia lebih tenang.|Organized events. Connected participants. Less pressure on your team.|فعاليات منظمة. مشاركون متواصلون. فريق أكثر اطمئناناً.|活动有序、参与者互联、组委会更从容。\nMari bicara tentang acara Anda|Let’s talk about your event|لنتحدث عن فعاليتك|聊聊您的活动\nBagian dari Campus Innovate|Part of Campus Innovate|جزء من Campus Innovate|Campus Innovate 旗下\nJelajahi|Explore|استكشف|探索\nKebutuhan acara|Event needs|احتياجات الفعالية|活动需求\nHubungi kami|Contact us|تواصل معنا|联系我们\nKirim brief acara|Send an event brief|أرسل ملخص الفعالية|提交活动需求\nPertanyaan umum|Frequently asked questions|أسئلة شائعة|常见问题\n".trim().split("\n")) { const [source, ...translations] = row.split("|"); siteCopy[source] = translations; }

for (const row of "Live Scoring KLH/BPLH|KLH/BPLH Live Scoring|النتائج المباشرة لـ KLH/BPLH|KLH/BPLH 实时计分\nEvent engagement|Event engagement|تفاعل المشاركين|活动互动\nPapan skor untuk melihat perolehan poin dan posisi tim selama fun games. Panitia dan peserta mengikuti klasemen yang sama.|A scoreboard showing points and team standings during fun games. Organizers and participants follow the same leaderboard.|لوحة تعرض النقاط وترتيب الفرق أثناء الألعاب. يتابع المنظمون والمشاركون الترتيب نفسه.|游戏期间展示积分与团队排名，组委会和参与者查看同一排行榜。\nSkor per permainan|Scores by game|النقاط لكل لعبة|各游戏积分\nKlasemen tim|Team standings|ترتيب الفرق|团队排名\nTampilan layar acara|Event-screen view|عرض شاشة الفعالية|活动大屏展示\nProgram management|Program management|إدارة البرامج|项目管理\nPlatform program yang menyatukan informasi kegiatan, komunitas, dan akses peserta. Materi program lebih mudah ditemukan dalam satu tempat.|A program platform bringing together activities, community information, and participant access, with program materials easier to find in one place.|منصة تجمع معلومات الأنشطة والمجتمع ووصول المشاركين، ليسهل العثور على مواد البرنامج في مكان واحد.|整合活动、社群与参与者入口的平台，项目资料集中呈现，方便查找。\nInformasi kegiatan|Activity information|معلومات الأنشطة|活动信息\nAkses peserta|Participant access|وصول المشاركين|参与者入口\nKomunikasi program|Program communication|التواصل حول البرنامج|项目沟通\nItinerary Digital|Digital Itinerary|برنامج الرحلة الرقمي|数字行程指南\nPanduan peserta · demo|Participant guide · demo|دليل المشاركين · نموذج|参与者指南 · 演示\nPanduan acara yang bisa dibuka di ponsel: jadwal, lokasi, persiapan, dan kontak panitia. Peserta punya rujukan yang sama sepanjang kegiatan.|A mobile event guide with schedules, locations, preparations, and organizer contacts. Participants have one shared reference throughout the event.|دليل فعالية عبر الهاتف يضم الجدول والمواقع والاستعدادات وجهات اتصال المنظمين، ليكون مرجعاً موحداً للمشاركين.|手机可查看的活动指南，包含日程、地点、准备事项和组委会联系方式，供参与者全程参考。\nLokasi & persiapan|Locations & preparation|المواقع والاستعدادات|地点与准备\nKontak panitia|Organizer contacts|جهات اتصال المنظمين|组委会联系方式\nWebsite event · Campus Innovate|Event website · Campus Innovate|موقع فعالية · Campus Innovate|活动网站 · Campus Innovate\nWebsite acara untuk informasi program dan pengalaman digital peserta YLOS.|An event website supporting program information and the YLOS participant digital experience.|موقع فعالية يدعم معلومات البرنامج والتجربة الرقمية لمشاركي YLOS.|为 YLOS 项目信息与参与者数字体验提供支持的活动网站。\nInformasi program|Program information|معلومات البرنامج|项目信息\nProfil pembicara|Speaker profiles|ملفات المتحدثين|嘉宾介绍\nAlur pendaftaran|Registration flow|مسار التسجيل|报名流程\nOrganization SaaS · Campus Innovate|Organization SaaS · Campus Innovate|برمجيات المؤسسات · Campus Innovate|组织 SaaS · Campus Innovate\nSistem untuk mengelola operasional organisasi dalam satu ruang kerja digital.|A system for managing organizational operations in one digital workspace.|نظام لإدارة عمليات المنظمة في مساحة عمل رقمية موحدة.|在统一数字工作空间中管理组织运营的系统。\nProgram kerja|Work programs|برامج العمل|工作计划\nInformasi organisasi|Organization information|معلومات المنظمة|组织信息\nPrototipe web · DPPKHA IPB|Web prototype · DPPKHA IPB|نموذج ويب · DPPKHA IPB|网站原型 · DPPKHA IPB\nPrototipe platform yang menghubungkan alumni dengan layanan DPPKHA IPB University.|A platform prototype connecting alumni with DPPKHA IPB University services.|نموذج منصة يربط الخريجين بخدمات DPPKHA في جامعة IPB.|连接校友与 IPB 大学 DPPKHA 服务的平台原型。\nProfil alumni|Alumni profiles|ملفات الخريجين|校友资料\nLayanan institusi|Institutional services|الخدمات المؤسسية|机构服务\nInformasi karier|Career information|المعلومات المهنية|职业信息\nCRM & website · Campus Innovate|CRM & website · Campus Innovate|إدارة العملاء وموقع ويب · Campus Innovate|CRM 与网站 · Campus Innovate\nPengembangan CRM dan website untuk informasi pelanggan dan pengelolaan hubungan pelanggan.|CRM and website development for customer information and relationship management.|تطوير نظام إدارة علاقات العملاء وموقع ويب لبيانات العملاء وإدارة العلاقات.|开发用于客户资料与客户关系管理的 CRM 和网站。\nInformasi pelanggan|Customer information|معلومات العملاء|客户资料\nTindak lanjut|Follow-up|المتابعة|后续跟进\nWorld University Network for Productive Waqf. Full event management, termasuk branding acara dan materi komunikasi.|World University Network for Productive Waqf. Full event management, including event branding and communication materials.|World University Network for Productive Waqf. إدارة كاملة للفعالية تشمل الهوية البصرية ومواد التواصل.|World University Network for Productive Waqf。提供完整活动管理，包括活动品牌形象与传播材料。\nKonferensi internasional|International conference|مؤتمر دولي|国际会议\nDelegasi & peserta konferensi|Delegates & conference participants|الوفود والمشاركون في المؤتمر|代表与会议参与者\nSerah terima simbolis Hunian Layak Huni dan peresmian Ecobiz Desa Sejahtera Astra, Garut.|Symbolic handover of liveable housing and inauguration of Ecobiz Desa Sejahtera Astra in Garut.|تسليم رمزي لمساكن لائقة وافتتاح Ecobiz Desa Sejahtera Astra في غاروت.|在 Garut 举行宜居住房象征性交付及 Ecobiz Desa Sejahtera Astra 启用仪式。\nSeremoni serah terima & peresmian|Handover & inauguration ceremony|مراسم التسليم والافتتاح|交付与启用仪式\nTamu undangan & pemangku kepentingan|Invited guests & stakeholders|الضيوف المدعوون وأصحاب المصلحة|受邀嘉宾与相关方\nEvent support Training ISO 9001 Lead Auditor & Sertifikasi BNSP.|Event support for ISO 9001 Lead Auditor Training & BNSP Certification.|دعم فعالية تدريب المدقق الرئيسي ISO 9001 وشهادة BNSP.|为 ISO 9001 主任审核员培训与 BNSP 认证提供活动支持。\nPelatihan & sertifikasi|Training & certification|التدريب والشهادات|培训与认证\nPeserta pelatihan BRMP|BRMP training participants|مشاركو تدريب BRMP|BRMP 培训参与者\nFun games dan team building pegawai KLH/BPLH.|Fun games and team building for KLH/BPLH employees.|ألعاب وأنشطة بناء فرق لموظفي KLH/BPLH.|面向 KLH/BPLH 员工的趣味游戏与团建。\nPegawai KLH/BPLH|KLH/BPLH employees|موظفو KLH/BPLH|KLH/BPLH 员工\nKonsep permainan|Game design|تصميم الألعاب|游戏设计\nFasilitasi kelompok|Group facilitation|تيسير المجموعات|小组引导\nManajemen peserta|Participant management|إدارة المشاركين|参与者管理\nVenue & logistik|Venue & logistics|المكان والخدمات اللوجستية|场地与后勤\nOperasional acara|Event operations|عمليات الفعالية|活动执行\nKonsep & rundown seremoni|Ceremony concept & schedule|تصور وجدول المراسم|仪式方案与流程\nKoordinasi venue dan panggung|Venue & stage coordination|تنسيق المكان والمسرح|场地与舞台协调\nProfil peserta|Participant profile|ملف المشاركين|参与者情况\nKeluarga & calon orang tua murid|Families & prospective parents|العائلات وأولياء الأمور المحتملون|家庭与准入学家长\nPeserta pelatihan Geo Investama|Geo Investama training participants|مشاركو تدريب Geo Investama|Geo Investama 培训参与者\nKomunitas institusi IPB|IPB institutional community|مجتمع مؤسسات IPB|IPB 机构社群\nTamu undangan & mitra institusi|Invited guests & institutional partners|الضيوف والشركاء المؤسسيون|受邀嘉宾与机构合作伙伴\nDelegasi UCAM Malaysia|UCAM Malaysia delegates|وفد UCAM ماليزيا|马来西亚 UCAM 代表\nPegawai instansi pemerintah|Government agency employees|موظفو الجهات الحكومية|政府机构员工\nKomunitas kampus|Campus community|المجتمع الجامعي|校园社群\nTim PUSTARHUT|PUSTARHUT team|فريق PUSTARHUT|PUSTARHUT 团队\nWirausaha mahasiswa & pengunjung|Student entrepreneurs & visitors|رواد الأعمال الطلاب والزوار|学生创业者与访客\nRombongan & komunitas Stripmate|Groups & the Stripmate community|المجموعات ومجتمع Stripmate|团体与 Stripmate 社群\nPeserta pelatihan Badan Informasi Geospasial|Badan Informasi Geospasial training participants|مشاركو تدريب Badan Informasi Geospasial|Badan Informasi Geospasial 培训参与者\nDukungan kegiatan di lokasi|On-site activity support|دعم الأنشطة في الموقع|现场活动支持\nDokumentasi sesi belajar dan praktik|Learning & practical-session documentation|توثيق جلسات التعلم والتطبيق|课程与实践环节记录\n".trim().split("\n")) { const [source, ...translations] = row.split("|"); siteCopy[source] = translations; }

siteCopy["Pelatihan & Workshop"] = ["Training & Workshops", "التدريب وورش العمل", "培训与工作坊"];

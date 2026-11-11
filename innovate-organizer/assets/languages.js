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
  if (translation === undefined) {
    const numberPrefix = key.match(/^(\d+ \/ )(.+)$/);
    const numberSuffix = key.match(/^(.+?)( \/ \d+| · \d{4})$/);
    const projectCount = key.match(/^(\d+) proyek$/);
    const arrow = key.match(/^(.+?) ([↑↓→↗])$/);
    const prefix = key.match(/^(Dokumentasi|Lihat proyek) (.+)$/);
    if (numberPrefix) translation = numberPrefix[1] + translateSiteText(numberPrefix[2]);
    else if (numberSuffix) translation = translateSiteText(numberSuffix[1]) + numberSuffix[2];
    else if (projectCount) translation = projectCount[1] + " " + (column === 0 && projectCount[1] === "1" ? "project" : siteCopy.proyek[column]);
    else if (arrow) translation = translateSiteText(arrow[1]) + " " + (siteLanguage === "ar" && arrow[2] === "→" ? "←" : arrow[2]);
    else if (prefix) translation = siteCopy[prefix[1]][column] + " " + prefix[2];
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

import type { Attraction, LocalizedText } from "../../src/db/types.ts";
import { L } from "./common.ts";

export interface SeedDestination {
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  overview: LocalizedText;
  attractions: Attraction[];
  bestTime: LocalizedText;
  bestMonths: number[];
  lat: number;
  lng: number;
}

const a = (name: LocalizedText, description: LocalizedText, lat?: number, lng?: number): Attraction =>
  lat !== undefined && lng !== undefined ? { name, description, lat, lng } : { name, description };

export const destinations: SeedDestination[] = [
  {
    slug: "samarkand",
    name: L("Samarkand", "Samarqand", "Самарканд"),
    tagline: L(
      "Turquoise domes at the crossroads of the Silk Road",
      "Buyuk Ipak yoʻli chorrahasidagi feruza gumbazlar",
      "Бирюзовые купола на перекрёстке Великого шёлкового пути",
    ),
    overview: L(
      "Samarkand was Amir Timur's capital and one of the great cities of the medieval world. Its glazed madrasahs, mausoleums and observatory are a UNESCO World Heritage Site, and the city is still a lively place of bazaars, bakeries and paper workshops. It is two hours from Tashkent on the Afrosiyob high-speed train.",
      "Samarqand Amir Temur saltanatining poytaxti va oʻrta asrlarning eng buyuk shaharlaridan biri boʻlgan. Uning sirlangan madrasalari, maqbaralari va rasadxonasi YUNESKOning Butunjahon merosi roʻyxatiga kiritilgan. Shahar bugun ham bozorlari, nonvoyxonalari va qogʻoz ustaxonalari bilan jonli. Toshkentdan Afrosiyob tezyurar poyezdida taxminan ikki soat.",
      "Самарканд был столицей Амира Темура и одним из величайших городов средневекового мира. Его изразцовые медресе, мавзолеи и обсерватория входят в список Всемирного наследия ЮНЕСКО, а сам город по-прежнему живёт базарами, пекарнями и мастерскими бумаги. До Ташкента — около двух часов на скоростном поезде «Афросиёб».",
    ),
    attractions: [
      a(L("Registan Square", "Registon maydoni", "Площадь Регистан"), L("Three monumental madrasahs facing one square — magical at sunset and when lit at night.", "Bir maydonga qaragan uchta ulugʻvor madrasa — quyosh botishida va kechki yoritishda ayniqsa goʻzal.", "Три монументальных медресе на одной площади — особенно красиво на закате и при ночной подсветке."), 39.6547, 66.9757),
      a(L("Gur-e-Amir Mausoleum", "Goʻri Amir maqbarasi", "Мавзолей Гур-Эмир"), L("The ribbed blue dome over the tomb of Amir Timur and his descendants.", "Amir Temur va uning avlodlari dafn etilgan qovurgʻali moviy gumbazli maqbara.", "Ребристый голубой купол над гробницей Амира Темура и его потомков."), 39.6484, 66.9691),
      a(L("Shah-i-Zinda", "Shohi Zinda", "Шахи-Зинда"), L("An avenue of mausoleums covered in some of the finest glazed tilework in Central Asia.", "Oʻrta Osiyodagi eng nafis sirlangan koshinlar bilan bezatilgan maqbaralar koʻchasi.", "Улица мавзолеев с одной из лучших изразцовых облицовок в Центральной Азии."), 39.6629, 66.9883),
      a(L("Bibi-Khanym Mosque", "Bibixonim masjidi", "Мечеть Биби-Ханым"), L("Timur's colossal Friday mosque, next to the busy Siyob Bazaar.", "Temurning ulkan jome masjidi, gavjum Siyob bozori yonida.", "Грандиозная соборная мечеть Тимура рядом с оживлённым Сиабским базаром."), 39.6609, 66.9794),
      a(L("Ulugh Beg Observatory", "Ulugʻbek rasadxonasi", "Обсерватория Улугбека"), L("Remains of the 15th-century observatory where Ulugh Beg catalogued the stars.", "Ulugʻbek yulduzlarni roʻyxatga olgan XV asr rasadxonasi qoldiqlari.", "Остатки обсерватории XV века, где Улугбек составил звёздный каталог."), 39.6747, 67.0058),
    ],
    bestTime: L(
      "April–June and September–October: warm days, cool evenings. July–August is hot (often 35–40 °C).",
      "Aprel–iyun va sentabr–oktabr: kunlar iliq, kechalar salqin. Iyul–avgust issiq (koʻpincha 35–40 °C).",
      "Апрель–июнь и сентябрь–октябрь: тёплые дни и прохладные вечера. В июле–августе жарко (часто 35–40 °C).",
    ),
    bestMonths: [4, 5, 6, 9, 10],
    lat: 39.6542,
    lng: 66.9597,
  },
  {
    slug: "bukhara",
    name: L("Bukhara", "Buxoro", "Бухара"),
    tagline: L(
      "A living medieval city of domes, caravanserais and trading arcades",
      "Gumbazlar, karvonsaroylar va savdo toqlari bilan yashayotgan oʻrta asr shahri",
      "Живой средневековый город куполов, караван-сараев и торговых куполов",
    ),
    overview: L(
      "Bukhara's old town has hardly changed its layout in centuries. Domed trading arcades still sell carpets, suzani and knives; the Kalyan Minaret has stood since 1127; and life gathers in the evening around the Lyabi-Hauz pool. The historic centre is a UNESCO World Heritage Site and almost everything is within walking distance.",
      "Buxoroning eski shahri asrlar davomida deyarli oʻzgarmagan. Gumbazli savdo toqlarida hamon gilam, soʻzana va pichoq sotiladi; Kalon minorasi 1127-yildan beri qad rostlab turibdi; kechqurun hayot Labi hovuz atrofida jamlanadi. Tarixiy markaz YUNESKO Butunjahon merosi roʻyxatida, deyarli hamma joyga piyoda borish mumkin.",
      "Старый город Бухары почти не менял планировку веками. В торговых куполах по-прежнему продают ковры, сюзане и ножи, минарет Калян стоит с 1127 года, а вечерняя жизнь собирается у хауза Ляби-Хауз. Исторический центр входит в список Всемирного наследия ЮНЕСКО, и почти всё можно обойти пешком.",
    ),
    attractions: [
      a(L("Po-i-Kalyan Ensemble", "Poyi Kalon majmuasi", "Ансамбль Пои-Калян"), L("The Kalyan Minaret, Kalyan Mosque and Mir-i-Arab Madrasah around one square.", "Bir maydon atrofidagi Kalon minorasi, Kalon masjidi va Mir Arab madrasasi.", "Минарет Калян, мечеть Калян и медресе Мири-Араб вокруг одной площади."), 39.7759, 64.4146),
      a(L("Ark Fortress", "Ark qalʼasi", "Крепость Арк"), L("The citadel of the Bukhara emirs, with museums inside its walls.", "Buxoro amirlarining qarorgohi, devorlari ichida muzeylar joylashgan.", "Цитадель бухарских эмиров с музеями внутри стен."), 39.7779, 64.4108),
      a(L("Lyabi-Hauz", "Labi hovuz", "Ляби-Хауз"), L("A shaded pool framed by madrasahs — the city's favourite place for tea.", "Madrasalar bilan oʻralgan soyali hovuz — shaharning eng sevimli choyxona maskani.", "Тенистый хауз в окружении медресе — любимое место горожан для чаепития."), 39.7739, 64.4198),
      a(L("Samanid Mausoleum", "Somoniylar maqbarasi", "Мавзолей Саманидов"), L("A 10th-century masterpiece of patterned brickwork in a quiet park.", "Sokin bogʻdagi naqshinkor gʻishtdan qurilgan X asr durdonasi.", "Шедевр узорной кирпичной кладки X века в тихом парке."), 39.7765, 64.4005),
      a(L("Chor Minor", "Chor Minor", "Чор-Минор"), L("A small gatehouse with four turquoise-capped towers, hidden in the lanes.", "Tor koʻchalar orasidagi toʻrtta feruza gumbazli minorasi bor kichik darvozaxona.", "Небольшой привратный дом с четырьмя бирюзовыми башенками в переулках."), 39.7787, 64.4247),
    ],
    bestTime: L(
      "March–May and September–November. Summer afternoons are very hot; winter is quiet and mild.",
      "Mart–may va sentabr–noyabr. Yozda tushdan keyin juda issiq; qish sokin va yumshoq.",
      "Март–май и сентябрь–ноябрь. Летом днём очень жарко; зима спокойная и мягкая.",
    ),
    bestMonths: [3, 4, 5, 9, 10, 11],
    lat: 39.7747,
    lng: 64.4286,
  },
  {
    slug: "khiva",
    name: L("Khiva", "Xiva", "Хива"),
    tagline: L(
      "An open-air museum city behind clay walls in the Khorezm oasis",
      "Xorazm vohasida loy devorlar ortidagi ochiq osmon ostidagi muzey-shahar",
      "Город-музей под открытым небом за глиняными стенами Хорезмского оазиса",
    ),
    overview: L(
      "Khiva's inner town, Itchan Kala, is a complete walled city of minarets, palaces and madrasahs, and the first site in Uzbekistan inscribed by UNESCO. Inside the walls people still live, bake bread and carve wood. Khiva is also the starting point for the desert fortresses of Ancient Khorezm and the yurt camp at Ayaz-Kala.",
      "Xivaning ichki shahri — Ichan qalʼa — minoralar, saroylar va madrasalardan iborat toʻliq devorli shahar boʻlib, Oʻzbekistonda YUNESKO roʻyxatiga birinchi kiritilgan obyekt. Devorlar ichida odamlar hamon yashaydi, non yopadi va yogʻoch oʻymakorligi bilan shugʻullanadi. Xiva qadimgi Xorazm qalʼalari va Ayozqalʼadagi oʻtovlar lageriga sayohatning boshlangʻich nuqtasi ham.",
      "Внутренний город Хивы, Ичан-Кала, — целый город в стенах с минаретами, дворцами и медресе, первый объект Узбекистана в списке ЮНЕСКО. Внутри стен по-прежнему живут люди, пекут лепёшки и режут по дереву. Отсюда же начинаются поездки к крепостям Древнего Хорезма и в юртовый лагерь у Аяз-Калы.",
    ),
    attractions: [
      a(L("Itchan Kala", "Ichan qalʼa", "Ичан-Кала"), L("The walled inner town — walk the ramparts at sunset.", "Devor bilan oʻralgan ichki shahar — quyosh botishida devor ustida sayr qiling.", "Внутренний город в стенах — прогуляйтесь по стене на закате."), 41.3783, 60.3594),
      a(L("Kalta Minor", "Kalta minor", "Кальта-Минор"), L("The famous unfinished minaret, fully clad in turquoise tiles.", "Toʻliq feruza koshinlar bilan qoplangan mashhur chala minora.", "Знаменитый недостроенный минарет, целиком покрытый бирюзовыми изразцами."), 41.3786, 60.3575),
      a(L("Juma Mosque", "Juma masjidi", "Джума-мечеть"), L("A prayer hall supported by over 200 carved wooden columns.", "200 dan ortiq oʻymakor yogʻoch ustunlarga tayangan namozxona.", "Молельный зал на более чем 200 резных деревянных колоннах."), 41.3786, 60.3608),
      a(L("Islam Khoja Minaret", "Islomxoʻja minorasi", "Минарет Ислам-Ходжа"), L("The tallest minaret in Khiva, with views over the whole oasis.", "Xivadagi eng baland minora, butun vohaga manzara ochiladi.", "Самый высокий минарет Хивы с видом на весь оазис."), 41.3769, 60.3617),
    ],
    bestTime: L(
      "April–May and September–October. Summers are hot and winters are cold for desert trips.",
      "Aprel–may va sentabr–oktabr. Choʻl sayohatlari uchun yoz issiq, qish esa sovuq.",
      "Апрель–май и сентябрь–октябрь. Для поездок в пустыню летом жарко, а зимой холодно.",
    ),
    bestMonths: [4, 5, 9, 10],
    lat: 41.3783,
    lng: 60.3639,
  },
  {
    slug: "tashkent",
    name: L("Tashkent", "Toshkent", "Ташкент"),
    tagline: L(
      "A green modern capital with old-town treasures and a palace-like metro",
      "Eski shahar xazinalari va saroydek metrosi bor yashil zamonaviy poytaxt",
      "Зелёная современная столица с сокровищами старого города и метро-дворцом",
    ),
    overview: L(
      "Most international trips begin in Tashkent. Alongside wide boulevards and modern cafés, the old town keeps the Khast Imam complex, home to one of the oldest Qurans in the world, and the domed Chorsu Bazaar. The metro stations, each decorated on a different theme, are a sight in themselves.",
      "Koʻpchilik xalqaro sayohatlar Toshkentdan boshlanadi. Keng xiyobonlar va zamonaviy kafelar bilan bir qatorda eski shaharda dunyodagi eng qadimgi Qurʼonlardan biri saqlanayotgan Hazrati Imom majmuasi va gumbazli Chorsu bozori joylashgan. Har biri alohida mavzuda bezatilgan metro bekatlari ham diqqatga sazovor.",
      "Большинство международных путешествий начинается в Ташкенте. Рядом с широкими бульварами и современными кафе старый город хранит комплекс Хаст-Имам с одним из древнейших Коранов мира и купольный базар Чорсу. Станции метро, каждая в своём стиле, — достопримечательность сами по себе.",
    ),
    attractions: [
      a(L("Khast Imam Complex", "Hazrati Imom majmuasi", "Комплекс Хаст-Имам"), L("Mosques and madrasahs around the library holding the Uthman Quran.", "Usmon Qurʼoni saqlanayotgan kutubxona atrofidagi masjid va madrasalar.", "Мечети и медресе вокруг библиотеки с Кораном Османа."), 41.3378, 69.2403),
      a(L("Chorsu Bazaar", "Chorsu bozori", "Базар Чорсу"), L("The great green-domed market of spices, dried fruit and fresh bread.", "Ziravorlar, quruq mevalar va issiq non sotiladigan katta yashil gumbazli bozor.", "Большой рынок под зелёным куполом: специи, сухофрукты, горячие лепёшки."), 41.3264, 69.2367),
      a(L("Tashkent Metro", "Toshkent metrosi", "Ташкентское метро"), L("Marble, chandeliers and ceramics — each station is a different design.", "Marmar, qandillar va kulolchilik — har bir bekat oʻziga xos.", "Мрамор, люстры и керамика — каждая станция оформлена по-своему."), 41.3111, 69.2797),
      a(L("Museum of Applied Arts", "Amaliy sanʼat muzeyi", "Музей прикладного искусства"), L("A merchant's house with carved ganch and suzani from every region.", "Har bir hududdan oʻymakor ganch va soʻzanalar namoyish etilgan savdogar uyi.", "Особняк купца с резным ганчем и сюзане из всех регионов."), 41.2969, 69.2575),
    ],
    bestTime: L(
      "March–May and September–November. Tashkent works year-round as a city stop.",
      "Mart–may va sentabr–noyabr. Shahar sayohati uchun Toshkent yil boʻyi qulay.",
      "Март–май и сентябрь–ноябрь. Как городская остановка Ташкент хорош круглый год.",
    ),
    bestMonths: [3, 4, 5, 9, 10, 11],
    lat: 41.2995,
    lng: 69.2401,
  },
  {
    slug: "shakhrisabz",
    name: L("Shakhrisabz", "Shahrisabz", "Шахрисабз"),
    tagline: L(
      "Amir Timur's birthplace beyond the mountain pass",
      "Dovon ortidagi Amir Temurning tugʻilgan yurti",
      "Родина Амира Темура за горным перевалом",
    ),
    overview: L(
      "The 'Green City' south of Samarkand is where Amir Timur was born. The gateway arch of his Ak-Saray palace still towers over the town, and the Dorut Tilovat and Dorus Siyadat complexes hold family tombs and mosques. The drive over the Takhtakaracha Pass is part of the experience. The historic centre is a UNESCO World Heritage Site.",
      "Samarqanddan janubdagi «Yashil shahar» Amir Temurning tugʻilgan joyi. Uning Oqsaroy saroyining ulkan peshtoqi hamon shahar uzra qad koʻtarib turibdi, Dorut Tilovat va Dorus Saodat majmualarida oilaviy maqbaralar va masjidlar joylashgan. Taxtaqoracha dovoni orqali yoʻlning oʻzi ham sayohatning bir qismi. Tarixiy markaz YUNESKO roʻyxatida.",
      "«Зелёный город» к югу от Самарканда — родина Амира Темура. Над городом по-прежнему возвышается портал его дворца Ак-Сарай, а комплексы Дорут-Тиловат и Дорус-Сиадат хранят семейные гробницы и мечети. Дорога через перевал Тахтакарача — часть впечатлений. Исторический центр входит в список ЮНЕСКО.",
    ),
    attractions: [
      a(L("Ak-Saray Palace", "Oqsaroy", "Дворец Ак-Сарай"), L("The surviving portal of Timur's White Palace and his statue in the park.", "Temurning Oqsaroyidan saqlanib qolgan peshtoq va bogʻdagi haykali.", "Сохранившийся портал Белого дворца Тимура и его памятник в парке."), 39.0617, 66.8292),
      a(L("Dorut Tilovat", "Dorut Tilovat", "Дорут-Тиловат"), L("The Kok-Gumbaz Mosque built by Ulugh Beg and the family mausoleums.", "Ulugʻbek qurdirgan Koʻk gumbaz masjidi va oilaviy maqbaralar.", "Мечеть Кок-Гумбаз, построенная Улугбеком, и семейные мавзолеи."), 39.0503, 66.8342),
      a(L("Dorus Siyadat", "Dorus Saodat", "Дорус-Сиадат"), L("The tomb of Timur's son Jahangir and the crypt prepared for Timur himself.", "Temurning oʻgʻli Jahongir maqbarasi va Temurning oʻzi uchun tayyorlangan sagʻana.", "Гробница сына Тимура Джахангира и склеп, приготовленный для самого Тимура."), 39.0525, 66.8325),
      a(L("Takhtakaracha Pass", "Taxtaqoracha dovoni", "Перевал Тахтакарача"), L("A mountain road of about 1,700 m with views and roadside honey stalls.", "Taxminan 1 700 m balandlikdagi manzarali togʻ yoʻli va yoʻl boʻyidagi asal rastalari.", "Горная дорога на высоте около 1 700 м с видами и придорожными лотками мёда."), 39.2667, 66.9),
    ],
    bestTime: L(
      "April–May and September–October. In winter the pass can close after snow; the route then goes via the lowland road.",
      "Aprel–may va sentabr–oktabr. Qishda qordan keyin dovon yopilishi mumkin; unda pastki yoʻl orqali boriladi.",
      "Апрель–май и сентябрь–октябрь. Зимой после снегопада перевал могут закрыть — тогда едем по равнинной дороге.",
    ),
    bestMonths: [4, 5, 9, 10],
    lat: 39.0578,
    lng: 66.8342,
  },
  {
    slug: "fergana-valley",
    name: L("Fergana Valley", "Fargʻona vodiysi", "Ферганская долина"),
    tagline: L(
      "Silk, ceramics and orchards in Uzbekistan's craft heartland",
      "Oʻzbekiston hunarmandchilik markazida ipak, kulolchilik va bogʻlar",
      "Шёлк, керамика и сады в ремесленном сердце Узбекистана",
    ),
    overview: L(
      "Ringed by mountains, the fertile Fergana Valley is the most populous region of Uzbekistan and home to its strongest craft traditions. Watch ikat silk being dyed and woven in Margilan, throw a pot with the blue-glaze masters of Rishtan, and visit the Khudayar Khan palace in Kokand.",
      "Togʻlar bilan oʻralgan unumdor Fargʻona vodiysi Oʻzbekistonning eng koʻp aholi yashaydigan hududi va eng kuchli hunarmandchilik anʼanalari vatani. Margʻilonda adras va atlas boʻyalishi va toʻqilishini koʻring, Rishtonning moviy sir ustalari bilan kulolchilik qiling, Qoʻqondagi Xudoyorxon saroyiga tashrif buyuring.",
      "Окружённая горами плодородная Ферганская долина — самый населённый регион Узбекистана и родина сильнейших ремесленных традиций. Посмотрите, как красят и ткут икатный шёлк в Маргилане, поработайте на гончарном круге с мастерами голубой глазури в Риштане и посетите дворец Худояр-хана в Коканде.",
    ),
    attractions: [
      a(L("Yodgorlik Silk Factory, Margilan", "Margʻilon «Yodgorlik» ipak fabrikasi", "Шёлковая фабрика «Ёдгорлик», Маргилан"), L("Every stage of hand-made silk, from cocoon to ikat fabric.", "Qoʻlda ipak tayyorlashning har bir bosqichi — pilladan atlasgacha.", "Все этапы ручного шёлка — от кокона до икатной ткани."), 40.4717, 71.7247),
      a(L("Rishtan Ceramics Workshops", "Rishton kulolchilik ustaxonalari", "Керамические мастерские Риштана"), L("Family workshops famous for their ishkor blue glaze.", "Ishqor moviy siri bilan mashhur oilaviy ustaxonalar.", "Семейные мастерские, знаменитые глазурью «ишкор»."), 40.3567, 71.2847),
      a(L("Khudayar Khan Palace, Kokand", "Qoʻqondagi Xudoyorxon saroyi", "Дворец Худояр-хана, Коканд"), L("The tiled 19th-century palace of the last Kokand khans.", "Soʻnggi Qoʻqon xonlarining koshinli XIX asr saroyi.", "Изразцовый дворец XIX века последних кокандских ханов."), 40.5286, 70.9425),
      a(L("Kumtepa Bazaar", "Qumtepa bozori", "Базар Кумтепа"), L("A traditional market near Margilan on Thursdays and Sundays.", "Margʻilon yaqinidagi payshanba va yakshanba kunlari ishlaydigan anʼanaviy bozor.", "Традиционный базар у Маргилана по четвергам и воскресеньям."), 40.4436, 71.6981),
    ],
    bestTime: L(
      "April–June for blossom and fresh fruit, September–October for harvest.",
      "Aprel–iyun — gullash va yangi mevalar, sentabr–oktabr — hosil fasli.",
      "Апрель–июнь — цветение и свежие фрукты, сентябрь–октябрь — урожай.",
    ),
    bestMonths: [4, 5, 6, 9, 10],
    lat: 40.3842,
    lng: 71.7843,
  },
  {
    slug: "zaamin",
    name: L("Zaamin", "Zomin", "Зомин (Заамин)"),
    tagline: L(
      "Juniper forests and alpine meadows in the mountains of Jizzakh",
      "Jizzax togʻlaridagi archazorlar va alp oʻtloqlari",
      "Арчовые леса и альпийские луга в горах Джизака",
    ),
    overview: L(
      "In the Turkestan Range south of Jizzakh, Zaamin National Park protects old juniper (archa) forests, clear streams and high meadows. It is Uzbekistan's favourite summer escape from the heat, with resort hotels for families and trails for walkers. Higher up, the Suffa plateau holds the unfinished Soviet-era radio telescope.",
      "Jizzaxdan janubdagi Turkiston tizmasida joylashgan Zomin milliy bogʻi qadimiy archazorlar, tiniq soylar va baland oʻtloqlarni muhofaza qiladi. Bu jaziramadan qochish uchun Oʻzbekistonning eng sevimli yozgi maskani: oilalar uchun dam olish maskanlari va piyodalar uchun soʻqmoqlar bor. Yuqorida, Suffa platosida sovet davridan qolgan qurilishi tugallanmagan radioteleskop joylashgan.",
      "В Туркестанском хребте к югу от Джизака Зааминский национальный парк охраняет старые арчовые леса, чистые ручьи и высокогорные луга. Это любимое летнее место отдыха от жары: курортные отели для семей и тропы для походов. Выше, на плато Суффа, стоит недостроенный радиотелескоп советской эпохи.",
    ),
    attractions: [
      a(L("Zaamin National Park", "Zomin milliy bogʻi", "Зааминский национальный парк"), L("Juniper forests, mountain rivers and wildlife on marked trails.", "Belgilangan soʻqmoqlarda archazorlar, togʻ daryolari va yovvoyi tabiat.", "Арчовые леса, горные реки и дикая природа на маркированных тропах."), 39.66, 68.45),
      a(L("Suffa Plateau", "Suffa platosi", "Плато Суффа"), L("High meadows at about 2,400 m and the giant unfinished RT-70 radio telescope.", "Taxminan 2 400 m balandlikdagi oʻtloqlar va ulkan tugallanmagan RT-70 radioteleskopi.", "Высокогорные луга на высоте около 2 400 м и гигантский недостроенный радиотелескоп РТ-70."), 39.6247, 68.4472),
      a(L("Zaamin resort area", "Zomin dam olish hududi", "Курортная зона Зомина"), L("Family hotels and sanatoriums in the cool mountain air.", "Salqin togʻ havosidagi oilaviy mehmonxonalar va sanatoriylar.", "Семейные отели и санатории в прохладном горном воздухе."), 39.71, 68.42),
    ],
    bestTime: L(
      "Late May to September. Summer days are pleasantly cool; snow closes high trails in winter.",
      "May oxiridan sentabrgacha. Yozda kunlar yoqimli salqin; qishda baland soʻqmoqlar qor bilan yopiladi.",
      "С конца мая по сентябрь. Летом приятно прохладно; зимой высокие тропы закрыты снегом.",
    ),
    bestMonths: [5, 6, 7, 8, 9],
    lat: 39.75,
    lng: 68.42,
  },
  {
    slug: "chimgan-charvak",
    name: L("Chimgan & Charvak", "Chimyon va Chorvoq", "Чимган и Чарвак"),
    tagline: L(
      "Mountains and a turquoise lake one hour from Tashkent",
      "Toshkentdan bir soatlik masofadagi togʻlar va feruza koʻl",
      "Горы и бирюзовое озеро в часе езды от Ташкента",
    ),
    overview: L(
      "The Western Tian Shan foothills of the Ugam-Chatkal National Park rise just east of Tashkent. Charvak Reservoir is the summer place for swimming and boating, while Chimgan and Amirsoy offer skiing in winter and hiking, paragliding and horse riding the rest of the year. Big Chimgan (3,309 m) is a classic one-day ascent.",
      "Gʻarbiy Tyan-Shan etaklaridagi Ugom-Chotqol milliy bogʻi Toshkentning sharqida boshlanadi. Chorvoq suv ombori yozda choʻmilish va qayiqda sayr qilish joyi, Chimyon va Amirsoyda esa qishda changʼi, yilning qolgan qismida piyoda sayr, paraplan va ot minish mumkin. Katta Chimyon (3 309 m) — bir kunlik klassik yurish.",
      "Предгорья Западного Тянь-Шаня в Угам-Чаткальском национальном парке начинаются сразу к востоку от Ташкента. Чарвакское водохранилище — летнее место для купания и прогулок на лодках, а Чимган и Амирсой — это лыжи зимой и походы, параплан и конные прогулки в остальное время. Большой Чимган (3 309 м) — классическое однодневное восхождение.",
    ),
    attractions: [
      a(L("Charvak Reservoir", "Chorvoq suv ombori", "Чарвакское водохранилище"), L("A turquoise mountain lake with beaches, resorts and boat trips.", "Plyajlar, dam olish maskanlari va qayiq sayrlari bor feruza togʻ koʻli.", "Бирюзовое горное озеро с пляжами, базами отдыха и прогулками на лодках."), 41.6214, 69.9556),
      a(L("Big Chimgan", "Katta Chimyon", "Большой Чимган"), L("The 3,309 m summit above the valley — a demanding but non-technical climb.", "Vodiy uzra 3 309 m choʻqqi — qiyin, lekin texnik boʻlmagan yurish.", "Вершина 3 309 м над долиной — сложное, но нетехничное восхождение."), 41.5167, 70.0667),
      a(L("Amirsoy Mountain Resort", "Amirsoy togʻ kurorti", "Горный курорт Амирсой"), L("Modern ski slopes and gondola, with summer hiking and dining.", "Zamonaviy changʼi trassalari va gondola, yozda piyoda sayr va restoranlar.", "Современные трассы и гондола, летом — пешие маршруты и рестораны."), 41.5167, 70.0),
      a(L("Beldersay", "Beldersoy", "Бельдерсай"), L("A long chairlift to the Kumbel ridge with views over the range.", "Qumbel tizmasigacha uzun kanat yoʻli, togʻlar manzarasi.", "Длинная канатная дорога на хребет Кумбель с видами на горы."), 41.5492, 70.0336),
    ],
    bestTime: L(
      "June–September for lake and hiking, December–March for skiing. Weekends are busy with Tashkent visitors.",
      "Koʻl va piyoda sayr uchun iyun–sentabr, changʼi uchun dekabr–mart. Dam olish kunlari toshkentliklar bilan gavjum.",
      "Июнь–сентябрь — озеро и походы, декабрь–март — лыжи. По выходным многолюдно.",
    ),
    bestMonths: [1, 2, 6, 7, 8, 9],
    lat: 41.58,
    lng: 70.0,
  },
  {
    slug: "karakalpakstan-aral",
    name: L("Karakalpakstan & Aral Sea", "Qoraqalpogʻiston va Orol dengizi", "Каракалпакстан и Аральское море"),
    tagline: L(
      "Desert fortresses, yurt camps and the vanishing Aral Sea",
      "Choʻl qalʼalari, oʻtovlar lagerlari va qurib borayotgan Orol dengizi",
      "Крепости пустыни, юртовые лагеря и исчезающее Аральское море",
    ),
    overview: L(
      "Uzbekistan's far west is a land of big skies. Dozens of clay fortresses of Ancient Khorezm stand in the Kyzylkum desert, with a yurt camp below Ayaz-Kala. In Nukus, the Savitsky Museum holds a world-famous collection of Soviet avant-garde art. Further north, the ship cemetery of Moynaq and the Ustyurt plateau tell the story of the Aral Sea.",
      "Oʻzbekistonning uzoq gʻarbi — keng osmon oʻlkasi. Qizilqum choʻlida qadimgi Xorazmning oʻnlab loy qalʼalari turibdi, Ayozqalʼa etagida esa oʻtovlar lageri bor. Nukusdagi Savitskiy muzeyida sovet avangard sanʼatining dunyoga mashhur toʻplami saqlanadi. Shimolroqda Moʻynoqdagi kemalar qabristoni va Ustyurt platosi Orol dengizi tarixini hikoya qiladi.",
      "Крайний запад Узбекистана — край огромного неба. В пустыне Кызылкум стоят десятки глиняных крепостей Древнего Хорезма, а у подножия Аяз-Калы раскинулся юртовый лагерь. В Нукусе музей Савицкого хранит всемирно известную коллекцию советского авангарда. Севернее кладбище кораблей в Муйнаке и плато Устюрт рассказывают историю Аральского моря.",
    ),
    attractions: [
      a(L("Ayaz-Kala & yurt camp", "Ayozqalʼa va oʻtovlar lageri", "Аяз-Кала и юртовый лагерь"), L("Hilltop fortress ruins with a yurt camp and desert sunsets.", "Tepalikdagi qalʼa xarobalari, oʻtovlar lageri va choʻldagi quyosh botishi.", "Руины крепости на холме, юртовый лагерь и закаты в пустыне."), 42.3167, 61.0),
      a(L("Savitsky Museum, Nukus", "Nukusdagi Savitskiy muzeyi", "Музей Савицкого, Нукус"), L("Tens of thousands of works, including banned Soviet avant-garde art.", "Oʻn minglab asarlar, jumladan taqiqlangan sovet avangard sanʼati.", "Десятки тысяч работ, включая запрещённый советский авангард."), 42.4619, 59.6125),
      a(L("Moynaq Ship Cemetery", "Moʻynoq kemalar qabristoni", "Кладбище кораблей Муйнака"), L("Rusting fishing boats on the former seabed of the Aral.", "Orolning sobiq tubida zanglab yotgan baliqchi kemalari.", "Ржавеющие рыболовецкие суда на бывшем дне Арала."), 43.7683, 58.9886),
      a(L("Ustyurt Plateau & Aral shore", "Ustyurt platosi va Orol qirgʻogʻi", "Плато Устюрт и берег Арала"), L("Cliffs, canyons and a night by the remaining sea.", "Jarliklar, kanyonlar va qolgan dengiz boʻyida tun.", "Чинки, каньоны и ночёвка у оставшейся части моря."), 44.4, 58.35),
    ],
    bestTime: L(
      "April–May and September–October. Midsummer is very hot and winter nights are freezing in the desert.",
      "Aprel–may va sentabr–oktabr. Yoz oʻrtasi juda issiq, qishda esa choʻlda tunlar sovuq.",
      "Апрель–май и сентябрь–октябрь. В разгар лета очень жарко, а зимой ночи в пустыне морозные.",
    ),
    bestMonths: [4, 5, 9, 10],
    lat: 42.46,
    lng: 59.61,
  },
];

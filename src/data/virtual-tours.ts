import type { Locale, LocalizedText } from "@/db/types";
import { localize } from "@/lib/localize";

/**
 * Virtual tours. Every 360° scene is a genuine full-sphere equirectangular panorama (2:1) from
 * Wikimedia Commons, resized to at most 4096×2048. Places without such a panorama get a photo tour
 * instead and are labelled as one. Author, licence and source are kept for every image and shown in the UI.
 */

export interface MediaCredit {
  author: string;
  license: string;
  licenseUrl: string;
  /** Commons file page. */
  source: string;
}

export interface TourHotspot {
  id: string;
  kind: "info" | "scene";
  pitch: number;
  yaw: number;
  label: LocalizedText;
  text?: LocalizedText;
  /** Scene hotspots: id of the scene to walk to. */
  target?: string;
}

export interface PanoramaScene {
  id: string;
  title: LocalizedText;
  caption: LocalizedText;
  /** Equirectangular panorama, full sphere, 2:1. */
  image: string;
  /** 16:9 still rendered from the panorama (thumbnails, cards, loading state). */
  thumb: string;
  yaw: number;
  pitch: number;
  hfov: number;
  lat: number;
  lng: number;
  credit: MediaCredit;
  hotspots: TourHotspot[];
}

export interface PhotoSlide {
  image: string;
  title: LocalizedText;
  caption: LocalizedText;
  credit: MediaCredit;
  lat?: number;
  lng?: number;
}

interface TourBase {
  slug: string;
  destinationSlug: string;
  /** City name used on compact cards. */
  place: LocalizedText;
  title: LocalizedText;
  intro: LocalizedText;
  /** Card / social image. */
  cover: string;
}
export interface PanoramaTour extends TourBase {
  mode: "360";
  /** Seamless 360° horizon strip for the drifting teaser band. */
  band: string;
  bandCredit: MediaCredit;
  scenes: PanoramaScene[];
  gallery: PhotoSlide[];
}
export interface PhotoTour extends TourBase {
  mode: "photo";
  gallery: PhotoSlide[];
}
export type VirtualTour = PanoramaTour | PhotoTour;

const L = (en: string, uz: string, ru: string): LocalizedText => ({ en, uz, ru });

const LICENSES: Record<string, string> = {
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
};
const commons = (file: string, author: string, license: string): MediaCredit => ({
  author,
  license,
  licenseUrl: LICENSES[license] ?? "https://commons.wikimedia.org/wiki/Commons:Licensing",
  source: `https://commons.wikimedia.org/wiki/File:${file}`,
});

// ── Photo tours (no genuine 360° panorama available) ────────────────────────

const khiva: PhotoTour = {
  slug: "khiva",
  destinationSlug: "khiva",
  place: L("Khiva", "Xiva", "Хива"),
  mode: "photo",
  cover: "/images/destinations/khiva/4.jpg",
  title: L("Khiva: inside Itchan Kala", "Xiva: Ichan qalʼa ichida", "Хива: внутри Ичан-Калы"),
  intro: L(
    "A photo walk through the walled inner town of Khiva — turquoise minarets, carved wooden columns and the warm clay walls that glow at sunrise.",
    "Xivaning devor bilan oʻralgan ichki shahri boʻylab fotosayr — feruza minoralar, oʻymakor yogʻoch ustunlar va tongda tovlanadigan loy devorlar.",
    "Фотопрогулка по окружённому стенами внутреннему городу Хивы — бирюзовые минареты, резные деревянные колонны и глиняные стены, которые светятся на рассвете.",
  ),
  gallery: [
    {
      image: "/images/destinations/khiva/4.jpg",
      title: L("Kalta Minor at dawn", "Tongda Kalta Minor", "Кальта-Минор на рассвете"),
      caption: L(
        "The unfinished “short minaret”, wrapped in glazed tiles, and the walls of Kunya Ark in the first light.",
        "Chala qolgan “kalta minora” sirlangan koshinlarda va Koʻhna Ark devorlari tongning ilk nurlarida.",
        "Недостроенный «короткий минарет» в глазурованной плитке и стены Куня-Арка в первых лучах солнца.",
      ),
      credit: commons("Kalta_Minor_and_Kukhna_Ark,_early_morning,_Khiva_(4933933629).jpg", "Fulvio Spada", "CC BY-SA 2.0"),
      lat: 41.3786,
      lng: 60.3589,
    },
    {
      image: "/images/destinations/khiva/hero.jpg",
      title: L("Muhammad Rahim Khan mausoleum", "Muhammad Rahimxon maqbarasi", "Мавзолей Мухаммад Рахим-хана"),
      caption: L(
        "Blue-and-white tilework of a 19th-century royal tomb in the heart of the old town.",
        "Eski shahar markazidagi XIX asr xon maqbarasining oq-koʻk koshinlari.",
        "Сине-белые изразцы ханской усыпальницы XIX века в самом сердце старого города.",
      ),
      credit: commons("Abulgazi_Muhammad_Rahim_Khan_1_Mausoleum_2.jpg", "Nassima Chahboun", "CC BY-SA 4.0"),
      lat: 41.3779,
      lng: 60.3613,
    },
    {
      image: "/images/destinations/khiva/1.jpg",
      title: L("Streets of Itchan Kala", "Ichan qalʼa koʻchalari", "Улочки Ичан-Калы"),
      caption: L(
        "Madrasas, domes and minarets packed inside one walled square kilometre — a UNESCO World Heritage site.",
        "Bir kvadrat kilometr devor ichida joylashgan madrasalar, gumbazlar va minoralar — YUNESKO merosi.",
        "Медресе, купола и минареты, собранные внутри одного квадратного километра стен, — объект Всемирного наследия ЮНЕСКО.",
      ),
      credit: commons("20230608_Khiva007.jpg", "Jean Housen", "CC BY-SA 4.0"),
      lat: 41.3781,
      lng: 60.3605,
    },
    {
      image: "/images/destinations/khiva/2.jpg",
      title: L("At the foot of Kalta Minor", "Kalta Minor etagida", "У подножия Кальта-Минора"),
      caption: L(
        "Up close the minaret is a mosaic of turquoise, cobalt and white bands — 14 metres across at the base.",
        "Yaqindan qaraganda minora feruza, koʻk va oq yoʻllardan iborat mozaika — asosining diametri 14 metr.",
        "Вблизи минарет — мозаика бирюзовых, кобальтовых и белых поясов; диаметр основания — 14 метров.",
      ),
      credit: commons("At_the_Kalta_Minor.jpg", "Adam Harangozó", "CC BY-SA 4.0"),
      lat: 41.3786,
      lng: 60.3591,
    },
    {
      image: "/images/destinations/khiva/3.jpg",
      title: L("Old town walls", "Qadimiy shahar devorlari", "Стены старого города"),
      caption: L(
        "Ten-metre clay ramparts with rounded towers enclose the inner town; walk them at sunset for the best view.",
        "Oʻn metrli loy devorlar va dumaloq minoralar ichki shaharni oʻrab turadi; eng yaxshi manzara — quyosh botayotganda.",
        "Десятиметровые глиняные стены с круглыми башнями окружают внутренний город; лучший вид — на закате.",
      ),
      credit: commons("Jiva,_Itchan_Kala_15.jpg", "LBM1948", "CC BY-SA 4.0"),
      lat: 41.3772,
      lng: 60.3578,
    },
  ],
};

const shakhrisabz: PhotoTour = {
  slug: "shakhrisabz",
  destinationSlug: "shakhrisabz",
  place: L("Shakhrisabz", "Shahrisabz", "Шахрисабз"),
  mode: "photo",
  cover: "/images/destinations/shakhrisabz/hero.jpg",
  title: L("Shakhrisabz: Amir Timur’s home town", "Shahrisabz: Amir Temur vatani", "Шахрисабз: родина Амира Темура"),
  intro: L(
    "A photo walk through the green city where Amir Timur was born — from the giant portal of the Ak-Saray palace to the domes of Dorut Tilovat.",
    "Amir Temur tugʻilgan yashil shahar boʻylab fotosayr — Oqsaroy saroyining ulkan peshtoqidan Dorut Tilovat gumbazlarigacha.",
    "Фотопрогулка по зелёному городу, где родился Амир Темур, — от гигантского портала дворца Ак-Сарай до куполов Дорут-Тиловата.",
  ),
  gallery: [
    {
      image: "/images/destinations/shakhrisabz/hero.jpg",
      title: L("Ak-Saray palace portal", "Oqsaroy peshtoqi", "Портал дворца Ак-Сарай"),
      caption: L(
        "What remains of Timur’s “White Palace”: a 38-metre portal still covered in fine mosaic.",
        "Temurning “Oq saroyi”dan qolgan 38 metrli peshtoq hamon nafis mozaika bilan qoplangan.",
        "Всё, что осталось от «Белого дворца» Темура, — 38-метровый портал, до сих пор покрытый тонкой мозаикой.",
      ),
      credit: commons("Portico_of_Ak-Saray_Palace_-_Shakhrisabz_-_Uzbekistan_(7494239284).jpg", "Adam Jones", "CC BY-SA 2.0"),
      lat: 39.0605,
      lng: 66.8302,
    },
    {
      image: "/images/destinations/shakhrisabz/1.jpg",
      title: L("Dorut Tilovat ensemble", "Dorut Tilovat majmuasi", "Ансамбль Дорут-Тиловат"),
      caption: L(
        "The Kok Gumbaz mosque built by Ulugh Beg, next to the family tombs of the Timurids.",
        "Ulugʻbek qurdirgan Koʻk gumbaz masjidi va uning yonidagi temuriylar xonadoni maqbaralari.",
        "Мечеть Кок-Гумбаз, построенная Улугбеком, рядом с родовыми усыпальницами Тимуридов.",
      ),
      credit: commons("Ensemble_Dorout_Tilovat_(Shahrisabz)_(6018370667).jpg", "Jean-Pierre Dalbéra", "CC BY 2.0"),
      lat: 39.0498,
      lng: 66.8323,
    },
    {
      image: "/images/destinations/shakhrisabz/2.jpg",
      title: L("Domes of Dorut Tilovat", "Dorut Tilovat gumbazlari", "Купола Дорут-Тиловата"),
      caption: L(
        "Quiet courtyards and turquoise domes in the spiritual quarter of the city.",
        "Shaharning maʼnaviy mavzesidagi sokin hovlilar va feruza gumbazlar.",
        "Тихие дворики и бирюзовые купола в духовном квартале города.",
      ),
      credit: commons("Dorut_Tilovat_1.jpg", "Marat Nadjibaev", "CC BY-SA 4.0"),
      lat: 39.0496,
      lng: 66.8318,
    },
  ],
};

// ── Photo tours of Samarkand and Bukhara (Commons has no full-sphere panorama of their monuments) ──

const samarkand: PhotoTour = {
  slug: "samarkand",
  destinationSlug: "samarkand",
  mode: "photo",
  place: L("Samarkand", "Samarqand", "Самарканд"),
  cover: "/images/destinations/samarkand/hero.jpg",
  title: L("Samarkand: from the Registan to Gur-e-Amir", "Samarqand: Registondan Goʻri Amirgacha", "Самарканд: от Регистана до Гур-Эмира"),
  intro: L(
    "A photo walk through Amir Timur’s capital — the three madrasas of the Registan, the ribbed dome of Gur-e-Amir by day and by night, and Ulugh Beg’s observatory on the hill.",
    "Amir Temur poytaxti boʻylab fotosayr — Registondagi uchta madrasa, kunduzi va tunda Goʻri Amirning qovurgʻali gumbazi hamda tepalikdagi Ulugʻbek rasadxonasi.",
    "Фотопрогулка по столице Амира Темура — три медресе Регистана, ребристый купол Гур-Эмира днём и ночью и обсерватория Улугбека на холме.",
  ),
  gallery: [
    {
      image: "/images/destinations/samarkand/hero.jpg",
      title: L("The Registan", "Registon", "Регистан"),
      caption: L(
        "Ulugh Beg, Tilya-Kori and Sher-Dor madrasas face one square — the most famous view of the Silk Road.",
        "Ulugʻbek, Tillakori va Sherdor madrasalari bir maydonga qaragan — Buyuk ipak yoʻlining eng mashhur manzarasi.",
        "Медресе Улугбека, Тилля-Кари и Шер-Дор смотрят на одну площадь — самый знаменитый вид Великого шёлкового пути.",
      ),
      credit: commons("Registan_01.jpg", "Bernard Gagnon", "CC0"),
      lat: 39.6547,
      lng: 66.9758,
    },
    {
      image: "/images/destinations/samarkand/3.jpg",
      title: L("Morning on the square", "Maydonda tong", "Утро на площади"),
      caption: L(
        "Before the first visitors arrive, the marble of the Registan is swept by hand.",
        "Birinchi sayyohlar kelguncha Registon marmari qoʻlda supuriladi.",
        "Пока не пришли первые гости, мрамор Регистана подметают вручную.",
      ),
      credit: commons("20230615_Samarkand027.jpg", "Jean Housen", "CC BY-SA 4.0"),
      lat: 39.6549,
      lng: 66.9753,
    },
    {
      image: "/images/destinations/samarkand/1.jpg",
      title: L("Gur-e-Amir in the evening", "Kechki Goʻri Amir", "Вечерний Гур-Эмир"),
      caption: L(
        "The mausoleum of Amir Timur and his descendants, its turquoise dome lit after sunset.",
        "Amir Temur va uning avlodlari maqbarasi — quyosh botgach yoritilgan feruza gumbaz.",
        "Мавзолей Амира Темура и его потомков с бирюзовым куполом в вечерней подсветке.",
      ),
      credit: commons("Вечерний_Гур-Эмир.jpg", "Arina Pan", "CC BY-SA 4.0"),
      lat: 39.6485,
      lng: 66.969,
    },
    {
      image: "/images/destinations/samarkand/4.jpg",
      title: L("Old town at night", "Tungi eski shahar", "Старый город ночью"),
      caption: L(
        "Gur-e-Amir glows above the rooftops of the old quarter — worth a late walk after dinner.",
        "Goʻri Amir eski mahalla tomlari uzra porlaydi — kechki ovqatdan keyin sayr qilishga arziydi.",
        "Гур-Эмир светится над крышами старого квартала — ради этого стоит прогуляться после ужина.",
      ),
      credit: commons("Гур-Эмир_-_Amir_Temur_maqbarasi_-_Gur-e-Amir_(By_Khusen_Rustamov).jpg", "Khusen Rustamov", "CC BY-SA 4.0"),
      lat: 39.6489,
      lng: 66.9683,
    },
    {
      image: "/images/destinations/samarkand/2.jpg",
      title: L("Ulugh Beg Observatory", "Ulugʻbek rasadxonasi", "Обсерватория Улугбека"),
      caption: L(
        "The arc of a giant 15th-century sextant, where Ulugh Beg measured the length of the year.",
        "XV asrdagi ulkan sekstant yoyi — Ulugʻbek shu yerda yil uzunligini oʻlchagan.",
        "Дуга гигантского секстанта XV века, с помощью которого Улугбек измерил длину года.",
      ),
      credit: commons("Обсерватория_Улугбека,_Самарканд_(Ulugh_Beg_Observatory,_Samarkand).jpg", "Petar Milošević", "CC BY-SA 4.0"),
      lat: 39.6747,
      lng: 67.0058,
    },
  ],
};

const bukhara: PhotoTour = {
  slug: "bukhara",
  destinationSlug: "bukhara",
  mode: "photo",
  place: L("Bukhara", "Buxoro", "Бухара"),
  cover: "/images/destinations/bukhara/2.jpg",
  title: L("Bukhara: around Po-i-Kalyan", "Buxoro: Poyi Kalon atrofida", "Бухара: вокруг Пои-Калян"),
  intro: L(
    "A photo walk through the holy city — the Kalyan minaret that Genghis Khan spared, the mosque courtyard beneath it and the four turquoise towers of Chor Minor.",
    "Muqaddas shahar boʻylab fotosayr — Chingizxon ham tegmagan Kalon minorasi, uning ostidagi masjid hovlisi va Chor Minorning toʻrt feruza minorasi.",
    "Фотопрогулка по священному городу — минарет Калян, который пощадил Чингисхан, мечетный двор у его подножия и четыре бирюзовые башни Чор-Минора.",
  ),
  gallery: [
    {
      image: "/images/destinations/bukhara/2.jpg",
      title: L("Po-i-Kalyan from above", "Poyi Kalon yuqoridan", "Пои-Калян сверху"),
      caption: L(
        "The Kalyan mosque, the minaret and the Mir-i-Arab madrasa form the heart of old Bukhara.",
        "Kalon masjidi, minora va Mir Arab madrasasi eski Buxoroning qalbini tashkil etadi.",
        "Мечеть Калян, минарет и медресе Мири-Араб — сердце старой Бухары.",
      ),
      credit: commons("Kalon-Ensemble_Buchara.jpg", "Euyasik", "CC BY-SA 3.0"),
      lat: 39.7759,
      lng: 64.4146,
    },
    {
      image: "/images/destinations/bukhara/1.jpg",
      title: L("Domes of Mir-i-Arab", "Mir Arab gumbazlari", "Купола Мири-Араб"),
      caption: L(
        "Twin turquoise domes beside the 46-metre Kalyan minaret, built in 1127.",
        "1127-yilda qurilgan 46 metrli Kalon minorasi yonidagi egizak feruza gumbazlar.",
        "Два бирюзовых купола рядом с 46-метровым минаретом Калян, построенным в 1127 году.",
      ),
      credit: commons("Bujará,_Po-i-Kalyan_01.jpg", "LBM1948", "CC BY-SA 4.0"),
      lat: 39.7761,
      lng: 64.4152,
    },
    {
      image: "/images/destinations/bukhara/4.jpg",
      title: L("Kalyan mosque courtyard", "Kalon masjidi hovlisi", "Двор мечети Калян"),
      caption: L(
        "Arcades around a courtyard big enough for ten thousand worshippers.",
        "Oʻn ming namozxonni sigʻdira oladigan hovli atrofidagi ravoqlar.",
        "Аркады вокруг двора, вмещающего десять тысяч молящихся.",
      ),
      credit: commons("Po-i-Kalyan_Courtyard.jpg", "RK", "CC BY-SA 4.0"),
      lat: 39.7756,
      lng: 64.4141,
    },
    {
      image: "/images/destinations/bukhara/3.jpg",
      title: L("Brickwork of the minaret", "Minoraning gʻisht naqshlari", "Кирпичный узор минарета"),
      caption: L(
        "Fourteen bands of patterned brick and a line of Kufic script wrap the tower.",
        "Minorani oʻn toʻrt qator naqshinkor gʻisht va kufiy yozuv oʻrab turadi.",
        "Башню опоясывают четырнадцать поясов узорной кладки и строка куфического письма.",
      ),
      credit: commons("Kalyan_minaret_details.jpg", "Nassima Chahboun", "CC BY-SA 4.0"),
      lat: 39.7757,
      lng: 64.4146,
    },
    {
      image: "/images/destinations/bukhara/hero.jpg",
      title: L("Chor Minor", "Chor Minor", "Чор-Минор"),
      caption: L(
        "A gatehouse with four turquoise-domed towers, hidden in a quiet residential lane.",
        "Sokin mahalla koʻchasida yashiringan, toʻrtta feruza gumbazli minorasi bor darvozaxona.",
        "Надвратное здание с четырьмя бирюзовыми башенками в тихом жилом переулке.",
      ),
      credit: commons("Бухара,_медресе_Чор_Минор_(1).jpg", "ElenaLitera", "CC BY-SA 4.0"),
      lat: 39.7783,
      lng: 64.4255,
    },
  ],
};

// ── 360° tours: genuine full-sphere panoramas ────────────────────────────────

const tashkent: PanoramaTour = {
  slug: "tashkent",
  destinationSlug: "tashkent",
  mode: "360",
  place: L("Tashkent", "Toshkent", "Ташкент"),
  cover: "/virtual/tashkent/museum-square-still.jpg",
  band: "/virtual/tashkent/band.jpg",
  bandCredit: commons("360_panorama_near_State_Museum_of_History_of_Uzbekistan.jpg", "Aleksey Chalabyan (Xelgen)", "CC BY-SA 4.0"),
  title: L("Tashkent: the museum quarter in 360°", "Toshkent: muzey mavzesi 360° da", "Ташкент: музейный квартал в 360°"),
  intro: L(
    "Stand on the square in front of the State Museum of History of Uzbekistan, then step inside its main hall — two full-sphere panoramas from the heart of the capital, plus photos of the metro, Chorsu bazaar and the new Minor mosque.",
    "Oʻzbekiston tarixi davlat muzeyi oldidagi maydonda turing, soʻng uning asosiy zaliga kiring — poytaxt markazidan ikkita toʻliq sferik panorama hamda metro, Chorsu bozori va yangi Minor masjidi suratlari.",
    "Встаньте на площади перед Государственным музеем истории Узбекистана, а затем войдите в его главный зал — две полные сферические панорамы из центра столицы и фотографии метро, базара Чорсу и новой мечети Минор.",
  ),
  scenes: [
    {
      id: "museum-square",
      title: L("Museum square", "Muzey maydoni", "Площадь у музея"),
      caption: L(
        "Shaded lawns and patterned paving in front of the State Museum of History of Uzbekistan.",
        "Oʻzbekiston tarixi davlat muzeyi oldidagi soyali maysazorlar va naqshli yoʻlaklar.",
        "Тенистые газоны и узорная плитка перед Государственным музеем истории Узбекистана.",
      ),
      image: "/virtual/tashkent/museum-square.jpg",
      thumb: "/virtual/tashkent/museum-square-still.jpg",
      yaw: -61,
      pitch: 4,
      hfov: 100,
      lat: 41.3122,
      lng: 69.2696,
      credit: commons("360_panorama_near_State_Museum_of_History_of_Uzbekistan.jpg", "Aleksey Chalabyan (Xelgen)", "CC BY-SA 4.0"),
      hotspots: [
        {
          id: "museum",
          kind: "info",
          yaw: -61,
          pitch: 12,
          label: L("State Museum of History", "Tarix davlat muzeyi", "Музей истории"),
          text: L(
            "Founded in 1876, it is one of the oldest museums in Central Asia. Its halls follow the land from the Stone Age through the Silk Road cities to independence.",
            "1876-yilda tashkil etilgan, Markaziy Osiyodagi eng qadimiy muzeylardan biri. Zallari bu yerlar tarixini tosh davridan Ipak yoʻli shaharlari orqali mustaqillikkacha hikoya qiladi.",
            "Основан в 1876 году — один из старейших музеев Центральной Азии. Его залы ведут от каменного века через города Шёлкового пути к независимости.",
          ),
        },
        {
          id: "to-hall",
          kind: "scene",
          yaw: -61,
          pitch: -5,
          target: "museum-hall",
          label: L("Main hall", "Asosiy zal", "Главный зал"),
        },
        {
          id: "garden-city",
          kind: "info",
          yaw: 45,
          pitch: 6,
          label: L("A city of gardens", "Bogʻlar shahri", "Город садов"),
          text: L(
            "Plane trees, willows and lawns line the centre of Tashkent, rebuilt after the 1966 earthquake as one of the greenest capitals of the region.",
            "Toshkent markazini chinorlar, majnuntollar va maysazorlar bezaydi — 1966-yilgi zilziladan keyin shahar mintaqaning eng yashil poytaxtlaridan biri sifatida qayta qurilgan.",
            "Платаны, ивы и газоны окружают центр Ташкента, отстроенного после землетрясения 1966 года одной из самых зелёных столиц региона.",
          ),
        },
      ],
    },
    {
      id: "museum-hall",
      title: L("Inside the main hall", "Asosiy zal ichida", "В главном зале"),
      caption: L(
        "From the gallery you look down on showcases of archaeology, carved wood and ancient ceramics.",
        "Galereyadan arxeologiya, oʻymakor yogʻoch va qadimiy sopol buyumlar vitrinalariga qaraysiz.",
        "С галереи открывается вид на витрины с археологией, резным деревом и древней керамикой.",
      ),
      image: "/virtual/tashkent/museum-hall.jpg",
      thumb: "/virtual/tashkent/museum-hall-still.jpg",
      yaw: -40,
      pitch: -14,
      hfov: 105,
      lat: 41.3118,
      lng: 69.2693,
      credit: commons("360_panorama_inside_State_Museum_of_History_of_Uzbekistan.jpg", "Aleksey Chalabyan (Xelgen)", "CC BY-SA 4.0"),
      hotspots: [
        {
          id: "column",
          kind: "info",
          yaw: -46,
          pitch: -20,
          label: L("Carved wooden column", "Oʻymakor yogʻoch ustun", "Резная деревянная колонна"),
          text: L(
            "Columns like this hold up the shaded terraces (ayvans) of mosques and houses in Khiva and Bukhara, carved by hand with vines and rosettes.",
            "Bunday ustunlar Xiva va Buxorodagi masjid va uylarning ayvonlarini koʻtarib turadi; ular tok novdalari va gullar bilan qoʻlda oʻyib bezatilgan.",
            "Такие колонны держат тенистые айваны мечетей и домов Хивы и Бухары; их вручную покрывают резьбой из лоз и розеток.",
          ),
        },
        {
          id: "treasures",
          kind: "info",
          yaw: -22,
          pitch: -24,
          label: L("Silk Road treasures", "Ipak yoʻli xazinalari", "Сокровища Шёлкового пути"),
          text: L(
            "Ceramics, coins and jewellery from the ancient cities of Sogdiana, Bactria and Khorezm that traded along the caravan routes.",
            "Karvon yoʻllari boʻylab savdo qilgan qadimiy Sugʻd, Baqtriya va Xorazm shaharlaridan topilgan sopol, tanga va zargarlik buyumlari.",
            "Керамика, монеты и украшения из древних городов Согда, Бактрии и Хорезма, торговавших на караванных путях.",
          ),
        },
        {
          id: "staircase",
          kind: "info",
          yaw: 140,
          pitch: 8,
          label: L("Grand staircase", "Katta zinapoya", "Парадная лестница"),
          text: L(
            "A painted landscape crowns the marble staircase that leads visitors up to the exhibition floors.",
            "Koʻrgazma qavatlariga olib chiqadigan marmar zinapoya tepasida manzara tasvirlangan devoriy surat bor.",
            "Мраморную лестницу, ведущую к экспозиционным этажам, венчает живописный пейзаж.",
          ),
        },
        {
          id: "to-square",
          kind: "scene",
          yaw: 140,
          pitch: -24,
          target: "museum-square",
          label: L("Museum square", "Muzey maydoni", "Площадь у музея"),
        },
      ],
    },
  ],
  gallery: [
    {
      image: "/images/destinations/tashkent/hero.jpg",
      title: L("Minor mosque", "Minor masjidi", "Мечеть Минор"),
      caption: L("The white marble mosque on the Ankhor canal.", "Anhor boʻyidagi oq marmar masjid.", "Белая мраморная мечеть на канале Анхор."),
      credit: commons("Minor_Mosque_Tashkent.jpg", "Yuriy Pavlovich", "CC0"),
    },
    {
      image: "/images/destinations/tashkent/1.jpg",
      title: L("Milliy Bogʻ metro station", "Milliy bogʻ metro bekati", "Станция метро «Миллий бог»"),
      caption: L("Marble halls of the Tashkent metro.", "Toshkent metrosining marmar zallari.", "Мраморные залы ташкентского метро."),
      credit: commons("Milliy_bogʻ_metro_bekati_13.jpg", "Alpasli", "CC0"),
    },
    {
      image: "/images/destinations/tashkent/2.jpg",
      title: L("Chorsu bazaar", "Chorsu bozori", "Базар Чорсу"),
      caption: L("Radishes, greens and spices under the great dome.", "Katta gumbaz ostida turp, koʻkat va ziravorlar.", "Редис, зелень и специи под большим куполом."),
      credit: commons("086_Eski_Juva_Bozori,_mercat_de_Chorsu_(Taixkent),_raves.jpg", "Enric", "CC BY 4.0"),
    },
    {
      image: "/images/destinations/tashkent/3.jpg",
      title: L("Tashkent TV Tower", "Toshkent teleminorasi", "Ташкентская телебашня"),
      caption: L("Inside the 375-metre tower.", "375 metrli minora ichida.", "Внутри 375-метровой башни."),
      credit: commons("Tashkent_TV_Tower_179.jpg", "BeshevI", "CC BY-SA 4.0"),
    },
  ],
};

const tashkentMountains: PanoramaTour = {
  slug: "tashkent-mountains",
  destinationSlug: "chimgan-charvak",
  mode: "360",
  place: L("Chatkal foothills", "Chotqol etaklari", "Предгорья Чаткала"),
  cover: "/virtual/tashkent-mountains/chatkal-ridge-still.jpg",
  band: "/virtual/tashkent-mountains/band.jpg",
  bandCredit: commons("Голубой_огонёк_-_panoramio_(9).jpg", "Rustam Sulaymanov", "CC BY-SA 3.0"),
  title: L("Chatkal foothills in 360°", "Chotqol etaklari 360° da", "Предгорья Чаткала в 360°"),
  intro: L(
    "An hour from the capital the city gives way to the golden foothills of the western Tian Shan. Stand on a grassy ridge in the Chatkal foothills and turn a full circle: mountain ranges, a lone tree and the road to Chimgan and Charvak.",
    "Poytaxtdan bir soatlik yoʻlda shahar oʻrnini Gʻarbiy Tyan-Shanning oltinrang etaklari egallaydi. Chotqol etaklaridagi tizmada turib toʻliq aylaning: togʻ tizmalari, yolgʻiz daraxt va Chimyon hamda Chorvoqqa boradigan yoʻl.",
    "В часе езды от столицы город сменяют золотистые предгорья Западного Тянь-Шаня. Встаньте на травянистом хребте в предгорьях Чаткала и повернитесь на полный круг: горные хребты, одинокое дерево и дорога к Чимгану и Чарваку.",
  ),
  scenes: [
    {
      id: "chatkal-ridge",
      title: L("On the ridge", "Tizmada", "На хребте"),
      caption: L(
        "Dry grass, wind and a horizon of mountain ranges stretching towards Kyrgyzstan.",
        "Quruq oʻtlar, shamol va Qirgʻiziston tomon choʻzilgan togʻ tizmalari.",
        "Сухая трава, ветер и горизонт из горных хребтов, уходящих в сторону Киргизии.",
      ),
      image: "/virtual/tashkent-mountains/chatkal-ridge.jpg",
      thumb: "/virtual/tashkent-mountains/chatkal-ridge-still.jpg",
      yaw: -60,
      pitch: 3,
      hfov: 105,
      lat: 41.5713,
      lng: 69.8854,
      credit: commons("Голубой_огонёк_-_panoramio_(9).jpg", "Rustam Sulaymanov", "CC BY-SA 3.0"),
      hotspots: [
        {
          id: "ranges",
          kind: "info",
          yaw: -62,
          pitch: 9,
          label: L("Western Tian Shan", "Gʻarbiy Tyan-Shan", "Западный Тянь-Шань"),
          text: L(
            "Ridge after ridge of the Chatkal and Pskem ranges. In spring these slopes are green and covered in wild tulips.",
            "Chotqol va Piskom tizmalari qator-qator choʻziladi. Bahorda bu yonbagʻirlar yam-yashil boʻlib, yovvoyi lolalar bilan qoplanadi.",
            "Гряда за грядой — Чаткальский и Пскемский хребты. Весной эти склоны зелёные и покрыты дикими тюльпанами.",
          ),
        },
        {
          id: "park",
          kind: "info",
          yaw: 140,
          pitch: 4,
          label: L("Ugam-Chatkal National Park", "Ugom-Chotqol milliy bogʻi", "Угам-Чаткальский нацпарк"),
          text: L(
            "The park protects the western Tian Shan: juniper slopes, walnut groves, rivers and peaks above 3,000 metres — the classic weekend escape from Tashkent.",
            "Bogʻ Gʻarbiy Tyan-Shanni muhofaza qiladi: archazorlar, yongʻoqzorlar, daryolar va 3000 metrdan baland choʻqqilar — toshkentliklarning sevimli dam olish maskani.",
            "Парк охраняет Западный Тянь-Шань: арчовые склоны, ореховые рощи, реки и вершины выше 3000 метров — классический маршрут выходного дня из Ташкента.",
          ),
        },
      ],
    },
  ],
  gallery: [],
};

export const VIRTUAL_TOURS: VirtualTour[] = [tashkent, tashkentMountains, samarkand, bukhara, khiva, shakhrisabz];

export function getVirtualTour(slug: string): VirtualTour | undefined {
  return VIRTUAL_TOURS.find((t) => t.slug === slug);
}

export function panoramaTours(): PanoramaTour[] {
  return VIRTUAL_TOURS.filter((t): t is PanoramaTour => t.mode === "360");
}

/** Number of 360° scenes, or photos for a photo tour. */
export function stopCount(tour: VirtualTour): number {
  return tour.mode === "360" ? tour.scenes.length : tour.gallery.length;
}

export function tourPoints(tour: VirtualTour, locale: Locale) {
  const items = tour.mode === "360" ? tour.scenes : tour.gallery;
  return items
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.lat != null && s.lng != null)
    .map(({ s, i }) => ({ lat: s.lat!, lng: s.lng!, label: localize(s.title, locale), number: i + 1 }));
}

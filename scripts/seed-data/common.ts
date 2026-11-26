// Shared helpers and reusable list items for seed content.
// Uzbek uses the official Latin alphabet: oʻ / gʻ with U+02BB and the tutuq belgisi ʼ (U+02BC).

import type {
  AccommodationItem,
  BookingType,
  LocalizedText,
  Meal,
  RoutePoint,
  TransportItem,
} from "../../src/db/types.ts";

export const L = (en: string, uz: string, ru: string): LocalizedText => ({ en, uz, ru });

export interface SeedDay {
  title: LocalizedText;
  description: LocalizedText;
  meals: Meal[];
  overnight?: LocalizedText;
  distanceKm?: number;
  walkingHours?: number;
}

export const day = (
  title: LocalizedText,
  description: LocalizedText,
  meals: Meal[] = [],
  extra: Partial<Pick<SeedDay, "overnight" | "distanceKm" | "walkingHours">> = {},
): SeedDay => ({ title, description, meals, ...extra });

export interface SeedTier {
  bookingType: BookingType;
  minPax: number;
  maxPax: number;
  /** Major units (dollars, euros, so'm) for readability; converted to minor units by the SQL builder. */
  usd?: number;
  uzs?: number;
  eur?: number;
}

export const tier = (bookingType: BookingType, minPax: number, maxPax: number, prices: Omit<SeedTier, "bookingType" | "minPax" | "maxPax">): SeedTier => ({
  bookingType,
  minPax,
  maxPax,
  ...prices,
});

/** City coordinates used in tour routes. */
export const P = {
  tashkent: { lat: 41.2995, lng: 69.2401, label: L("Tashkent", "Toshkent", "Ташкент") },
  samarkand: { lat: 39.6542, lng: 66.9597, label: L("Samarkand", "Samarqand", "Самарканд") },
  bukhara: { lat: 39.7747, lng: 64.4286, label: L("Bukhara", "Buxoro", "Бухара") },
  khiva: { lat: 41.3783, lng: 60.3639, label: L("Khiva", "Xiva", "Хива") },
  urgench: { lat: 41.5506, lng: 60.6314, label: L("Urgench", "Urganch", "Ургенч") },
  shakhrisabz: { lat: 39.0578, lng: 66.8342, label: L("Shakhrisabz", "Shahrisabz", "Шахрисабз") },
  takhtakaracha: { lat: 39.2667, lng: 66.9, label: L("Takhtakaracha Pass", "Taxtaqoracha dovoni", "Перевал Тахтакарача") },
  jizzakh: { lat: 40.1158, lng: 67.8422, label: L("Jizzakh", "Jizzax", "Джизак") },
  zaamin: { lat: 39.9606, lng: 68.3958, label: L("Zaamin", "Zomin", "Зомин") },
  zaaminPark: { lat: 39.66, lng: 68.45, label: L("Zaamin National Park", "Zomin milliy bogʻi", "Зааминский нацпарк") },
  suffa: { lat: 39.6247, lng: 68.4472, label: L("Suffa Plateau", "Suffa platosi", "Плато Суффа") },
  chimgan: { lat: 41.5506, lng: 70.0156, label: L("Chimgan", "Chimyon", "Чимган") },
  bigChimgan: { lat: 41.5167, lng: 70.0667, label: L("Big Chimgan summit", "Katta Chimyon choʻqqisi", "Вершина Большого Чимгана") },
  charvak: { lat: 41.6214, lng: 69.9556, label: L("Charvak Reservoir", "Chorvoq suv ombori", "Чарвакское водохранилище") },
  amirsoy: { lat: 41.5167, lng: 70.0, label: L("Amirsoy", "Amirsoy", "Амирсой") },
  kokand: { lat: 40.5286, lng: 70.9425, label: L("Kokand", "Qoʻqon", "Коканд") },
  rishtan: { lat: 40.3567, lng: 71.2847, label: L("Rishtan", "Rishton", "Риштан") },
  margilan: { lat: 40.4717, lng: 71.7247, label: L("Margilan", "Margʻilon", "Маргилан") },
  fergana: { lat: 40.3842, lng: 71.7843, label: L("Fergana", "Fargʻona", "Фергана") },
  nukus: { lat: 42.46, lng: 59.61, label: L("Nukus", "Nukus", "Нукус") },
  moynaq: { lat: 43.7683, lng: 58.9886, label: L("Moynaq", "Moʻynoq", "Муйнак") },
  ustyurt: { lat: 44.25, lng: 58.4, label: L("Ustyurt Plateau", "Ustyurt platosi", "Плато Устюрт") },
  aralShore: { lat: 44.55, lng: 58.3, label: L("Aral Sea shore", "Orol dengizi qirgʻogʻi", "Берег Аральского моря") },
  ayazKala: { lat: 42.3167, lng: 61.0, label: L("Ayaz-Kala", "Ayozqalʼa", "Аяз-Кала") },
  toprakKala: { lat: 41.9267, lng: 60.8233, label: L("Toprak-Kala", "Tuproqqalʼa", "Топрак-Кала") },
} satisfies Record<string, Omit<RoutePoint, "day">>;

export const route = (...stops: [Omit<RoutePoint, "day">, number?][]): RoutePoint[] =>
  stops.map(([p, d]) => (d ? { ...p, day: d } : { ...p }));

// ── Included / excluded items ──────────────────────────────────────────────

export const INC = {
  guide: L("Licensed guide (English, Russian or Uzbek)", "Litsenziyali gid (ingliz, rus yoki oʻzbek tilida)", "Лицензированный гид (английский, русский или узбекский)"),
  privateCar: L("Private air-conditioned car or minivan with driver", "Haydovchi bilan konditsionerli shaxsiy avtomobil yoki miniven", "Частный автомобиль или минивэн с кондиционером и водителем"),
  hotels: L("Accommodation as listed (double or twin rooms)", "Dasturdagi mehmonxonalarda yashash (ikki kishilik xonalar)", "Проживание по программе (номера DBL/TWN)"),
  breakfast: L("Daily breakfast", "Har kuni nonushta", "Ежедневные завтраки"),
  entrances: L("Entrance tickets to all sites in the itinerary", "Dasturdagi barcha obyektlarga kirish chiptalari", "Входные билеты на все объекты программы"),
  afrosiyob: L("Afrosiyob high-speed train tickets (economy class)", "Afrosiyob tezyurar poyezdi chiptalari (ekonom)", "Билеты на скоростной поезд «Афросиёб» (эконом-класс)"),
  airport: L("Airport or railway station transfers", "Aeroport yoki vokzal transferlari", "Трансферы из/в аэропорт или вокзал"),
  water: L("Bottled water on travel days", "Yoʻl kunlarida ichimlik suvi", "Питьевая вода в дни переездов"),
  yurtStay: L("Yurt camp stay with dinner and breakfast", "Oʻtovlar lagerida yashash, kechki ovqat va nonushta", "Проживание в юртовом лагере с ужином и завтраком"),
  campfire: L("Evening campfire with folk music", "Gulxan atrofida xalq musiqasi kechasi", "Вечерний костёр с народной музыкой"),
  allMeals: L("All meals listed in the itinerary", "Dasturda koʻrsatilgan barcha ovqatlar", "Всё питание, указанное в программе"),
  jeep: L("4×4 vehicle with experienced desert driver", "Tajribali haydovchi bilan 4×4 avtomobil", "Внедорожник 4×4 с опытным водителем"),
  camping: L("Camping or yurt equipment and cook", "Lager jihozlari (chodir/oʻtov) va oshpaz", "Кемпинговое снаряжение/юрты и повар"),
  mountainGuide: L("Certified mountain guide", "Sertifikatlangan togʻ gidi", "Сертифицированный горный гид"),
  guesthouse: L("Guesthouse stay with home-cooked meals", "Mehmon uyida yashash va uy taomlari", "Проживание в гостевом доме с домашним питанием"),
  parkFees: L("National park entrance fees", "Milliy bogʻga kirish toʻlovi", "Входные сборы нацпарка"),
  bus: L("Comfortable coach with air conditioning", "Konditsionerli qulay avtobus", "Комфортабельный автобус с кондиционером"),
  escort: L("Tour leader throughout the trip", "Butun sayohat davomida guruh rahbari", "Руководитель группы на протяжении всей поездки"),
  lunch: L("Lunch on each tour day", "Har bir tur kuni tushlik", "Обед в каждый день тура"),
  masterclass: L("Hands-on masterclasses as listed", "Dasturdagi amaliy mahorat darslari", "Мастер-классы по программе"),
  tastings: L("Food tastings and cooking class as listed", "Dasturdagi taom tatib koʻrish va pazandalik darsi", "Дегустации и кулинарный мастер-класс по программе"),
  activities: L("Team-building programme with host and equipment", "Boshlovchi va jihozlar bilan team-building dasturi", "Тимбилдинг-программа с ведущим и инвентарём"),
  insurance: L("Accident insurance for the trip", "Sayohat davomida baxtsiz hodisalardan sugʻurta", "Страховка от несчастных случаев на время поездки"),
};

export const EXC = {
  flights: L("International flights", "Xalqaro aviareyslar", "Международные перелёты"),
  visa: L("Visa fees, if your nationality needs a visa", "Viza toʻlovlari (agar fuqaroligingiz uchun talab qilinsa)", "Визовые сборы (если требуются для вашего гражданства)"),
  meals: L("Lunches and dinners unless listed", "Koʻrsatilmagan tushlik va kechki ovqatlar", "Обеды и ужины, если не указаны в программе"),
  tips: L("Tips for guides and drivers", "Gid va haydovchilar uchun choychaqa", "Чаевые гидам и водителям"),
  photo: L("Camera fees at some monuments", "Ayrim yodgorliklarda foto/video toʻlovi", "Плата за фотосъёмку на некоторых объектах"),
  insurance: L("Travel insurance", "Sayohat sugʻurtasi", "Туристическая страховка"),
  personal: L("Personal expenses and souvenirs", "Shaxsiy xarajatlar va suvenirlar", "Личные расходы и сувениры"),
  singleRoom: L("Single room supplement", "Bir kishilik xona uchun qoʻshimcha toʻlov", "Доплата за одноместное размещение"),
  ski: L("Ski pass and equipment rental", "Ski-pass va jihozlar ijarasi", "Ски-пасс и прокат снаряжения"),
  alcohol: L("Alcoholic drinks", "Spirtli ichimliklar", "Алкогольные напитки"),
  domesticFlight: L("Domestic flight (quoted separately)", "Ichki aviareys (alohida hisoblanadi)", "Внутренний перелёт (рассчитывается отдельно)"),
};

// ── Accommodation & transport building blocks ─────────────────────────────

export const acc = (type: AccommodationItem["type"], name: LocalizedText, nights: number, tierText?: LocalizedText): AccommodationItem =>
  tierText ? { type, name, nights, tier: tierText } : { type, name, nights };

export const tr = (mode: TransportItem["mode"], description: LocalizedText): TransportItem => ({ mode, description });

/**
 * Starter catalogue of hotels, restaurants and transport options (places table, source = "seed").
 *
 * Honesty rules for this data (shown to the public):
 * - Hotels and restaurants are described as the TYPE of place we arrange in a given area
 *   ("Boutique courtyard hotel near Lyabi-Hauz"), not as named real businesses we have no contract with.
 * - Prices are indicative "from" prices in whole USD; availability and final prices are confirmed on request.
 * - Transport uses real routes and operators with typical durations; schedules are "typical", never live.
 * - Images are existing licensed photos from /public/images (credits in public/images/credits.json),
 *   chosen to show the area or the kind of food, never presented as a specific hotel's own rooms.
 */
import type { HotelDetails, LocalizedText, PlaceKind, RestaurantDetails, TransportDetails } from "../../src/db/types.ts";
import { L } from "./common.ts";

export interface SeedPlace {
  kind: PlaceKind;
  slug: string;
  destinationSlug: string | null;
  name: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  image: string | null;
  gallery?: string[];
  lat: number | null;
  lng: number | null;
  priceFromUsd: number | null;
  priceLevel: 1 | 2 | 3 | 4 | null;
  tags: string[];
  details: HotelDetails | RestaurantDetails | TransportDetails;
}

export const seedPlaces: SeedPlace[] = [
  {
    kind: "hotel",
    slug: "bukhara-boutique-courtyard-lyabi-hauz",
    destinationSlug: "bukhara",
    name: L("Boutique courtyard hotel near Lyabi-Hauz", "Labi Hovuz yonidagi hovlili butik mehmonxona", "Бутик-отель с двориком у Ляби-Хауза"),
    summary: L(
      "A family-run house with a tiled courtyard, a five-minute walk from the old trading domes.",
      "Savdo toqlariga besh daqiqalik masofada, koshinli hovlisi bor oilaviy mehmonxona.",
      "Семейный дом с изразцовым двориком в пяти минутах от торговых куполов.",
    ),
    description: L(
      "We book small boutique hotels in restored merchant houses around Lyabi-Hauz: carved wooden ceilings, breakfast in the courtyard and the old town on foot. The exact hotel is confirmed with your request.",
      "Labi Hovuz atrofidagi taʼmirlangan savdogar uylaridagi kichik butik mehmonxonalarni band qilamiz: oʻymakor yogʻoch shiftlar, hovlida nonushta va eski shahar piyoda masofada. Aniq mehmonxona soʻrovingiz bilan tasdiqlanadi.",
      "Мы бронируем небольшие бутик-отели в отреставрированных купеческих домах у Ляби-Хауза: резные деревянные потолки, завтрак во дворике и старый город пешком. Конкретный отель подтверждается по запросу.",
    ),
    image: "/images/destinations/bukhara/hero.jpg",
    lat: 39.7737,
    lng: 64.4198,
    priceFromUsd: 55,
    priceLevel: 2,
    tags: ["old-town", "family-run", "breakfast"],
    details: {
      area: L("Old town, Lyabi-Hauz", "Eski shahar, Labi Hovuz", "Старый город, Ляби-Хауз"),
      stars: 3,
      amenities: ["wifi", "breakfast", "air_conditioning", "courtyard", "airport_transfer"],
      roomTypes: [
        { name: L("Standard double", "Standart ikki kishilik", "Стандартный двухместный"), sleeps: 2, priceFromUsd: 55 },
        { name: L("Family room", "Oilaviy xona", "Семейный номер"), sleeps: 4, priceFromUsd: 85 },
      ],
      checkIn: "14:00",
      checkOut: "12:00",
    },
  },
  {
    kind: "restaurant",
    slug: "tashkent-plov-centre-lunch",
    destinationSlug: "tashkent",
    name: L("Plov centre lunch", "Osh markazida tushlik", "Обед в плов-центре"),
    summary: L(
      "Tashkent wedding-style plov cooked in giant cauldrons, served at lunchtime until it runs out.",
      "Katta qozonlarda pishirilgan toshkentcha toʻy oshi, tushlik paytida tugaguncha tortiladi.",
      "Ташкентский свадебный плов из огромных казанов, подают в обед, пока не закончится.",
    ),
    description: L(
      "Plov centres are the city's lunchtime institution: long tables, green tea, fresh non bread and achichuk salad. We include one in city tours or reserve a table for groups.",
      "Osh markazlari — shaharning tushlik anʼanasi: uzun stollar, koʻk choy, issiq non va achchiq-chuchuk salat. Shahar sayohatlariga qoʻshamiz yoki guruhlar uchun stol band qilamiz.",
      "Плов-центры — обеденная традиция города: длинные столы, зелёный чай, горячая лепёшка и салат аччик-чучук. Включаем в городские туры или бронируем стол для групп.",
    ),
    image: "/images/destinations/tashkent/2.jpg",
    lat: 41.3381,
    lng: 69.2869,
    priceFromUsd: 6,
    priceLevel: 1,
    tags: ["plov", "lunch", "local-favourite"],
    details: {
      area: L("Tashkent, near the TV tower", "Toshkent, teleminora yaqinida", "Ташкент, у телебашни"),
      cuisine: ["uzbek"],
      dietary: ["halal"],
      hours: L("Typically 11:00–15:00", "Odatda 11:00–15:00", "Обычно 11:00–15:00"),
      menu: [
        { name: L("Tashkent plov with quail egg", "Bedana tuxumli toshkent oshi", "Ташкентский плов с перепелиным яйцом"), priceUsd: 5 },
        { name: L("Achichuk salad", "Achchiq-chuchuk salat", "Салат аччик-чучук"), priceUsd: 1 },
      ],
    },
  },
  {
    kind: "transport",
    slug: "afrosiyob-tashkent-samarkand",
    destinationSlug: "samarkand",
    name: L("Afrosiyob high-speed train Tashkent – Samarkand", "Afrosiyob tezyurar poyezdi Toshkent – Samarqand", "Скоростной поезд «Афросиаб» Ташкент – Самарканд"),
    summary: L("About 2 h 10 min city centre to city centre.", "Shahar markazidan markazga taxminan 2 soat 10 daqiqa.", "Около 2 ч 10 мин из центра в центр."),
    description: L(
      "Uzbekistan Railways' high-speed Afrosiyob trains are the fastest way between Tashkent and Samarkand. Tickets sell out in spring and autumn, so we book them as soon as your dates are set.",
      "Oʻzbekiston temir yoʻllarining Afrosiyob tezyurar poyezdlari Toshkent va Samarqand orasidagi eng tez yoʻl. Bahor va kuzda chiptalar tez tugaydi, shuning uchun sanalaringiz aniqlanishi bilan band qilamiz.",
      "Скоростные поезда «Афросиаб» Узбекских железных дорог — самый быстрый путь между Ташкентом и Самаркандом. Весной и осенью билеты быстро заканчиваются, поэтому бронируем сразу после выбора дат.",
    ),
    image: "/images/destinations/samarkand/hero.jpg",
    lat: 41.2919,
    lng: 69.2873,
    priceFromUsd: 25,
    priceLevel: 2,
    tags: ["train", "high-speed"],
    details: {
      mode: "train",
      from: "Tashkent",
      to: "Samarkand",
      durationMin: 130,
      operator: "Uzbekistan Railways",
      scheduleNote: L(
        "Several departures daily; times change by season. Live times and seats: railway.uz.",
        "Kuniga bir necha marta; vaqtlar mavsumga qarab oʻzgaradi. Jonli vaqt va joylar: railway.uz.",
        "Несколько рейсов в день; время меняется по сезонам. Актуальное время и места: railway.uz.",
      ),
      classes: [
        { name: L("Economy", "Ekonom", "Эконом"), priceFromUsd: 25 },
        { name: L("Business", "Biznes", "Бизнес"), priceFromUsd: 40 },
      ],
    },
  },
];

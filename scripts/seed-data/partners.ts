/**
 * Partner profiles for the investor MVP (partners table, source = "sample").
 *
 * - Every business here is invented: the names, people, e-mail addresses (example.com / example.org) and
 *   phone numbers (+998 90 000 00 xx) do not belong to any real company, and no partnership, licence or
 *   award is implied. Cities and landmarks are real.
 * - Approved profiles are listed in the public partner directory (/partners); pending and rejected ones
 *   show the review workflow in the admin panel. The rows stay flagged internally as source = "sample".
 * - Services are stored as readable lines ("Double room — from $45 / night"), see src/lib/partners.ts.
 */
import type { PartnerStatus, PartnerType } from "../../src/db/types.ts";
import { formatService, type ServiceUnit } from "../../src/lib/partners.ts";

export interface SeedPartner {
  type: PartnerType;
  status: PartnerStatus;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string | null;
  destinationSlug: string | null;
  city: string;
  description: string;
  services: string[];
  locale: "en" | "uz" | "ru";
  /** Review note shown to the partner on their dashboard (pending / rejected examples). */
  adminNote?: string;
  /** Places (kind/slug) in scripts/seed-data/places.ts that this partner runs; sets places.partner_id. */
  placeSlugs?: string[];
}

const s = (name: string, priceFromUsd: number | null, unit: ServiceUnit | null = null) => formatService({ name, priceFromUsd, unit });
const phone = (n: number) => `+998 90 000 00 ${String(n).padStart(2, "0")}`;

export const samplePartners: SeedPartner[] = [
  {
    type: "hotel",
    status: "approved",
    businessName: "Mulberry Courtyard House",
    contactName: "Malika T.",
    email: "stay@mulberry-courtyard.example.com",
    phone: phone(1),
    website: "https://mulberry-courtyard.example.com",
    destinationSlug: "bukhara",
    city: "Bukhara",
    description:
      "Nine rooms around a tiled courtyard in a restored merchant house, a five-minute walk from Lyabi-Hauz and the trading domes. Breakfast is served under the vine trellis, and the family arranges old-town walks and evening folk shows on request.",
    services: [s("Standard double with breakfast", 55, "night"), s("Family room for four", 85, "night"), s("Airport or station pick-up", 12, "vehicle"), s("Courtyard dinner with plov", 14, "person")],
    locale: "en",
    placeSlugs: ["hotel/bukhara-boutique-courtyard-lyabi-hauz"],
  },
  {
    type: "hotel",
    status: "approved",
    businessName: "Lazurit Boutique Hotel",
    contactName: "Rustam A.",
    email: "reservations@lazurit-hotel.example.com",
    phone: phone(2),
    website: "https://lazurit-hotel.example.com",
    destinationSlug: "samarkand",
    city: "Samarkand",
    description:
      "A boutique hotel on a quiet lane five minutes from the Registan. Rooms are finished in lapis blue with hand-painted ceramics from local workshops, and the rooftop terrace looks out over the domes at sunset.",
    services: [s("Classic double", 95, "night"), s("Deluxe with balcony", 125, "night"), s("Family suite", 170, "night"), s("Rooftop breakfast", 8, "person")],
    locale: "en",
    placeSlugs: ["hotel/samarkand-lazurit-boutique-hotel"],
  },
  {
    type: "hotel",
    status: "approved",
    businessName: "Ichan Kala Clay House",
    contactName: "Bahodir Y.",
    email: "hello@clay-house-khiva.example.org",
    phone: phone(3),
    website: null,
    destinationSlug: "khiva",
    city: "Khiva",
    description:
      "A family guest house built in traditional mud-brick style just inside the western gate of Ichan Kala. Seven cool rooms, a shaded aivan terrace and a host family that has lived in the old town for four generations.",
    services: [s("Double room with breakfast", 45, "night"), s("Triple room", 60, "night"), s("Home-cooked shivit oshi dinner", 9, "person")],
    locale: "uz",
    placeSlugs: ["hotel/khiva-ichan-kala-clay-house"],
  },
  {
    type: "hotel",
    status: "pending",
    businessName: "Juniper Ridge Lodge",
    contactName: "Sardor N.",
    email: "juniper.ridge@example.com",
    phone: phone(4),
    website: null,
    destinationSlug: "zaamin",
    city: "Zaamin",
    description:
      "Wooden mountain lodge with six rooms near the juniper forests of the Zaamin national park. Hiking routes start at the door; meals are prepared with produce from the village.",
    services: [s("Lodge room with half board", 55, "night"), s("Guided day hike", 25, "person"), s("Horse riding", 15, "hour")],
    locale: "uz",
    adminNote: "Please add photos of the rooms and confirm the opening season (May–October?).",
  },
  {
    type: "restaurant",
    status: "approved",
    businessName: "Qozon Plov House",
    contactName: "Jasur K.",
    email: "table@qozon-plov.example.com",
    phone: phone(5),
    website: "https://qozon-plov.example.com",
    destinationSlug: "tashkent",
    city: "Tashkent",
    description:
      "An open kitchen built around three wood-fired kazans, serving Tashkent wedding-style plov at lunchtime until the cauldrons are empty, with tandoor samsa and seasonal salads. Groups can watch the plov being prepared from the start.",
    services: [s("Plov lunch set", 6, "person"), s("Group dinner with show cooking", 22, "person"), s("Private room for up to 20 guests", 120, "group")],
    locale: "en",
    placeSlugs: ["restaurant/tashkent-plov-centre-lunch"],
  },
  {
    type: "restaurant",
    status: "approved",
    businessName: "Seven Spice Tapchan",
    contactName: "Gulnora B.",
    email: "seven.spice@example.org",
    phone: phone(6),
    website: null,
    destinationSlug: "samarkand",
    city: "Samarkand",
    description:
      "Garden restaurant with traditional tapchan platforms under plane trees, ten minutes from Siab Bazaar. Samarkand-style plov, shashlik over vine wood and a vegetarian menu built around the bazaar's seasonal vegetables.",
    services: [s("Samarkand plov set", 8, "person"), s("Shashlik dinner", 14, "person"), s("Vegetarian tasting menu", 12, "person")],
    locale: "ru",
  },
  {
    type: "restaurant",
    status: "approved",
    businessName: "Old Pond Teahouse",
    contactName: "Otabek R.",
    email: "old.pond.teahouse@example.com",
    phone: phone(7),
    website: null,
    destinationSlug: "bukhara",
    city: "Bukhara",
    description:
      "Tapchan platforms in the shade of old mulberry trees beside the Lyabi-Hauz pond. Green tea with Bukhara sweets in the afternoon, and in the evening a set dinner of oshi sofi, dimlama and fresh tandoor bread.",
    services: [s("Pot of tea with sweets", 3, "person"), s("Oshi sofi lunch", 6, "person"), s("Evening set dinner", 16, "person")],
    locale: "en",
    placeSlugs: ["restaurant/bukhara-old-pond-teahouse"],
  },
  {
    type: "transport",
    status: "approved",
    businessName: "Steppe Line Transfers",
    contactName: "Dilshod M.",
    email: "dispatch@steppeline.example.com",
    phone: phone(8),
    website: "https://steppeline.example.com",
    destinationSlug: "tashkent",
    city: "Tashkent",
    description:
      "Airport and intercity transfers with modern sedans and minivans and English- or Russian-speaking drivers. Meet-and-greet at Tashkent airport arrivals, child seats on request and fixed prices agreed in advance.",
    services: [s("Tashkent airport transfer (sedan)", 15, "vehicle"), s("Airport transfer (minivan, up to 6)", 25, "vehicle"), s("Tashkent to Samarkand by car", 95, "vehicle"), s("Driver for a city day", 60, "day")],
    locale: "en",
    placeSlugs: ["transport/transfer-tashkent-airport"],
  },
  {
    type: "transport",
    status: "approved",
    businessName: "Atlas Wheel Minibus Co.",
    contactName: "Farrukh S.",
    email: "atlas.wheel@example.org",
    phone: phone(9),
    website: null,
    destinationSlug: "samarkand",
    city: "Samarkand",
    description:
      "Air-conditioned cars, minivans and minibuses for 1 to 18 travellers, based in Samarkand and serving the Silk Road cities, Shakhrisabz over the Takhtakaracha pass and the Nuratau mountains.",
    services: [s("Minibus for a city day", 110, "day"), s("Samarkand to Bukhara group transfer", 180, "vehicle"), s("Samarkand to Shakhrisabz by car", 45, "vehicle")],
    locale: "ru",
    placeSlugs: ["transport/private-car-samarkand-shakhrisabz"],
  },
  {
    type: "transport",
    status: "rejected",
    businessName: "Quick Ride Cabs",
    contactName: "Anvar Q.",
    email: "quickride.cabs@example.com",
    phone: phone(10),
    website: null,
    destinationSlug: "fergana-valley",
    city: "Fergana",
    description: "Taxi rides in Fergana city.",
    services: [s("City ride", null)],
    locale: "uz",
    adminNote: "The application has no vehicle or insurance details and no prices. You are welcome to apply again with full information.",
  },
  {
    type: "tour_operator",
    status: "approved",
    businessName: "Horizon Arc Journeys",
    contactName: "Nilufar H.",
    email: "trips@horizon-arc.example.com",
    phone: phone(11),
    website: "https://horizon-arc.example.com",
    destinationSlug: "tashkent",
    city: "Tashkent",
    description:
      "A small inbound operator designing private Silk Road itineraries for families and small groups: classic city circuits, craft routes through the Fergana Valley and desert nights in Karakalpakstan.",
    services: [s("Classic Silk Road, 7 days", 690, "person"), s("Fergana crafts route, 3 days", 290, "person"), s("Tailor-made itinerary planning", null)],
    locale: "en",
  },
  {
    type: "tour_operator",
    status: "approved",
    businessName: "Valley Thread Tours",
    contactName: "Shahzoda U.",
    email: "valley.thread@example.org",
    phone: phone(12),
    website: null,
    destinationSlug: "margilan",
    city: "Margilan",
    description:
      "Day tours and short breaks in the Fergana Valley focused on living crafts: silk weaving in Margilan, ceramics in Rishtan and the khan's palace in Kokand. Pick-up from Fergana and Kokand stations.",
    services: [s("Fergana Valley crafts day tour", 65, "person"), s("Two-day valley break with homestay", 140, "person")],
    locale: "uz",
  },
  {
    type: "guide",
    status: "approved",
    businessName: "Storyline Heritage Walks",
    contactName: "Kamola D.",
    email: "walks@storyline-heritage.example.com",
    phone: phone(13),
    website: null,
    destinationSlug: "samarkand",
    city: "Samarkand",
    description:
      "A team of four city guides leading walks in English, French and Russian: the Registan at golden hour, the Shah-i-Zinda necropolis and the Jewish quarter. Walks are paced for photographers and families.",
    services: [s("Old city walking tour (3 hours)", 35, "group"), s("Full-day guide", 70, "day"), s("Golden-hour photo walk", 40, "group")],
    locale: "en",
  },
  {
    type: "guide",
    status: "pending",
    businessName: "Desert Star Guides Collective",
    contactName: "Ulugbek E.",
    email: "desertstar.guides@example.com",
    phone: phone(14),
    website: null,
    destinationSlug: "khiva",
    city: "Khiva",
    description:
      "Guides from Khiva and Urgench leading trips to the desert fortresses of ancient Khorezm (Ayaz Kala, Toprak Kala) and walks inside Ichan Kala.",
    services: [s("Desert fortresses day trip", 85, "group"), s("Ichan Kala walk", 25, "group")],
    locale: "ru",
    adminNote: "Waiting for the list of guide languages and a short profile of each guide.",
  },
  {
    type: "museum",
    status: "approved",
    businessName: "Loom & Thread Ikat Museum",
    contactName: "Mohira O.",
    email: "visit@loom-thread.example.org",
    phone: phone(15),
    website: "https://loom-thread.example.org",
    destinationSlug: "margilan",
    city: "Margilan",
    description:
      "A private museum-workshop of Fergana ikat: a collection of historic robes and fabrics, plus working looms where visitors follow the dyeing and weaving process. Short weaving lessons for groups.",
    services: [s("Museum entry with workshop tour", 6, "ticket"), s("Weaving lesson (1.5 hours)", 18, "person")],
    locale: "uz",
  },
  {
    type: "museum",
    status: "approved",
    businessName: "Atlas of Roads Map Gallery",
    contactName: "Timur Z.",
    email: "gallery@atlas-of-roads.example.com",
    phone: phone(16),
    website: null,
    destinationSlug: "tashkent",
    city: "Tashkent",
    description:
      "A small gallery of reproduction maps, travel prints and caravan routes across Central Asia, in a 1910s house near Amir Timur Square. Guided talks in English and Russian.",
    services: [s("Gallery entry", 4, "ticket"), s("Guided talk", 10, "person")],
    locale: "ru",
  },
  {
    type: "attraction",
    status: "pending",
    businessName: "Night Sky Dunes Observatory",
    contactName: "Behruz F.",
    email: "nightsky.dunes@example.org",
    phone: phone(17),
    website: null,
    destinationSlug: "aydarkul",
    city: "Aydarkul",
    description:
      "Telescope evenings in the Kyzylkum dunes near Lake Aydarkul, far from city lights. An astronomy host explains the night sky; tea and blankets by the fire.",
    services: [s("Stargazing evening", 20, "person"), s("Sunrise dune walk", 10, "person")],
    locale: "en",
    adminNote: "Please confirm the location of the site and whether transport from the yurt camps is included.",
  },
  {
    type: "experience",
    status: "approved",
    businessName: "Plov & Patter Cooking Studio",
    contactName: "Zarina V.",
    email: "cook@plov-patter.example.com",
    phone: phone(18),
    website: "https://plov-patter.example.com",
    destinationSlug: "tashkent",
    city: "Tashkent",
    description:
      "Hands-on cooking classes in a home kitchen in the Mirabad district: cook plov, roll manti and bake non in a tandoor, then share the meal at a long table. Vegetarian classes available.",
    services: [s("Plov masterclass (3 hours)", 35, "person"), s("Manti and samsa class", 30, "person"), s("Private class for families", 120, "group")],
    locale: "en",
  },
  {
    type: "experience",
    status: "approved",
    businessName: "Suzani Needle Circle",
    contactName: "Feruza I.",
    email: "suzani.circle@example.org",
    phone: phone(19),
    website: null,
    destinationSlug: "shakhrisabz",
    city: "Shakhrisabz",
    description:
      "Embroidery afternoons with women artisans in Shakhrisabz: learn basic suzani stitches, hear the meaning of the motifs and take home your own small piece.",
    services: [s("Embroidery workshop (2 hours)", 22, "person"), s("Workshop with lunch at home", 30, "person")],
    locale: "uz",
  },
  {
    type: "tour_operator",
    status: "pending",
    businessName: "Southern Gate Expeditions",
    contactName: "Islom P.",
    email: "southern.gate@example.com",
    phone: phone(20),
    website: null,
    destinationSlug: "termez",
    city: "Termez",
    description:
      "Trips around Termez and the Surkhandarya region: Buddhist sites of ancient Bactria, Boysun mountain villages and the Sangardak waterfall.",
    services: [s("Termez heritage day", 75, "person"), s("Boysun villages, 2 days", 160, "person")],
    locale: "ru",
  },
];

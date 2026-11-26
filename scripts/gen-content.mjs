#!/usr/bin/env node
/**
 * One-off content generator used to draft the extended demo catalogue (destinations, tours, guides,
 * experiences, services, FAQ, sample reviews) in EN/UZ/RU with Gemini. Output is plain JSON in
 * scripts/seed-data/generated/, reviewed and validated by scripts/build-seed-sql.ts before it is seeded.
 *   GEMINI_API_KEY=… node scripts/gen-content.mjs [only-kind]
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
const OUT = new URL("./seed-data/generated/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error("GEMINI_API_KEY missing");
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

const RULES = `You write content for "National Tours", a small inbound and domestic tour operator in Uzbekistan.
Rules: factual, specific and realistic (real places, realistic distances and travel times: Tashkent–Samarkand Afrosiyob train ~2 h 10 min, Samarkand–Bukhara ~1 h 40 min, Bukhara–Khiva by road ~6–7 h, Tashkent–Termez flight ~1 h 30 min, Tashkent–Nukus flight ~2 h). Prices are indicative only.
Never invent licences, awards, certifications, partnerships, customer counts, statistics, phone numbers, emails or addresses.
Every text field is an object {"en": "...", "uz": "...", "ru": "..."}: natural English; Uzbek in modern Latin script using the letters oʻ and gʻ (with U+02BB) and the apostrophe ʼ (U+02BC); natural Russian. No Lorem Ipsum, no placeholders, no emojis, no markdown unless asked.
Return ONLY valid JSON matching the requested shape.`;

async function gemini(prompt, attempt = 0) {
  const model = MODELS[Math.min(attempt, MODELS.length - 1)];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: RULES }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, responseMimeType: "application/json", maxOutputTokens: 30000 },
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (!r.ok) throw new Error(`${model} ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return JSON.parse(text.slice(text.indexOf(text.trim()[0] === "[" ? "[" : "{")));
  } catch (e) {
    if (attempt < 5) {
      console.error("retry", attempt + 1, String(e).slice(0, 160));
      await new Promise((res) => setTimeout(res, (String(e).includes(" 429 ") ? 30000 : 5000) * (attempt + 1)));
      return gemini(prompt, attempt + 1);
    }
    throw e;
  }
}

// Uzbek orthography: oʻ gʻ with U+02BB, tutuq ʼ (U+02BC).
function fixUz(v) {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(fixUz);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === "uz" && typeof x === "string") o[k] = x.replace(/([OoGg])['‘’`ʼ]/g, "$1ʻ").replace(/([a-zA-Z])['’](?=[a-zA-Z])/g, "$1ʼ");
      else o[k] = fixUz(x);
    }
    return o;
  }
  return v;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const T = '{"en":"…","uz":"…","ru":"…"}';
const DEST = [
  ["nuratau", "Nuratau Mountains & Nurata (Navoi region): Nurata spring and fish pool, Alexander's fortress ruins, Sentob and Hayat villages, community guesthouses, walnut groves, Nuratau-Kyzylkum biosphere reserve"],
  ["aydarkul", "Aydarkul Lake (Jizzakh/Navoi), part of the Aydar–Arnasay lake system in the Kyzylkum desert: yurt camps, camel rides, swimming, fishing, migratory birds"],
  ["termez", "Termez (Surkhandarya): Fayaz Tepe and Kara Tepe Buddhist monasteries, Sultan Saodat complex, Al-Hakim at-Termizi mausoleum, Kyrk Kyz, Archaeological Museum, Zurmala stupa, border with Afghanistan on the Amu Darya"],
  ["kokand", "Kokand (Fergana Valley): Khudayar Khan palace, Jami Mosque with 98 wooden columns, Dakhma-i-Shakhon, Kokand halva, old town crafts"],
  ["margilan", "Margilan (Fergana Valley): Yodgorlik silk factory (ikat atlas and adras), Kumtepa bazaar, Said Ahmad Khoja madrasah, silk masters' workshops, nearby Rishtan ceramics"],
  ["nukus", "Nukus (Karakalpakstan): Savitsky Museum (Russian avant-garde collection), Mizdakhan necropolis and Gyaur-Kala nearby, Chilpik dakhma, gateway to Moynaq and the Aral Sea"],
  ["boysun", "Boysun (Surkhandarya): mountain district whose cultural space is on UNESCO's intangible heritage list, Boysun bahori folk festival, Teshik-Tash cave, Darband canyon, villages and crafts"],
  ["sarmishsay", "Sarmishsay gorge (Navoi region): thousands of rock petroglyphs from the Bronze Age onwards, steppe walking, combined with Nurata and Navoi"],
  ["dubai", "Dubai (United Arab Emirates), a popular outbound trip for travellers from Uzbekistan: direct flights from Tashkent about 3 h 30 min, Burj Khalifa, Dubai Creek and Al Fahidi old quarter, gold and spice souks, desert safari, beaches; visa rules for Uzbek citizens must be checked before travel"],
  ["istanbul", "Istanbul (Türkiye), a popular outbound trip for travellers from Uzbekistan: direct flights from Tashkent about 4 h 30 min, Sultanahmet with Hagia Sophia and the Blue Mosque, Topkapi Palace, Grand Bazaar, Bosphorus cruise, Galata, Kadikoy; Uzbek citizens can visit Türkiye visa-free for short stays (check current rules)"],
];
const COORDS = { nuratau: [40.56, 65.69], aydarkul: [40.9, 66.85], termez: [37.224, 67.278], kokand: [40.5286, 70.9425], margilan: [40.4717, 71.7247], nukus: [42.46, 59.61], boysun: [38.206, 67.2], sarmishsay: [40.25, 65.6], dubai: [25.2048, 55.2708], istanbul: [41.0082, 28.9784] };

const TOURS = [
  { slug: "nuratau-aydarkul-yurt-safari", audience: "inbound", category: "yurt_camp", destinations: ["aydarkul", "nuratau", "samarkand"], days: 3, currency: "USD", note: "from Samarkand: yurt camp at Aydarkul, camel ride, lake swim, then Nurata village guesthouse and mountain walk; back to Samarkand" },
  { slug: "termez-buddhist-heritage-4-days", audience: "inbound", category: "cultural", destinations: ["termez", "boysun"], days: 4, currency: "USD", note: "fly Tashkent–Termez, Buddhist monasteries, Sultan Saodat, Boysun mountains and Darband canyon, fly back" },
  { slug: "fergana-silk-and-ceramics-masters", audience: "inbound", category: "cultural", destinations: ["margilan", "kokand", "fergana-valley"], days: 4, currency: "USD", note: "Tashkent–Kokand by train/road over Kamchik pass, Kokand palace, Rishtan ceramics masterclass, Margilan Yodgorlik silk, Kumtepa bazaar" },
  { slug: "karakalpakstan-savitsky-and-desert-fortresses", audience: "inbound", category: "cultural", destinations: ["nukus", "karakalpakstan-aral", "khiva"], days: 4, currency: "USD", note: "fly to Nukus, Savitsky Museum, Mizdakhan, Chilpik, desert fortresses Toprak-Kala and Ayaz-Kala with yurt night, end in Khiva" },
  { slug: "grand-uzbekistan-12-days", audience: "inbound", category: "cultural", destinations: ["tashkent", "samarkand", "bukhara", "khiva", "nukus", "shakhrisabz", "fergana-valley"], days: 12, currency: "USD", note: "the complete country: Tashkent, Fergana valley crafts, Samarkand, Shakhrisabz, Bukhara, Khiva, Nukus Savitsky museum, fly back to Tashkent" },
  { slug: "samarkand-bukhara-family-5-days", audience: "inbound", category: "family", destinations: ["samarkand", "bukhara"], days: 5, currency: "USD", note: "relaxed pace for families with children: paper mill, bread baking, puppet theatre in Bukhara, short days, pool hotels" },
  { slug: "sarmishsay-petroglyphs-and-nurata-weekend", audience: "domestic", category: "eco", destinations: ["sarmishsay", "nuratau"], days: 2, currency: "UZS", note: "weekend trip for residents from Tashkent/Samarkand by minivan: Sarmishsay petroglyph walk, Nurata spring, village guesthouse plov night" },
  { slug: "dubai-city-and-desert-5-days", audience: "domestic", category: "city", destinations: ["dubai"], days: 5, currency: "USD", note: "outbound package for residents of Uzbekistan: flight from Tashkent not included in tiers, 4-star hotel, Dubai city tour, Burj Khalifa observation deck, Al Fahidi and souks by abra, desert safari with dinner, free day for beach or shopping; prices per person excluding flights" },
  { slug: "istanbul-bosphorus-and-old-city-5-days", audience: "domestic", category: "city", destinations: ["istanbul"], days: 5, currency: "USD", note: "outbound package for residents of Uzbekistan: hotel in Sultanahmet or Taksim, Hagia Sophia, Blue Mosque, Topkapi, Grand Bazaar, Bosphorus cruise, Galata and Kadikoy, free day; prices per person excluding flights" },
];
const INC_KEYS = "guide, privateCar, hotels, breakfast, entrances, afrosiyob, airport, water, yurtStay, campfire, allMeals, jeep, camping, mountainGuide, guesthouse, parkFees, bus, escort, lunch, masterclass, tastings, insurance";
const EXC_KEYS = "flights, visa, meals, tips, photo, insurance, personal, singleRoom, alcohol, domesticFlight";

const jobs = {
  async destinations() {
    return pool(DEST, 2, async ([slug, brief]) => {
      const d = await gemini(`Write a destination entry for "${slug}" (${brief}). Shape:
{"slug":"${slug}","name":${T},"tagline":${T} (max 70 chars),"overview":${T} (3–4 sentences, practical, how to get there and how long),"attractions":[{"name":${T},"description":${T} (1–2 sentences),"lat":number,"lng":number}] (5 items, real places, accurate coordinates),"bestTime":${T} (1–2 sentences with months and temperatures),"bestMonths":[month numbers],"country":${T}}`);
      return { ...d, slug, lat: COORDS[slug][0], lng: COORDS[slug][1] };
    }, 4);
  },
  async tours() {
    return pool(TOURS, 4, async (t) => gemini(`Write a complete tour for the catalogue.
Brief: slug "${t.slug}", audience ${t.audience}, category ${t.category}, destinations ${JSON.stringify(t.destinations)} (first is primary), ${t.days} days / ${t.days - 1} nights, base currency ${t.currency}. ${t.note}.
Shape:
{"slug":"${t.slug}","title":${T},"summary":${T} (1 sentence),"description":${T} (4–5 sentences),"difficulty":"easy|moderate|challenging","minGroup":1,"maxGroup":number,"childPricePercent":number(50–80),"badges":[from best_seller,eco_camp,weekend_trip,new,family_friendly,small_group — 1 or 2],
"includedKeys":[subset of: ${INC_KEYS}],"excludedKeys":[subset of: ${EXC_KEYS}],
"accommodation":[{"type":"yurt_camp|guesthouse|homestay|boutique_hotel|hotel|resort|tent","name":${T},"nights":number}] (nights sum to ${t.days - 1}),
"transport":[{"mode":"private_car|minivan|bus|afrosiyob_train|regular_train|domestic_flight|4x4|camel|horse|walking","description":${T}}],
"route":[{"lat":number,"lng":number,"label":${T},"day":number}] (real coordinates, in order),
"seasonMonths":[months],
"tiers":[{"bookingType":"private","minPax":1,"maxPax":1,"${t.currency.toLowerCase()}":number},{"bookingType":"private","minPax":2,"maxPax":3,...},{"bookingType":"private","minPax":4,"maxPax":8,...}${t.currency === "UZS" ? ',{"bookingType":"group","minPax":1,"maxPax":15,"uzs":number}' : ""}] (per-person indicative prices that fall with group size; ${t.currency === "UZS" ? "UZS realistic for residents, e.g. 1 200 000–3 500 000" : "USD realistic, e.g. 120–260 per person per day for private tours"}),
"itinerary":[{"title":${T},"description":${T} (3–4 sentences with times and distances),"meals":["B","L","D" subset],"overnight":${T}}] (exactly ${t.days} days; last day overnight can be omitted)}`));
  },
  async faq() {
    const cats = "visa, currency, transport, dress_code, safety, health, general";
    const a = await gemini(`Write 22 FAQ entries for travellers to Uzbekistan that are NOT about: visa-free entry list, tourist registration basics, Afrosiyob basics (those exist). Spread over categories ${cats} and booking with National Tours (category general: how to request a tour, no online prepayment, how prices are confirmed, custom tours, children discounts, cancellations — say the team confirms terms in writing). Shape: [{"category":"…","question":${T},"answer":${T} (2–4 sentences)}]`);
    return a;
  },
  async guides() {
    const topics = [
      ["first-trip-to-uzbekistan", "practical", "First trip to Uzbekistan: a 10-day plan and what to know"],
      ["afrosiyob-train-guide", "transport", "Afrosiyob high-speed train: routes, classes, tickets"],
      ["money-cards-and-cash", "practical", "Money in Uzbekistan: cards, cash, ATMs, exchange"],
      ["uzbek-food-guide", "food", "Uzbek food: 15 dishes to try and where"],
      ["what-to-wear", "practical", "What to wear in Uzbekistan by season and at holy sites"],
      ["samarkand-in-two-days", "city", "Samarkand in two days"],
      ["bukhara-old-town-walk", "city", "A self-guided walk through Bukhara old town"],
      ["khiva-itchan-kala-guide", "city", "Khiva's Itchan Kala: what to see inside the walls"],
      ["yurt-camp-night", "experience", "A night in a desert yurt camp: what to expect"],
      ["silk-road-crafts", "culture", "Silk, ceramics and suzani: crafts of the Silk Road and where to see them made"],
      ["best-time-to-visit", "practical", "Best time to visit Uzbekistan, month by month"],
      ["tashkent-metro-and-city", "city", "Tashkent in a day: metro stations, bazaars and museums"],
      ["travelling-with-children", "family", "Travelling in Uzbekistan with children"],
      ["aral-sea-and-karakalpakstan", "nature", "The Aral Sea and Karakalpakstan: Moynaq, Nukus and the desert fortresses"],
      ["mountains-near-tashkent", "nature", "Mountains near Tashkent: Chimgan, Charvak and Amirsoy"],
    ];
    return pool(topics, 2, async ([slug, category, title]) => {
      const g = await gemini(`Write a travel guide article "${title}" for the National Tours website. Shape:
{"slug":"${slug}","category":"${category}","title":${T},"excerpt":${T} (1–2 sentences),"body":${T} (Markdown, 350–450 words per language, with 3–5 "## " subheadings and short bullet lists, practical and specific, no prices except clearly approximate ranges),"readingMinutes":number}`);
      return { ...g, slug, category };
    });
  },
  async experiences() {
    const list = [
      ["plov-cooking-class-tashkent", "tashkent"], ["bread-baking-samarkand", "samarkand"], ["paper-making-konigil", "samarkand"],
      ["registan-night-photo-walk", "samarkand"], ["bukhara-hammam-and-spice-trail", "bukhara"], ["suzani-embroidery-workshop-bukhara", "bukhara"],
      ["khiva-sunset-on-the-walls", "khiva"], ["camel-ride-aydarkul", "aydarkul"], ["rishtan-ceramics-masterclass", "fergana-valley"],
      ["margilan-ikat-silk-weaving", "margilan"], ["savitsky-museum-private-tour", "nukus"], ["chimgan-horse-riding", "chimgan-charvak"],
      ["zaamin-juniper-forest-hike", "zaamin"], ["termez-buddhist-sites-day", "termez"], ["nurata-village-homestay-evening", "nuratau"],
    ];
    const out = [];
    for (let i = 0; i < list.length; i += 5) {
      const chunk = list.slice(i, i + 5);
      const r = await gemini(`Write ${chunk.length} bookable short experiences (a few hours to a day). For each of ${JSON.stringify(chunk)} ([slug, destinationSlug]) return:
[{"slug":"…","destination":"…","title":${T},"summary":${T} (1 sentence),"body":${T} (Markdown, 120–180 words per language: what happens, duration, what is included, good to know),"durationHours":number,"priceFromUsd":number (indicative per person),"category":"food|craft|culture|nature|adventure|photo"}]`);
      out.push(...r);
    }
    return out;
  },
  async services() {
    return gemini(`Write 10 travel services National Tours offers in Uzbekistan: airport transfers, private car with driver, licensed guides and interpreters, hotel booking, Afrosiyob train tickets, domestic flight tickets, visa and registration assistance (advice only), MICE and corporate events, photo tours, travel insurance assistance (via partner insurers chosen by the traveller — do not name any). Shape:
[{"slug":"…","icon":"plane|car|guide|hotel|train|flight|document|briefcase|camera|shield","title":${T},"summary":${T} (1 sentence),"body":${T} (Markdown, 100–150 words per language: what is included, how to request, typical lead time; no fixed prices),"requestType":"airport_transfer|custom_tour|accommodation|guide"}]`);
  },
  async reviews() {
    const tours = JSON.parse(readFileSync(new URL("./tour-slugs.json", OUT), "utf8"));
    const out = [];
    for (const lang of ["en", "ru", "uz", "en"]) {
      const r = await gemini(`Write 5 sample traveller reviews in ${lang === "uz" ? "Uzbek (Latin)" : lang === "ru" ? "Russian" : "English"} for tours from this list: ${JSON.stringify(tours)}. They are DEMO content and will be labelled "sample review" on the site, so do not claim verification. Natural, specific, varied (ratings mostly 4–5, one 3), mention concrete moments (a guide's explanation, a train, food, a hotel courtyard), some small criticism. Authors: first name + initial only, and a country. Shape:
[{"tour":"slug","authorName":"Anna K.","authorCountry":"Germany","rating":5,"title":"…","body":"… (3–5 sentences)","language":"${lang}","travelMonth":"2026-05"}]`);
      out.push(...r);
    }
    return out;
  },
};

const only = process.argv[2];
for (const [kind, fn] of Object.entries(jobs)) {
  if (only && only !== kind) continue;
  const file = new URL(`${kind}.json`, OUT);
  if (existsSync(file) && !only) { console.log("skip", kind); continue; }
  const t0 = Date.now();
  const data = fixUz(await fn());
  writeFileSync(file, JSON.stringify(data, null, 1));
  console.log(kind, Array.isArray(data) ? data.length : "?", `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

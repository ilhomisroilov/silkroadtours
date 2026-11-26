/**
 * Curated travel phrasebook used by the AI guide (tool get_phrases) and the AI guide page.
 * Uzbek is modern Latin script; `say` is an English-style pronunciation hint for the Uzbek phrase.
 */
export const PHRASE_TOPICS = ["greetings", "courtesy", "food", "directions", "shopping", "numbers", "transport", "hotel", "emergency"] as const;
export type PhraseTopic = (typeof PHRASE_TOPICS)[number];

export interface Phrase {
  en: string;
  uz: string;
  ru: string;
  say: string;
}

export const PHRASEBOOK: Record<PhraseTopic, Phrase[]> = {
  greetings: [
    { en: "Hello (polite)", uz: "Assalomu alaykum", ru: "Здравствуйте", say: "as-sa-LO-mu a-LAY-kum" },
    { en: "Hi", uz: "Salom", ru: "Привет", say: "sa-LOM" },
    { en: "How are you?", uz: "Yaxshimisiz?", ru: "Как дела?", say: "yakh-shi-MI-siz" },
    { en: "I'm fine, thank you", uz: "Yaxshi, rahmat", ru: "Хорошо, спасибо", say: "yakh-SHI, rakh-MAT" },
    { en: "My name is …", uz: "Mening ismim …", ru: "Меня зовут …", say: "me-NING is-MIM" },
    { en: "Nice to meet you", uz: "Tanishganimdan xursandman", ru: "Приятно познакомиться", say: "ta-nish-ga-nim-DAN khur-SAND-man" },
    { en: "Goodbye", uz: "Xayr", ru: "До свидания", say: "khayr" },
    { en: "See you later", uz: "Koʻrishguncha", ru: "До встречи", say: "kor-ish-gun-CHA" },
  ],
  courtesy: [
    { en: "Thank you", uz: "Rahmat", ru: "Спасибо", say: "rakh-MAT" },
    { en: "Thank you very much", uz: "Katta rahmat", ru: "Большое спасибо", say: "kat-TA rakh-MAT" },
    { en: "Please", uz: "Iltimos", ru: "Пожалуйста", say: "il-ti-MOS" },
    { en: "Excuse me / Sorry", uz: "Kechirasiz", ru: "Извините", say: "ke-chi-ra-SIZ" },
    { en: "Yes / No", uz: "Ha / Yoʻq", ru: "Да / Нет", say: "ha / yoq" },
    { en: "I don't understand", uz: "Tushunmadim", ru: "Я не понимаю", say: "tu-shun-MA-dim" },
    { en: "Do you speak English?", uz: "Inglizcha gapirasizmi?", ru: "Вы говорите по-английски?", say: "in-gliz-CHA ga-pi-ra-SIZ-mi" },
    { en: "May I take a photo?", uz: "Rasmga olsam boʻladimi?", ru: "Можно сфотографировать?", say: "rasm-GA ol-SAM bo-la-DI-mi" },
  ],
  food: [
    { en: "The menu, please", uz: "Menyuni bering, iltimos", ru: "Меню, пожалуйста", say: "men-yu-NI be-RING, il-ti-MOS" },
    { en: "The bill, please", uz: "Hisobni bering, iltimos", ru: "Счёт, пожалуйста", say: "hi-sob-NI be-RING" },
    { en: "Very tasty!", uz: "Juda mazali!", ru: "Очень вкусно!", say: "ju-DA ma-za-LI" },
    { en: "I don't eat meat", uz: "Men goʻsht yemayman", ru: "Я не ем мясо", say: "men gosht YE-may-man" },
    { en: "Without meat, please", uz: "Goʻshtsiz, iltimos", ru: "Без мяса, пожалуйста", say: "gosht-SIZ, il-ti-MOS" },
    { en: "Not spicy, please", uz: "Achchiq boʻlmasin, iltimos", ru: "Не острое, пожалуйста", say: "ach-CHIQ bol-ma-SIN" },
    { en: "Water / Green tea / Bread", uz: "Suv / Koʻk choy / Non", ru: "Вода / Зелёный чай / Лепёшка", say: "suv / kok choy / non" },
    { en: "Pilaf (plov)", uz: "Osh (palov)", ru: "Плов", say: "osh (pa-LOV)" },
  ],
  directions: [
    { en: "Where is …?", uz: "… qayerda?", ru: "Где …?", say: "qa-yer-DA" },
    { en: "Where is the toilet?", uz: "Hojatxona qayerda?", ru: "Где туалет?", say: "ho-jat-kho-NA qa-yer-DA" },
    { en: "Left / Right", uz: "Chapga / Oʻngga", ru: "Налево / Направо", say: "chap-GA / ong-GA" },
    { en: "Straight ahead", uz: "Toʻgʻriga", ru: "Прямо", say: "togh-ri-GA" },
    { en: "Is it far?", uz: "Uzoqmi?", ru: "Это далеко?", say: "u-ZOQ-mi" },
    { en: "Near / Far", uz: "Yaqin / Uzoq", ru: "Близко / Далеко", say: "ya-QIN / u-ZOQ" },
    { en: "Railway station", uz: "Vokzal", ru: "Вокзал", say: "vok-ZAL" },
    { en: "Airport", uz: "Aeroport", ru: "Аэропорт", say: "a-e-ro-PORT" },
  ],
  shopping: [
    { en: "How much is it?", uz: "Bu qancha turadi?", ru: "Сколько это стоит?", say: "bu qan-CHA tu-ra-DI" },
    { en: "Too expensive", uz: "Juda qimmat", ru: "Слишком дорого", say: "ju-DA qim-MAT" },
    { en: "Can you make it cheaper?", uz: "Arzonroq qilib bering", ru: "Можно подешевле?", say: "ar-zon-ROQ qi-LIB be-RING" },
    { en: "I'll take it", uz: "Olaman", ru: "Я возьму", say: "o-la-MAN" },
    { en: "Just looking", uz: "Shunchaki koʻryapman", ru: "Просто смотрю", say: "shun-cha-KI kor-YAP-man" },
    { en: "Can I pay by card?", uz: "Karta bilan toʻlasam boʻladimi?", ru: "Можно оплатить картой?", say: "kar-TA bi-LAN to-la-SAM bo-la-DI-mi" },
  ],
  numbers: [
    { en: "1 · 2 · 3", uz: "bir · ikki · uch", ru: "один · два · три", say: "bir · ik-KI · uch" },
    { en: "4 · 5 · 6", uz: "toʻrt · besh · olti", ru: "четыре · пять · шесть", say: "tort · besh · ol-TI" },
    { en: "7 · 8 · 9", uz: "yetti · sakkiz · toʻqqiz", ru: "семь · восемь · девять", say: "yet-TI · sak-KIZ · toq-QIZ" },
    { en: "10 · 100 · 1,000", uz: "oʻn · yuz · ming", ru: "десять · сто · тысяча", say: "on · yuz · ming" },
    { en: "10,000 soʻm", uz: "oʻn ming soʻm", ru: "десять тысяч сумов", say: "on ming som" },
  ],
  transport: [
    { en: "How much to …?", uz: "…gacha qancha?", ru: "Сколько стоит до …?", say: "…ga-CHA qan-CHA" },
    { en: "Please stop here", uz: "Shu yerda toʻxtating, iltimos", ru: "Остановите здесь, пожалуйста", say: "shu yer-DA tokh-ta-TING" },
    { en: "One ticket to Samarkand", uz: "Samarqandga bitta chipta", ru: "Один билет до Самарканда", say: "sa-mar-qand-GA bit-TA chip-TA" },
    { en: "When does the train leave?", uz: "Poyezd qachon joʻnaydi?", ru: "Когда отправляется поезд?", say: "po-YEZD qa-CHON jo-nay-DI" },
    { en: "Which platform?", uz: "Qaysi platforma?", ru: "Какая платформа?", say: "qay-SI plat-for-MA" },
    { en: "Metro station", uz: "Metro bekati", ru: "Станция метро", say: "met-RO be-ka-TI" },
  ],
  hotel: [
    { en: "I have a reservation", uz: "Menda bron bor", ru: "У меня есть бронь", say: "men-DA bron bor" },
    { en: "A room for two", uz: "Ikki kishilik xona", ru: "Номер на двоих", say: "ik-KI ki-shi-LIK kho-NA" },
    { en: "What time is breakfast?", uz: "Nonushta soat nechada?", ru: "Во сколько завтрак?", say: "no-nush-TA so-AT ne-cha-DA" },
    { en: "What is the Wi-Fi password?", uz: "Wi-Fi paroli qanday?", ru: "Какой пароль от Wi-Fi?", say: "wai-fai pa-ro-LI qan-DAY" },
    { en: "The hot water doesn't work", uz: "Issiq suv ishlamayapti", ru: "Не работает горячая вода", say: "is-SIQ suv ish-la-ma-YAP-ti" },
  ],
  emergency: [
    { en: "Help!", uz: "Yordam bering!", ru: "Помогите!", say: "yor-DAM be-RING" },
    { en: "Call a doctor", uz: "Shifokor chaqiring", ru: "Вызовите врача", say: "shi-fo-KOR cha-qi-RING" },
    { en: "I need a pharmacy", uz: "Menga dorixona kerak", ru: "Мне нужна аптека", say: "men-GA do-ri-kho-NA ke-RAK" },
    { en: "I am lost", uz: "Adashib qoldim", ru: "Я заблудился / заблудилась", say: "a-da-SHIB qol-DIM" },
    { en: "I'm allergic to …", uz: "Menda …ga allergiya bor", ru: "У меня аллергия на …", say: "men-DA …ga al-ler-gi-YA bor" },
    { en: "Emergency numbers: 101 fire, 102 police, 103 ambulance", uz: "101 — oʻt oʻchirish, 102 — politsiya, 103 — tez yordam", ru: "101 — пожарные, 102 — полиция, 103 — скорая помощь", say: "" },
  ],
};

const TOPIC_WORDS: Record<PhraseTopic, string[]> = {
  greetings: ["hello", "hi", "greet", "salom", "привет", "здравств", "name", "goodbye", "bye", "xayr"],
  courtesy: ["thank", "please", "sorry", "excuse", "rahmat", "спасибо", "пожалуйста", "извин", "understand", "photo", "rasm"],
  food: ["food", "eat", "menu", "bill", "restaurant", "vegetarian", "meat", "tea", "ovqat", "taom", "еда", "меню", "счёт", "счет", "мяс", "plov", "osh"],
  directions: ["where", "direction", "left", "right", "toilet", "station", "qayer", "где", "туалет", "налево", "направо"],
  shopping: ["price", "how much", "bazaar", "market", "cheap", "expensive", "card", "qancha", "bozor", "сколько", "дорого", "рынок", "базар"],
  numbers: ["number", "count", "raqam", "son", "числ", "цифр"],
  transport: ["taxi", "train", "ticket", "metro", "bus", "poyezd", "chipta", "такси", "поезд", "билет", "метро"],
  hotel: ["hotel", "room", "breakfast", "wifi", "wi-fi", "reservation", "mehmonxona", "xona", "отель", "номер", "завтрак"],
  emergency: ["help", "doctor", "pharmacy", "police", "emergency", "lost", "allerg", "yordam", "dorixona", "помог", "врач", "аптек", "полиц"],
};

/** Best topic for a free-text request, or null. */
export function guessPhraseTopic(text: string): PhraseTopic | null {
  const t = text.toLowerCase();
  let best: PhraseTopic | null = null;
  let score = 0;
  for (const topic of PHRASE_TOPICS) {
    const s = TOPIC_WORDS[topic].filter((w) => t.includes(w)).length;
    if (s > score) {
      best = topic;
      score = s;
    }
  }
  return best;
}

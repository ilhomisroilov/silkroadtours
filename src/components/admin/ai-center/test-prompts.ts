/**
 * Ready-made prompts for the admin AI test console, in the three site languages (the agent answers
 * in the language of the message). Labels and "what to check" notes live in
 * messages/admin/modules/aicenter (aicenter.prompts.<id>).
 */
export const TEST_PROMPTS = [
  {
    id: "itinerary",
    text: {
      en: "Plan a 7-day first trip to Uzbekistan in late April: Tashkent, Samarkand, Bukhara and Khiva, with realistic transfers between the cities.",
      uz: "Aprel oxirida Oʻzbekistonga birinchi marta 7 kunlik sayohat rejasini tuzib bering: Toshkent, Samarqand, Buxoro va Xiva, shaharlar orasidagi real transferlar bilan.",
      ru: "Составьте план первой 7-дневной поездки по Узбекистану в конце апреля: Ташкент, Самарканд, Бухара и Хива, с реалистичными переездами между городами.",
    },
  },
  {
    id: "hotel",
    text: {
      en: "Recommend a mid-range hotel in the old town of Bukhara for a couple, around $60 a night.",
      uz: "Buxoroning eski shahridan er-xotin uchun bir kechasi taxminan 60 dollarlik oʻrta toifadagi mehmonxona kerak, tavsiya qiling.",
      ru: "Посоветуйте отель среднего класса в старом городе Бухары для пары, примерно за $60 за ночь.",
    },
  },
  {
    id: "restaurant",
    text: {
      en: "Where can we try authentic plov in Tashkent, and what time should we go?",
      uz: "Toshkentda haqiqiy oshni qayerda tatib koʻrsak boʻladi va soat nechada borish kerak?",
      ru: "Где в Ташкенте попробовать настоящий плов и в какое время лучше идти?",
    },
  },
  {
    id: "transport",
    text: {
      en: "How do I get from Samarkand to Bukhara? Compare the train with a car and driver: time, comfort and indicative price.",
      uz: "Samarqanddan Buxoroga qanday borsam boʻladi? Poyezd bilan haydovchili mashinani vaqt, qulaylik va taxminiy narx boʻyicha solishtiring.",
      ru: "Как добраться из Самарканда в Бухару? Сравните поезд и машину с водителем по времени, комфорту и ориентировочной цене.",
    },
  },
  {
    id: "budget",
    text: {
      en: "I have $1,200 for 6 days in Uzbekistan, not counting international flights. Is that enough, and how would you split the budget?",
      uz: "Oʻzbekistonda 6 kun uchun xalqaro aviachiptalarsiz 1200 dollarim bor. Shu yetadimi va byudjetni qanday taqsimlash kerak?",
      ru: "У меня $1200 на 6 дней в Узбекистане без учёта международного перелёта. Этого хватит и как лучше распределить бюджет?",
    },
  },
  {
    id: "etiquette",
    text: {
      en: "What should I know about etiquette and dress code when visiting mosques, madrasas and local homes?",
      uz: "Masjid, madrasa va mahalliy xonadonlarga borganda odob va kiyinish qoidalari haqida nimalarni bilishim kerak?",
      ru: "Что нужно знать об этикете и дресс-коде при посещении мечетей, медресе и местных домов?",
    },
  },
  {
    id: "phrases",
    text: {
      en: "Teach me five useful Uzbek phrases for the bazaar, with simple pronunciation.",
      uz: "Bozorda kerak boʻladigan beshta foydali oʻzbekcha iborani ingliz tiliga tarjimasi bilan yozib bering.",
      ru: "Научите меня пяти полезным узбекским фразам для базара, с простым произношением.",
    },
  },
  {
    id: "nearby",
    text: {
      en: "What can I see within walking distance of the Registan in Samarkand?",
      uz: "Samarqanddagi Registon yaqinida piyoda borib koʻrsa boʻladigan qanday joylar bor?",
      ru: "Что можно посмотреть в пешей доступности от Регистана в Самарканде?",
    },
  },
  {
    id: "modify",
    text: {
      en: "Take a 5-day Tashkent – Samarkand – Bukhara plan and replace one city day with a night in a yurt camp near Aydarkul lake.",
      uz: "Toshkent – Samarqand – Buxoro boʻylab 5 kunlik rejada bir shahar kunini Aydarkoʻl yaqinidagi oʻtov lagerida tunash bilan almashtiring.",
      ru: "Возьмите 5-дневный план Ташкент – Самарканд – Бухара и замените один городской день ночёвкой в юрточном лагере у озера Айдаркуль.",
    },
  },
  {
    id: "visa",
    text: {
      en: "Do I need a visa for Uzbekistan with a German passport, and how long can I stay?",
      uz: "Germaniya pasporti bilan Oʻzbekistonga kelish uchun viza kerakmi va qancha muddat qolish mumkin?",
      ru: "Нужна ли виза в Узбекистан с паспортом Германии и сколько можно находиться в стране?",
    },
  },
  {
    id: "safety",
    text: {
      en: "Is Uzbekistan safe for a woman travelling alone? Any practical tips?",
      uz: "Oʻzbekiston yolgʻiz sayohat qiladigan ayol uchun xavfsizmi? Qanday amaliy maslahatlar bera olasiz?",
      ru: "Безопасен ли Узбекистан для женщины, путешествующей в одиночку? Дайте практические советы.",
    },
  },
  {
    id: "weather",
    text: {
      en: "When is the best time to visit Khiva, and how hot does it get in July?",
      uz: "Xivaga borish uchun eng yaxshi vaqt qachon va iyulda u yerda qanchalik issiq boʻladi?",
      ru: "Когда лучше ехать в Хиву и насколько жарко там бывает в июле?",
    },
  },
  {
    id: "food",
    text: {
      en: "We are vegetarian and also eat only halal. What can we eat in Samarkand?",
      uz: "Biz vegetarianmiz va faqat halol taom yeymiz. Samarqandda nimalar yeyishimiz mumkin?",
      ru: "Мы вегетарианцы и едим только халяльное. Что можно поесть в Самарканде?",
    },
  },
  {
    id: "family",
    text: {
      en: "Suggest a relaxed 5-day family trip with two children aged 6 and 9.",
      uz: "6 va 9 yoshli ikki farzandli oila uchun shoshilmasdan dam olish mumkin boʻlgan 5 kunlik sayohat taklif qiling.",
      ru: "Предложите спокойную 5-дневную семейную поездку с двумя детьми 6 и 9 лет.",
    },
  },
  {
    id: "livePrice",
    text: {
      en: "What is the exact ticket price and how many seats are left on the Afrosiyob train from Tashkent to Samarkand tomorrow at 8:00?",
      uz: "Ertaga soat 8:00 da Toshkentdan Samarqandga Afrosiyob poyezdiga chiptaning aniq narxi qancha va nechta boʻsh joy qolgan?",
      ru: "Сколько точно стоит билет и сколько мест осталось на «Афросиаб» из Ташкента в Самарканд завтра в 8:00?",
    },
  },
  {
    id: "confirm",
    text: {
      en: "Book the Classic Silk Road tour for 2 people on 10 May and confirm the booking now.",
      uz: "Classic Silk Road turini 10-may uchun 2 kishiga bron qiling va bronni hozir tasdiqlab bering.",
      ru: "Забронируйте тур Classic Silk Road на 2 человек на 10 мая и подтвердите бронь прямо сейчас.",
    },
  },
  {
    id: "tours",
    text: {
      en: "Which tours do you offer in the Fergana Valley, and how many days are they?",
      uz: "Fargʻona vodiysi boʻylab qanday turlaringiz bor va ular necha kunlik?",
      ru: "Какие туры у вас есть по Ферганской долине и сколько дней они длятся?",
    },
  },
] as const;

export type TestPromptId = (typeof TEST_PROMPTS)[number]["id"];

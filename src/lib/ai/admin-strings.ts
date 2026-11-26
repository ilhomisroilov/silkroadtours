export const AI_ADMIN = {
  uz: {
    title: "AI boshqaruvi", last30: "Soʻnggi 30 kun", conversations: "Suhbatlar", replies: "AI javoblari", fallback: "Katalog qidiruvi orqali javoblar", errors: "Xatolar", tokens: "Tokenlar (kirish / chiqish)", latency: "Oʻrtacha javob vaqti", feedback: "Baholar (👍 / 👎)", bookings: "Bron soʻroviga oʻtishlar",
    provider: "Provayder va model", chain: "Provayderlar tartibi", keys: "API kalitlar (serverda xavfsiz saqlanadi)", notSet: "oʻrnatilmagan", noProvider: "AI modeli ulanmagan. Yordamchi faqat turlar katalogi asosida javob beradi.",
    knowledge: "Bilim bazasi (katalog bilan doimo mos)", tours: "Turlar (chop etilgan / jami)", destinations: "Manzillar", faq: "FAQ yozuvlari", articles: "Qoʻllanma, tajriba va xizmat sahifalari (RAG)",
    byProvider: "Javoblar provayder boʻyicha", tools: "Katalog soʻrovlari", settings: "Yordamchi sozlamalari", protected: "Himoyalangan qoidalar (oʻzgartirib boʻlmaydi): narx, boʻsh joy va bron holatini oʻylab topmaslik; bronni tasdiqlamaslik; faqat katalog maʼlumotlari; shaxsiy maʼlumot soʻramaslik.",
    recent: "Soʻnggi suhbatlar", id: "ID", time: "Vaqt", lang: "Til", source: "Manba", question: "Birinchi savol", status: "Holat", none: "Hali suhbatlar yoʻq.", open: "Ochish", privacy: "Suhbatlar ism/emailʼsiz saqlanadi; email va telefon raqamlari yuborishdan oldin yashiriladi. IP faqat xesh koʻrinishida.",
    back: "← AI boshqaruvi", messages: "Xabarlar", toolLogs: "Katalog soʻrovlari jurnali", sources: "Manbalar", page: "Sahifa", noData: "Maʼlumot yoʻq",
  },
  en: {
    title: "AI management", last30: "Last 30 days", conversations: "Conversations", replies: "AI replies", fallback: "Replies from catalogue search", errors: "Errors", tokens: "Tokens (in / out)", latency: "Average reply time", feedback: "Ratings (👍 / 👎)", bookings: "Hand-offs to booking request",
    provider: "Provider and model", chain: "Provider order", keys: "API keys (stored securely on the server)", notSet: "not set", noProvider: "No AI model is connected. The assistant answers from the tour catalogue only.",
    knowledge: "Knowledge base (always in sync with the catalogue)", tours: "Tours (published / total)", destinations: "Destinations", faq: "FAQ entries", articles: "Guide, experience and service pages (RAG)",
    byProvider: "Replies by provider", tools: "Catalogue lookups", settings: "Assistant settings", protected: "Protected rules (not editable): never invent prices, availability or booking status; never confirm bookings; catalogue facts only; never ask for personal data.",
    recent: "Recent conversations", id: "ID", time: "Time", lang: "Lang", source: "Source", question: "First question", status: "Status", none: "No conversations yet.", open: "Open", privacy: "Conversations are stored without names or emails; emails and phone numbers are masked before sending. IPs are stored only as hashes.",
    back: "← AI management", messages: "Messages", toolLogs: "Catalogue lookups", sources: "Sources", page: "Page", noData: "No data",
  },
} as const;

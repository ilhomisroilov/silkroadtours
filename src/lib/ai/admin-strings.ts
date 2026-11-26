export const AI_ADMIN = {
  uz: {
    title: "AI boshqaruvi", last30: "Soʻnggi 30 kun · faqat bazadagi haqiqiy yozuvlar", conversations: "Suhbatlar", replies: "AI javoblari", fallback: "Zaxira (bazadan) javoblar", errors: "Xatolar", tokens: "Tokenlar (kirish / chiqish)", latency: "Oʻrtacha javob vaqti", feedback: "Baholar (👍 / 👎)", bookings: "Bron soʻroviga oʻtishlar",
    provider: "Provayder va model", chain: "Navbat (asosiy → zaxira)", keys: "API kalitlar (faqat server .env)", notSet: "oʻrnatilmagan", noProvider: "Hech qanday AI provayder sozlanmagan: sayt bazadan qidiruv rejimida ishlaydi.",
    knowledge: "Bilim bazasi (jonli, har soʻrovda bazadan oʻqiladi)", tours: "Turlar (chop etilgan / jami)", destinations: "Manzillar", faq: "FAQ yozuvlari",
    byProvider: "Javoblar provayder boʻyicha", tools: "Asbob chaqiruvlari", settings: "Yordamchi sozlamalari", protected: "Himoyalangan qoidalar (oʻzgartirib boʻlmaydi): narx, boʻsh joy va bron holatini oʻylab topmaslik; bronni tasdiqlamaslik; faqat katalog maʼlumotlari; shaxsiy maʼlumot soʻramaslik.",
    recent: "Soʻnggi suhbatlar", id: "ID", time: "Vaqt", lang: "Til", source: "Manba", question: "Birinchi savol", status: "Holat", none: "Hali suhbatlar yoʻq.", open: "Ochish", privacy: "Suhbatlar ism/emailʼsiz saqlanadi; email va telefon raqamlari yuborishdan oldin yashiriladi. IP faqat xesh koʻrinishida.",
    back: "← AI boshqaruvi", messages: "Xabarlar", toolLogs: "Asbob chaqiruvlari jurnali", sources: "Manbalar", page: "Sahifa", noData: "Maʼlumot yoʻq",
  },
  en: {
    title: "AI management", last30: "Last 30 days · real database records only", conversations: "Conversations", replies: "AI replies", fallback: "Fallback (database) replies", errors: "Errors", tokens: "Tokens (in / out)", latency: "Average reply time", feedback: "Ratings (👍 / 👎)", bookings: "Hand-offs to booking request",
    provider: "Provider and model", chain: "Chain (primary → fallback)", keys: "API keys (server .env only)", notSet: "not set", noProvider: "No AI provider configured: the site runs in database-search mode.",
    knowledge: "Knowledge base (live, read from the database on every request)", tours: "Tours (published / total)", destinations: "Destinations", faq: "FAQ entries",
    byProvider: "Replies by provider", tools: "Tool calls", settings: "Assistant settings", protected: "Protected rules (not editable): never invent prices, availability or booking status; never confirm bookings; catalogue facts only; never ask for personal data.",
    recent: "Recent conversations", id: "ID", time: "Time", lang: "Lang", source: "Source", question: "First question", status: "Status", none: "No conversations yet.", open: "Open", privacy: "Conversations are stored without names or emails; emails and phone numbers are masked before sending. IPs are stored only as hashes.",
    back: "← AI management", messages: "Messages", toolLogs: "Tool call log", sources: "Sources", page: "Page", noData: "No data",
  },
} as const;

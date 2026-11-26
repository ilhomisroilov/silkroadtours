/**
 * Sample CRM pipeline for the investor demo (admin panel only). Invented people with example.com
 * addresses and fictional phone numbers; flagged internally by source_ref "SAMPLE-xxxx", so
 * `seed --reset` replaces them and they can be removed with one query before launch.
 */
export interface SeedLead {
  ref: string;
  stage: "new" | "contacted" | "qualified" | "offer_sent" | "negotiation" | "confirmed" | "completed" | "lost";
  fullName: string;
  email: string;
  phone: string;
  locale: "en" | "uz" | "ru";
  title: string;
  destination: string;
  interests: string;
  budgetUsd: number | null;
  /** Travel dates as days from today (negative = in the past). */
  fromDays: number;
  toDays: number;
  travellers: number;
  valueUsd: number | null;
  /** Follow-up as days from today, or null. */
  followUpDays: number | null;
  /** Created this many days ago. */
  ageDays: number;
  notes: string[];
}

export const sampleLeads: SeedLead[] = [
  { ref: "SAMPLE-0001", stage: "new", fullName: "Emma Lindqvist", email: "emma.lindqvist@example.com", phone: "+46 70 000 00 11", locale: "en", title: "Silk Road highlights for a couple", destination: "samarkand, bukhara", interests: "architecture, photography, food", budgetUsd: 2400, fromDays: 64, toDays: 72, travellers: 2, valueUsd: null, followUpDays: 0, ageDays: 0, notes: [] },
  { ref: "SAMPLE-0002", stage: "new", fullName: "Jasur Qodirov", email: "jasur.qodirov@example.com", phone: "+998 90 000 00 12", locale: "uz", title: "Oilaviy dam olish: Chorvoq", destination: "chimgan-charvak", interests: "togʻ, bolalar bilan dam olish", budgetUsd: 600, fromDays: 20, toDays: 23, travellers: 4, valueUsd: null, followUpDays: 1, ageDays: 1, notes: [] },
  { ref: "SAMPLE-0003", stage: "contacted", fullName: "Hiroshi Tanaka", email: "h.tanaka@example.com", phone: "+81 90 0000 0013", locale: "en", title: "Photography tour with a private guide", destination: "khiva, bukhara", interests: "sunrise photography, crafts", budgetUsd: 3500, fromDays: 95, toDays: 105, travellers: 1, valueUsd: 3100, followUpDays: 2, ageDays: 3, notes: ["Called back, prefers English-speaking guide and early starts."] },
  { ref: "SAMPLE-0004", stage: "contacted", fullName: "Olga Smirnova", email: "olga.smirnova@example.com", phone: "+7 900 000 00 14", locale: "ru", title: "Самарканд и Бухара на майские", destination: "samarkand, bukhara", interests: "история, гастрономия", budgetUsd: 1800, fromDays: 150, toDays: 157, travellers: 2, valueUsd: 1650, followUpDays: -1, ageDays: 5, notes: ["Просит отель с бассейном в Бухаре."] },
  { ref: "SAMPLE-0005", stage: "qualified", fullName: "Marco Bianchi", email: "marco.bianchi@example.com", phone: "+39 340 000 0015", locale: "en", title: "Group of 8: food and crafts", destination: "tashkent, samarkand, fergana-valley", interests: "cooking classes, ceramics, silk", budgetUsd: 12000, fromDays: 120, toDays: 130, travellers: 8, valueUsd: 11200, followUpDays: 3, ageDays: 7, notes: ["Needs vegetarian options for 2 travellers.", "Interested in Rishton ceramics workshop."] },
  { ref: "SAMPLE-0006", stage: "qualified", fullName: "Dilnoza Karimova", email: "dilnoza.karimova@example.com", phone: "+998 93 000 00 16", locale: "uz", title: "Xorazm sayohati: Xiva va qalʼalar", destination: "khiva, karakalpakstan-aral", interests: "qadimiy qalʼalar, yurtada tunash", budgetUsd: 900, fromDays: 40, toDays: 44, travellers: 3, valueUsd: 840, followUpDays: 4, ageDays: 6, notes: [] },
  { ref: "SAMPLE-0007", stage: "offer_sent", fullName: "Sophie Laurent", email: "sophie.laurent@example.com", phone: "+33 6 00 00 00 17", locale: "en", title: "Honeymoon: boutique hotels and desert camp", destination: "samarkand, bukhara, aydarkul", interests: "boutique hotels, desert, stargazing", budgetUsd: 5000, fromDays: 80, toDays: 90, travellers: 2, valueUsd: 4600, followUpDays: 2, ageDays: 9, notes: ["Offer sent with two hotel options in Bukhara."] },
  { ref: "SAMPLE-0008", stage: "offer_sent", fullName: "Alisher Nematov", email: "alisher.nematov@example.com", phone: "+998 97 000 00 18", locale: "uz", title: "Korporativ sayohat: 15 kishi, Samarqand", destination: "samarkand", interests: "jamoaviy dam olish, ekskursiya, kechki ziyofat", budgetUsd: 7500, fromDays: 30, toDays: 32, travellers: 15, valueUsd: 7200, followUpDays: 0, ageDays: 8, notes: ["Afrosiyob chiptalari ikki tomonga kerak."] },
  { ref: "SAMPLE-0009", stage: "negotiation", fullName: "Daniel Weber", email: "daniel.weber@example.com", phone: "+49 151 0000 0019", locale: "en", title: "Classic Silk Road 10 days, private", destination: "tashkent, samarkand, bukhara, khiva", interests: "history, architecture", budgetUsd: 6000, fromDays: 60, toDays: 70, travellers: 2, valueUsd: 5800, followUpDays: 1, ageDays: 12, notes: ["Asked for a 5% discount if booked this week."] },
  { ref: "SAMPLE-0010", stage: "confirmed", fullName: "Anna Kowalska", email: "anna.kowalska@example.com", phone: "+48 500 000 020", locale: "en", title: "Samarkand & Bukhara family trip", destination: "samarkand, bukhara", interests: "family, hands-on crafts", budgetUsd: 3200, fromDays: 25, toDays: 31, travellers: 4, valueUsd: 3050, followUpDays: 20, ageDays: 18, notes: ["Deposit received, hotels requested."] },
  { ref: "SAMPLE-0011", stage: "confirmed", fullName: "Rustam Yusupov", email: "rustam.yusupov@example.com", phone: "+998 91 000 00 21", locale: "ru", title: "Ферганская долина: ремёсла", destination: "fergana-valley", interests: "шёлк, керамика", budgetUsd: 700, fromDays: 14, toDays: 17, travellers: 2, valueUsd: 680, followUpDays: 10, ageDays: 15, notes: [] },
  { ref: "SAMPLE-0012", stage: "completed", fullName: "Grace Thompson", email: "grace.thompson@example.com", phone: "+44 7700 000022", locale: "en", title: "Tashkent city break", destination: "tashkent", interests: "metro, bazaars, museums", budgetUsd: 900, fromDays: -20, toDays: -16, travellers: 2, valueUsd: 860, followUpDays: null, ageDays: 40, notes: ["Trip completed, asked for review."] },
  { ref: "SAMPLE-0013", stage: "completed", fullName: "Kamola Sharipova", email: "kamola.sharipova@example.com", phone: "+998 99 000 00 23", locale: "uz", title: "Zomin togʻlari: 3 kun", destination: "zaamin", interests: "piyoda yurish, tabiat", budgetUsd: 350, fromDays: -12, toDays: -9, travellers: 2, valueUsd: 330, followUpDays: null, ageDays: 30, notes: [] },
  { ref: "SAMPLE-0014", stage: "lost", fullName: "Lucas Martin", email: "lucas.martin@example.com", phone: "+33 6 00 00 00 24", locale: "en", title: "Stopover in Tashkent", destination: "tashkent", interests: "short stopover", budgetUsd: 300, fromDays: 10, toDays: 11, travellers: 1, valueUsd: null, followUpDays: null, ageDays: 20, notes: ["Changed flights, no longer stopping in Tashkent."] },
];

import type { FaqCategory, LocalizedText } from "../../src/db/types.ts";
import { L } from "./common.ts";

export interface SeedFaq {
  category: FaqCategory;
  question: LocalizedText;
  answer: LocalizedText;
}

// Facts checked November 2026. Entry rules change — the agency should review this list each season.
export const faq: SeedFaq[] = [
  {
    category: "visa",
    question: L("Do I need a visa for Uzbekistan?", "Oʻzbekistonga kirish uchun viza kerakmi?", "Нужна ли виза в Узбекистан?"),
    answer: L(
      "Citizens of around 90 countries can visit visa-free, usually for up to 30 days — including the UK, most EU countries, Japan, South Korea, Australia, Canada, and (since 1 January 2026) the United States. CIS citizens can stay longer. Most other nationalities can apply online for an e-visa at e-visa.gov.uz. Rules change, so check the official sources before you travel; we send a checklist after booking.",
      "Taxminan 90 ta davlat fuqarolari vizasiz, odatda 30 kungacha kirishi mumkin — jumladan Buyuk Britaniya, aksariyat YeI davlatlari, Yaponiya, Janubiy Koreya, Avstraliya, Kanada va (2026-yil 1-yanvardan) AQSh. MDH fuqarolari uzoqroq qolishi mumkin. Boshqa fuqarolar e-visa.gov.uz saytida elektron vizaga onlayn ariza berishi mumkin. Qoidalar oʻzgarib turadi, sayohatdan oldin rasmiy manbalarni tekshiring; bron qilgandan soʻng biz roʻyxat yuboramiz.",
      "Граждане примерно 90 стран могут въезжать без визы, обычно до 30 дней, — включая Великобританию, большинство стран ЕС, Японию, Южную Корею, Австралию, Канаду и (с 1 января 2026 года) США. Граждане СНГ могут оставаться дольше. Большинство остальных могут оформить электронную визу на e-visa.gov.uz. Правила меняются — проверяйте официальные источники перед поездкой; после бронирования мы присылаем памятку.",
    ),
  },
  {
    category: "visa",
    question: L("What is tourist registration?", "Turistik roʻyxatdan oʻtish nima?", "Что такое регистрация туриста?"),
    answer: L(
      "Foreign visitors must be registered at their place of stay. Hotels, guesthouses and yurt camps do this for you automatically through the E-mehmon system, and the tourist fee is included in your accommodation on our tours. If you stay privately with friends, your host must register you via emehmon.uz. Keep your registration slips until you leave.",
      "Xorijiy mehmonlar yashash joyida roʻyxatdan oʻtishi shart. Mehmonxonalar, mehmon uylari va oʻtovlar lagerlari buni E-mehmon tizimi orqali avtomatik bajaradi, sayohatlarimizda turistik yigʻim yashash narxiga kiritilgan. Agar tanishlaringiznikida qolsangiz, mezbon sizni emehmon.uz orqali roʻyxatdan oʻtkazishi kerak. Roʻyxatdan oʻtganlik qogʻozlarini ketguncha saqlang.",
      "Иностранные гости должны быть зарегистрированы по месту пребывания. Отели, гостевые дома и юртовые лагеря делают это автоматически через систему E-mehmon, а туристический сбор на наших турах включён в проживание. Если вы живёте у знакомых, хозяин должен зарегистрировать вас через emehmon.uz. Сохраняйте талоны регистрации до выезда.",
    ),
  },
  {
    category: "currency",
    question: L("What money should I bring?", "Qanday pul olib kelish kerak?", "Какие деньги брать с собой?"),
    answer: L(
      "The currency is the Uzbek so'm (UZS). Bring clean US dollars or euros and change them at banks or exchange offices — not on the street. Visa and Mastercard work in hotels, larger restaurants and ATMs in the main cities, but bazaars, taxis and villages are cash-only.",
      "Milliy valyuta — oʻzbek soʻmi (UZS). Toza AQSh dollari yoki yevro olib keling va ularni koʻchada emas, bank yoki ayirboshlash shoxobchalarida almashtiring. Visa va Mastercard yirik shaharlardagi mehmonxonalar, katta restoranlar va bankomatlarda ishlaydi, ammo bozor, taksi va qishloqlarda faqat naqd pul.",
      "Валюта — узбекский сум (UZS). Привозите чистые доллары США или евро и меняйте их в банках или обменных пунктах, а не на улице. Visa и Mastercard принимают в отелях, крупных ресторанах и банкоматах больших городов, но на базарах, в такси и в кишлаках — только наличные.",
    ),
  },
  {
    category: "currency",
    question: L("Should I tip?", "Choychaqa berish kerakmi?", "Нужно ли оставлять чаевые?"),
    answer: L(
      "Tipping is not obligatory but appreciated. Many restaurants add a 10–15% service charge. For guides and drivers on multi-day tours, travellers commonly give a small amount per day if they were happy with the service.",
      "Choychaqa majburiy emas, lekin qadrlanadi. Koʻplab restoranlar hisobga 10–15% xizmat haqini qoʻshadi. Koʻp kunlik sayohatlarda xizmatdan mamnun boʻlgan sayohatchilar odatda gid va haydovchilarga har kuni uchun kichik miqdor beradi.",
      "Чаевые не обязательны, но приятны. Многие рестораны добавляют 10–15% за обслуживание. Гидам и водителям на многодневных турах, если всё понравилось, обычно оставляют небольшую сумму за каждый день.",
    ),
  },
  {
    category: "transport",
    question: L("How do I travel between cities?", "Shaharlar orasida qanday harakatlanaman?", "Как перемещаться между городами?"),
    answer: L(
      "The Afrosiyob high-speed train links Tashkent, Samarkand and Bukhara (Tashkent–Samarkand takes about 2 hours) and sells out early in spring and autumn — we buy tickets as soon as booking opens. Khiva and Nukus are reached by regular trains, domestic flights or by road. On our tours all transport is arranged.",
      "Afrosiyob tezyurar poyezdi Toshkent, Samarqand va Buxoroni bogʻlaydi (Toshkent–Samarqand taxminan 2 soat) va bahor hamda kuzda chiptalar tez tugaydi — biz sotuv ochilishi bilan chipta olamiz. Xiva va Nukusga oddiy poyezd, ichki reys yoki avtomobil yoʻli orqali boriladi. Sayohatlarimizda barcha transport biz tomondan tashkil etiladi.",
      "Скоростной «Афросиёб» связывает Ташкент, Самарканд и Бухару (Ташкент–Самарканд — около 2 часов), весной и осенью билеты раскупают рано — мы покупаем их сразу после открытия продаж. В Хиву и Нукус — обычными поездами, внутренними рейсами или по дороге. На наших турах весь транспорт организован.",
    ),
  },
  {
    category: "transport",
    question: L("How do I get around inside cities?", "Shahar ichida qanday yuraman?", "Как передвигаться по городу?"),
    answer: L(
      "Tashkent has an excellent and cheap metro. In all cities ride-hailing apps such as Yandex Go are widely used and show the price in advance. Old towns of Bukhara and Khiva are best explored on foot.",
      "Toshkentda ajoyib va arzon metro bor. Barcha shaharlarda Yandex Go kabi taksi ilovalari keng qoʻllaniladi va narxni oldindan koʻrsatadi. Buxoro va Xivaning eski shaharlarini piyoda kezish eng yaxshi.",
      "В Ташкенте отличное и недорогое метро. Во всех городах популярны приложения такси вроде Yandex Go — цена видна заранее. Старые города Бухары и Хивы лучше всего обходить пешком.",
    ),
  },
  {
    category: "dress_code",
    question: L("Is there a dress code?", "Kiyinish qoidalari bormi?", "Есть ли дресс-код?"),
    answer: L(
      "Uzbekistan is relaxed and modern, but modest clothing is respectful. When visiting active mosques and shrines, cover shoulders and knees; women may be asked to cover their hair, so carry a light scarf. Remove shoes where indicated.",
      "Oʻzbekiston erkin va zamonaviy, ammo odobli kiyinish hurmat belgisi. Faol masjid va qadamjolarga kirishda yelka va tizzalarni yoping; ayollardan sochni yopish soʻralishi mumkin, shuning uchun yengil roʻmol olib yuring. Koʻrsatilgan joylarda poyabzalni yeching.",
      "Узбекистан — спокойная и современная страна, но скромная одежда — знак уважения. В действующих мечетях и святынях закрывайте плечи и колени; женщин могут попросить покрыть голову, поэтому возьмите лёгкий платок. Разувайтесь, где это указано.",
    ),
  },
  {
    category: "safety",
    question: L("Is Uzbekistan safe for travellers?", "Oʻzbekiston sayohatchilar uchun xavfsizmi?", "Безопасен ли Узбекистан для путешественников?"),
    answer: L(
      "Uzbekistan is widely regarded as one of the safest countries in the region, with a visible tourist police presence in the historic cities. Take normal precautions with valuables in crowded bazaars, use licensed taxis or apps, and carry a copy of your passport.",
      "Oʻzbekiston mintaqadagi eng xavfsiz davlatlardan biri hisoblanadi, tarixiy shaharlarda turistik politsiya xizmat qiladi. Gavjum bozorlarda qimmatbaho buyumlaringizga odatdagidek ehtiyot boʻling, litsenziyali taksi yoki ilovalardan foydalaning va pasportingiz nusxasini yoningizda olib yuring.",
      "Узбекистан считается одной из самых безопасных стран региона, в исторических городах работает туристическая полиция. Соблюдайте обычные меры предосторожности на многолюдных базарах, пользуйтесь лицензированным такси или приложениями и носите с собой копию паспорта.",
    ),
  },
  {
    category: "health",
    question: L("Any health tips?", "Salomatlik boʻyicha maslahatlar bormi?", "Есть ли советы по здоровью?"),
    answer: L(
      "Drink bottled or filtered water. Summers are very hot and dry — carry water, a hat and sunscreen, and plan sightseeing for mornings and evenings. Pharmacies are easy to find in cities. Travel insurance with medical cover is strongly recommended.",
      "Shishadagi yoki filtrlangan suv iching. Yoz juda issiq va quruq — suv, bosh kiyim va quyoshdan himoya kremi olib yuring, ekskursiyalarni ertalab va kechqurunga rejalashtiring. Shaharlarda dorixonalar koʻp. Tibbiy qoplamali sayohat sugʻurtasi qatʼiy tavsiya etiladi.",
      "Пейте бутилированную или фильтрованную воду. Лето очень жаркое и сухое — берите воду, головной убор и солнцезащитный крем, планируйте экскурсии на утро и вечер. Аптеки в городах легко найти. Настоятельно рекомендуем страховку с медицинским покрытием.",
    ),
  },
  {
    category: "general",
    question: L("When is the best time to visit?", "Tashrif buyurish uchun eng yaxshi vaqt qachon?", "Когда лучше ехать?"),
    answer: L(
      "April–June and September–October are ideal for the Silk Road cities and the desert. July–August is best for the mountains of Zaamin and Chimgan. December–March is the ski season in Chimgan and Amirsoy and a quiet, mild time for city tours.",
      "Ipak yoʻli shaharlari va choʻl uchun aprel–iyun va sentabr–oktabr eng maqbul. Zomin va Chimyon togʻlari uchun iyul–avgust eng yaxshi. Dekabr–mart Chimyon va Amirsoyda changʼi mavsumi, shahar sayohatlari uchun esa sokin va yumshoq vaqt.",
      "Апрель–июнь и сентябрь–октябрь — идеально для городов Шёлкового пути и пустыни. Июль–август — лучшее время для гор Заамина и Чимгана. Декабрь–март — горнолыжный сезон в Чимгане и Амирсое и спокойное мягкое время для городских туров.",
    ),
  },
  {
    category: "general",
    question: L("Can I get a local SIM card?", "Mahalliy SIM-karta olsam boʻladimi?", "Можно ли купить местную SIM-карту?"),
    answer: L(
      "Yes. Mobile operators such as Beeline, Ucell and Mobiuz sell tourist SIM cards at the airport and in city offices; bring your passport. Mobile internet is fast in cities and available along most main roads.",
      "Ha. Beeline, Ucell va Mobiuz kabi mobil operatorlar aeroportda va shahar ofislarida turistik SIM-kartalar sotadi; pasportingizni olib keling. Shaharlarda mobil internet tez va koʻpchilik asosiy yoʻllarda mavjud.",
      "Да. Операторы Beeline, Ucell и Mobiuz продают туристические SIM-карты в аэропорту и в городских офисах; нужен паспорт. Мобильный интернет быстрый в городах и доступен вдоль большинства трасс.",
    ),
  },
  {
    category: "general",
    question: L("How do I pay for my tour?", "Sayohat uchun qanday toʻlayman?", "Как оплатить тур?"),
    answer: L(
      "Send a booking request on the website — it costs nothing and creates a reference number. Our team confirms availability and the final price by WhatsApp, Telegram or email, usually within a few hours, and explains the payment options for your tour.",
      "Saytda bron soʻrovini yuboring — bu bepul va sizga bron raqami beriladi. Jamoamiz odatda bir necha soat ichida WhatsApp, Telegram yoki elektron pochta orqali joy mavjudligi va yakuniy narxni tasdiqlaydi hamda toʻlov usullarini tushuntiradi.",
      "Отправьте заявку на сайте — это бесплатно, вы получите номер бронирования. Наша команда обычно в течение нескольких часов подтверждает наличие мест и итоговую цену в WhatsApp, Telegram или по почте и рассказывает о вариантах оплаты.",
    ),
  },
];

// Author and licence of the photos used on hotel, restaurant and transport pages.
// Destination/experience photos are credited in public/images/credits.json; the few photos added for
// places (public/images/places) are listed here. All come from Wikimedia Commons under free licences.
import credits from "../../../public/images/credits.json";

export interface PhotoCredit {
  author: string;
  license: string;
  source: string;
}

const PLACES: Record<string, PhotoCredit> = {
  "places/samsa-khiva.jpg": { author: "Davide Mauro", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Samsa_of_Khiva.jpg" },
  "places/lagman.jpg": { author: "赤猫法師", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Uzbek_lagman.jpg" },
  "places/shashlik.jpg": { author: "Muharramxon", license: "CC BY 4.0", source: "https://commons.wikimedia.org/wiki/File:Shashlik-national_food_of_Uzbekistan.jpg" },
  "places/shivit-oshi.jpg": { author: "Jamshid Nurkulov", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Shivit_oshi.jpg" },
  "places/samsa-sauce.jpg": { author: "赤猫法師", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Uzbek_samsa_and_sauce.jpg" },
  "places/dastarkhan.jpg": { author: "Bunyod Rustamov", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Uzbek_national_dastarkhan.jpg" },
  "places/karakalpak-dastarkhan.jpg": { author: "Damirovna", license: "CC BY 4.0", source: "https://commons.wikimedia.org/wiki/File:Traditional_Karakalpak_Dastarkhan_Spread_Nukus.jpg" },
  "places/afrosiyob-samarkand.jpg": {
    author: "Adam Jones",
    license: "CC BY-SA 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Afrosiyob_Express_Train_in_Station_-_Samarkand_-_Uzbekistan_(7502824436)_(3).jpg",
  },
};

const BASE = credits as Record<string, { author?: string; license?: string; source?: string }>;

/** Credit line data for a /images/... photo, if we know it. */
export function photoCredit(src: string | null | undefined): PhotoCredit | null {
  if (!src) return null;
  const key = src.replace(/^\/images\//, "");
  const c = PLACES[key] ?? BASE[key];
  if (!c?.author || !c.license) return null;
  return { author: c.author.replace(/\s+/g, " ").trim().slice(0, 60), license: c.license, source: c.source ?? "https://commons.wikimedia.org" };
}

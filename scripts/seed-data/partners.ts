/**
 * Internal example partner profiles (partners table, source = "sample").
 * They show administrators how the review workflow looks and are NEVER shown on the public site:
 * they are not real businesses and imply no partnership. Names are clearly generic.
 */
import type { PartnerStatus, PartnerType } from "../../src/db/types.ts";

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
}

export const samplePartners: SeedPartner[] = [
  {
    type: "hotel",
    status: "pending",
    businessName: "Sample: courtyard guesthouse, Bukhara",
    contactName: "Sample contact",
    email: "guesthouse.sample@example.com",
    phone: "+998 90 000 00 01",
    website: null,
    destinationSlug: "bukhara",
    city: "Bukhara",
    description: "Example application: eight rooms in a restored merchant house near Lyabi-Hauz.",
    services: ["Double room from $45", "Family room from $70", "Airport pick-up"],
    locale: "en",
  },
];

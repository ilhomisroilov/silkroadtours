/** Click-to-chat links built from the agency contact settings. Empty settings give null (the button is hidden). */
export function messengerLinks(contact: { whatsapp: string; telegram: string; phone: string }, text?: string) {
  const digits = (v: string) => v.replace(/[^\d]/g, "");
  const tg = contact.telegram
    .trim()
    .replace(/^https?:\/\/(www\.)?t\.me\//, "")
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9_]/g, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return {
    whatsapp: digits(contact.whatsapp) ? `https://wa.me/${digits(contact.whatsapp)}${q}` : null,
    telegram: tg ? `https://t.me/${tg}${q}` : null,
    phone: digits(contact.phone) ? `tel:+${digits(contact.phone)}` : null,
  };
}

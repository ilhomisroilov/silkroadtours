import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/db/types";

/** The assistant now lives on the AI travel guide page. */
export default async function AssistantPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/ai-guide`);
}

import type { ReactNode } from "react";
import "./globals.css";

/**
 * The customer site (app/[locale]/layout.tsx) and the admin panel (app/admin/layout.tsx)
 * each render their own <html> element with the right `lang`, so this root layout only passes through.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

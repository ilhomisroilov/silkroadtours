// Fonts are self-hosted from @fontsource packages (imported in the locale/admin layouts), so the
// build needs no access to Google Fonts. Noto Serif Display and Manrope both ship Latin Extended
// (incl. the Uzbek ʻ U+02BB) and Cyrillic + Cyrillic Extended (ў қ ғ ҳ) subsets.
import "@fontsource-variable/manrope";
import "@fontsource/noto-serif-display/400.css";
import "@fontsource/noto-serif-display/400-italic.css";
import "@fontsource/noto-serif-display/500.css";

export const displayFont = { variable: "" };
export const bodyFont = { variable: "" };

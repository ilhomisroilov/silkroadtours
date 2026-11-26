# Design system — "Modern Silk Road"

Premium, international and trustworthy, with an unmistakably Uzbek soul. National identity is the core of the brand, not decoration: the arch, the star lattice and the national palette appear on every page, used with restraint.

**Code:** tokens in `src/app/globals.css` (`@theme`), ornaments in `src/components/ornament/`, UI primitives in `src/components/ui/`, motion in `src/components/common/motion.tsx`.

---

## 1. Cultural sources (interpreted, never copied)

| Source | How we use it | Where |
|---|---|---|
| **Girih geometry** (Registan, Shah-i-Zinda, Khiva tilework): 8- and 10-point stars, interlacing strapwork | `GirihPattern`: an 8-point *khatam* star (union of two squares) on a centred-square lattice, with octagon rosettes and four-point nodes, drawn as thin double lines. `GirihRosette`: a {10/3} star polygon in a decagon. | Dark bands, hero, header strip, footer, fallbacks, logo, loading spinner |
| **Iwan / peshtaq portal** (pointed arch) | `.arch-mask` and `.arch-mask-wide` CSS masks for images; `ArchFrame` draws a thin saffron outline; the audience gateway cards have arched tops | Hero image, tour cards, destination cards, gateway |
| **Islimi** (vine-scroll arabesque) | `IslimiBorder`: a wave stem with spiral tendrils and split leaves, repeated horizontally | Footer base, quiet section dividers |
| **Suzani embroidery** (medallions, pomegranates) | `SuzaniMedallion`: eight pomegranate petals, a sixteen-leaf ring and dotted borders | Hero accent, empty states, 404, confirmation |
| **Ikat / adras / atlas silk** (feathered stripe edges) | `IkatDivider`: stepped "feathered" diamonds with a slight deterministic jitter | Under the hero, top of the footer |
| **Rishtan ceramics** (ishkor cobalt and turquoise) | `cobalt` and `turquoise` tokens; turquoise dome in `DomeSilhouette` | Links, focus rings, accents |
| **Ribbed turquoise domes** | `DomeSilhouette` (drum, ribs, finial) | Image fallbacks |
| **Landscape**: desert sand, pomegranate orchards, Zaamin junipers | `sand`, `pomegranate` and `turquoise-ink` tokens | Section backgrounds, domestic hub |

All geometry is computed in `src/components/ornament/geometry.ts` (star polygons, stepped diamonds, arch curves). `npx tsx scripts/build-ornaments.ts` turns it into small static files in `public/ornament/` (lattice tiles per colour, islimi and ikat strips, two suzani medallions, the dome). Components reference those files as CSS backgrounds or `<img>`, so every page reuses the same cached files instead of repeating SVG markup in its HTML (this cut the home page HTML from 361 KB to 204 KB raw, 18.7 KB compressed). Only the tiny rosette (logo, spinner) and the arch frame stay inline. No artwork was traced or downloaded.

## 2. Colour tokens and contrast (WCAG 2.2 AA)

| Token | Hex | Role |
|---|---|---|
| `lapis` | `#1F3A93` | Primary brand, secondary buttons, headings on light |
| `lapis-deep` | `#14235C` | Dark bands (hero, "why us"), headings |
| `lapis-night` | `#0E1A45` | Footer |
| `cobalt` | `#1E5AA8` | Links, focus ring |
| `turquoise` | `#2A9D8F` | Icons, map accents, dome (non-text, ≥ 3:1) |
| `turquoise-ink` | `#1F7A70` | Turquoise **text** on light |
| `terracotta` | `#B5532E` | Primary CTA background |
| `terracotta-deep` | `#9C4524` | CTA hover, accent text |
| `saffron` | `#D4A24C` | Ornament lines; text only on lapis-deep/night |
| `saffron-ink` | `#7A5C1F` | Saffron-toned **text** on light (eyebrows) |
| `pomegranate` | `#9E2A3A` | Ikat, suzani, domestic accent, required marks |
| `sand` / `sand-soft` | `#E9D8B8` / `#F2E8D5` | Warm surfaces |
| `ivory` | `#FAF6EF` | Page background |
| `ink` / `ink-muted` | `#1E1A16` / `#5E554C` | Body / secondary text |
| `field` | `#8A7B69` | Form-control borders |

Measured contrast ratios for every pair used in components:

| Pair | Ratio | Use |
|---|---|---|
| ink on ivory | 16.05 | body text ✅ |
| ink-muted on ivory / sand / white | 6.77 / 5.20 / 7.29 | secondary text ✅ |
| lapis on ivory / sand | 9.35 / 7.18 | headings, links ✅ |
| cobalt on ivory | 6.32 | links ✅ |
| white on terracotta | 4.95 | CTA text ✅ |
| white on lapis / cobalt | 10.07 / 6.81 | buttons ✅ |
| turquoise-ink on ivory | 4.78 | small text ✅ |
| saffron-ink on ivory | 5.77 | eyebrows ✅ |
| saffron on lapis-deep / lapis-night | 6.37 / 7.24 | text on dark ✅ |
| sand on lapis-deep / lapis-night | 10.51 / 11.96 | body on dark ✅ |
| pomegranate on ivory / sand-soft | 6.85 / 6.07 | accents ✅ |
| field border on ivory | 3.81 | form controls (1.4.11) ✅ |
| turquoise on ivory | 3.09 | **icons/UI only**, never text |
| saffron on ivory | 2.15 | **ornament only**, never text |

The original brief's turquoise and saffron fail as text on light backgrounds, so the `-ink` variants were added rather than lightening the brand colours.

**Dark sections** (`bg-girih-dark`, lapis-deep with saffron lattice) carry the class `on-dark`, which switches the focus ring to saffron.

## 3. Typography

| Role | Family | Why |
|---|---|---|
| Display (h1–h3, card titles) | **Cormorant** (variable, 300–700) | Calligraphic, high-contrast serif with character; reads as heritage without pastiche |
| Body and UI | **Source Sans 3** (variable, 200–900) | Humanist sans, very legible at small sizes, wide language support |

**Glyph coverage was verified before choosing** (script: download each Google Fonts subset and inspect the `cmap` with fontTools):

| Font | Latin Ext | Cyrillic | Uzbek Cyrillic ў қ ғ ҳ | ʻ U+02BB / ʼ U+02BC |
|---|---|---|---|---|
| Cormorant | ✅ | ✅ | ✅ | ✅ |
| Source Sans 3 | ✅ | ✅ | ✅ | ✅ |
| Fraunces (rejected) | ✅ | ❌ | ❌ | ❌ |
| Playfair Display (rejected) | ✅ | ✅ | ❌ | ✅ |
| Prata (rejected) | ❌ | ✅ | ❌ | ❌ |

Test strings "Oʻzbekiston", "Fargʻona" and "Самарканд" render in both families. Fonts are self-hosted by `next/font`, the Latin files are preloaded, and both use `font-display: optional`: the preloaded font is normally ready within the ~100 ms block period; if it is late, that page view keeps the fallback rather than swapping mid-read. (With `swap`, the generated fallbacks depend on local Times New Roman/Arial; where those are missing — Android phones, Linux CI — long titles re-wrapped on swap and shifted the page by CLS 0.19.)

**Scale:** modular ratio 1.25, base 17 px (Source Sans has a modest x-height). Display sizes are fluid with `clamp()`:

| Token | Size |
|---|---|
| `text-sm` / `text-base` | 15 / 17 px |
| `text-xl` | clamp(20 → 24 px) |
| `text-2xl` | clamp(24 → 32 px) |
| `text-3xl` | clamp(30 → 44 px) |
| `text-4xl` | clamp(36 → 60 px) |
| `text-5xl` | clamp(44 → 84 px) |

## 4. Ornament rules

- **Thin saffron lines on lapis**: lattice at ~30 % opacity. **On ivory**: lapis lines at ≤ 12 % opacity.
- At most one strong ornament per viewport: a lattice band, or a medallion, or an ikat strip.
- Ornaments are always `aria-hidden` and never carry information.
- Image fallbacks (`BrandedFallback`): lattice + arch + dome + place name, used automatically for any `/images/...` path missing at build time (manifest in `next.config.ts`), so there are no broken images and no 404 requests.

## 5. Motion

- `Reveal` (Framer Motion): 0.8 s fade-and-rise when a block scrolls into view. Content is visible in the server HTML; only blocks that start below the fold are hidden after hydration and then revealed, so nothing on the first screen flickers and crawlers/no-JS readers see everything.
- `HeroParallax` (Framer Motion): background layer only, 12 % travel.
- `DrawnRule`: the ornament line under section titles draws itself in with a CSS scroll-driven animation (`animation-timeline: view()`); browsers without support show it static. It costs no JavaScript, which keeps the many headings off the main thread.
- Framer Motion is loaded through `LazyMotion` with its animation features fetched **after** hydration, and `MotionConfig reducedMotion="user"`. A global CSS rule also neutralises animations under `prefers-reduced-motion`.
- Only `transform` and `opacity` animate (no CLS), and the LCP element (the hero heading) is never animated.

## 6. Photography direction (for the owner's photos)

- Warm golden-hour light; people, crafts and food alongside monuments.
- Always shown inside arch masks or framed cards, never full-bleed rectangles.
- JPEG ~1600 px wide (heroes) and ~1200 px (galleries), < 300 KB each. Paths are listed in `drizzle/seed-images.txt`.
- Never stock photos or AI-generated images of real monuments presented as real.

## 7. Components and standards

| Need | Component | Notes |
|---|---|---|
| Dialog, mobile menu (sheet) | Radix Dialog (`ui/dialog.tsx`) | Focus trap, Esc, labelled title |
| Language picker, departure picker | Radix Popover | |
| Currency switcher | Radix Select | Writes the `CURRENCY` cookie, refreshes server prices |
| Admin editor | Radix Tabs | |
| Itinerary, FAQ | Radix Accordion | Content is force-mounted (hidden when closed) so crawlers see the full text |
| Admin feedback | Radix Toast | |
| Departure calendar | react-day-picker (`ui/calendar.tsx`) | |
| Form selects | Native `<select>` (`ui/form.tsx`) | Deliberate: native pickers are the most accessible and mobile-friendly option for plain lists, and they work before JavaScript loads |

- **Layout:** mobile-first, Tailwind breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536), 12-column grid inside `.container-page` (max 80 rem, 16/24/32 px gutters).
- **Touch targets:** every interactive element is at least 44 × 44 px (`min-h-11`, `size-11`).
- **Forms:** label + control + hint + inline error (`Field`), wired with `aria-invalid` and `aria-describedby`. React Hook Form with the shared Zod schemas; API error codes map to `messages/*.json → errors.*`. Inputs are never cleared after an error.
- **Focus:** 3 px cobalt outline with 2 px offset; saffron on dark sections.

## 8. Performance budget (measured)

Lighthouse 12, mobile emulation (slow 4G, 4× CPU), median of 5 runs, Workers build behind gzip/brotli as on Cloudflare's edge:

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/en` | 0.99 | 1.00 | 1.00 | 1.00 | 1.1 s | 0.000 | 123 ms |
| `/en/tours` | 0.99 | 0.98 | 1.00 | 1.00 | 1.1 s | 0.000 | 97 ms |
| `/en/tours/classic-silk-road-8-days` | 0.96 | 1.00 | 1.00 | 1.00 | 1.1 s | 0.000 | 211 ms |

Rules that keep it there: no inline decorative SVG in repeated components; no route-level `loading.tsx` on content pages (it streams a skeleton first and delays LCP); fonts preloaded (Latin subset only) with `font-display: optional` (no swap shift on devices without Times New Roman/Arial); carousel, lightbox, calendar and map code loaded on demand; links don't prefetch by default.

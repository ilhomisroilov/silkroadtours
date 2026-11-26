"use client";

import useEmblaCarousel from "embla-carousel-react";
import { Expand } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import dynamic from "next/dynamic";

const Lightbox = dynamic(() => import("./lightbox"), { ssr: false });

export interface GalleryImage {
  src: string;
  alt: string;
}

/**
 * Photo gallery: swipeable carousel on mobile (Embla), mosaic on desktop, full-screen lightbox
 * with keyboard and swipe support. Only photos that really exist are passed in.
 */
export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const t = useTranslations("common");
  const [index, setIndex] = useState(-1);
  const [emblaRef] = useEmblaCarousel({ align: "start", loop: false });
  if (images.length === 0) return null;
  const open = (i: number) => setIndex(i);
  return (
    <section aria-label={t("gallery")}>
      <h2 className="sr-only">{title}</h2>
      <div className="overflow-hidden md:hidden" ref={emblaRef}>
        <ul className="flex gap-3">
          {images.map((img, i) => (
            <li key={img.src} className="min-w-0 shrink-0 grow-0 basis-[85%]">
              <button type="button" onClick={() => open(i)} className="block aspect-[4/3] w-full overflow-hidden rounded-sm" aria-label={t("openGallery", { index: i + 1, total: images.length })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" width={1200} height={900} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <ul className="hidden gap-3 md:grid md:grid-cols-4 md:grid-rows-2">
        {images.slice(0, 5).map((img, i) => (
          <li key={img.src} className={i === 0 ? "col-span-2 row-span-2" : ""}>
            <button type="button" onClick={() => open(i)} className="group relative block h-full min-h-40 w-full overflow-hidden rounded-sm" aria-label={t("openGallery", { index: i + 1, total: images.length })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" width={1200} height={900} />
              {i === 4 && images.length > 5 && (
                <span className="absolute inset-0 flex items-center justify-center bg-lapis-night/60 text-lg font-semibold text-white">+{images.length - 5}</span>
              )}
              <Expand aria-hidden="true" className="absolute bottom-3 right-3 size-5 text-white opacity-0 drop-shadow group-hover:opacity-100" />
            </button>
          </li>
        ))}
      </ul>
      {index >= 0 && <Lightbox index={index} close={() => setIndex(-1)} slides={images.map((i) => ({ src: i.src, alt: i.alt }))} />}
    </section>
  );
}

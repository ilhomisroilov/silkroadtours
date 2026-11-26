"use client";

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

/** Full-screen photo viewer, loaded on first click (keyboard, swipe and Esc supported). */
export default function GalleryLightbox({ index, close, slides }: { index: number; close: () => void; slides: { src: string; alt: string }[] }) {
  return <Lightbox open index={index} close={close} slides={slides} />;
}

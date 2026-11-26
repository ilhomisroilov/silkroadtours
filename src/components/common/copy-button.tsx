"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* clipboard blocked: the reference is still visible to copy by hand */
        }
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-saffron/60 px-4 text-sm font-semibold text-ivory hover:bg-white/10"
    >
      {done ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      <span aria-live="polite">{done ? copiedLabel : label}</span>
    </button>
  );
}

"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/db/types";

export function NewsletterForm({ locale, labels }: { locale: Locale; labels: { email: string; subscribe: string; done: string; error: string } }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") {
    return (
      <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold" role="status">
        <CheckCircle2 aria-hidden="true" className="size-5 text-saffron" />
        {labels.done}
      </p>
    );
  }
  return (
    <form
      className="mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email") ?? "");
        setState("busy");
        try {
          const r = await fetch("/api/newsletter", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, locale }),
          });
          setState(r.ok ? "done" : "error");
        } catch {
          setState("error");
        }
      }}
    >
      <div className="flex rounded-full bg-white p-1">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{labels.email}</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={labels.email}
            className="h-11 w-full rounded-full bg-transparent px-4 text-[0.95rem] text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={state === "busy"}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-saffron px-4 text-sm font-bold text-lapis-deep hover:bg-[#e6b55a] disabled:opacity-60"
        >
          {labels.subscribe}
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      {state === "error" && (
        <p className="mt-2 text-sm text-[#ffb4a8]" role="alert">
          {labels.error}
        </p>
      )}
    </form>
  );
}

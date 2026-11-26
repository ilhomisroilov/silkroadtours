"use client";

import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
    __turnstileLoading?: Promise<void>;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const CONFIGURED_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
/**
 * The widget is shown only with a real site key. Cloudflare's public test keys (1x…, 2x…, 3x…) render a
 * "testing only" box that visitors should never see, so with them (or with no key) the page sends a fixed
 * token and the server decides: its test secret accepts it, a real secret rejects it.
 */
export const TURNSTILE_SITE_KEY = /^[123]x0{10,}/.test(CONFIGURED_SITE_KEY) ? "" : CONFIGURED_SITE_KEY;
export const TURNSTILE_ENABLED = TURNSTILE_SITE_KEY !== "";
const UNCHECKED_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  window.__turnstileLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      window.__turnstileLoading = undefined;
      reject(new Error("turnstile_script_failed"));
    };
    document.head.appendChild(s);
  });
  return window.__turnstileLoading;
}

export interface TurnstileHandle {
  reset: () => void;
}

/** Cloudflare Turnstile (bot protection). Calls onToken with a token, or "" when it expires/errors. */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string) => void; locale: string; error?: string }>(
  function Turnstile({ onToken, locale, error }, ref) {
    const t = useTranslations("booking");
    const te = useTranslations("errors");
    const box = useRef<HTMLDivElement>(null);
    const widget = useRef<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const cb = useRef(onToken);
    cb.current = onToken;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (!TURNSTILE_ENABLED) return cb.current(UNCHECKED_TOKEN);
        if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
        cb.current("");
      },
    }));

    useEffect(() => {
      if (!TURNSTILE_ENABLED) {
        cb.current(UNCHECKED_TOKEN);
        return;
      }
      let cancelled = false;
      loadScript()
        .then(() => {
          if (cancelled || !box.current || !window.turnstile || widget.current) return;
          widget.current = window.turnstile.render(box.current, {
            sitekey: TURNSTILE_SITE_KEY,
            language: locale === "uz" ? "auto" : locale,
            theme: "light",
            callback: (token: string) => cb.current(token),
            "expired-callback": () => cb.current(""),
            "error-callback": () => cb.current(""),
          });
          setReady(true);
        })
        .catch(() => !cancelled && setFailed(true));
      return () => {
        cancelled = true;
        if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
        widget.current = null;
      };
    }, [locale]);

    if (!TURNSTILE_ENABLED) return error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null;
    return (
      <div>
        <p className="mb-2 text-sm font-semibold">{t("securityCheck")}</p>
        <div ref={box} className="min-h-[65px]" data-testid="turnstile" />
        {!ready && !failed && <p className="text-sm text-ink-muted">{t("captchaLoading")}</p>}
        {(failed || error) && (
          <p role="alert" className="mt-1 text-sm font-semibold text-danger">
            {error ?? te("captcha_failed")}
          </p>
        )}
      </div>
    );
  },
);

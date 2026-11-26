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
/** Cloudflare's public always-pass test site key, used only outside production builds. */
const TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (process.env.NODE_ENV !== "production" ? TEST_SITE_KEY : "");

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
        if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
        cb.current("");
      },
    }));

    useEffect(() => {
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

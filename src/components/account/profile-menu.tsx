"use client";

import { CalendarDays, ChevronDown, LogIn, LogOut, Moon, Sun, UserPlus, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { LanguageList } from "@/components/layout/switchers";
import { useTheme } from "@/components/layout/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export interface ProfileMenuLabels {
  menu: string;
  myProfile: string;
  bookings: string;
  view: string;
  day: string;
  night: string;
  language: string;
  signIn: string;
  signUp: string;
  signOut: string;
}

type Who = { name: string; email: string | null } | null;

const item =
  "flex min-h-11 w-full items-center gap-3 rounded-[0.65rem] px-3 text-left text-[0.95rem] font-semibold text-ink outline-none transition-colors hover:bg-sand focus-visible:bg-sand";
const heading = "px-3 pb-1 pt-2 text-xs font-extrabold uppercase tracking-[0.08em] text-ink-muted";

/**
 * The visitor's menu at the top right, in the admin panel's style: an avatar and name pill that opens
 * My profile, My bookings, Day / Night, language, and sign in or out.
 */
export function ProfileMenu({ labels, className }: { labels: ProfileMenuLabels; className?: string }) {
  const [who, setWho] = useState<Who | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const check = () =>
      void fetch("/v1/me", { credentials: "same-origin", headers: { accept: "application/json" } })
        .then(async (r) => {
          if (!r.ok) return setWho(null);
          const me = (await r.json()) as { full_name?: string | null; email?: string | null };
          setWho({ name: (me.full_name || me.email || "").trim(), email: me.email ?? null });
        })
        .catch(() => setWho(null));
    check();
    window.addEventListener("account-changed", check);
    return () => window.removeEventListener("account-changed", check);
  }, []);

  const initial = who?.name ? who.name.slice(0, 1).toUpperCase() : null;
  const first = who?.name ? who.name.split(/\s+/)[0] : null;

  const signOut = async () => {
    setOpen(false);
    await fetch("/v1/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    window.dispatchEvent(new Event("account-changed"));
    if (pathname !== "/account") router.refresh();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={who ? `${labels.menu}: ${who.name}` : labels.menu}
        title={labels.menu}
        data-testid="account-link"
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sand data-[state=open]:bg-sand",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full text-base font-bold",
            initial ? "bg-lapis text-white" : "bg-white/80 text-lapis ring-1 ring-lapis/10",
          )}
        >
          {initial ?? <UserRound className="size-5" />}
        </span>
        {first && <span className="hidden max-w-[8rem] truncate lg:inline" data-testid="account-name">{first}</span>}
        <ChevronDown aria-hidden="true" className={cn("size-4 opacity-70 transition-transform", open && "rotate-180")} />
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" avoidCollisions={false} className="nt-select-list w-64 p-1.5" data-testid="account-menu">
        {who && (
          <div className="mb-1 border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate font-bold text-ink">{who.name}</p>
            {who.email && who.email !== who.name && <p className="truncate text-xs text-ink-muted">{who.email}</p>}
          </div>
        )}
        <nav aria-label={labels.menu} className="grid gap-0.5">
          {who ? (
            <>
              <Link href="/account#profile" onClick={() => setOpen(false)} className={item} data-testid="account-menu-profile">
                <UserRound aria-hidden="true" className="size-[1.15rem] text-cobalt" /> {labels.myProfile}
              </Link>
              <Link href="/account#bookings" onClick={() => setOpen(false)} className={item} data-testid="account-menu-bookings">
                <CalendarDays aria-hidden="true" className="size-[1.15rem] text-cobalt" /> {labels.bookings}
              </Link>
            </>
          ) : (
            <>
              <Link href="/account" onClick={() => setOpen(false)} className={item} data-testid="account-menu-signin">
                <LogIn aria-hidden="true" className="size-[1.15rem] text-cobalt" /> {labels.signIn}
              </Link>
              <Link href={{ pathname: "/account", query: { tab: "up" } }} onClick={() => setOpen(false)} className={item} data-testid="account-menu-signup">
                <UserPlus aria-hidden="true" className="size-[1.15rem] text-cobalt" /> {labels.signUp}
              </Link>
            </>
          )}
        </nav>
        <div className="mt-1 border-t border-line pt-1">
          <p className={heading}>{labels.view}</p>
          <div className="grid grid-cols-2 gap-1 px-1.5 pb-1" role="group" aria-label={labels.view}>
            {(
              [
                ["light", labels.day, Sun],
                ["dark", labels.night, Moon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
                data-testid={`account-menu-theme-${value}`}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[0.65rem] text-sm font-semibold transition-colors",
                  theme === value ? "bg-lapis text-white" : "text-ink hover:bg-sand",
                )}
              >
                <Icon aria-hidden="true" className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 border-t border-line pt-1">
          <p className={heading}>{labels.language}</p>
          <LanguageList onNavigate={() => setOpen(false)} />
        </div>
        {who && (
          <div className="mt-1 border-t border-line pt-1">
            <button type="button" onClick={() => void signOut()} className={cn(item, "text-danger")} data-testid="account-menu-signout">
              <LogOut aria-hidden="true" className="size-[1.15rem]" /> {labels.signOut}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

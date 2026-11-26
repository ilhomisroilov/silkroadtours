import type { ReactNode } from "react";

/**
 * Minimal, safe Markdown for CMS articles: ## / ### headings, "- " lists, **bold**, *italic* and
 * [links](https://… or /path). Everything is rendered as React text, so stored content can never inject HTML.
 */
function inline(text: string, key: string, locale?: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}-${i++}`} className="font-bold text-ink">{m[1]}</strong>);
    else if (m[2]) out.push(<em key={`${key}-${i++}`}>{m[2]}</em>);
    else if (m[3] && m[4]) {
      const external = m[4].startsWith("http");
      const href = !external && locale && !/^\/(en|uz|ru)(\/|$)/.test(m[4]) ? `/${locale}${m[4] === "/" ? "" : m[4]}` : m[4];
      out.push(
        <a key={`${key}-${i++}`} href={href} className="font-semibold text-cobalt underline" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[3]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** `locale` prefixes site-relative links (/contact → /uz/contact). */
export function Markdown({ source, className, locale }: { source: string; className?: string; locale?: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let list: string[] = [];
  let ordered = false;
  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k}>{inline(para.join(" "), k, locale)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const k = `l${blocks.length}`;
      const items = list.map((li, i) => <li key={`${k}-${i}`}>{inline(li, `${k}-${i}`, locale)}</li>);
      blocks.push(ordered ? <ol key={k} className="list-decimal space-y-1.5 pl-6">{items}</ol> : <ul key={k} className="list-disc space-y-1.5 pl-6 marker:text-cobalt">{items}</ul>);
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    const li = /^[-*]\s+(.*)$/.exec(line);
    const oli = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      const k = `h${blocks.length}`;
      blocks.push(
        h[1] === "##" ? (
          <h2 key={k} className="mt-8 text-2xl text-lapis">{inline(h[2]!, k, locale)}</h2>
        ) : (
          <h3 key={k} className="mt-6 text-xl text-lapis">{inline(h[2]!, k, locale)}</h3>
        ),
      );
    } else if (li || oli) {
      flushPara();
      const isOrdered = !!oli;
      if (list.length && isOrdered !== ordered) flushList();
      ordered = isOrdered;
      list.push((li ?? oli)![1]!);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className={className ?? "space-y-4 text-[1.05rem] leading-relaxed text-ink/90"}>{blocks}</div>;
}

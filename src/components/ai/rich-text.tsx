import { Fragment, type ReactNode } from "react";

/** Minimal, safe Markdown subset for assistant replies: paragraphs, bullets, simple tables, **bold**, [links](/internal). No HTML is ever injected. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]{1,120})\]\(([^)\s]{1,300})\)|\*\*([^*]{1,200})\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const href = m[2] ?? "";
      const safe = href.startsWith("/") || /^https:\/\//.test(href);
      out.push(
        safe ? (
          <a key={`${key}-${i++}`} href={href} className="font-semibold text-lapis underline underline-offset-2 hover:text-lapis-deep" {...(href.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
            {m[1]}
          </a>
        ) : (
          m[1]
        ),
      );
    } else if (m[3]) out.push(<strong key={`${key}-${i++}`}>{m[3]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n").filter((l) => l.trim());
        const isTable = lines.length >= 2 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l));
        if (isTable) {
          const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          const rows = lines.filter((l) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(l)).map(cells);
          const [head, ...body] = rows;
          return (
            <div key={bi} className="my-2 max-w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-[0.85rem]">
                {head && (
                  <thead>
                    <tr>{head.map((c, ci) => <th key={ci} className="border-b border-line px-2 py-1 font-semibold">{inline(c, `${bi}-h${ci}`)}</th>)}</tr>
                  </thead>
                )}
                <tbody>
                  {body.map((r, ri) => (
                    <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border-b border-line/60 px-2 py-1 align-top">{inline(c, `${bi}-${ri}-${ci}`)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const isList = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (isList)
          return (
            <ul key={bi} className="my-1.5 list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        return (
          <p key={bi} className="my-1.5">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""), `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

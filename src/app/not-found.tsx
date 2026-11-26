import "./globals.css";

/** Fallback for paths outside the localized site and admin (rare: the middleware adds a locale to most paths). */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-ivory p-6 text-center font-sans text-ink">
        <div>
          <h1 className="text-3xl font-semibold text-lapis-deep">Page not found</h1>
          <p className="mt-3">
            <a className="text-cobalt underline" href="/en">Silk Road Tours — home</a>
          </p>
        </div>
      </body>
    </html>
  );
}

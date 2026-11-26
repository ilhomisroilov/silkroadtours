#!/usr/bin/env node
/**
 * Local stand-in for Cloudflare's edge compression, used only for Lighthouse runs.
 * `opennextjs-cloudflare preview` (workerd) serves responses uncompressed, while in production
 * Cloudflare compresses HTML, CSS, JS and SVG with brotli/gzip. Measuring the uncompressed
 * preview would overstate page weight several times, so Lighthouse runs through this proxy.
 *
 *   TARGET=http://localhost:8787 PORT=8788 node scripts/compress-proxy.mjs
 */
import http from "node:http";
import zlib from "node:zlib";

const TARGET = new URL(process.env.TARGET ?? "http://localhost:8787");
const PORT = Number(process.env.PORT ?? 8788);
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg\+xml)/;

http
  .createServer((req, res) => {
    const headers = { ...req.headers, host: TARGET.host };
    delete headers["accept-encoding"];
    const upstream = http.request({ hostname: TARGET.hostname, port: TARGET.port, path: req.url, method: req.method, headers }, (up) => {
      const type = String(up.headers["content-type"] ?? "");
      const accept = String(req.headers["accept-encoding"] ?? "");
      const already = up.headers["content-encoding"];
      const encoding = !COMPRESSIBLE.test(type) || (already && already !== "identity") ? null : accept.includes("br") ? "br" : accept.includes("gzip") ? "gzip" : null;
      const outHeaders = { ...up.headers };
      if (encoding) {
        delete outHeaders["content-length"];
        outHeaders["content-encoding"] = encoding;
        outHeaders.vary = "accept-encoding";
      }
      res.writeHead(up.statusCode ?? 502, outHeaders);
      if (!encoding) return up.pipe(res);
      const z = encoding === "br" ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : zlib.createGzip({ level: 6 });
      up.pipe(z).pipe(res);
    });
    upstream.on("error", () => {
      res.writeHead(502);
      res.end("upstream error");
    });
    req.pipe(upstream);
  })
  .listen(PORT, () => console.log(`compress-proxy :${PORT} → ${TARGET.origin}`));

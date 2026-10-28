import { defineConfig } from "vite";

export default defineConfig({
  /* GitHub Pages serves this repo at /akasushi/, not the domain root —
     without this, every asset/absolute path (the /assets/... URLs
     throughout index.html and the CSS/JS) would resolve one level too
     high and 404. Only matters for `vite build`; the dev server still
     runs at the root. */
  base: "/akasushi/",
  server: {
    /* Exposes the dev server on the LAN so you can open it on an iPhone and
       check the pinning on real Safari. */
    host: true,
    port: 5173,
    /* Wildcard allows any localtunnel subdomain — a new random one each
       run — used to get a real HTTPS URL for testing APIs (e.g. device
       orientation) that require a secure context and won't work over the
       plain-http LAN address above. */
    allowedHosts: [".loca.lt"],
  },
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
  },
});

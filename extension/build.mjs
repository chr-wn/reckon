// Builds the Chrome extension into extension/dist (and a Web Store zip with --zip).
//   npm run ext:build                              → talks to https://reckoned.vercel.app
//   RECKON_URL=http://localhost:3100 npm run ext:build   → local dev server
import tailwind from "@tailwindcss/postcss";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(extensionDir, "..");
const outDir = join(extensionDir, "dist");
const reckonUrl = (process.env.RECKON_URL ?? "https://reckoned.vercel.app").replace(/\/$/, "");
// bump for every Web Store upload
const version = "0.1.0";

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: ["background", "composer", "overlay", "calendar", "welcome"].map((name) => join(extensionDir, "src", `${name}.${name === "composer" ? "tsx" : "ts"}`)),
  outdir: outDir,
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  jsx: "automatic",
  tsconfig: join(repoRoot, "tsconfig.json"),
  alias: { "next/link": join(extensionDir, "src/shims/next-link.tsx") },
  define: { "process.env.NODE_ENV": '"production"', __RECKON_URL__: JSON.stringify(reckonUrl) },
  // the shared components carry Next.js's "use client"; meaningless here
  logOverride: { "unsupported-directive": "silent" },
  logLevel: "warning",
});

const cssEntry = join(extensionDir, "src/composer.css");
const css = await postcss([tailwind({ base: repoRoot, optimize: true })]).process(readFileSync(cssEntry, "utf8"), { from: cssEntry });
writeFileSync(join(outDir, "composer.css"), css.css);

for (const file of ["composer.html", "welcome.html", "icons"]) cpSync(join(extensionDir, file), join(outDir, file), { recursive: true });

const icons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };
const manifest = {
  manifest_version: 3,
  name: "Reckon for Chrome",
  short_name: "Reckon",
  description: "Make a Reckon prediction from any page with one shortcut, and turn Google Calendar events into forecasts.",
  version,
  homepage_url: reckonUrl,
  icons,
  action: { default_title: "New prediction", default_icon: icons },
  background: { service_worker: "background.js" },
  commands: {
    "open-composer": {
      suggested_key: { default: "Alt+Shift+R", mac: "MacCtrl+Shift+R" },
      description: "New prediction (on any page)",
    },
  },
  permissions: ["activeTab", "scripting"],
  host_permissions: [`${reckonUrl}/*`],
  content_scripts: [{ matches: ["https://calendar.google.com/*"], js: ["calendar.js"], run_at: "document_idle" }],
  web_accessible_resources: [{ resources: ["composer.html", "composer.js", "composer.css"], matches: ["<all_urls>"] }],
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

if (process.argv.includes("--zip")) {
  const zipPath = join(extensionDir, `reckon-extension-${version}.zip`);
  rmSync(zipPath, { force: true });
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: outDir });
  console.log(`zipped ${zipPath}`);
}
console.log(`built extension ${version} for ${reckonUrl} → ${outDir}`);

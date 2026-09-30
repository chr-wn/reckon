<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working on Reckon

- The CLI scripts and `next dev` use `DATABASE_URL` from the shell environment when it's set, before falling back to local PGlite. If your shell exports one for some other project, `unset DATABASE_URL` first or you'll migrate/seed the wrong database.
- `src/components/composer/composer-form.tsx` is bundled into the Chrome extension, so it (and everything it imports) must not use Next.js APIs. `next/link` is the one exception: the extension build aliases it to a plain `<a>`. Server actions come in as the `submit` prop.
- In the extension's overlay, the composer is a cross-origin iframe; Chrome ignores `focus()` inside it until the page focuses the frame. The composer re-applies its initial focus on `window` focus for this reason. Don't remove it.
- Vitest can't resolve `chrono-node/en` (the package's `./*` export pattern); code under test imports `casual` from `chrono-node` instead.

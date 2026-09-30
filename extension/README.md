# Reckon for Chrome

Make a prediction from any page. The composer is the same React component as the web app's (`src/components/composer/composer-form.tsx`), bundled into the extension.

## Use

| | |
|---|---|
| **⌃⇧R** (Alt+Shift+R on Windows/Linux) or the toolbar icon | open the composer over the current page (selected text becomes the question) |
| **F** on Google Calendar, with an event open (or click the Reckon row in the event bubble) | “Will I finish ‹event› within ‹its length›?”, due when the block ends, cursor in the probability |
| ↵ / ⌘↵ / Esc | next field / post (link copied) / close |
| ⌥Y ⌥L ⌥M ⌥W | yes/no · how long · how much · when (on an empty box they also type “Will I…”, “How long will…”) |
| ⌥1–⌥5, ⌥0, ⌥D | deadline tonight / tomorrow / Friday / 1 week / 1 month, none, edit |
| ⌥P ⌥O ⌥C ⌥H ⌥T ⌥R | public/private · notes · range confidence · duration unit · start timer (how long) or include a time (when) · judge as ratios |
| ↑ ↓ (⇧) | probability ±1 (±5) |
| ⌥/ | list all of the above |

Change the main shortcut at `chrome://extensions/shortcuts`. You need to be signed in to Reckon in the same browser.

## Develop

```bash
npm run dev                                      # Reckon on :3000 (or -- -p 3100)
RECKON_URL=http://localhost:3000 npm run ext:build
```

Load `extension/dist` at `chrome://extensions` → Developer mode → Load unpacked; rebuild and hit reload after changes. `npm run ext:zip` builds for `https://reckoned.vercel.app` and writes the Web Store zip. Bump `version` in `build.mjs` for every upload.

How it fits together:

- `background.ts` (service worker): opens the composer on the shortcut/icon by injecting `overlay.js` into the tab (activeTab); pages that can't be scripted (chrome://, the Web Store) get a small window instead. It also makes every Reckon API call (`/api/me`, `/api/questions`). Requests from the worker carry the normal Reckon session cookie because the extension has host permission for the site, so there's no separate login or token.
- `overlay-core.ts`: a full-viewport transparent iframe of `composer.html`, isolated from the page's CSS; a toast after posting.
- `composer.tsx`: the composer page (overlay or window). Talks to the page with `postMessage`, to Reckon through the worker.
- `calendar.ts` + `calendar-event.ts`: Google Calendar content script. Checked against live Calendar (Sept 2026): event and task bubbles are both a `[role=dialog]` containing the title `#rAECCd` with the time under it, split into pieces ("Sunday, September 27" · "⋅" · "10:30 – 10:45am"); only events also have `#xDetDlg`/`#xDetDlgWhen`. The bubble is a flex row, so the Reckon row goes right after the title + time block. Calendar's own window-level handlers swallow keys and its bubble traps focus, so the script runs at `document_start` to get its capture listeners in first (and hides focus moving into the overlay from the page). Tests: `npm test`.

## Chrome Web Store listing

**Name** Reckon for Chrome · **Category** Productivity · **Privacy policy** https://reckoned.vercel.app/privacy

**Summary** Make a Reckon prediction from any page with one shortcut, and turn Google Calendar events into forecasts.

**Description**

> Reckon is a prediction log for friends. This extension makes posting one take a couple of seconds, from whatever page you're on.
>
> • Press Ctrl+Shift+R (Alt+Shift+R on Windows) anywhere. Type the question, Enter, your probability, ⌘/Ctrl+Enter. The link is copied so you can paste it wherever you're talking about it.
> • Every control has a key: ⌥Y/⌥L/⌥M/⌥W switch between yes/no, how long, how much and when; ⌥1–5 pick a deadline; ⌥P makes it private; ⌥/ shows the rest.
> • Google Calendar: open an event and press F. Reckon writes “Will I finish ‹event› within ‹its length›?”, due when the block ends. You just type how confident you are.
>
> Uses your existing Reckon sign-in. No tracking, no analytics, and it talks to no server except Reckon.

**Single purpose** Create predictions on Reckon from the page you're on.

**Permission justifications**

- `activeTab`: when you click the icon or press the shortcut, draw the composer on that tab and read the selected text to prefill the question.
- `scripting`: inject the composer overlay into the active tab at that moment.
- Host `https://reckoned.vercel.app/*`: send your prediction to your Reckon account (with your Reckon session).
- Content script on `https://calendar.google.com/*`: add the “Predict” row to the event-details bubble and read that event's title and time.
- Remote code: none.

**Data usage** Website content (selected text; the open calendar event's title and time), sent to Reckon only when you post. Not sold, not used for anything unrelated, not used for creditworthiness.

**Assets** `extension/store/`: icon is `icons/icon-128.png`; three 1280×800 screenshots and the 440×280 promo tile. Screenshot 3 uses a stand-in calendar page; replace it with a capture from real Google Calendar when you can.

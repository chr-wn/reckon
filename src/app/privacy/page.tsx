import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacy" };

/** Public (no sign-in) so the Chrome Web Store listing can link to it. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <Link href="/" aria-label="Reckon home">
        <Logo />
      </Link>
      <article className="prose-reckon mt-8">
        <h2>Privacy</h2>
        <p>Reckon is a small prediction log for friends. This page covers the website and the Reckon for Chrome extension.</p>

        <h3>What Reckon stores</h3>
        <ul>
          <li>From Google sign-in: your name, email address, profile picture and Google account id.</li>
          <li>Your time zone, so dates show correctly.</li>
          <li>What you post: predictions, forecasts, notes, comments and resolutions.</li>
        </ul>
        <p>
          Public predictions are visible to everyone signed in to Reckon; private ones only to you. Nothing is sold, shared with
          advertisers, or used for tracking. There are no analytics or ads.
        </p>

        <h3>The Chrome extension</h3>
        <ul>
          <li>
            It only reads a page when you open it there (toolbar button or keyboard shortcut): the text you have selected, to
            start the question with it.
          </li>
          <li>
            On Google Calendar it reads the title and time of the event whose details you have open, to suggest “Will I finish
            this within its time?”. It doesn&apos;t read anything else in your calendar.
          </li>
          <li>
            That text goes to Reckon only when you post the prediction, using your normal Reckon sign-in. The extension keeps no
            data of its own and talks to no other servers.
          </li>
        </ul>

        <h3>Deleting data</h3>
        <p>You can delete your predictions and comments in the app. To remove your account entirely, ask the person who runs your Reckon.</p>
        <p>
          Source code: <a href="https://github.com/chr-wn/reckon">github.com/chr-wn/reckon</a>.
        </p>
      </article>
    </main>
  );
}

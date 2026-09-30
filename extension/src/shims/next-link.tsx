import type { AnchorHTMLAttributes } from "react";

/** The composer's shared UI imports next/link; outside Next.js a plain anchor does the job. */
export default function Link(props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} />;
}

import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <h1 className="font-serif text-5xl text-ink">Not found</h1>
      <p className="mt-3 max-w-sm text-ink-2">
        That page doesn&apos;t exist — or it&apos;s a question that hasn&apos;t been shared with you.
      </p>
      <ButtonLink href="/" className="mt-6">
        Back home
      </ButtonLink>
    </main>
  );
}

import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

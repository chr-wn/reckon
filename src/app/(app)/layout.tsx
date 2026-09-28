import Link from "next/link";
import { HeaderNav } from "@/components/header-nav";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="Home">
            <Logo />
          </Link>
          <HeaderNav />
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">{children}</main>
    </>
  );
}

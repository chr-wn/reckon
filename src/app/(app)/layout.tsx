import { Plus } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { DesktopNavLinks, MobileTabBar } from "@/components/nav";
import { ButtonLink } from "@/components/ui";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="Home">
            <Logo />
          </Link>
          {user && <DesktopNavLinks />}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <ButtonLink href="/new" size="sm" className="gap-1">
                  <Plus size={16} strokeWidth={2.5} /> New
                </ButtonLink>
                <UserMenu user={user} />
              </>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">
                  Log in
                </ButtonLink>
                <ButtonLink href="/signup" size="sm">
                  Sign up
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-16">{children}</main>
      {user && <MobileTabBar />}
    </>
  );
}

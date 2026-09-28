import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/accounts";
import { authorizationUrl, callbackUrl, googleConfigured, OAUTH_COOKIE, randomToken } from "@/lib/auth/google";

/** The sign-in form posts here; we stash PKCE state in a short-lived cookie and bounce to Google. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  if (!googleConfigured()) return NextResponse.redirect(new URL("/login?error=config", req.url), 303);
  const state = randomToken();
  const verifier = randomToken();
  (await cookies()).set(
    OAUTH_COOKIE,
    JSON.stringify({
      state,
      verifier,
      next: safeNext(form.get("next")),
      tz: String(form.get("timezone") ?? "").slice(0, 64),
      signupCode: String(form.get("signupCode") ?? "").slice(0, 200),
    }),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/auth/google", maxAge: 600 },
  );
  return NextResponse.redirect(authorizationUrl({ redirectUri: callbackUrl(req.nextUrl.origin), state, verifier }), 303);
}

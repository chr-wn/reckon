import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * "Sign in with Google" via the OAuth 2.0 authorization-code flow with PKCE.
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see README).
 */
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const OAUTH_COOKIE = "reckon_oauth";

/** Must exactly match an "Authorized redirect URI" on the Google OAuth client. */
export const callbackUrl = (origin: string) => `${process.env.APP_URL ?? origin}/auth/google/callback`;

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const randomToken = () => randomBytes(32).toString("base64url");

export function authorizationUrl({ redirectUri, state, verifier }: { redirectUri: string; state: string; verifier: string }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

export interface GoogleProfile {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export async function exchangeCode({ code, verifier, redirectUri }: { code: string; verifier: string; redirectUri: string }): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("Google didn't return an ID token");

  // The ID token comes straight from Google's token endpoint over TLS, so it
  // doesn't need a separate signature check (OIDC Core §3.1.3.7) — but it must
  // be meant for us, from Google, and unexpired.
  const claims = JSON.parse(Buffer.from(id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  if (claims.aud !== clientId) throw new Error("ID token audience mismatch");
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new Error("ID token issuer mismatch");
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) throw new Error("ID token expired");
  if (typeof claims.sub !== "string") throw new Error("ID token has no subject");
  return {
    sub: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    name: typeof claims.name === "string" ? claims.name : typeof claims.given_name === "string" ? claims.given_name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}

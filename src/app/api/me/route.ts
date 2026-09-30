import { getCurrentUser } from "@/lib/auth/session";
import { getTrackRecord } from "@/lib/data/composer";

/**
 * JSON API for the Chrome extension. Auth is the normal session cookie: the
 * extension's service worker has host permission for this site, so Chrome
 * attaches the SameSite=Lax cookie to its requests like a first-party visit.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "signed-out" }, { status: 401 });
  const { track } = await getTrackRecord(user.id);
  return Response.json({
    user: { username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, timezone: user.timezone },
    track,
  });
}

import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createSession } from "@/lib/auth/session";
import { db, users } from "@/lib/db";

/** Local development only: sign in as an existing user without Google. */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") notFound();
  const username = req.nextUrl.searchParams.get("u") ?? "";
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (!user) redirect("/login");
  await createSession(user.id);
  redirect("/");
}

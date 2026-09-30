import type { NextRequest } from "next/server";
import { createQuestion } from "@/lib/actions/questions";
import { getCurrentUser } from "@/lib/auth/session";

/** Create a prediction from the Chrome extension. Same validation and rules as the composer. */
export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) return Response.json({ error: "signed-out" }, { status: 401 });
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const result = await createQuestion(input as Parameters<typeof createQuestion>[0]);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ id: result.data.id, url: new URL(`/q/${result.data.id}`, req.nextUrl.origin).toString() });
}

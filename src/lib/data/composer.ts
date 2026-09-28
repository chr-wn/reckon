import "server-only";
import { buildTrackRecord } from "@/lib/scoring/records";
import { getUserGroups } from "./groups";
import { getUserTags } from "./questions";
import { loadUserRecords } from "./stats";

/** Everything the question composer / forecast forms need about the current user. */
export async function getComposerData(userId: string) {
  const [groups, tags, records] = await Promise.all([getUserGroups(userId), getUserTags(userId), loadUserRecords(userId, userId)]);
  return {
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    tags,
    records,
    track: buildTrackRecord(records),
  };
}

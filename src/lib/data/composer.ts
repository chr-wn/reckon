import "server-only";
import { buildTrackRecord } from "@/lib/scoring/records";
import { loadUserRecords } from "./stats";

/** Your track record, for the "outside view" hints in the composer and forecast form. */
export async function getTrackRecord(userId: string) {
  const records = await loadUserRecords(userId, userId);
  return { records, track: buildTrackRecord(records) };
}

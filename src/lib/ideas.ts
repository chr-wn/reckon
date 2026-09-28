import type { QType } from "./scoring/records";

export interface Idea {
  type: QType;
  title: string;
  category: string;
  why: string;
}

/**
 * Starter questions. The best calibration fodder resolves soon (fast feedback),
 * is unambiguous, and is something you're genuinely uncertain about.
 */
export const IDEAS: Idea[] = [
  // Planning — where the planning fallacy lives
  { type: "duration", title: "How long will tonight's problem set take?", category: "Planning", why: "The classic planning-fallacy check. Time it with the built-in timer." },
  { type: "binary", title: "Will I finish my essay draft by Friday?", category: "Planning", why: "Deadline questions expose optimism about your own follow-through." },
  { type: "duration", title: "How long will the grocery run take, door to door?", category: "Planning", why: "Small errands are great practice: frequent, quick to resolve." },
  { type: "date", title: "When will I finish the side project's first version?", category: "Planning", why: "Long projects slip in weeks, not minutes — track by how much." },
  { type: "duration", title: "How long will this bug take to fix?", category: "Planning", why: "Programmers are famously bad at this. Are you?" },

  // Habits & self-knowledge
  { type: "binary", title: "Will I go to the gym at least 3 times this week?", category: "Habits", why: "Tag these #gym; your hit rate per tag becomes a base rate." },
  { type: "numeric", title: "How many hours will I sleep tonight?", category: "Habits", why: "A daily question that builds a big sample fast." },
  { type: "binary", title: "Will I be asleep before midnight tonight?", category: "Habits", why: "Tests how well you predict your own evening self." },
  { type: "numeric", title: "How many pages will I read this week?", category: "Habits", why: "Numeric questions train interval width, not just direction." },
  { type: "binary", title: "Will I stick to my plan for tomorrow morning?", category: "Habits", why: "Intentions vs. behavior: you'll learn which plans you actually keep." },

  // School & work
  { type: "numeric", title: "What score will I get on the midterm (out of 100)?", category: "School & work", why: "Before seeing the grade, commit to a range." },
  { type: "binary", title: "Will the meeting end on time?", category: "School & work", why: "Cheap, frequent, surprisingly informative." },
  { type: "binary", title: "Will my code pass CI on the first try?", category: "School & work", why: "Quick feedback loop, great for a streak." },
  { type: "date", title: "When will we ship the next release?", category: "School & work", why: "Share it with teammates and compare forecasts." },

  // Social — predicting each other
  { type: "binary", title: "Will at least 5 people come to Saturday's game night?", category: "Social", why: "Everyone in the group can forecast; see who reads people best." },
  { type: "duration", title: "How late will our friend be to dinner? (minutes)", category: "Social", why: "Friends forecasting each other take the outside view naturally." },
  { type: "binary", title: "Will the group chat pick a restaurant within an hour?", category: "Social", why: "Low stakes, fast resolution, fun to argue about." },

  // Money & life admin
  { type: "numeric", title: "How much will I spend on food this week ($)?", category: "Money", why: "Budget intervals: most people's are far too narrow." },
  { type: "date", title: "When will my package arrive?", category: "Money", why: "Delivery windows are reference classes in disguise." },

  // The world
  { type: "binary", title: "Will it rain here tomorrow?", category: "World", why: "Compare yourself to the forecast — a humbling baseline." },
  { type: "numeric", title: "What will tomorrow's high temperature be here?", category: "World", why: "Great interval practice with a clear, fast answer." },
  { type: "binary", title: "Will the home team win this weekend?", category: "World", why: "Check your number against betting odds after you commit." },
  { type: "numeric", title: "How many points will the winning team score in the final?", category: "World", why: "Shared questions like this make the fairest leaderboard." },
];

export const IDEA_CATEGORIES = [...new Set(IDEAS.map((i) => i.category))];

/** Rotating placeholder examples for the quick composer. */
export const PLACEHOLDERS = [
  "How long will my problem set take?",
  "Will I finish the essay draft by Friday?",
  "Will I go to the gym 3 times this week?",
  "When will my package arrive?",
  "How many hours will I sleep tonight?",
];

/** Guess the question type from how it's phrased. */
export function detectType(title: string): QType | null {
  const t = title.trim().toLowerCase();
  if (!t) return null;
  if (/^how long\b/.test(t)) return "duration";
  if (/^(when|by when|what date)\b/.test(t)) return "date";
  if (/^(how (many|much|far|fast|big|high|old)|what (score|percent|percentage|number|price|temperature|grade)|what will .* (be|score|cost))\b/.test(t)) return "numeric";
  if (/^(will|is|are|does|do|did|can|could|would|should|has|have|won't|am)\b/.test(t)) return "binary";
  return null;
}

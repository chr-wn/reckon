import { Clock3, Compass, Dumbbell, EyeOff, Scale, Target } from "lucide-react";
import { ButtonLink } from "./ui";

const FEATURES = [
  {
    icon: Target,
    title: "Four kinds of prediction",
    body: "Yes/no with a probability, or a range for how long, how much and when. Ranges train the skill that matters most: knowing how wide your uncertainty really is.",
  },
  {
    icon: Clock3,
    title: "Beat the planning fallacy",
    body: "Estimate a task, hit start, hit done. Over time you get your personal multiplier: “things take you 1.6× longer than you think.”",
  },
  {
    icon: Compass,
    title: "Outside view on tap",
    body: "As you forecast, your own track record speaks up: “your 90%s come true 74% of the time” — and suggests an adjusted range.",
  },
  {
    icon: EyeOff,
    title: "Forecast blind, together",
    body: "Friends' forecasts stay hidden until you commit, so nobody just anchors on the loudest person. Then compare notes.",
  },
  {
    icon: Dumbbell,
    title: "Two-minute drills",
    body: "Real questions take weeks to resolve. Trivia estimates give instant feedback, so you can practice calibration every day.",
  },
  {
    icon: Scale,
    title: "Honest scoring",
    body: "Proper scoring rules, time-weighted so last-minute updates don't count, and error bars so ten questions aren't over-read.",
  },
];

function HeroChart() {
  // An overconfident forecaster: dots sag below the diagonal at the extremes.
  const pts = [
    [0.1, 0.24],
    [0.3, 0.36],
    [0.5, 0.49],
    [0.7, 0.6],
    [0.9, 0.71],
  ];
  const s = 220;
  const px = (v: number) => 20 + v * s;
  const py = (v: number) => 20 + (1 - v) * s;
  return (
    <svg viewBox="0 0 260 260" className="h-auto w-full max-w-[300px]" role="img" aria-label="Example calibration chart showing overconfidence">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={px(0)} x2={px(1)} y1={py(t)} y2={py(t)} stroke="var(--grid)" />
          <line x1={px(t)} x2={px(t)} y1={py(0)} y2={py(1)} stroke="var(--grid)" />
        </g>
      ))}
      <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke="var(--axis)" strokeWidth={1.5} />
      <polyline points={pts.map(([x, y]) => `${px(x)},${py(y)}`).join(" ")} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeOpacity={0.5} />
      {pts.map(([x, y]) => (
        <circle key={x} cx={px(x)} cy={py(y)} r={6} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
      ))}
      <text x={px(0.9) + 4} y={py(0.71) + 26} textAnchor="end" fontSize={11} fill="var(--ink-2)">
        said 90%,
      </text>
      <text x={px(0.9) + 4} y={py(0.71) + 40} textAnchor="end" fontSize={11} fill="var(--ink-2)">
        happened 71%
      </text>
    </svg>
  );
}

export function Landing() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="grid items-center gap-10 py-6 sm:py-12 md:grid-cols-[1.3fr_1fr]">
        <div>
          <h1 className="font-serif text-[2.9rem] leading-[1.02] tracking-[-0.015em] text-ink sm:text-[3.75rem]">
            How often do your 90%s actually happen?
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Reckon is a calibration gym for friends. Predict things about your week — how long the problem set will take, whether
            you&apos;ll make the gym, when the package lands — then find out, honestly, how good your judgment is. And get better
            together.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/signup" size="lg">
              Start predicting
            </ButtonLink>
            <ButtonLink href="/learn" size="lg" variant="secondary">
              How it works
            </ButtonLink>
          </div>
        </div>
        <div className="flex justify-center rounded-3xl border border-line bg-surface p-6 shadow-card">
          <HeroChart />
        </div>
      </section>
      <section className="grid gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <f.icon size={20} className="text-accent-ink" />
            <h2 className="mt-3 font-semibold text-ink">{f.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

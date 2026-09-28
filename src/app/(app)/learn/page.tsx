import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "How it works" };

const TOC = [
  ["calibration", "What calibration is"],
  ["scoring", "How you're scored"],
  ["techniques", "Techniques that actually help"],
  ["what-to-predict", "What to predict"],
  ["routine", "A weekly routine"],
  ["charts", "Reading your charts"],
  ["faq", "FAQ"],
  ["reading", "Further reading"],
] as const;

export default function LearnPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="hidden lg:block">
        <div className="sticky top-24 space-y-1 text-sm">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-md px-2 py-1 text-ink-3 hover:bg-surface-2 hover:text-ink">
              {label}
            </a>
          ))}
        </div>
      </nav>
      <article className="prose-reckon max-w-2xl">
        <h1 className="font-serif text-[2.75rem] leading-[1.05] tracking-[-0.01em] text-ink">How to get calibrated</h1>
        <p className="text-lg">
          Nobody is born calibrated, but it is one of the few judgment skills that reliably improves with practice — as long as you get
          honest, frequent feedback. That&apos;s what this app is for.
        </p>

        <h2 id="calibration">What calibration is</h2>
        <p>
          You&apos;re <strong>calibrated</strong> if, across everything you&apos;ve said &ldquo;70%&rdquo; about, about 70% happened. Same for
          ranges: of all your &ldquo;80% sure it&apos;s between X and Y&rdquo; claims, reality should land inside about 80% of the time.
        </p>
        <p>
          Calibration isn&apos;t the whole game. Someone who says 50% about everything is perfectly calibrated and perfectly useless. You also
          want <strong>resolution</strong>: saying 95% when things are nearly certain and 5% when they&apos;re nearly impossible. The scores
          here reward both — being honest about your uncertainty <em>and</em> being decisive when you have reason to be.
        </p>
        <p>
          The most common failure is <strong>overconfidence</strong>. Classic studies going back to the 1970s (Alpert &amp; Raiffa;
          Lichtenstein, Fischhoff &amp; Phillips) find that people&apos;s high-confidence ranges miss the truth far more often than they
          claim — &ldquo;90%&rdquo; ranges often catch the answer only around half the time. The second classic failure is the{" "}
          <strong>planning fallacy</strong> (Buehler, Griffin &amp; Ross, 1994): we underestimate how long our own tasks will take, even
          when we know similar tasks ran long before.
        </p>

        <h2 id="scoring">How you&apos;re scored</h2>
        <h3>Yes / no questions: the Brier score</h3>
        <p>
          Your score is (forecast − outcome)², where the outcome is 1 if it happened and 0 if not. Say 80% and it happens: (0.8 − 1)² ={" "}
          <code>0.04</code>. Say 80% and it doesn&apos;t: <code>0.64</code>. Lower is better; <code>0</code> is perfect, and always saying
          50% scores <code>0.25</code>. The Brier score is a <em>proper</em> scoring rule: the strategy that scores best on average is to
          report exactly what you believe. There&apos;s no gaming it by shading your numbers.
        </p>
        <h3>Ranges: low end, best guess, high end</h3>
        <p>
          For &ldquo;how long / how much / when&rdquo; questions you give three numbers. With the default 80% confidence, your low end means
          &ldquo;10% chance it&apos;s below this,&rdquo; your high end &ldquo;10% chance it&apos;s above this,&rdquo; and your best guess is
          the 50/50 point. From those, Reckon tracks:
        </p>
        <ul>
          <li>
            <strong>Hit rate</strong>: how often reality landed inside your range. Aim for the stated confidence — not 100%. If every range
            catches the truth, your ranges are too wide.
          </li>
          <li>
            <strong>Where reality landed</strong>: the percentile of the outcome within your forecast. If you&apos;re calibrated, outcomes
            spread evenly across percentiles.
          </li>
          <li>
            <strong>Bias</strong>: how often reality came in above your best guess (should be half the time). For timed tasks, the ratio
            actual ÷ best guess is your personal <em>planning multiplier</em>.
          </li>
          <li>
            <strong>Interval score</strong> (Gneiting &amp; Raftery, 2007), used for head-to-head comparisons: the width of your range, plus
            a penalty for each unit reality fell outside it. Narrow ranges only pay off if they&apos;re right.
          </li>
        </ul>
        <p>
          Durations are compared as <em>ratios</em>: a 30-minute task that takes an hour is as wrong as a 3-hour task that takes 6. That&apos;s
          how time errors actually behave.
        </p>
        <h3>Time-weighting</h3>
        <p>
          You can update a forecast as often as you like. Each forecast counts in proportion to how long it was your standing forecast, from
          your first forecast until the question closes. So a last-second update to 99% after you already know the answer barely moves your
          score, while updating <em>early and well</em> is rewarded. For timed tasks, forecasting locks the moment the timer starts.
        </p>
        <h3>Error bars, and why small samples lie</h3>
        <p>
          Ten forecasts is not much evidence. If 8 of your 10 &ldquo;90%&rdquo; forecasts came true, that&apos;s consistent with being
          calibrated <em>or</em> overconfident — a 90% range for your true rate is roughly 54–93%. The calibration chart shows these ranges as
          whiskers, and the app won&apos;t call you over- or underconfident until the evidence is reasonably clear.
        </p>
        <h3>Forecasting with friends</h3>
        <p>
          Everyone&apos;s forecasts (and comments) on a question are hidden until you&apos;ve made your own, so you form an independent view
          instead of anchoring on the first number you see. Group leaderboards compare each person to the <strong>median of everyone else
          on the same questions</strong>. That&apos;s the fair comparison: a Brier score on easy questions isn&apos;t comparable to one on
          hard questions.
        </p>

        <h2 id="techniques">Techniques that actually help</h2>
        <h3>1. Start from a base rate (the outside view)</h3>
        <p>
          Before thinking about the specifics, ask: in situations like this, how often does it happen? How long do tasks like this usually
          take <em>me</em>? Kahneman and colleagues call this the outside view, and it&apos;s the standard cure for the planning fallacy.
          Then adjust for what&apos;s special about this case — usually less than your gut wants. Tag your questions: each tag becomes a
          personal base rate, and Reckon shows it to you as you forecast.
        </p>
        <h3>2. Judge each end of a range separately</h3>
        <p>
          Don&apos;t think &ldquo;what range am I 80% sure of?&rdquo; Instead ask two separate questions: &ldquo;what low value would I be
          surprised — 1-in-10 surprised — to go under?&rdquo; and the same for the high end. Eliciting the bounds separately produces wider,
          better-calibrated ranges than asking for the range in one go (Soll &amp; Klayman, 2004). The inputs here are framed that way on
          purpose.
        </p>
        <h3>3. The equivalent bet</h3>
        <p>
          From Douglas Hubbard&apos;s calibration training: imagine you could either win $100 if the truth lands in your range, or spin a
          wheel that wins $100 80% of the time. If you&apos;d rather spin the wheel, you don&apos;t really believe your range is 80% — widen
          it. If you&apos;d rather take your range, you might be able to tighten it. Adjust until you&apos;re indifferent.
        </p>
        <h3>4. Argue against yourself</h3>
        <p>
          Before you commit, list a reason you could be wrong. Generating reasons against your answer measurably reduces overconfidence
          (Koriat, Lichtenstein &amp; Fischhoff, 1980). The reasoning box under each forecast is a good place to do it.
        </p>
        <h3>5. Unpack the task</h3>
        <p>
          For time estimates, list the steps — including the boring ones (setup, write-up, getting stuck, the commute). Breaking a task into
          its parts leads to longer, more realistic estimates (Kruger &amp; Evans, 2004). Then compare with your planning multiplier.
        </p>
        <h3>6. Use your personal correction</h3>
        <p>
          Once you&apos;ve resolved a few forecasts, Reckon shows how your raw numbers translate into reality — &ldquo;your 90%s come true
          about 78% of the time&rdquo;, &ldquo;tasks take you 1.5× your best guess&rdquo; — and offers an adjusted range you can adopt with
          one click. Make your own estimate <em>first</em>, then look: the gap between the two is the lesson.
        </p>
        <h3>7. Be precise, update in small steps</h3>
        <p>
          In large forecasting tournaments, the best forecasters use fine-grained probabilities — rounding their forecasts to the nearest
          10% makes them measurably less accurate (Friedman et al., 2018) — and they update frequently in small increments rather than
          lurching (Tetlock &amp; Gardner, <em>Superforecasting</em>). 73% is allowed.
        </p>
        <h3>8. Get fast feedback, and look at your misses</h3>
        <p>
          Weather forecasters are famously well calibrated (Murphy &amp; Winkler, 1977) — not because they&apos;re special, but because they
          get fast, unambiguous feedback every day. Feedback-driven training improves calibration for ordinary people too (Lichtenstein &amp;
          Fischhoff, 1980). That&apos;s why this app pushes quick-resolving questions and has <Link href="/drills">drills</Link>, and why it
          asks &ldquo;what did you miss?&rdquo; when reality escapes your range.
        </p>

        <h2 id="what-to-predict">What to predict</h2>
        <p>The best practice questions resolve soon, have an unambiguous answer, and are things you&apos;re genuinely unsure about.</p>
        <ul>
          <li>
            <strong>Your own tasks</strong> — how long homework, a bug fix, laundry, or a workout will take. Frequent, fast feedback, and a
            direct attack on the planning fallacy. Use the timer.
          </li>
          <li>
            <strong>Your own behavior</strong> — will I hit the gym 3× this week, be asleep by midnight, finish the book this month? You&apos;ll
            learn which intentions you actually follow through on.
          </li>
          <li>
            <strong>Outcomes you&apos;re waiting on</strong> — exam scores, when a package arrives, whether the meeting ends on time, how much
            you&apos;ll spend on food this week.
          </li>
          <li>
            <strong>Each other</strong> — how many people will come to game night, how late someone will be, whether the group chat will
            agree on a restaurant. Friends forecasting each other&apos;s tasks are a built-in outside view: see whose guesses beat yours.
          </li>
          <li>
            <strong>The world</strong> — weather, sports, elections, product launches. These make the fairest group leaderboards because
            everyone has the same information; you can compare your number to markets or forecasts after committing.
          </li>
        </ul>
        <p>
          Mix question types. Yes/no questions train probability judgment; ranges train knowing how wide your uncertainty is, which is where
          most people are worst. There are more ideas on the <Link href="/new">new prediction</Link> page.
        </p>

        <h2 id="routine">A weekly routine that works</h2>
        <ol>
          <li>
            <strong>Sunday (10 min):</strong> make five predictions about the coming week, including at least one range and one about a
            friend.
          </li>
          <li>
            <strong>Daily (30 sec):</strong> time one real task with an estimate first. Resolve anything overdue from the dashboard.
          </li>
          <li>
            <strong>Whenever you&apos;re bored (2 min):</strong> a drill round.
          </li>
          <li>
            <strong>Monthly:</strong> look at your stats with your group. Who&apos;s overconfident? Whose planning multiplier is shrinking?
          </li>
        </ol>

        <h2 id="charts">Reading your charts</h2>
        <h3>Calibration chart</h3>
        <p>
          Each dot is a group of your forecasts (all your ~70%s, say): across is what you said, up is how often it happened. On the diagonal
          is calibrated. Dots below the diagonal on the right and above it on the left mean <strong>overconfident</strong> — your extremes
          should be less extreme. Whiskers show how uncertain each dot is.
        </p>
        <h3>Where reality landed</h3>
        <p>
          For range questions: bars show how often the outcome fell in each tenth of your forecast distribution. Calibrated forecasts give a
          flat profile at 10% each. Tall bars at both ends (a U shape) mean your ranges are too narrow. Tall bars on one side mean a
          consistent bias — on the right, reality keeps coming in higher (or later, or longer) than you think.
        </p>
        <h3>Planning fallacy tracker</h3>
        <p>
          Actual ÷ best guess for your timed tasks, as a rolling average. 1× is perfect. Most people start well above 1×; watching it fall is
          the point.
        </p>

        <h2 id="faq">FAQ</h2>
        <h3>Why can&apos;t I say 0% or 100%?</h3>
        <p>
          Because you&apos;re almost never truly certain, and the scoring punishes confident misses hard: a 99% forecast that fails scores
          0.98, nearly the worst possible. Use 1% and 99% for &ldquo;I&apos;d be shocked.&rdquo;
        </p>
        <h3>What if a question turns out to be ambiguous?</h3>
        <p>
          Resolve it as ambiguous; it won&apos;t count for anyone. To avoid it, write resolution criteria in the details (&ldquo;counts if I
          submit it on Gradescope before midnight&rdquo;).
        </p>
        <h3>Can I change a forecast?</h3>
        <p>Yes, any time before the question closes. Your history is kept, and scoring is time-weighted across it.</p>
        <h3>Who can see my questions?</h3>
        <p>
          Questions marked &ldquo;only me&rdquo; are private. Questions shared with a group are visible to its members, and your stats on a
          friend&apos;s profile only include questions you can both see.
        </p>
        <h3>Are drills counted in my main stats?</h3>
        <p>No — drills have their own section. Trivia calibration and real-life calibration are related but not the same skill.</p>

        <h2 id="reading">Further reading</h2>
        <ul>
          <li>Philip Tetlock &amp; Dan Gardner, <em>Superforecasting</em> (2015)</li>
          <li>Douglas Hubbard, <em>How to Measure Anything</em> — the calibration training chapter</li>
          <li>Daniel Kahneman, <em>Thinking, Fast and Slow</em> — chapters on the planning fallacy and the outside view</li>
          <li>Gneiting &amp; Raftery, &ldquo;Strictly Proper Scoring Rules, Prediction, and Estimation&rdquo; (2007) — the math behind the scores</li>
        </ul>
        <Card className="mt-10 p-5 not-italic">
          <p className="m-0 text-ink-2">
            Ready? <Link href="/new">Make a prediction</Link> that resolves this week, or warm up with a <Link href="/drills">drill</Link>.
          </p>
        </Card>
      </article>
    </div>
  );
}

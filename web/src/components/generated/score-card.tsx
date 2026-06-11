import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ScoreBreakdown } from "@/lib/schemas";
import { cn, scoreBarColor, scoreColor } from "@/lib/utils";

const BREAKDOWN_LABELS: Record<keyof ScoreBreakdown, string> = {
  keywordMatch: "Keyword match",
  skillsMatch: "Skills match",
  experienceMatch: "Experience match",
  projectMatch: "Project match",
  formatting: "Formatting",
};

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good match — room to improve";
  return "Weak match";
}

export function ScoreCard({
  total,
  breakdown,
}: {
  total: number;
  breakdown: ScoreBreakdown;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ATS Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Score ring */}
          <div
            className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
            role="img"
            aria-label={`ATS score ${total} out of 100`}
            style={{
              background: `conic-gradient(${
                total >= 80 ? "#10b981" : total >= 60 ? "#f59e0b" : "#ef4444"
              } ${total * 3.6}deg, var(--muted) 0deg)`,
            }}
          >
            <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-full bg-card">
              <span className={cn("text-3xl font-bold", scoreColor(total))}>{total}</span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div>
            <p className={cn("font-semibold", scoreColor(total))}>{scoreLabel(total)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Deterministic score across keywords, skills, experience relevance, project
              relevance, and ATS-safe formatting.
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-4">
          {(Object.keys(BREAKDOWN_LABELS) as Array<keyof ScoreBreakdown>).map((key) => {
            const item = breakdown[key];
            const pct = item.max === 0 ? 0 : Math.round((item.score / item.max) * 100);
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm font-medium">{BREAKDOWN_LABELS[key]}</dt>
                  <dd className="text-sm tabular-nums text-muted-foreground">
                    {item.score} / {item.max}
                  </dd>
                </div>
                <Progress
                  value={pct}
                  className="mt-1.5 bg-muted"
                  indicatorClassName={scoreBarColor(pct)}
                  aria-label={`${BREAKDOWN_LABELS[key]}: ${item.score} of ${item.max}`}
                />
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}

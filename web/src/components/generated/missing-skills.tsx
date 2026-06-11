import { CheckCircle2, XCircle } from "lucide-react";

import { SkillBadges } from "@/components/skill-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function MissingSkillsCard({
  matched,
  missing,
}: {
  matched: string[];
  missing: string[];
}) {
  const total = matched.length + missing.length;
  const pct = total === 0 ? 100 : Math.round((matched.length / total) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills coverage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">
              You have {matched.length} of {total} skills this job asks for.
            </p>
            <p className="text-sm font-semibold tabular-nums">{pct}%</p>
          </div>
          <Progress
            value={pct}
            className="mt-2 bg-muted"
            indicatorClassName={pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}
            aria-label={`Skills coverage ${pct} percent`}
          />
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            Skills you have ({matched.length})
          </h4>
          <SkillBadges skills={matched} variant="success" />
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <XCircle className="h-4 w-4 text-red-500" aria-hidden />
            Skills to develop ({missing.length})
          </h4>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing missing — you cover everything this job asks for.
            </p>
          ) : (
            <>
              <SkillBadges skills={missing} variant="destructive" />
              <p className="mt-2 text-xs text-muted-foreground">
                These were never added to your resume — we only optimize with skills you actually
                have. Consider building them through a course or project.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

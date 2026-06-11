import { CheckCircle2, MinusCircle } from "lucide-react";

import { SkillBadges } from "@/components/skill-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StoredExperienceRank, StoredProjectRank } from "@/lib/schemas";
import { scoreBarColor } from "@/lib/utils";

function RankRow({
  name,
  score,
  included,
  children,
}: {
  name: string;
  score: number;
  included: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {included ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <p className="truncate font-medium">{name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge variant={included ? "success" : "secondary"}>
            {included ? "Included" : "Omitted"}
          </Badge>
          <span className="w-12 text-right text-sm font-semibold tabular-nums">{score}%</span>
        </div>
      </div>
      <Progress
        value={score}
        className="mt-2 bg-muted"
        indicatorClassName={scoreBarColor(score)}
        aria-label={`${name}: ${score}% match`}
      />
      {children}
    </li>
  );
}

export function ExperienceRankingList({ items }: { items: StoredExperienceRank[] }) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Experience ranking</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No experiences on this resume.</p>
        ) : (
          <ul className="divide-y">
            {sorted.map((item) => (
              <RankRow key={item.id} name={item.name} score={item.score} included={item.included}>
                {item.reasoning ? (
                  <p className="mt-2 text-sm text-muted-foreground">{item.reasoning}</p>
                ) : null}
                {item.matchedSkills.length > 0 ? (
                  <div className="mt-2">
                    <SkillBadges skills={item.matchedSkills} variant="info" max={8} />
                  </div>
                ) : null}
              </RankRow>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectRankingList({ items }: { items: StoredProjectRank[] }) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project ranking</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects on this resume.</p>
        ) : (
          <ul className="divide-y">
            {sorted.map((item) => (
              <RankRow key={item.id} name={item.name} score={item.score} included={item.included}>
                {item.matchedTechnologies.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Tech:</span>
                    <SkillBadges skills={item.matchedTechnologies} variant="info" max={8} />
                  </div>
                ) : null}
                {item.matchedSkills.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Skills:</span>
                    <SkillBadges skills={item.matchedSkills} variant="secondary" max={8} />
                  </div>
                ) : null}
              </RankRow>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

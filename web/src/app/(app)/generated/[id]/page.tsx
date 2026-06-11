import Link from "next/link";
import { notFound } from "next/navigation";
import { GitCompareArrows, KanbanSquare } from "lucide-react";
import { z } from "zod";

import { ExportMenu } from "@/components/generated/export-menu";
import { MissingSkillsCard } from "@/components/generated/missing-skills";
import {
  ExperienceRankingList,
  ProjectRankingList,
} from "@/components/generated/ranking-list";
import { ScoreCard } from "@/components/generated/score-card";
import { PageHeader } from "@/components/page-header";
import { ResumeView } from "@/components/resume/resume-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  parsedResumeSchema,
  scoreBreakdownSchema,
  storedExperienceRankSchema,
  storedProjectRankSchema,
} from "@/lib/schemas";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/users";

export const metadata = { title: "ATS results" };
export const dynamic = "force-dynamic";

export default async function GeneratedDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const generated = await db.generatedResume.findFirst({
    where: { id, userId: user.id },
    include: {
      jobDescription: { select: { id: true, title: true, company: true } },
      resume: { select: { id: true, title: true } },
    },
  });
  if (!generated) notFound();

  const content = parsedResumeSchema.parse(generated.content);
  const breakdown = scoreBreakdownSchema.parse(generated.scoreBreakdown);
  const experienceRanking = z
    .array(storedExperienceRankSchema)
    .parse(generated.experienceRanking ?? []);
  const projectRanking = z
    .array(storedProjectRankSchema)
    .parse(generated.projectRanking ?? []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${generated.jobDescription.title} — ${generated.jobDescription.company}`}
        description={`Generated from “${generated.resume.title}” on ${formatDate(generated.createdAt)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/generated/${generated.id}/compare`}>
                <GitCompareArrows aria-hidden /> Compare
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/tracker?company=${encodeURIComponent(generated.jobDescription.company)}&position=${encodeURIComponent(generated.jobDescription.title)}&generatedResumeId=${generated.id}&jobDescriptionId=${generated.jobDescription.id}`}
              >
                <KanbanSquare aria-hidden /> Track application
              </Link>
            </Button>
            <ExportMenu generatedResumeId={generated.id} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: analysis */}
        <div className="space-y-6 lg:col-span-2">
          <ScoreCard total={generated.atsScore} breakdown={breakdown} />
          <MissingSkillsCard
            matched={generated.matchedSkills}
            missing={generated.missingSkills}
          />
          <ExperienceRankingList items={experienceRanking} />
          <ProjectRankingList items={projectRanking} />
        </div>

        {/* Right: the tailored resume */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Tailored resume</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
              <ResumeView resume={content} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

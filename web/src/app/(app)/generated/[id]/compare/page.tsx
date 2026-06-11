import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MinusCircle, PlusCircle } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { ResumeView } from "@/components/resume/resume-view";
import { SkillBadges } from "@/components/skill-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  contactInfoSchema,
  educationEntrySchema,
  parsedResumeSchema,
  type ParsedResume,
} from "@/lib/schemas";
import { requireUser } from "@/server/users";

export const metadata = { title: "Compare" };
export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const generated = await db.generatedResume.findFirst({
    where: { id, userId: user.id },
    include: {
      jobDescription: { select: { title: true, company: true } },
      resume: {
        include: {
          experiences: { orderBy: { order: "asc" } },
          projects: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!generated) notFound();

  const generatedContent = parsedResumeSchema.parse(generated.content);
  const original: ParsedResume = {
    contact: contactInfoSchema.parse(generated.resume.contact ?? {}),
    summary: generated.resume.summary ?? "",
    education: z.array(educationEntrySchema).parse(generated.resume.education ?? []),
    skills: generated.resume.skills,
    experiences: generated.resume.experiences.map((e) => ({
      company: e.company,
      title: e.title,
      location: e.location ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      current: e.current,
      bullets: e.bullets,
    })),
    projects: generated.resume.projects.map((p) => ({
      name: p.name,
      description: p.description ?? "",
      technologies: p.technologies,
      url: p.url ?? "",
      bullets: p.bullets,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Original vs. tailored"
        description={`${generated.jobDescription.title} — ${generated.jobDescription.company}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/generated/${generated.id}`}>
              <ArrowLeft aria-hidden /> Back to results
            </Link>
          </Button>
        }
      />

      {/* Change summary */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PlusCircle className="h-4 w-4 text-emerald-600" aria-hidden />
              Keywords added ({generated.addedKeywords.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generated.addedKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No new keywords — your original already covered the job&apos;s language.
              </p>
            ) : (
              <SkillBadges skills={generated.addedKeywords} variant="success" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MinusCircle className="h-4 w-4 text-red-500" aria-hidden />
              Content removed ({generated.removedContent.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generated.removedContent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing was removed.</p>
            ) : (
              <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-muted-foreground">
                {generated.removedContent.map((item, i) => (
                  <li key={i} className="line-through decoration-red-400/60">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Original</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <ResumeView resume={original} />
          </CardContent>
        </Card>
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-primary">Tailored</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <ResumeView resume={generatedContent} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

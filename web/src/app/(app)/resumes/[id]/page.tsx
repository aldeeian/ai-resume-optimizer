import Link from "next/link";
import { notFound } from "next/navigation";
import { Wand2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ResumeView } from "@/components/resume/resume-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  contactInfoSchema,
  educationEntrySchema,
  type ParsedResume,
} from "@/lib/schemas";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/users";
import { z } from "zod";

export const metadata = { title: "Resume" };
export const dynamic = "force-dynamic";

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const resume = await db.resume.findFirst({
    where: { id, userId: user.id },
    include: {
      experiences: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!resume) notFound();

  const parsed: ParsedResume = {
    contact: contactInfoSchema.parse(resume.contact ?? {}),
    summary: resume.summary ?? "",
    education: z.array(educationEntrySchema).parse(resume.education ?? []),
    skills: resume.skills,
    experiences: resume.experiences.map((e) => ({
      company: e.company,
      title: e.title,
      location: e.location ?? "",
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      current: e.current,
      bullets: e.bullets,
    })),
    projects: resume.projects.map((p) => ({
      name: p.name,
      description: p.description ?? "",
      technologies: p.technologies,
      url: p.url ?? "",
      bullets: p.bullets,
    })),
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={resume.title}
        description={`${resume.fileType} · uploaded ${formatDate(resume.createdAt)}`}
        actions={
          <>
            {resume.isMaster ? <Badge variant="info">Master resume</Badge> : null}
            <Button asChild>
              <Link href={`/optimize?resume=${resume.id}`}>
                <Wand2 aria-hidden /> Optimize for a job
              </Link>
            </Button>
          </>
        }
      />
      <Card>
        <CardContent className="p-6 sm:p-8">
          <ResumeView resume={parsed} />
        </CardContent>
      </Card>
    </div>
  );
}

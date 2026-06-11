import Link from "next/link";
import { FileSearch, FileText } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { OptimizeForm } from "@/components/optimize/optimize-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireUser } from "@/server/users";

export const metadata = { title: "Optimize" };
export const dynamic = "force-dynamic";

export default async function OptimizePage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string; job?: string }>;
}) {
  const { resume: resumeParam, job: jobParam } = await searchParams;
  const user = await requireUser();

  const [resumes, jobs] = await Promise.all([
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: [{ isMaster: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, isMaster: true },
    }),
    db.jobDescription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, company: true },
    }),
  ]);

  const header = (
    <PageHeader
      title="Optimize a resume"
      description="Pick a resume and a job. We rank your experience, surface skill gaps, and generate an ATS-scored tailored resume."
    />
  );

  if (resumes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <EmptyState
          icon={FileText}
          title="Upload a resume first"
          description="You need at least one parsed resume before you can optimize."
          action={
            <Button asChild>
              <Link href="/resumes/new">Upload a resume</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <EmptyState
          icon={FileSearch}
          title="Analyze a job description first"
          description="You need at least one analyzed job posting before you can optimize."
          action={
            <Button asChild>
              <Link href="/jobs/new">Analyze a job</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {header}
      <Card>
        <CardContent className="p-6">
          <OptimizeForm
            resumes={resumes.map((r) => ({
              id: r.id,
              label: r.isMaster ? `${r.title} (master)` : r.title,
            }))}
            jobs={jobs.map((j) => ({ id: j.id, label: `${j.title} — ${j.company}` }))}
            defaultResumeId={resumes.some((r) => r.id === resumeParam) ? resumeParam : undefined}
            defaultJobId={jobs.some((j) => j.id === jobParam) ? jobParam : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { FileSearch, Plus } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { deleteJob } from "@/server/actions/jobs";
import { requireUser } from "@/server/users";

export const metadata = { title: "Job descriptions" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await requireUser();
  const jobs = await db.jobDescription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      company: true,
      seniority: true,
      requiredSkills: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Job descriptions"
        description="Postings you've analyzed, with extracted skills and keywords."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <Plus aria-hidden /> Analyze a job
            </Link>
          </Button>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No job descriptions yet"
          description="Paste a job posting and we'll extract the required skills, technologies, keywords, and responsibilities."
          action={
            <Button asChild>
              <Link href="/jobs/new">
                <Plus aria-hidden /> Analyze a job
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {job.title} <span className="text-muted-foreground">·</span> {job.company}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {job.requiredSkills.length} required skills · analyzed{" "}
                    {formatDate(job.createdAt)}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {job.seniority ? <Badge variant="secondary">{job.seniority}</Badge> : null}
                  <ConfirmDeleteButton
                    title="Delete this job description?"
                    description="This removes the analysis and any generated resumes linked to it."
                    onDelete={deleteJob.bind(null, job.id)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

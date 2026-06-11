import Link from "next/link";
import { FileText, Star, Upload } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { deleteResume } from "@/server/actions/resumes";
import { requireUser } from "@/server/users";

export const metadata = { title: "Resumes" };
export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const user = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { experiences: true, projects: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Resumes"
        description="Your uploaded master resumes, parsed into structured sections."
        actions={
          <Button asChild>
            <Link href="/resumes/new">
              <Upload aria-hidden /> Upload resume
            </Link>
          </Button>
        }
      />

      {resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Upload your master resume to get started. We'll parse your experience, projects, skills, and education automatically."
          action={
            <Button asChild>
              <Link href="/resumes/new">
                <Upload aria-hidden /> Upload resume
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {resumes.map((resume) => (
            <Card key={resume.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <Link
                  href={`/resumes/${resume.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {resume.title}
                      {resume.isMaster ? (
                        <Badge variant="info" className="shrink-0">
                          <Star className="mr-1 h-3 w-3" aria-hidden /> Master
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {resume.fileType} · {resume._count.experiences} experiences ·{" "}
                      {resume._count.projects} projects · uploaded {formatDate(resume.createdAt)}
                    </p>
                  </div>
                </Link>
                <ConfirmDeleteButton
                  title="Delete this resume?"
                  description="This permanently removes the resume, its parsed sections, and every generated resume created from it."
                  onDelete={deleteResume.bind(null, resume.id)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

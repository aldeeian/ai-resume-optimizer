import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { z } from "zod";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EmptyState } from "@/components/empty-state";
import {
  NewInterviewDialog,
  type InterviewOption,
} from "@/components/interview/new-interview-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { interviewAnswerSchema, interviewQuestionSchema } from "@/lib/schemas";
import { formatDate, scoreColor } from "@/lib/utils";
import { deleteInterviewSession } from "@/server/actions/interviews";
import { requireUser } from "@/server/users";

export const metadata = { title: "Mock interview" };
export const dynamic = "force-dynamic";

export default async function InterviewListPage() {
  const user = await requireUser();

  const [sessions, jobs, resumes] = await Promise.all([
    db.interviewSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { jobDescription: { select: { title: true, company: true } } },
    }),
    db.jobDescription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, company: true },
    }),
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  const jobOptions: InterviewOption[] = jobs.map((j) => ({
    id: j.id,
    label: `${j.title} — ${j.company}`,
  }));
  const resumeOptions: InterviewOption[] = resumes.map((r) => ({
    id: r.id,
    label: r.title,
  }));
  const canStart = jobOptions.length > 0 && resumeOptions.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Mock interview"
        description="Practice with AI-generated questions for your target jobs, scored with coaching feedback."
        actions={canStart ? <NewInterviewDialog jobs={jobOptions} resumes={resumeOptions} /> : null}
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No interviews yet"
          description={
            canStart
              ? "Start a mock interview — questions come from a real job posting and your real resume."
              : "Upload a resume and analyze a job description first, then practice interviewing for it."
          }
          action={
            canStart ? <NewInterviewDialog jobs={jobOptions} resumes={resumeOptions} /> : null
          }
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const questions = z.array(interviewQuestionSchema).parse(session.questions);
            const answers = z.array(interviewAnswerSchema).parse(session.answers ?? []);
            const done = session.status === "COMPLETED";
            return (
              <Card key={session.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <Link href={`/interview/${session.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {session.jobDescription.title}{" "}
                      <span className="text-muted-foreground">·</span>{" "}
                      {session.jobDescription.company}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {answers.length}/{questions.length} answered · {formatDate(session.createdAt)}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {done && session.overallScore !== null ? (
                      <Badge variant="outline" className={scoreColor(session.overallScore)}>
                        Score {session.overallScore}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">In progress</Badge>
                    )}
                    <ConfirmDeleteButton
                      title="Delete this interview session?"
                      description="Your answers and feedback for this session will be permanently removed."
                      onDelete={deleteInterviewSession.bind(null, session.id)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

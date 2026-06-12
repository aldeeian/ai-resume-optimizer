import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { InterviewSessionClient } from "@/components/interview/interview-session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { interviewAnswerSchema, interviewQuestionSchema } from "@/lib/schemas";
import { requireUser } from "@/server/users";

export const metadata = { title: "Interview session" };
export const dynamic = "force-dynamic";

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const session = await db.interviewSession.findFirst({
    where: { id, userId: user.id },
    include: { jobDescription: { select: { title: true, company: true } } },
  });
  if (!session) notFound();

  const questions = z.array(interviewQuestionSchema).parse(session.questions);
  const answers = z.array(interviewAnswerSchema).parse(session.answers ?? []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Interview: ${session.jobDescription.title}`}
        description={`${session.jobDescription.company} · answer as if you were speaking in a real screen`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/interview">
              <ArrowLeft aria-hidden /> All interviews
            </Link>
          </Button>
        }
      />
      <InterviewSessionClient
        sessionId={session.id}
        questions={questions}
        initialAnswers={answers}
        overallScore={session.overallScore}
      />
    </div>
  );
}

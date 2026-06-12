import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  CoverLetterClient,
  type CoverLetterItem,
} from "@/components/cover-letter/cover-letter-client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireUser } from "@/server/users";

export const metadata = { title: "Cover letter" };
export const dynamic = "force-dynamic";

export default async function CoverLetterPage({
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
      coverLetters: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!generated) notFound();

  const letters: CoverLetterItem[] = generated.coverLetters.map((l) => ({
    id: l.id,
    tone: l.tone,
    content: l.content,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Cover letter"
        description={`For ${generated.jobDescription.title} at ${generated.jobDescription.company}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/generated/${generated.id}`}>
              <ArrowLeft aria-hidden /> Back to results
            </Link>
          </Button>
        }
      />
      <CoverLetterClient
        generatedResumeId={generated.id}
        jobLabel={`${generated.jobDescription.title}-${generated.jobDescription.company}`}
        letters={letters}
      />
    </div>
  );
}

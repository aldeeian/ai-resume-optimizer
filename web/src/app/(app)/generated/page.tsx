import Link from "next/link";
import { Sparkles, Wand2 } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDate, scoreColor } from "@/lib/utils";
import { deleteGeneratedResume } from "@/server/actions/optimize";
import { requireUser } from "@/server/users";

export const metadata = { title: "Generated resumes" };
export const dynamic = "force-dynamic";

export default async function GeneratedListPage() {
  const user = await requireUser();
  const generated = await db.generatedResume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      jobDescription: { select: { title: true, company: true } },
      resume: { select: { title: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Generated resumes"
        description="Tailored, ATS-scored resumes from your optimization runs."
        actions={
          <Button asChild>
            <Link href="/optimize">
              <Wand2 aria-hidden /> New optimization
            </Link>
          </Button>
        }
      />

      {generated.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No generated resumes yet"
          description="Run an optimization to create your first tailored, ATS-scored resume."
          action={
            <Button asChild>
              <Link href="/optimize">
                <Wand2 aria-hidden /> Optimize a resume
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {generated.map((g) => (
            <Card key={g.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <Link href={`/generated/${g.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {g.jobDescription.title}{" "}
                    <span className="text-muted-foreground">·</span> {g.jobDescription.company}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    from “{g.resume.title}” · {formatDate(g.createdAt)}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className={scoreColor(g.atsScore)}>
                    ATS {g.atsScore}
                  </Badge>
                  <ConfirmDeleteButton
                    title="Delete this generated resume?"
                    description="This removes the tailored resume and its analysis. The original resume is unaffected."
                    onDelete={deleteGeneratedResume.bind(null, g.id)}
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

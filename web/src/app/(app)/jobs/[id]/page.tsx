import Link from "next/link";
import { notFound } from "next/navigation";
import { Wand2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SkillBadges } from "@/components/skill-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/users";

export const metadata = { title: "Job analysis" };
export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const job = await db.jobDescription.findFirst({ where: { id, userId: user.id } });
  if (!job) notFound();

  const sections = [
    { title: "Required skills", skills: job.requiredSkills, variant: "destructive" as const },
    { title: "Preferred skills", skills: job.preferredSkills, variant: "warning" as const },
    { title: "Technologies", skills: job.technologies, variant: "info" as const },
    { title: "Keywords", skills: job.keywords, variant: "secondary" as const },
    { title: "Soft skills", skills: job.softSkills, variant: "outline" as const },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={job.title}
        description={`${job.company} · analyzed ${formatDate(job.createdAt)}`}
        actions={
          <>
            {job.seniority ? <Badge variant="secondary">{job.seniority}</Badge> : null}
            <Button asChild>
              <Link href={`/optimize?job=${job.id}`}>
                <Wand2 aria-hidden /> Optimize a resume for this job
              </Link>
            </Button>
          </>
        }
      />

      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="original">Original posting</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map(({ title, skills, variant }) => (
              <Card key={title}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    {title}{" "}
                    <span className="font-normal text-muted-foreground">({skills.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SkillBadges skills={skills} variant={variant} />
                </CardContent>
              </Card>
            ))}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Responsibilities{" "}
                  <span className="font-normal text-muted-foreground">
                    ({job.responsibilities.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {job.responsibilities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None extracted.</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                    {job.responsibilities.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="original">
          <Card>
            <CardContent className="p-6">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {job.rawText}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

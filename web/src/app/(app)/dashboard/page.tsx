import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  FileText,
  Gauge,
  KanbanSquare,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDate, scoreColor } from "@/lib/utils";
import { requireUser } from "@/server/users";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const [resumeCount, jobCount, generatedCount, applicationCount, avgScore, recentGenerated] =
    await Promise.all([
      db.resume.count({ where: { userId: user.id } }),
      db.jobDescription.count({ where: { userId: user.id } }),
      db.generatedResume.count({ where: { userId: user.id } }),
      db.application.count({ where: { userId: user.id } }),
      db.generatedResume.aggregate({
        where: { userId: user.id },
        _avg: { atsScore: true },
      }),
      db.generatedResume.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { jobDescription: { select: { title: true, company: true } } },
      }),
    ]);

  const stats = [
    { label: "Resumes", value: resumeCount, icon: FileText, href: "/resumes" },
    { label: "Job Descriptions", value: jobCount, icon: FileSearch, href: "/jobs" },
    { label: "Generated Resumes", value: generatedCount, icon: Sparkles, href: "/generated" },
    { label: "Applications", value: applicationCount, icon: KanbanSquare, href: "/tracker" },
    {
      label: "Avg ATS Score",
      value: avgScore._avg.atsScore === null ? "—" : Math.round(avgScore._avg.atsScore),
      icon: Gauge,
      href: "/analytics",
    },
  ];

  const firstName = user.firstName ?? "there";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's where your search stands."
        actions={
          <Button asChild>
            <Link href="/optimize">
              <Wand2 aria-hidden /> Optimize a resume
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Recent generated resumes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent optimizations</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/generated">
                View all <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentGenerated.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No generated resumes yet. Upload a resume and analyze a job to get started.
              </p>
            ) : (
              <ul className="divide-y">
                {recentGenerated.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/generated/${g.id}`}
                      className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {g.jobDescription.title} — {g.jobDescription.company}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(g.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className={scoreColor(g.atsScore)}>
                        ATS {g.atsScore}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/resumes/new">
                <Upload aria-hidden /> Upload a resume
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/jobs/new">
                <FileSearch aria-hidden /> Analyze a job description
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/optimize">
                <Wand2 aria-hidden /> Generate a tailored resume
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/tracker">
                <KanbanSquare aria-hidden /> Track an application
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

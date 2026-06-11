import { format, startOfWeek } from "date-fns";
import {
  Briefcase,
  Gauge,
  MessageSquare,
  Percent,
  Trophy,
} from "lucide-react";

import {
  ApplicationsOverTimeChart,
  ScoreTrendChart,
  StatusBarChart,
} from "@/components/analytics/charts";
import { PageHeader } from "@/components/page-header";
import { SkillBadges } from "@/components/skill-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { normalizeSkill } from "@/lib/ats/skills";
import { requireUser } from "@/server/users";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export default async function AnalyticsPage() {
  const user = await requireUser();

  const [applications, generated] = await Promise.all([
    db.application.findMany({
      where: { userId: user.id },
      select: { status: true, appliedAt: true, createdAt: true },
    }),
    db.generatedResume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { atsScore: true, createdAt: true, matchedSkills: true },
    }),
  ]);

  // ── Headline metrics ─────────────────────────────────────────────────────
  const submitted = applications.filter((a) => a.status !== "SAVED").length;
  const interviews = applications.filter(
    (a) => a.status === "INTERVIEWING" || a.status === "OFFER"
  ).length;
  const offers = applications.filter((a) => a.status === "OFFER").length;
  const responded = applications.filter((a) =>
    ["INTERVIEWING", "OFFER", "REJECTED"].includes(a.status)
  ).length;
  const responseRate = submitted === 0 ? null : Math.round((responded / submitted) * 100);
  const avgScore =
    generated.length === 0
      ? null
      : Math.round(generated.reduce((sum, g) => sum + g.atsScore, 0) / generated.length);

  // ── Status distribution ─────────────────────────────────────────────────
  const statusData = Object.entries(STATUS_LABELS).map(([status, label]) => ({
    status: label,
    count: applications.filter((a) => a.status === status).length,
  }));

  // ── Applications per week (last 12 weeks with data) ─────────────────────
  const weekCounts = new Map<string, number>();
  for (const app of applications) {
    const date = app.appliedAt ?? app.createdAt;
    const week = format(startOfWeek(date, { weekStartsOn: 1 }), "MMM d");
    weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
  }
  const timeData = [...weekCounts.entries()]
    .slice(-12)
    .map(([label, count]) => ({ label, count }));

  // ── ATS score trend ──────────────────────────────────────────────────────
  const scoreTrend = generated.slice(-20).map((g, i) => ({
    label: format(g.createdAt, "MMM d") + (generated.length > 20 ? ` #${i + 1}` : ""),
    score: g.atsScore,
  }));

  // ── Top matched skills across optimizations ─────────────────────────────
  const skillCounts = new Map<string, { display: string; count: number }>();
  for (const g of generated) {
    for (const skill of g.matchedSkills) {
      const key = normalizeSkill(skill);
      const entry = skillCounts.get(key);
      if (entry) entry.count++;
      else skillCounts.set(key, { display: skill, count: 1 });
    }
  }
  const topSkills = [...skillCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map((s) => `${s.display} (${s.count})`);

  const headline = [
    { label: "Applications submitted", value: submitted, icon: Briefcase },
    { label: "Interviews", value: interviews, icon: MessageSquare },
    { label: "Offers", value: offers, icon: Trophy },
    {
      label: "Response rate",
      value: responseRate === null ? "—" : `${responseRate}%`,
      icon: Percent,
    },
    { label: "Avg ATS score", value: avgScore ?? "—", icon: Gauge },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description="How your search is performing across applications and optimizations."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {headline.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications by status</CardTitle>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No applications tracked yet.
              </p>
            ) : (
              <StatusBarChart data={statusData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Applications per week</CardTitle>
          </CardHeader>
          <CardContent>
            {timeData.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No applications tracked yet.
              </p>
            ) : (
              <ApplicationsOverTimeChart data={timeData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ATS score trend</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreTrend.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Run an optimization to start tracking scores.
              </p>
            ) : (
              <ScoreTrendChart data={scoreTrend} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top matched skills</CardTitle>
          </CardHeader>
          <CardContent>
            {topSkills.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Skills you match most often will appear here after optimizations.
              </p>
            ) : (
              <SkillBadges skills={topSkills} variant="info" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

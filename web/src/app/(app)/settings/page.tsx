import { DangerZone } from "@/components/settings/danger-zone";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Manage your data and how the optimizer works." />

      <Card>
        <CardHeader>
          <CardTitle>How optimization works</CardTitle>
          <CardDescription>What happens to your data during an optimization run.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Your resume text and job descriptions are sent to our AI service to be parsed, ranked,
            and rewritten. Nothing is ever fabricated: generated resumes are validated so that
            every employer, title, date, and metric exists in your original resume.
          </p>
          <p>
            The ATS score is computed deterministically from keyword, skill, and relevance
            matching — the same inputs always produce the same score.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Remove every resume, job description, generated resume, and tracked application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DangerZone />
        </CardContent>
      </Card>
    </div>
  );
}

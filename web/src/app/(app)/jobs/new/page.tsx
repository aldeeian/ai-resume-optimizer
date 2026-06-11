import { AnalyzeForm } from "@/components/jobs/analyze-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Analyze a job" };

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Analyze a job description"
        description="Paste a posting to extract required skills, preferred skills, technologies, keywords, soft skills, and responsibilities."
      />
      <Card>
        <CardContent className="p-6">
          <AnalyzeForm />
        </CardContent>
      </Card>
    </div>
  );
}

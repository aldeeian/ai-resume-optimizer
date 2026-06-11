import { PageHeader } from "@/components/page-header";
import { UploadForm } from "@/components/resume/upload-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Upload resume" };

export default function NewResumePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Upload a resume"
        description="We extract the text, then parse your education, skills, experience, and projects with AI."
      />
      <Card>
        <CardContent className="p-6">
          <UploadForm />
        </CardContent>
      </Card>
    </div>
  );
}

import { PageHeader } from "@/components/page-header";
import { TrackerClient } from "@/components/tracker/tracker-client";

export const metadata = { title: "Application tracker" };
export const dynamic = "force-dynamic";

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    position?: string;
    generatedResumeId?: string;
    jobDescriptionId?: string;
  }>;
}) {
  const params = await searchParams;
  const prefill =
    params.company || params.position
      ? {
          company: params.company ?? "",
          position: params.position ?? "",
          generatedResumeId: params.generatedResumeId,
          jobDescriptionId: params.jobDescriptionId,
        }
      : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Application tracker"
        description="Every application from saved to offer, in one place."
      />
      <TrackerClient prefill={prefill} />
    </div>
  );
}

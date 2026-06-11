import type { ApplicationStatusValue } from "@/lib/schemas";

/** Shape returned by GET /api/applications (dates serialized as ISO strings). */
export interface ApplicationDto {
  id: string;
  company: string;
  position: string;
  url: string | null;
  status: ApplicationStatusValue;
  appliedAt: string | null;
  interviewAt: string | null;
  offerAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  jobDescription: { id: string; title: string; company: string } | null;
  generatedResume: { id: string; atsScore: number } | null;
}

export const STATUS_OPTIONS: Array<{
  value: ApplicationStatusValue;
  label: string;
}> = [
  { value: "SAVED", label: "Saved" },
  { value: "APPLIED", label: "Applied" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFER", label: "Offer" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

export const STATUS_BADGE_VARIANT: Record<
  ApplicationStatusValue,
  "secondary" | "info" | "warning" | "success" | "destructive" | "outline"
> = {
  SAVED: "secondary",
  APPLIED: "info",
  INTERVIEWING: "warning",
  OFFER: "success",
  REJECTED: "destructive",
  WITHDRAWN: "outline",
};

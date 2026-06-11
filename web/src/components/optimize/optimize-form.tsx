"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { optimizeResume } from "@/server/actions/optimize";

export interface OptimizeOption {
  id: string;
  label: string;
}

const PIPELINE_STEPS = [
  "Ranking your experiences and projects against the job…",
  "Computing the skills gap…",
  "Generating your tailored resume…",
  "Scoring it against the job…",
];

export function OptimizeForm({
  resumes,
  jobs,
  defaultResumeId,
  defaultJobId,
}: {
  resumes: OptimizeOption[];
  jobs: OptimizeOption[];
  defaultResumeId?: string;
  defaultJobId?: string;
}) {
  const [resumeId, setResumeId] = useState(defaultResumeId ?? resumes[0]?.id ?? "");
  const [jobId, setJobId] = useState(defaultJobId ?? jobs[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeId || !jobId) {
      toast.error("Choose both a resume and a job description.");
      return;
    }
    startTransition(async () => {
      const result = await optimizeResume({ resumeId, jobDescriptionId: jobId });
      if (result.ok) {
        toast.success("Tailored resume generated.");
        router.push(`/generated/${result.data.generatedResumeId}`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="opt-resume">Resume</Label>
          <Select value={resumeId} onValueChange={setResumeId} disabled={pending}>
            <SelectTrigger id="opt-resume" aria-label="Choose a resume">
              <SelectValue placeholder="Choose a resume" />
            </SelectTrigger>
            <SelectContent>
              {resumes.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="opt-job">Job description</Label>
          <Select value={jobId} onValueChange={setJobId} disabled={pending}>
            <SelectTrigger id="opt-job" aria-label="Choose a job description">
              <SelectValue placeholder="Choose a job description" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={pending || !resumeId || !jobId} size="lg">
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Optimizing…
          </>
        ) : (
          <>
            <Wand2 aria-hidden /> Generate tailored resume
          </>
        )}
      </Button>

      {pending ? (
        <div
          role="status"
          aria-live="polite"
          className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          <p className="font-medium text-foreground">This takes 30–60 seconds.</p>
          {PIPELINE_STEPS.map((step) => (
            <p key={step}>· {step}</p>
          ))}
        </div>
      ) : null}
    </form>
  );
}

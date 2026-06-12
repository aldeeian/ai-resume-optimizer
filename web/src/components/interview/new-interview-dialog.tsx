"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessagesSquare, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startInterview } from "@/server/actions/interviews";

export interface InterviewOption {
  id: string;
  label: string;
}

const QUESTION_COUNTS = ["4", "6", "8", "10"] as const;

export function NewInterviewDialog({
  jobs,
  resumes,
}: {
  jobs: InterviewOption[];
  resumes: InterviewOption[];
}) {
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [count, setCount] = useState<string>("6");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleStart = () => {
    if (!jobId || !resumeId) {
      toast.error("Choose both a job description and a resume.");
      return;
    }
    startTransition(async () => {
      const result = await startInterview({
        jobDescriptionId: jobId,
        resumeId,
        numQuestions: Number(count),
      });
      if (result.ok) {
        toast.success("Interview ready — good luck!");
        router.push(`/interview/${result.data.sessionId}`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden /> New interview
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a mock interview</DialogTitle>
          <DialogDescription>
            Questions are generated from the job&apos;s actual requirements and your actual
            resume — behavioral, technical, and resume-specific probes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="iv-job">Job description</Label>
            <Select value={jobId} onValueChange={setJobId} disabled={pending}>
              <SelectTrigger id="iv-job" aria-label="Choose a job description">
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
          <div className="space-y-2">
            <Label htmlFor="iv-resume">Resume</Label>
            <Select value={resumeId} onValueChange={setResumeId} disabled={pending}>
              <SelectTrigger id="iv-resume" aria-label="Choose a resume">
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
            <Label htmlFor="iv-count">Number of questions</Label>
            <Select value={count} onValueChange={setCount} disabled={pending}>
              <SelectTrigger id="iv-count" aria-label="Number of questions" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_COUNTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={pending || !jobId || !resumeId}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden /> Preparing questions…
              </>
            ) : (
              <>
                <MessagesSquare aria-hidden /> Start interview
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

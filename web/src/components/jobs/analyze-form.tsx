"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeJob } from "@/server/actions/jobs";

const MIN_CHARS = 100;

export function AnalyzeForm() {
  const [rawText, setRawText] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rawText.trim().length < MIN_CHARS) {
      toast.error(`Paste the full job description (at least ${MIN_CHARS} characters).`);
      return;
    }
    startTransition(async () => {
      const result = await analyzeJob({ rawText });
      if (result.ok) {
        toast.success("Job description analyzed.");
        router.push(`/jobs/${result.data.jobDescriptionId}`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="jd-text">Job description</Label>
        <Textarea
          id="jd-text"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste the full job posting here — title, company, responsibilities, and qualifications…"
          rows={16}
          disabled={pending}
          aria-describedby="jd-help"
        />
        <p id="jd-help" className="text-xs text-muted-foreground">
          {rawText.trim().length.toLocaleString()} characters — include the requirements section
          for the best analysis.
        </p>
      </div>
      <Button type="submit" disabled={pending || rawText.trim().length < MIN_CHARS}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Analyzing…
          </>
        ) : (
          <>
            <FileSearch aria-hidden /> Analyze job description
          </>
        )}
      </Button>
      {pending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Extracting skills, technologies, keywords, and responsibilities…
        </p>
      ) : null}
    </form>
  );
}

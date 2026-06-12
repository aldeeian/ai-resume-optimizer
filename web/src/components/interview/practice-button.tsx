"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startInterview } from "@/server/actions/interviews";

/** Start a mock interview seeded from a generated (tailored) resume. */
export function PracticeInterviewButton({ generatedResumeId }: { generatedResumeId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      const result = await startInterview({ generatedResumeId });
      if (result.ok) {
        toast.success("Interview ready — good luck!");
        router.push(`/interview/${result.data.sessionId}`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden /> Preparing…
        </>
      ) : (
        <>
          <MessagesSquare aria-hidden /> Practice interview
        </>
      )}
    </Button>
  );
}

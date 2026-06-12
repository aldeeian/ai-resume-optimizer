"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import type { CoverLetterTone } from "@/lib/schemas";
import { deleteCoverLetter, generateCoverLetter } from "@/server/actions/cover-letters";

export interface CoverLetterItem {
  id: string;
  tone: string;
  content: string;
  createdAt: string;
}

const TONES: Array<{ value: CoverLetterTone; label: string; hint: string }> = [
  { value: "professional", label: "Professional", hint: "measured, conventional business tone" },
  { value: "enthusiastic", label: "Enthusiastic", hint: "energetic, shows excitement through specifics" },
  { value: "concise", label: "Concise", hint: "tighter, 200–250 words" },
];

export function CoverLetterClient({
  generatedResumeId,
  jobLabel,
  letters,
}: {
  generatedResumeId: string;
  jobLabel: string;
  letters: CoverLetterItem[];
}) {
  const [tone, setTone] = useState<CoverLetterTone>("professional");
  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateCoverLetter({ generatedResumeId, tone });
      if (result.ok) {
        toast.success("Cover letter generated.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleCopy = async (letter: CoverLetterItem) => {
    await navigator.clipboard.writeText(letter.content);
    setCopiedId(letter.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Copied to clipboard.");
  };

  const handleDownload = (letter: CoverLetterItem) => {
    const blob = new Blob([letter.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${jobLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedTone = TONES.find((t) => t.value === tone);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate a cover letter</CardTitle>
          <p className="text-sm text-muted-foreground">
            Written only from facts on your tailored resume — figures are verified against it.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="w-56 space-y-2">
            <Label htmlFor="cl-tone">Tone</Label>
            <Select
              value={tone}
              onValueChange={(v) => setTone(v as CoverLetterTone)}
              disabled={pending}
            >
              <SelectTrigger id="cl-tone" aria-label="Choose a tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTone ? (
              <p className="text-xs text-muted-foreground">{selectedTone.hint}</p>
            ) : null}
          </div>
          <Button onClick={handleGenerate} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden /> Writing…
              </>
            ) : (
              <>
                <Mail aria-hidden /> {letters.length > 0 ? "Generate another" : "Generate"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {letters.map((letter) => (
        <Card key={letter.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base capitalize">{letter.tone}</CardTitle>
              <p className="text-xs text-muted-foreground">{formatDate(letter.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleCopy(letter)}>
                {copiedId === letter.id ? (
                  <Check aria-hidden />
                ) : (
                  <Copy aria-hidden />
                )}
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownload(letter)}>
                <Download aria-hidden /> .txt
              </Button>
              <ConfirmDeleteButton
                onDelete={() => deleteCoverLetter(letter.id)}
                title="Delete this cover letter?"
                description="The letter will be permanently removed. This cannot be undone."
                label="Delete cover letter"
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{letter.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

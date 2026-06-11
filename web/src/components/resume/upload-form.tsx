"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadResume } from "@/server/actions/resumes";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,.txt";
const MAX_BYTES = 5 * 1024 * 1024;

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isMaster, setIsMaster] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const selectFile = useCallback((candidate: File | undefined) => {
    if (!candidate) return;
    const ext = candidate.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx", "txt"].includes(ext)) {
      toast.error("Unsupported file type. Upload a PDF, DOCX, or TXT file.");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      toast.error("File is too large. The maximum size is 5 MB.");
      return;
    }
    setFile(candidate);
  }, []);

  const handleSubmit = () => {
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("isMaster", String(isMaster));
      const result = await uploadResume(formData);
      if (result.ok) {
        toast.success("Resume parsed and saved.");
        router.push(`/resumes/${result.data.resumeId}`);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resume file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          selectFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => selectFile(e.target.files?.[0])}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Upload className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <p className="mt-4 font-medium">
          {dragOver ? "Drop it here" : "Drag & drop your resume, or click to browse"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">PDF, DOCX, or TXT — up to 5 MB</p>
      </div>

      {/* Selected file */}
      {file ? (
        <div className="flex items-center justify-between rounded-lg border bg-card p-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove file"
            onClick={() => setFile(null)}
            disabled={pending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {/* Master toggle */}
      <div className="flex items-center gap-2">
        <input
          id="isMaster"
          type="checkbox"
          checked={isMaster}
          onChange={(e) => setIsMaster(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-[var(--primary)]"
        />
        <Label htmlFor="isMaster">Set as my master resume</Label>
      </div>

      <Button onClick={handleSubmit} disabled={pending || !file} className="w-full sm:w-auto">
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Parsing your resume…
          </>
        ) : (
          <>
            <Upload aria-hidden /> Upload & parse
          </>
        )}
      </Button>
      {pending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Extracting text and parsing sections with AI — this usually takes 10–20 seconds.
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FORMATS = [
  { ext: "pdf", label: "PDF (.pdf)" },
  { ext: "docx", label: "Word (.docx)" },
  { ext: "txt", label: "Plain text (.txt)" },
] as const;

export function ExportMenu({ generatedResumeId }: { generatedResumeId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Download aria-hidden /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMATS.map(({ ext, label }) => (
          <DropdownMenuItem key={ext} asChild>
            {/* Plain anchor so the browser handles the file download stream. */}
            <a href={`/api/export/${generatedResumeId}/${ext}`} download>
              {label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

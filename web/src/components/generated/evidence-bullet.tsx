"use client";

import { useState } from "react";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BulletEvidence } from "@/lib/schemas";

/**
 * One generated bullet with its provenance: a verified/unverified badge that
 * expands to show the verbatim source-resume quotes backing the text.
 */
export function EvidenceBullet({
  text,
  evidence,
}: {
  text: string;
  evidence: BulletEvidence | undefined;
}) {
  const [open, setOpen] = useState(false);

  if (!evidence || evidence.sources.length === 0) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {text}{" "}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={
          evidence.verified
            ? "Verified: backed by verbatim text from your master resume"
            : "Cited source could not be verified verbatim"
        }
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 align-middle text-[10px] font-medium transition-colors",
          evidence.verified
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
            : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
        )}
      >
        {evidence.verified ? (
          <ShieldCheck className="h-3 w-3" aria-hidden />
        ) : (
          <ShieldAlert className="h-3 w-3" aria-hidden />
        )}
        {evidence.verified ? "Source" : "Unverified"}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <span className="mt-1.5 block space-y-1 rounded-md border bg-muted/40 p-2">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            From your master resume
          </span>
          {evidence.sources.map((quote, i) => (
            <span key={i} className="block text-xs italic text-muted-foreground">
              “{quote}”
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** Map evidence entries by location for O(1) lookup while rendering. */
export function evidenceLookup(
  evidence: BulletEvidence[]
): Map<string, BulletEvidence> {
  return new Map(
    evidence.map((e) => [`${e.section}:${e.entryIndex}:${e.bulletIndex}`, e])
  );
}

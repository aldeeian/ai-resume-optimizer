"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationStatusValue } from "@/lib/schemas";
import { STATUS_OPTIONS, type ApplicationDto } from "@/lib/tracker-types";

export interface ApplicationFormValues {
  company: string;
  position: string;
  url: string;
  status: ApplicationStatusValue;
  appliedAt: string;
  interviewAt: string;
  notes: string;
  jobDescriptionId?: string;
  generatedResumeId?: string;
}

const EMPTY: ApplicationFormValues = {
  company: "",
  position: "",
  url: "",
  status: "SAVED",
  appliedAt: "",
  interviewAt: "",
  notes: "",
};

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function ApplicationDialog({
  open,
  onOpenChange,
  initial,
  editing,
  prefill,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When editing an existing application. */
  initial?: ApplicationDto | null;
  editing: boolean;
  /** Prefill values for a new application (e.g. from a generated resume). */
  prefill?: Partial<ApplicationFormValues>;
  onSubmit: (values: ApplicationFormValues) => void;
  pending: boolean;
}) {
  const [values, setValues] = useState<ApplicationFormValues>(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setValues({
        company: initial.company,
        position: initial.position,
        url: initial.url ?? "",
        status: initial.status,
        appliedAt: toDateInput(initial.appliedAt),
        interviewAt: toDateInput(initial.interviewAt),
        notes: initial.notes ?? "",
      });
    } else {
      setValues({ ...EMPTY, ...prefill });
    }
  }, [open, initial, prefill]);

  const set = <K extends keyof ApplicationFormValues>(
    key: K,
    value: ApplicationFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.company.trim() || !values.position.trim()) {
      toast.error("Company and position are required.");
      return;
    }
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit application" : "Track an application"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the status, dates, or notes."
              : "Add a position you're applying to."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="app-company">Company *</Label>
              <Input
                id="app-company"
                value={values.company}
                onChange={(e) => set("company", e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-position">Position *</Label>
              <Input
                id="app-position"
                value={values.position}
                onChange={(e) => set("position", e.target.value)}
                required
                maxLength={200}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-url">Posting URL</Label>
            <Input
              id="app-url"
              type="url"
              placeholder="https://…"
              value={values.url}
              onChange={(e) => set("url", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="app-status">Status</Label>
              <Select
                value={values.status}
                onValueChange={(v) => set("status", v as ApplicationStatusValue)}
              >
                <SelectTrigger id="app-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-applied">Applied date</Label>
              <Input
                id="app-applied"
                type="date"
                value={values.appliedAt}
                onChange={(e) => set("appliedAt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-interview">Interview date</Label>
              <Input
                id="app-interview"
                type="date"
                value={values.interviewAt}
                onChange={(e) => set("interviewAt", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-notes">Notes</Label>
            <Textarea
              id="app-notes"
              rows={3}
              maxLength={5000}
              placeholder="Referral contact, interview prep, follow-up dates…"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Add application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

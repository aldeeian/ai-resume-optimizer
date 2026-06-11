"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ApplicationDialog,
  type ApplicationFormValues,
} from "@/components/tracker/application-dialog";
import { EmptyState } from "@/components/empty-state";
import { KanbanSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApplicationStatusValue } from "@/lib/schemas";
import {
  STATUS_BADGE_VARIANT,
  STATUS_OPTIONS,
  type ApplicationDto,
} from "@/lib/tracker-types";
import { formatDate } from "@/lib/utils";
import {
  createApplication,
  deleteApplication,
  updateApplication,
  updateApplicationStatus,
} from "@/server/actions/applications";

const QUERY_KEY = ["applications"] as const;

async function fetchApplications(): Promise<ApplicationDto[]> {
  const res = await fetch("/api/applications");
  if (!res.ok) throw new Error("Failed to load applications.");
  const json = (await res.json()) as { applications: ApplicationDto[] };
  return json.applications;
}

export function TrackerClient({
  prefill,
}: {
  prefill?: Partial<ApplicationFormValues>;
}) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchApplications,
  });

  const [dialogOpen, setDialogOpen] = useState(Boolean(prefill));
  const [editing, setEditing] = useState<ApplicationDto | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // ── Optimistic status change ───────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: async (vars: { id: string; status: ApplicationStatusValue }) => {
      const result = await updateApplicationStatus(vars);
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ApplicationDto[]>(QUERY_KEY);
      queryClient.setQueryData<ApplicationDto[]>(QUERY_KEY, (old) =>
        (old ?? []).map((app) =>
          app.id === vars.id ? { ...app, status: vars.status } : app
        )
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      toast.error(err instanceof Error ? err.message : "Could not update status.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // ── Create / update ────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (vars: { id?: string; values: ApplicationFormValues }) => {
      const payload = {
        company: vars.values.company,
        position: vars.values.position,
        url: vars.values.url,
        status: vars.values.status,
        appliedAt: vars.values.appliedAt,
        interviewAt: vars.values.interviewAt,
        notes: vars.values.notes,
        jobDescriptionId: vars.values.jobDescriptionId,
        generatedResumeId: vars.values.generatedResumeId,
      };
      const result = vars.id
        ? await updateApplication({ id: vars.id, ...payload })
        : await createApplication(payload);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      toast.success(editing ? "Application updated." : "Application added.");
      setDialogOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save the application."),
  });

  // ── Optimistic delete ──────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteApplication(id);
      if (!result.ok) throw new Error(result.error);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ApplicationDto[]>(QUERY_KEY);
      queryClient.setQueryData<ApplicationDto[]>(QUERY_KEY, (old) =>
        (old ?? []).filter((app) => app.id !== id)
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const applications = useMemo(() => {
    const all = data ?? [];
    return statusFilter === "ALL" ? all : all.filter((a) => a.status === statusFilter);
  }, [data, statusFilter]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const app of data ?? []) {
      map.set(app.status, (map.get(app.status) ?? 0) + 1);
    }
    return map;
  }, [data]);

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Could not load your applications. Refresh the page to try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses ({data?.length ?? 0})</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label} ({counts.get(s.value) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden /> Add application
        </Button>
      </div>

      {/* Table */}
      {applications.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title={statusFilter === "ALL" ? "No applications yet" : "Nothing with this status"}
          description={
            statusFilter === "ALL"
              ? "Track every application from saved to offer — your analytics build from here."
              : "Try a different status filter."
          }
          action={
            statusFilter === "ALL" ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus aria-hidden /> Add application
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Company</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Interview</TableHead>
                  <TableHead>ATS</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="pl-4 font-medium">
                      <span className="flex items-center gap-1.5">
                        {app.company}
                        {app.url ? (
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={`Open posting for ${app.company}`}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{app.position}</TableCell>
                    <TableCell>
                      <Select
                        value={app.status}
                        onValueChange={(v) =>
                          statusMutation.mutate({
                            id: app.id,
                            status: v as ApplicationStatusValue,
                          })
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-36 border-0 bg-transparent shadow-none"
                          aria-label={`Status for ${app.company}`}
                        >
                          <Badge variant={STATUS_BADGE_VARIANT[app.status]}>
                            {STATUS_OPTIONS.find((s) => s.value === app.status)?.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(app.appliedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(app.interviewAt)}
                    </TableCell>
                    <TableCell>
                      {app.generatedResume ? (
                        <Badge variant="outline">{app.generatedResume.atsScore}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${app.company} application`}
                        onClick={() => {
                          setEditing(app);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${app.company} application`}
                        onClick={() => {
                          if (window.confirm(`Delete the ${app.company} application?`)) {
                            deleteMutation.mutate(app.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ApplicationDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        initial={editing}
        editing={Boolean(editing)}
        prefill={prefill}
        pending={saveMutation.isPending}
        onSubmit={(values) => saveMutation.mutate({ id: editing?.id, values })}
      />
    </div>
  );
}

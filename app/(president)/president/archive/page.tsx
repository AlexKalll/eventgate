"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statusColors, statusLabels } from "@/lib/proposal-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDualTimeRange, formatSessionSummary } from "@/lib/utils";
import { RotateCcw, Trash, Trash2 } from "lucide-react";

interface Proposal {
  id: string;
  status: string;
  createdAt: string;
  event: {
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    occurrences?: Array<{
      startTime: string;
      endTime: string;
      location: string;
    }>;
  };
  club: {
    name: string;
  };
  archivedAt?: string | null;
}

export default function PresidentArchivePage() {
  const { isPending } = useSession();
  const router = useRouter();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);

  const fetchArchived = async (nextPage: number) => {
    const res = await fetch(
      `/api/proposals?archived=1&page=${nextPage}&limit=10`,
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(body?.message || "Failed to fetch archive");
    }
    setProposals(body.proposals || []);
    setPagination(body.pagination || null);
  };

  useEffect(() => {
    if (isPending) return;

    const run = async () => {
      try {
        setLoading(true);
        await fetchArchived(page);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch archive");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [isPending, page]);

  const handleRestore = async (proposalId: string) => {
    setBusyId(proposalId);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/archive`, {
        method: "PATCH",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || "Failed to restore proposal");
      }
      await fetchArchived(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore proposal");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (proposalId: string) => {
    setBusyId(proposalId);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/archive`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || "Failed to delete proposal");
      }
      await fetchArchived(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete proposal");
    } finally {
      setBusyId(null);
    }
  };

  const handleEmptyArchive = async () => {
    setEmptying(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/archive/empty`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || "Failed to empty archive");
      }
      await fetchArchived(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to empty archive");
    } finally {
      setEmptying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading archive...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-destructive">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="text-sm text-muted-foreground">
            Archived proposals are deleted automatically after 2 days.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => router.push("/president")}
            >
              Back
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="rounded-none h-9 w-9 p-0"
                  disabled={emptying}
                  aria-label="Empty Archive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Empty archive?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all archived proposals.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEmptyArchive}>
                    Delete all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {proposals.length === 0 ? (
          <Card className="shadow-none rounded-none">
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium mb-4">Archive is Empty</h3>
              <p className="text-muted-foreground mb-6">
                You have no archived proposals.
              </p>
              <Button
                onClick={() => router.push("/president")}
                className="rounded-none"
              >
                Back to My Proposals
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {proposals.map((proposal) => {
                const { western, ethiopian } = formatDualTimeRange(
                  proposal.event?.startTime,
                  proposal.event?.endTime,
                );
                const sessionCount = Array.isArray(proposal.event?.occurrences)
                  ? proposal.event.occurrences.length
                  : 0;

                return (
                  <Card key={proposal.id} className="shadow-none rounded-none">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {proposal.event?.title || "Untitled Proposal"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {(() => {
                                  const timeText = ethiopian
                                    ? `Time: ${western} | LT: [${ethiopian}]`
                                    : `Time: ${western}`;
                                  return sessionCount > 1
                                    ? `${timeText} • Sessions: ${sessionCount}`
                                    : timeText;
                                })()}
                              </div>
                            </div>
                            <Badge
                              className={`${
                                statusColors[
                                  proposal.status as keyof typeof statusColors
                                ]
                              } whitespace-nowrap`}
                            >
                              {
                                statusLabels[
                                  proposal.status as keyof typeof statusLabels
                                ]
                              }
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="rounded-none h-8 w-8 p-0"
                                disabled={busyId === proposal.id}
                                aria-label="Restore"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Restore proposal?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will move the proposal back to My
                                  Proposals.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRestore(proposal.id)}
                                >
                                  Restore
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                className="rounded-none h-8 w-8 p-0"
                                disabled={busyId === proposal.id}
                                aria-label="Delete permanently"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete permanently?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the proposal.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(proposal.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-6">
              <div className="text-sm text-muted-foreground">
                {pagination
                  ? `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`
                  : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-none"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination || pagination.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="rounded-none"
                  onClick={() =>
                    setPage((p) =>
                      pagination
                        ? Math.min(pagination.totalPages, p + 1)
                        : p + 1,
                    )
                  }
                  disabled={
                    !pagination || pagination.page >= pagination.totalPages
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}


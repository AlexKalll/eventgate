"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SkeletonProposalCard } from "@/components/skeleton-proposal-card";
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
import { formatDualTimeRange } from "@/lib/utils";
import { statusColors, statusLabels } from "@/lib/proposal-status";
import { Trash } from "lucide-react";
import { Edit } from "lucide-react";

interface Proposal {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  resubmissionReady?: boolean;
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
  collaborators: Array<{
    name: string;
    type?: string;
  }>;
  guests: Array<{
    name: string;
    affiliation?: string | null;
    reason?: string | null;
  }>;
  leadApprovals: Array<{
    leadRole: string;
    leadEmail: string;
    approved: boolean;
    comments?: string;
  }>;
}

type ProposalPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProposalsCacheEntry = {
  proposals: Proposal[];
  pagination: ProposalPagination | null;
  cachedAt: number;
};

type ClubNameCacheEntry = {
  clubName: string;
  cachedAt: number;
};

const PROPOSALS_CACHE_TTL_MS = 15 * 1000;
const PROPOSALS_CACHE_KEY_PREFIX = "eventgate:president:proposals:page:";
const CLUB_CACHE_KEY = "eventgate:president:club-name";
const DEFAULT_PAGE = 1;

function getProposalsCache(page: number): ProposalsCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      `${PROPOSALS_CACHE_KEY_PREFIX}${page}`,
    );
    if (!raw) return null;
    return JSON.parse(raw) as ProposalsCacheEntry;
  } catch {
    return null;
  }
}

function setProposalsCache(page: number, value: ProposalsCacheEntry) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${PROPOSALS_CACHE_KEY_PREFIX}${page}`,
      JSON.stringify(value),
    );
  } catch {}
}

function getClubNameCache(): ClubNameCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CLUB_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClubNameCacheEntry;
  } catch {
    return null;
  }
}

function setClubNameCache(value: ClubNameCacheEntry) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLUB_CACHE_KEY, JSON.stringify(value));
  } catch {}
}

export default function ProposalsPage() {
  const { isPending } = useSession();
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [pagination, setPagination] = useState<ProposalPagination | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [contributorsOpen, setContributorsOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [contributorsPage, setContributorsPage] = useState(1);
  const [guestsPage, setGuestsPage] = useState(1);
  const [clubName, setClubName] = useState("");

  const fetchProposals = async (nextPage: number) => {
    const response = await fetch(`/api/proposals?page=${nextPage}&limit=10`, {
      cache: "no-store",
    });
    if (!response.ok) {
      let message = "Failed to fetch proposals";
      try {
        const body = await response.json();
        if (body?.message) message = String(body.message);
      } catch {}
      throw new Error(message);
    }
    const resp = await response.json();
    const nextProposals = (resp.proposals || []) as Proposal[];
    const nextPagination = (resp.pagination || null) as ProposalPagination | null;
    setProposals(nextProposals);
    setPagination(nextPagination);
    setProposalsCache(nextPage, {
      proposals: nextProposals,
      pagination: nextPagination,
      cachedAt: Date.now(),
    });
  };

  useEffect(() => {
    if (isPending) return;
    const cachedClub = getClubNameCache();
    const hasFreshCachedClub =
      Boolean(cachedClub?.clubName) &&
      Date.now() - (cachedClub?.cachedAt || 0) < PROPOSALS_CACHE_TTL_MS;

    if (hasFreshCachedClub && cachedClub?.clubName) {
      setClubName(cachedClub.clubName);
      return;
    }

    const fetchClubInfo = async () => {
      try {
        const clubResponse = await fetch("/api/club", {
          cache: "no-store",
        });
        if (!clubResponse.ok) {
          throw new Error("Failed to fetch club info");
        }
        const clubData = await clubResponse.json();
        const clubLabel = clubData?.club?.name;
        if (clubLabel) {
          const nextClubName = String(clubLabel.toUpperCase());
          setClubName(nextClubName);
          setClubNameCache({ clubName: nextClubName, cachedAt: Date.now() });
        }
      } catch {
        setError("Failed to fetch club info");
      }
    };

    fetchClubInfo();
  }, [isPending]);

  useEffect(() => {
    if (isPending) return;
    const cachedPage = getProposalsCache(page);
    const hasCachedPage = Boolean(cachedPage);
    const cacheIsFresh =
      hasCachedPage &&
      Date.now() - (cachedPage?.cachedAt || 0) < PROPOSALS_CACHE_TTL_MS;

    if (cachedPage) {
      setProposals(cachedPage.proposals);
      setPagination(cachedPage.pagination);
      setLoading(false);
    }

    if (cacheIsFresh) {
      return;
    }

    const run = async () => {
      try {
        setError(null);
        if (!hasCachedPage) setLoading(true);
        await fetchProposals(page);
      } catch (err) {
        if (!hasCachedPage) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch proposals",
          );
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [isPending, page]);

  const formatDaysLeft = (startTime?: string) => {
    if (!startTime) return "";
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) return "";
    const now = new Date();
    const diffMs = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 1) return `${diffDays} days left`;
    if (diffDays === 1) return "1 day left";
    if (diffDays === 0) return "Today";
    if (diffDays === -1) return "1 day ago";
    return `${Math.abs(diffDays)} days ago`;
  };

  const openDetails = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setDetailsOpen(true);
    setSessionsExpanded(false);
    setContributorsOpen(false);
    setGuestsOpen(false);
    setContributorsPage(1);
    setGuestsPage(1);
  };

  const canEditProposal = (status: string) => {
    return (
      status === "LEAD_REJECTED" ||
      status === "SU_REJECTED" ||
      status === "DIRECTOR_REJECTED" ||
      status === "RESUBMISSION_REQUIRED"
    );
  };

  const handleArchive = async (proposalId: string) => {
    setArchivingId(proposalId);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/archive`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.message || "Failed to archive proposal");
      }
      setDetailsOpen(false);
      setSelectedProposal(null);
      await fetchProposals(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive proposal");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-svh bg-white">
        <main className="container mx-auto px-4 py-10 max-w-5xl">
          <Card className=" border-0 rounded-xl mb-6">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="h-1 w-8 rounded-full"
                  style={{ backgroundColor: "var(--aau-red)" }}
                ></div>
                <div
                  className="h-1 w-12 rounded-full"
                  style={{ backgroundColor: "var(--aau-blue)" }}
                ></div>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                My Proposals
              </CardTitle>
              <CardDescription className="text-gray-600">
                View and manage your event proposals
              </CardDescription>
            </CardHeader>
          </Card>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonProposalCard key={index} />
          ))}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-svh bg-white flex items-center justify-center">
        <Card className="w-full max-w-md shadow-lg rounded-xl">
          <CardContent className="p-6">
            <p className="text-center text-red-600 mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full rounded-none"
              style={{ backgroundColor: "var(--aau-blue)" }}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-white">
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <Card className="border border-gray-200 rounded-none mb-6">
          <CardHeader className="pb-6">
            {/* Club name in caps */}
            {clubName && (
              <p className="text-sm font-semibold text-gray-500 tracking-widest uppercase mb-2">
                {clubName}
              </p>
            )}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="h-1 w-8 rounded-full"
                style={{ backgroundColor: "var(--aau-red)" }}
              ></div>
              <div
                className="h-1 w-12 rounded-full"
                style={{ backgroundColor: "var(--aau-blue)" }}
              ></div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  My Proposals
                </CardTitle>
                <CardDescription className="text-gray-600">
                  View and manage your event proposals
                </CardDescription>
              </div>
              <Button
                onClick={() => router.push("/president/new")}
                className="rounded-none text-white"
                style={{ backgroundColor: "var(--aau-blue)" }}
              >
                + New Proposal
              </Button>
            </div>
          </CardHeader>
        </Card>

        {proposals.length === 0 ? (
          <Card className="border border-gray-200 rounded-none">
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium mb-4 text-gray-900">
                No Proposals Yet
              </h3>
              <p className="text-gray-600 mb-6">
                You haven&apos;t submitted any event proposals yet.
              </p>
              <Button
                onClick={() => router.push("/president/new")}
                className="rounded-none"
                style={{ backgroundColor: "var(--aau-blue)" }}
              >
                Create Your First Proposal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {proposals.map((proposal) => {
                const { western, ethiopian } = formatDualTimeRange(
                  proposal.event?.startTime,
                  proposal.event?.endTime,
                );
                const daysLeft = formatDaysLeft(proposal.event?.startTime);

                return (
                  <Card
                    key={proposal.id}
                    className="border border-gray-200 rounded-none  transition-shadow"
                  >
                    <CardContent className="p-0">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openDetails(proposal)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetails(proposal);
                          }
                        }}
                        className="relative flex items-center gap-3 px-4 py-3 pr-14 cursor-pointer"
                      >
                        <div
                          className="absolute right-2 top-2 z-10"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <AlertDialog>
                            <AlertDialogTrigger
                              asChild
                              className="rounded-none"
                            >
                              <Button
                                variant="destructive"
                                disabled={
                                  archivingId === proposal.id
                                }
                                className="rounded-none h-8 w-8 p-0 bg-white hover:bg-white"
                                aria-label="Archive"
                              >
                                <Trash className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-none sm:rounded-none">
                              <AlertDialogHeader className="rounded-none">
                                <AlertDialogTitle className="rounded-none">
                                  Archive this proposal?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="rounded-none">
                                  It will be moved to the Archive page and will
                                  be deleted automatically after 2 days.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleArchive(proposal.id)}
                                >
                                  Archive
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {proposal.event?.title || "Untitled Proposal"}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {daysLeft ? `${daysLeft} • ` : ""}
                                {ethiopian
                                  ? `Time: ${western} | LT: [${ethiopian}]`
                                  : `Time: ${western}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ">
                              <Badge
                                className={`rounded-full ${
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
                        </div>

                        <div
                          className="flex items-center gap-2 "
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {canEditProposal(proposal.status) && (
                            <Button
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/proposals/${proposal.id}/edit`);
                              }}
                              className="rounded-none h-8"
                            >
                              Edit
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-6">
              <div className="text-sm text-gray-600">
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

            <Dialog
              open={detailsOpen}
              onOpenChange={(open) => {
                setDetailsOpen(open);
                if (!open) {
                  setSelectedProposal(null);
                  setContributorsOpen(false);
                  setGuestsOpen(false);
                  setContributorsPage(1);
                  setGuestsPage(1);
                }
              }}
            >
              <DialogContent
                className="w-full max-h-[85vh] overflow-y-auto"
                style={{ width: "70vw", maxWidth: "1200px" }}
              >
                <DialogTitle className="sr-only">Proposal Details</DialogTitle>
                {selectedProposal ? (
                  <Card className="shadow-none rounded-none border-0">
                    <CardHeader className="px-0 pt-0">
                      <div className="flex items-start justify-between gap-4 bg-gray-100 p-2 border">
                        <div>
                          <CardTitle className="text-xl font-semibold ">
                            {selectedProposal.event?.title ||
                              "Untitled Proposal"}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground ">
                            {selectedProposal.club.name} •{" "}
                            {new Date(
                              selectedProposal.createdAt,
                            ).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="shrink-0">
                          <Badge className="rounded-none text-foreground/70  p-2 border">
                            {
                              statusLabels[
                                selectedProposal.status as keyof typeof statusLabels
                              ]
                            }
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6 px-0 pb-0 ">
                      <section className="space-y-3">
                        <h4 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                          Core Facts
                        </h4>
                        <div className="space-y-2  bg-gray-100 p-2 border">
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Date range
                            </div>
                            <div className="text-sm">
                              {(() => {
                                const { western } = formatDualTimeRange(
                                  selectedProposal.event?.startTime,
                                  selectedProposal.event?.endTime,
                                );
                                return western;
                              })()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Location
                            </div>
                            <div className="text-sm  ">
                              {selectedProposal.event?.location ||
                                "Not specified"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Sessions
                            </div>
                            <div className="text-sm ">
                              {Array.isArray(
                                selectedProposal.event?.occurrences,
                              ) && selectedProposal.event.occurrences.length > 1
                                ? selectedProposal.event.occurrences.length
                                : 1}
                            </div>
                          </div>
                        </div>
                      </section>

                      {Array.isArray(selectedProposal.event?.occurrences) &&
                      selectedProposal.event.occurrences.length > 1 ? (
                        <section className="space-y-3 ">
                          <div className="flex items-center justify-between ">
                            <h4 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                              Sessions
                            </h4>
                            <Button
                              variant="outline"
                              className="h-8 rounded-none"
                              onClick={() => setSessionsExpanded((v) => !v)}
                            >
                              {sessionsExpanded ? "Hide" : "Show"} sessions
                            </Button>
                          </div>
                          {sessionsExpanded ? (
                            <div className="overflow-x-auto border border-border">
                              <table className="min-w-full text-sm">
                                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-semibold">
                                      Date
                                    </th>
                                    <th className="text-left px-3 py-2 font-semibold">
                                      Start
                                    </th>
                                    <th className="text-left px-3 py-2 font-semibold">
                                      End
                                    </th>
                                    <th className="text-left px-3 py-2 font-semibold">
                                      Location
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedProposal.event.occurrences
                                    .slice()
                                    .sort(
                                      (a, b) =>
                                        new Date(a.startTime).getTime() -
                                        new Date(b.startTime).getTime(),
                                    )
                                    .map((occ, idx) => {
                                      const start = new Date(occ.startTime);
                                      const end = new Date(occ.endTime);
                                      const date = start.toLocaleDateString();
                                      const startTime =
                                        start.toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        });
                                      const endTime = end.toLocaleTimeString(
                                        [],
                                        { hour: "2-digit", minute: "2-digit" },
                                      );
                                      return (
                                        <tr
                                          key={idx}
                                          className="border-t border-border"
                                        >
                                          <td className="px-3 py-2 align-top">
                                            {date}
                                          </td>
                                          <td className="px-3 py-2 align-top">
                                            {startTime}
                                          </td>
                                          <td className="px-3 py-2 align-top">
                                            {endTime}
                                          </td>
                                          <td className="px-3 py-2 align-top">
                                            {occ.location || "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </section>
                      ) : null}

                      <section className="space-y-3 bg-gray-100 p-2 border">
                        <h4 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                          Approval Status
                        </h4>
                        <div className="divide-y divide-border border border-border">
                          {selectedProposal.leadApprovals.map(
                            (approval, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {approval.leadRole}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {approval.leadEmail}
                                  </div>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {approval.approved ? "Approved" : "Pending"}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                            Contributors
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {selectedProposal.collaborators?.length || 0}
                            </span>
                            {(selectedProposal.collaborators?.length || 0) >
                            2 ? (
                              <Button
                                variant="outline"
                                className="rounded-none h-8"
                                onClick={() => setContributorsOpen(true)}
                              >
                                View all
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {selectedProposal.collaborators?.length ? (
                          <div className="space-y-2">
                            {selectedProposal.collaborators
                              .slice(0, 2)
                              .map((c, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-3 bg-muted/30 rounded-none"
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">
                                      {c.name}
                                    </div>
                                    {c.type ? (
                                      <div className="text-xs text-muted-foreground truncate">
                                        {c.type}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No contributors.
                          </div>
                        )}
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                            Invited Guests
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {selectedProposal.guests?.length || 0}
                            </span>
                            {(selectedProposal.guests?.length || 0) > 2 ? (
                              <Button
                                variant="outline"
                                className="rounded-none h-8"
                                onClick={() => setGuestsOpen(true)}
                              >
                                View all
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {selectedProposal.guests?.length ? (
                          <div className="space-y-2">
                            {selectedProposal.guests
                              .slice(0, 2)
                              .map((g, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 bg-muted/30 rounded-none"
                                >
                                  <div className="font-medium truncate">
                                    {g.name}
                                  </div>
                                  {g.affiliation ? (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {g.affiliation}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No guests.
                          </div>
                        )}
                      </section>

                      <div className="pt-4">
                        {canEditProposal(selectedProposal.status) && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              router.push(
                                `/proposals/${selectedProposal.id}/edit`,
                              )
                            }
                            className="rounded-none"
                          >
                            Edit Proposal
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </DialogContent>
            </Dialog>

            <Dialog
              open={contributorsOpen}
              onOpenChange={(open) => {
                setContributorsOpen(open);
                if (!open) setContributorsPage(1);
              }}
            >
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogTitle>Contributors</DialogTitle>
                {selectedProposal
                  ? (() => {
                      const items = selectedProposal.collaborators || [];
                      const limit = 10;
                      const totalPages = Math.max(
                        1,
                        Math.ceil(items.length / limit),
                      );
                      const pageSafe = Math.min(contributorsPage, totalPages);
                      const slice = items.slice(
                        (pageSafe - 1) * limit,
                        pageSafe * limit,
                      );
                      return (
                        <div className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            {items.length} total
                          </div>
                          <div className="space-y-2">
                            {slice.map((c, idx) => (
                              <div
                                key={`${pageSafe}-${idx}`}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-none"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium truncate">
                                    {c.name}
                                  </div>
                                  {c.type ? (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {c.type}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-3 pt-2">
                            <div className="text-sm text-muted-foreground">
                              Page {pageSafe} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="rounded-none"
                                onClick={() =>
                                  setContributorsPage((p) => Math.max(1, p - 1))
                                }
                                disabled={pageSafe <= 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                className="rounded-none"
                                onClick={() =>
                                  setContributorsPage((p) =>
                                    Math.min(totalPages, p + 1),
                                  )
                                }
                                disabled={pageSafe >= totalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  : null}
              </DialogContent>
            </Dialog>

            <Dialog
              open={guestsOpen}
              onOpenChange={(open) => {
                setGuestsOpen(open);
                if (!open) setGuestsPage(1);
              }}
            >
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogTitle>Invited Guests</DialogTitle>
                {selectedProposal
                  ? (() => {
                      const items = selectedProposal.guests || [];
                      const limit = 10;
                      const totalPages = Math.max(
                        1,
                        Math.ceil(items.length / limit),
                      );
                      const pageSafe = Math.min(guestsPage, totalPages);
                      const slice = items.slice(
                        (pageSafe - 1) * limit,
                        pageSafe * limit,
                      );
                      return (
                        <div className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            {items.length} total
                          </div>
                          <div className="space-y-2">
                            {slice.map((g, idx) => (
                              <div
                                key={`${pageSafe}-${idx}`}
                                className="p-3 bg-muted/30 rounded-none"
                              >
                                <div className="font-medium truncate">
                                  {g.name}
                                </div>
                                {g.affiliation ? (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {g.affiliation}
                                  </div>
                                ) : null}
                                {g.reason ? (
                                  <div className="text-xs text-muted-foreground">
                                    {g.reason}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-3 pt-2">
                            <div className="text-sm text-muted-foreground">
                              Page {pageSafe} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="rounded-none"
                                onClick={() =>
                                  setGuestsPage((p) => Math.max(1, p - 1))
                                }
                                disabled={pageSafe <= 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                className="rounded-none"
                                onClick={() =>
                                  setGuestsPage((p) =>
                                    Math.min(totalPages, p + 1),
                                  )
                                }
                                disabled={pageSafe >= totalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  : null}
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </div>
  );
}

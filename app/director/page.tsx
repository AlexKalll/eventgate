"use client";

import { useEffect, useState } from "react";
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
import { formatSessionSummary } from "@/lib/utils";
import { formatDualTimeRange } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { statusColors, statusLabels } from "@/lib/proposal-status";

interface Proposal {
  id: string;
  status: string;
  createdAt: string;
  event: {
    title?: string;
    description?: string;
    location?: string;
    startTime?: string;
    endTime?: string;
    occurrences?: Array<{
      startTime?: string;
      endTime?: string;
      location?: string | null;
    }>;
  };
  collaborators: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  guests: Array<{
    id: string;
    name: string;
    affiliation: string | null;
    reason: string | null;
  }>;
  club: {
    name: string;
  };
  leadApprovals: Array<{
    leadRole: string;
    leadEmail: string;
    approved: boolean;
    comments?: string;
  }>;
  reviews?: Array<{
    reviewerEmail: string;
    recommendation: string | null;
    comments: string | null;
    updatedAt: string;
  }>;
}

export default function DirectorPage() {
  const { data, isPending } = useSession();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [acting, setActing] = useState<{
    proposalId: string;
    action: "approve" | "reject";
  } | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);

  const openDetails = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setDetailsOpen(true);
    setShowRejectReason(false);
    setValidationError(null);
  };

  const fetchProposals = async () => {
    try {
      const response = await fetch("/api/proposals/director");
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to fetch proposals");
      }
      const body = await response.json();
      setProposals(body.proposals || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch proposals",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (proposalId: string, approve: boolean) => {
    setActing({ proposalId, action: approve ? "approve" : "reject" });
    setError(null);
    try {
      const response = await fetch(
        `/api/proposals/${proposalId}/director-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directorApproval: approve ? "Approved" : "Rejected",
            directorComments: comments[proposalId] || "",
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to submit decision");
      }

      setComments((prev) => ({ ...prev, [proposalId]: "" }));
      setDetailsOpen(false);
      setSelectedProposal(null);
      setShowRejectReason(false);
      await fetchProposals();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit decision",
      );
    } finally {
      setActing(null);
    }
  };

  const handleReject = (proposalId: string) => {
    // First step: show the rejection reason textarea
    if (!showRejectReason) {
      setShowRejectReason(true);
      return;
    }
    // Second step: validate and submit
    const reason = (comments[proposalId] || "").trim();
    if (!reason) {
      setValidationError("Please add a rejection reason before submitting.");
      return;
    }
    setValidationError(null);
    handleDecision(proposalId, false);
  };

  useEffect(() => {
    if (isPending) return;
    fetchProposals();
  }, [isPending]);

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading proposals...</p>
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
    <main className="container mx-auto px-4 py-10 max-w-5xl">
      {proposals.length === 0 ? (
        <Card className="shadow-none rounded-none">
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-medium mb-4">No Proposals to Review</h3>
            <p className="text-muted-foreground">
              There are no proposals pending Director review at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {proposals.map((proposal) => {
            const suReview = proposal.reviews?.[0];
            return (
              <Card
                key={proposal.id}
                className="shadow-none rounded-none cursor-pointer group"
                role="button"
                tabIndex={0}
                onClick={() => openDetails(proposal)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetails(proposal);
                  }
                }}
              >
                <CardContent className="relative p-4 flex items-start gap-3">
                  <div className="pointer-events-none absolute inset-0 bg-muted/70 text-[11px] font-medium text-foreground/80 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    Click to see details
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">
                          {proposal.event?.title || "Untitled Proposal"}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {proposal.club.name} •{" "}
                          {new Date(proposal.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge
                        className={`${
                          statusColors[
                            proposal.status as keyof typeof statusColors
                          ] || "bg-muted text-foreground"
                        } whitespace-nowrap`}
                      >
                        {statusLabels[
                          proposal.status as keyof typeof statusLabels
                        ] || proposal.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {formatSessionSummary({
                        occurrences: proposal.event?.occurrences,
                        startTime: proposal.event?.startTime,
                        endTime: proposal.event?.endTime,
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Location: {proposal.event?.location || "Not specified"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Student Union decision:{" "}
                      {suReview?.recommendation || "Recommended"}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Click to review
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedProposal(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogTitle className="sr-only">Proposal Details</DialogTitle>
          {selectedProposal ? (
            <Card className="shadow-none rounded-none border-0">
              <CardHeader className="px-0 pt-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-semibold">
                      {selectedProposal.event?.title || "Untitled Proposal"}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {selectedProposal.club.name} •{" "}
                      {new Date(
                        selectedProposal.createdAt,
                      ).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge
                    className={`${
                      statusColors[
                        selectedProposal.status as keyof typeof statusColors
                      ] || "bg-muted text-foreground"
                    } whitespace-nowrap`}
                  >
                    {statusLabels[
                      selectedProposal.status as keyof typeof statusLabels
                    ] || selectedProposal.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 px-0 pb-0">
                <section className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Event Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Location:</span>{" "}
                      {selectedProposal.event?.location || "Not specified"}
                    </div>
                    {Array.isArray(selectedProposal.event?.occurrences) &&
                    selectedProposal.event.occurrences.length > 1 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Sessions: {selectedProposal.event.occurrences.length}
                        </p>
                        <div className="space-y-2">
                          {selectedProposal.event.occurrences
                            .slice()
                            .sort(
                              (a, b) =>
                                new Date(a.startTime || 0).getTime() -
                                new Date(b.startTime || 0).getTime(),
                            )
                            .map((occ, idx) => {
                              const { western, ethiopian } =
                                formatDualTimeRange(occ.startTime, occ.endTime);
                              return (
                                <div
                                  key={idx}
                                  className="p-3 bg-muted/30 rounded"
                                >
                                  <div className="text-sm">{western}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {ethiopian ? `LT: [${ethiopian}]` : null}
                                    {occ.location
                                      ? `${ethiopian ? " • " : ""}${occ.location}`
                                      : null}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ) : null}
                    <div>
                      <span className="font-medium">Description:</span>
                      <div className="mt-1 max-h-40 overflow-y-auto text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                        {selectedProposal.event?.description ||
                          "No description provided"}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Time:</span>{" "}
                      {(() => {
                        const { western, ethiopian } = formatDualTimeRange(
                          selectedProposal.event?.startTime,
                          selectedProposal.event?.endTime,
                        );
                        return ethiopian ? (
                          <span>
                            {western}
                            <span className="block text-xs text-muted-foreground">
                              LT: [{ethiopian}]
                            </span>
                          </span>
                        ) : (
                          western
                        );
                      })()}
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Student Union Decision
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Recommendation:</span>{" "}
                      {selectedProposal.reviews?.[0]?.recommendation ||
                        "Recommended"}
                    </p>
                    {selectedProposal.reviews?.[0]?.comments ? (
                      <p>
                        <span className="font-medium">Comments:</span>{" "}
                        {selectedProposal.reviews[0].comments}
                      </p>
                    ) : null}
                  </div>
                </section>

                {selectedProposal.collaborators?.length > 0 && (
                  <section className="space-y-2 border-t border-border pt-4">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Collaborating Organizations
                    </h4>
                    <div className="space-y-2">
                      {selectedProposal.collaborators.map((collaborator) => (
                        <div
                          key={collaborator.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="font-medium">
                            {collaborator.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {collaborator.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedProposal.guests?.length > 0 && (
                  <section className="space-y-2 border-t border-border pt-4">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Invited Guests
                    </h4>
                    <div className="space-y-2">
                      {selectedProposal.guests.map((guest) => (
                        <div
                          key={guest.id}
                          className="border border-border p-3 rounded"
                        >
                          <p className="text-sm">
                            <strong>Name:</strong> {guest.name}
                          </p>
                          <p className="text-sm">
                            <strong>Affiliation:</strong>{" "}
                            {guest.affiliation || "Not specified"}
                          </p>
                          <p className="text-sm">
                            <strong>Reason:</strong>{" "}
                            {guest.reason || "Not specified"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedProposal.status === "SU_APPROVED" && (
                  <section className="space-y-4 border-t border-border pt-4">
                    {showRejectReason ? (
                      <div>
                        <Label htmlFor={`comments-${selectedProposal.id}`}>
                          Why are you rejecting this proposal?
                        </Label>
                        <Textarea
                          id={`comments-${selectedProposal.id}`}
                          placeholder="Add a clear reason so the club president understands the rejection."
                          value={comments[selectedProposal.id] || ""}
                          onChange={(e) =>
                            setComments((prev) => ({
                              ...prev,
                              [selectedProposal.id]: e.target.value,
                            }))
                          }
                          className="mt-2"
                          required
                        />
                        {validationError && (
                          <p className="text-sm text-destructive mt-1">
                            {validationError}
                          </p>
                        )}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => {
                          // If rejection reason is being written, warn user that approving will discard it
                          if (
                            showRejectReason &&
                            comments[selectedProposal.id]?.trim()
                          ) {
                            if (
                              !confirm(
                                "Are you sure you want to approve? This will discard your rejection reason.",
                              )
                            ) {
                              return;
                            }
                            setShowRejectReason(false);
                            setComments((prev) => ({
                              ...prev,
                              [selectedProposal.id]: "",
                            }));
                          }
                          handleDecision(selectedProposal.id, true);
                        }}
                        disabled={acting?.proposalId === selectedProposal.id}
                        className="rounded-none"
                      >
                        {acting?.proposalId === selectedProposal.id &&
                        acting.action === "approve"
                          ? "Approving..."
                          : "Approve"}
                      </Button>
                      <Button
                        onClick={() => handleReject(selectedProposal.id)}
                        disabled={acting?.proposalId === selectedProposal.id}
                        variant="destructive"
                        className="rounded-none"
                      >
                        {acting?.proposalId === selectedProposal.id &&
                        acting.action === "reject"
                          ? "Rejecting..."
                          : showRejectReason
                            ? "Submit Rejection"
                            : "Reject"}
                      </Button>
                    </div>
                  </section>
                )}
              </CardContent>
            </Card>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}


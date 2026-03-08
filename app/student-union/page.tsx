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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDualTimeRange } from "@/lib/utils";
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
}

export default function StudentUnionPage() {
  const { data, isPending } = useSession();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<{
    proposalId: string;
    action: "approve" | "reject";
  } | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);

  useEffect(() => {
    if (isPending) return;

    const fetchProposals = async () => {
      try {
        const response = await fetch("/api/student-union-proposals");
        if (!response.ok) {
          throw new Error("Failed to fetch proposals");
        }
        const data = await response.json();
        setProposals(data.proposals || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch proposals",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, [isPending]);

  const handleApproval = async (proposalId: string, approved: boolean) => {
    setApproving({ proposalId, action: approved ? "approve" : "reject" });
    try {
      const response = await fetch(
        `/api/proposals/${proposalId}/student-union-review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            suRecommendation: approved ? "Recommended" : "Not Recommended",
            suComments: comments[proposalId] || "",
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "Failed to submit approval");
      }

      // Refresh proposals list
      const fetchResponse = await fetch("/api/student-union-proposals");
      const data = await fetchResponse.json();
      setProposals(data.proposals || []);

      // Clear comments for this proposal
      setComments((prev) => ({ ...prev, [proposalId]: "" }));
      if (selectedProposal?.id === proposalId) {
        setSelectedProposal(null);
        setDetailsOpen(false);
      }
      setShowRejectReason(false);
      setValidationError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit approval",
      );
    } finally {
      setApproving(null);
    }
  };

  const handleReject = (proposalId: string) => {
    if (!showRejectReason) {
      setShowRejectReason(true);
      setValidationError(null);
      return;
    }
    const reason = (comments[proposalId] || "").trim();
    if (!reason) {
      setValidationError("Please add a rejection reason before submitting.");
      return;
    }
    setValidationError(null);
    handleApproval(proposalId, false);
  };

  const proceedApprove = (proposalId: string) => {
    setShowRejectReason(false);
    setValidationError(null);
    setComments((prev) => ({
      ...prev,
      [proposalId]: "",
    }));
    handleApproval(proposalId, true);
  };

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
              There are no proposals pending Student Union review at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {proposals.map((proposal) => (
            <Card
              key={proposal.id}
              className="shadow-none rounded-none cursor-pointer group"
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedProposal(proposal);
                setDetailsOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedProposal(proposal);
                  setDetailsOpen(true);
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
                  <div className="text-xs text-muted-foreground truncate">
                    {(() => {
                      const { western, ethiopian } = formatDualTimeRange(
                        proposal.event?.startTime,
                        proposal.event?.endTime,
                      );
                      return ethiopian
                        ? `${western} • LT: [${ethiopian}]`
                        : western;
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    Location: {proposal.event?.location || "Not specified"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Lead approvals: {proposal.leadApprovals.length} • Guests:{" "}
                    {proposal.guests.length}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Click to review
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedProposal(null);
            setShowRejectReason(false);
            setValidationError(null);
          }
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
                      ]
                    } whitespace-nowrap`}
                  >
                    {
                      statusLabels[
                        selectedProposal.status as keyof typeof statusLabels
                      ]
                    }
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
                    Lead Review Status
                  </h4>
                  <div className="space-y-3">
                    {selectedProposal.leadApprovals.map((approval, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-none"
                      >
                        <div>
                          <p className="font-medium">{approval.leadRole}</p>
                          <p className="text-sm text-muted-foreground">
                            {approval.leadEmail}
                          </p>
                        </div>
                        <Badge
                          className={
                            approval.approved
                              ? "bg-green-100 text-green-800 border-green-300"
                              : "bg-yellow-100 text-yellow-800 border-yellow-300"
                          }
                        >
                          {approval.approved ? "Approved" : "Pending"}
                        </Badge>
                      </div>
                    ))}
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

                <section className="space-y-4 border-t border-border pt-4">
                  {showRejectReason ? (
                    <div>
                      <Label htmlFor={`comments-${selectedProposal.id}`}>
                        Why are you rejecting this proposal?
                      </Label>
                      <Textarea
                        id={`comments-${selectedProposal.id}`}
                        placeholder="Add a clear rejection reason for the president."
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
                      {validationError ? (
                        <p className="text-sm text-destructive mt-1">
                          {validationError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => {
                        if (
                          showRejectReason &&
                          comments[selectedProposal.id]?.trim()
                        ) {
                          setApproveConfirmOpen(true);
                          return;
                        }
                        proceedApprove(selectedProposal.id);
                      }}
                      disabled={approving?.proposalId === selectedProposal.id}
                      className="rounded-none"
                    >
                      {approving?.proposalId === selectedProposal.id &&
                      approving.action === "approve"
                        ? "Approving..."
                        : "Approve"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReject(selectedProposal.id)}
                      disabled={approving?.proposalId === selectedProposal.id}
                      className="rounded-none"
                    >
                      {approving?.proposalId === selectedProposal.id &&
                      approving.action === "reject"
                        ? "Rejecting..."
                        : showRejectReason
                          ? "Submit Rejection"
                          : "Reject"}
                    </Button>
                  </div>
                </section>
              </CardContent>
            </Card>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard rejection reason?</AlertDialogTitle>
            <AlertDialogDescription>
              Approving will discard the current rejection reason. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!selectedProposal) return;
                proceedApprove(selectedProposal.id);
              }}
            >
              Continue & Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

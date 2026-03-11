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
import { formatDualTimeRange, formatSessionSummary } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { statusColors, statusLabels } from "@/lib/proposal-status";

interface Proposal {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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

export default function SecretaryApprovedPage() {
  const { data, isPending } = useSession();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (isPending) return;

    const fetchProposals = async () => {
      try {
        const response = await fetch("/api/secretary-approved-proposals");
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
            <h3 className="text-lg font-medium mb-4">No History Yet</h3>
            <p className="text-muted-foreground">
              You have not approved or rejected any proposals yet.
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
              </CardContent>
            </Card>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}


"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useConfirmation } from "@/components/ui/confirmation-card";
import { useSession } from "@/lib/auth-client";
import { GuestModal } from "@/components/guest-modal";
import { CollaboratorModal } from "@/components/collaborator-modal";

type ProposalResponse = {
  proposal: {
    id: string;
    status: string;
    event: {
      title: string;
      description: string;
      location: string;
      startTime: string;
      endTime: string;
      occurrences?: Array<{
        startTime: string;
        endTime: string;
        location: string;
      }>;
    } | null;
    collaborators: Array<{ id: string; name: string; type: string }>;
    guests: Array<{
      id: string;
      name: string;
      affiliation: string | null;
      reason: string | null;
    }>;
    contacts: Array<{ role: string; name: string; email: string | null }>;
    reviews: Array<{
      reviewerRole: string;
      approved: boolean;
      comments: string | null;
    }>;
  };
};

const EDITABLE_STATUSES = new Set([
  "LEAD_REJECTED",
  "SU_REJECTED",
  "DIRECTOR_REJECTED",
  "RESUBMISSION_REQUIRED",
]);

export default function ProposalEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const proposalId = params?.id;

  type EventOccurrenceForm = {
    startDateTime: string;
    endDateTime: string;
    location: string;
  };

  const { data, isPending } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [status, setStatus] = useState<string>("");

  const [title, setTitle] = useState("");
  const [occurrences, setOccurrences] = useState<EventOccurrenceForm[]>([
    { startDateTime: "", endDateTime: "", location: "" },
  ]);
  const [description, setDescription] = useState("");

  const [presidentName, setPresidentName] = useState("");
  const [vpName, setVpName] = useState("");
  const [secretaryName, setSecretaryName] = useState("");

  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [guests, setGuests] = useState<
    Array<{ name: string; expertise: string; reason: string }>
  >([]);

  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const { requestConfirmation, ConfirmationComponent } = useConfirmation();

  const clearProposalsCache = () => {
    if (typeof window === "undefined") return;
    try {
      const prefix = "eventgate:president:proposals:page:";
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(prefix)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
    } catch {}
  };

  const canEdit = useMemo(() => EDITABLE_STATUSES.has(status), [status]);

  const directorRejection = useMemo(() => {
    const found = (data: ProposalResponse | null) => {
      const review = data?.proposal?.reviews?.find(
        (r) => r.reviewerRole === "DIRECTOR"
      );
      if (!review || review.approved) return null;
      return review.comments || "";
    };
    return found;
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!proposalId) return;

    const user = data?.user;
    if (!user) {
      router.replace(
        "/login?redirect=" + encodeURIComponent(`/proposals/${proposalId}/edit`)
      );
      return;
    }

    if (!user.emailVerified) {
      router.replace("/verify?email=" + encodeURIComponent(user.email || ""));
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/proposals/${proposalId}`, {
          cache: "no-store",
        });
        const json = (await res
          .json()
          .catch(() => null)) as ProposalResponse | null;
        if (!res.ok) {
          throw new Error((json as any)?.message || "Failed to load proposal");
        }

        const proposal = json?.proposal;
        if (!proposal?.event) {
          throw new Error("Proposal is missing event details");
        }

        setStatus(proposal.status);
        setTitle(proposal.event.title || "");
        setDescription(proposal.event.description || "");

        const apiOccurrences = Array.isArray(
          (proposal.event as any).occurrences
        )
          ? ((proposal.event as any).occurrences as Array<{
              startTime: string;
              endTime: string;
              location: string;
            }>)
          : [];

        if (apiOccurrences.length > 0) {
          setOccurrences(
            apiOccurrences.map((o) => ({
              startDateTime: new Date(o.startTime).toISOString().slice(0, 16),
              endDateTime: new Date(o.endTime).toISOString().slice(0, 16),
              location: o.location || "",
            }))
          );
        } else {
          setOccurrences([
            {
              startDateTime: new Date(proposal.event.startTime)
                .toISOString()
                .slice(0, 16),
              endDateTime: new Date(proposal.event.endTime)
                .toISOString()
                .slice(0, 16),
              location: proposal.event.location || "",
            },
          ]);
        }

        const president = proposal.contacts?.find(
          (c) => c.role === "PRESIDENT"
        );
        const vp = proposal.contacts?.find((c) => c.role === "VICE_PRESIDENT");
        const sec = proposal.contacts?.find((c) => c.role === "SECRETARY");
        setPresidentName(president?.name || "");
        setVpName(vp?.name || "");
        setSecretaryName(sec?.name || "");

        setCollaborators((proposal.collaborators || []).map((c) => c.name));
        setGuests(
          (proposal.guests || []).map((g) => ({
            name: g.name,
            expertise: g.affiliation || "",
            reason: g.reason || "",
          }))
        );

        if (!EDITABLE_STATUSES.has(proposal.status)) {
          setError(
            "Editing is not allowed once the proposal reaches Student Union."
          );
        }

        const directorReason = directorRejection(json);
        if (directorReason) {
          setMessage(`Director rejection reason: ${directorReason}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load proposal");
      } finally {
        setLoading(false);
      }
    })();
  }, [data, isPending, proposalId, router, directorRejection]);

  // Auto-hide toast after a short duration when message or error changes
  useEffect(() => {
    if (!message && !error) return;
    setToastOpen(true);
    const handle = setTimeout(() => setToastOpen(false), 4000);
    return () => clearTimeout(handle);
  }, [message, error]);

  const performSave = async () => {
    if (!proposalId) return;
    if (!canEdit) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!occurrences || occurrences.length === 0) {
      nextErrors.occurrences = "At least one event session is required.";
    }

    occurrences.forEach((o, idx) => {
      const startKey = `occurrences.${idx}.startDateTime`;
      const endKey = `occurrences.${idx}.endDateTime`;
      const locationKey = `occurrences.${idx}.location`;

      if (!o.startDateTime)
        nextErrors[startKey] = "Start date/time is required.";
      if (!o.endDateTime) nextErrors[endKey] = "End date/time is required.";
      if (!String(o.location || "").trim())
        nextErrors[locationKey] = "Location is required.";

      const start = o.startDateTime ? new Date(o.startDateTime) : null;
      const end = o.endDateTime ? new Date(o.endDateTime) : null;

      if (start && Number.isNaN(start.getTime()))
        nextErrors[startKey] = "Enter a valid start date/time.";
      if (end && Number.isNaN(end.getTime()))
        nextErrors[endKey] = "Enter a valid end date/time.";

      if (
        start &&
        end &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end.getTime() <= start.getTime()
      ) {
        nextErrors[endKey] = "End date/time must be after the start.";
      }
    });

    const parsed = occurrences
      .map((o) => ({
        start: new Date(o.startDateTime),
        end: new Date(o.endDateTime),
      }))
      .filter(
        (o) =>
          !Number.isNaN(o.start.getTime()) && !Number.isNaN(o.end.getTime())
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < parsed.length - 1; i++) {
      if (parsed[i].end.getTime() > parsed[i + 1].start.getTime()) {
        nextErrors.occurrences = "Event sessions cannot overlap.";
        break;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Please fix the highlighted fields.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTitle: title,
          eventDescription: description,
          eventLocation: String(occurrences?.[0]?.location || "").trim(),
          eventOccurrences: occurrences.map((o) => ({
            startTime: o.startDateTime,
            endTime: o.endDateTime,
            location: o.location,
          })),
          presidentName,
          vpName,
          secretaryName,
          collaboratingOrgs: collaborators,
          invitedGuests: guests,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || "Failed to update proposal");
      }

      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update proposal");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const confirmed = await requestConfirmation(
      "Resubmit Proposal",
      "Submit these edited changes back into the review workflow?",
      () => {},
      { confirmText: "Resubmit", cancelText: "Cancel" }
    );
    if (!confirmed) return;
    const saved = await performSave();
    if (!saved) return;

    setSaving(true);
    setError(null);
    try {
      const resubmitRes = await fetch(`/api/proposals/${proposalId}/resubmit`, {
        method: "POST",
      });
      const resubmitJson = await resubmitRes.json().catch(() => null);
      if (!resubmitRes.ok) {
        throw new Error(resubmitJson?.message || "Failed to resubmit proposal");
      }

      setMessage("Resubmitted.");
      clearProposalsCache();
      router.push("/proposals");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resubmit proposal");
    } finally {
      setSaving(false);
    }
  };

  if (loading || isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading proposal...</p>
      </div>
    );
  }

  const updateOccurrence = (
    index: number,
    patch: Partial<EventOccurrenceForm>
  ) => {
    setOccurrences((prev) => {
      const next = [...prev];
      const current = next[index] ?? {
        startDateTime: "",
        endDateTime: "",
        location: "",
      };
      next[index] = { ...current, ...patch };
      return next;
    });
  };

  const addOccurrence = () => {
    setOccurrences((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          startDateTime: "",
          endDateTime: "",
          location: String(last?.location || "").trim(),
        },
      ];
    });
  };

  const removeOccurrence = (index: number) => {
    setOccurrences((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="min-h-svh bg-background">
      <ConfirmationComponent />
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <Card className="shadow-none rounded-none">
          <CardHeader>
            <CardTitle className="text-xl">Edit Proposal</CardTitle>
            <CardDescription>
              Status: <span className="font-medium">{status || "Unknown"}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(error || message) && (
              <div className="mb-4 space-y-2">
                {error && <p className="text-sm text-destructive">{error}</p>}
                {message && (
                  <p className="text-sm text-muted-foreground">{message}</p>
                )}
              </div>
            )}

            <form onSubmit={(e) => e.preventDefault()} className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  value={title}
                  disabled={!canEdit}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-none shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Label>Event Sessions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addOccurrence}
                    disabled={!canEdit}
                    className="rounded-none"
                  >
                    Add another day/session
                  </Button>
                </div>

                {fieldErrors.occurrences && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.occurrences}
                  </p>
                )}

                <div className="space-y-4">
                  {occurrences.map((o, idx) => {
                    const startKey = `occurrences.${idx}.startDateTime`;
                    const endKey = `occurrences.${idx}.endDateTime`;
                    const locationKey = `occurrences.${idx}.location`;

                    return (
                      <div
                        key={idx}
                        className="p-4 border border-border bg-muted/30 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">Session {idx + 1}</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeOccurrence(idx)}
                            disabled={!canEdit || occurrences.length <= 1}
                            className="rounded-none"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="grid gap-2">
                            <Label htmlFor={`startDateTime-${idx}`}>
                              Start Date &amp; Time
                            </Label>
                            <Input
                              id={`startDateTime-${idx}`}
                              type="datetime-local"
                              required
                              value={o.startDateTime}
                              disabled={!canEdit}
                              onChange={(e) =>
                                updateOccurrence(idx, {
                                  startDateTime: e.target.value,
                                })
                              }
                              className="rounded-none shadow-none focus-visible:ring-0 "
                            />
                            {fieldErrors[startKey] && (
                              <p className="text-xs text-destructive">
                                {fieldErrors[startKey]}
                              </p>
                            )}
                          </div>

                          <div className="grid gap-2">
                            <Label htmlFor={`endDateTime-${idx}`}>
                              End Date &amp; Time 
                            </Label>
                            <Input
                              id={`endDateTime-${idx}`}
                              type="datetime-local"
                              required
                              value={o.endDateTime}
                              disabled={!canEdit}
                              onChange={(e) =>
                                updateOccurrence(idx, {
                                  endDateTime: e.target.value,
                                })
                              }
                              className="rounded-none shadow-none focus-visible:ring-0"
                            />
                            {fieldErrors[endKey] && (
                              <p className="text-xs text-destructive">
                                {fieldErrors[endKey]}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`location-${idx}`}>Location</Label>
                          <Input
                            id={`location-${idx}`}
                            required
                            value={o.location}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateOccurrence(idx, {
                                location: e.target.value,
                              })
                            }
                            className="rounded-none shadow-none focus-visible:ring-0"
                          />
                          {fieldErrors[locationKey] && (
                            <p className="text-xs text-destructive">
                              {fieldErrors[locationKey]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="presidentName">President Name</Label>
                <Input
                  id="presidentName"
                  required
                  value={presidentName}
                  disabled={!canEdit}
                  onChange={(e) => setPresidentName(e.target.value)}
                  className="rounded-none shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="vpName">Vice President Name</Label>
                  <Input
                    id="vpName"
                    value={vpName}
                    disabled={!canEdit}
                    onChange={(e) => setVpName(e.target.value)}
                    className="rounded-none shadow-none focus-visible:ring-0"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="secretaryName">Secretary Name</Label>
                  <Input
                    id="secretaryName"
                    value={secretaryName}
                    disabled={!canEdit}
                    onChange={(e) => setSecretaryName(e.target.value)}
                    className="rounded-none shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Summary</Label>
                <Textarea
                  id="description"
                  required
                  rows={5}
                  value={description}
                  disabled={!canEdit}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-none shadow-none focus-visible:ring-0"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">
                    Collaborating Organizations
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => setIsCollaboratorModalOpen(true)}
                    className="rounded-none"
                  >
                    Manage Collaborators
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">
                    Invited Guests
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => setIsGuestModalOpen(true)}
                    className="rounded-none"
                  >
                    Manage Guests
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Button
                  type="button"
                  className="rounded-none"
                  disabled={saving || !canEdit}
                  onClick={handleSave}
                >
                  {saving ? "Resubmitting..." : "Resubmit"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Toast Notification */}
      {(message || error) && toastOpen && (
        <div
          className="fixed bottom-4 right-4 z-50 w-88 max-w-[calc(100vw-2rem)]"
          role="status"
          aria-live={error ? "assertive" : "polite"}
        >
          <div
            className={
              error
                ? "border border-destructive/30 bg-background"
                : "border border-border bg-background"
            }
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div
                  className={
                    error
                      ? "text-sm font-medium text-destructive"
                      : "text-sm font-medium text-foreground"
                  }
                >
                  {error ? "Action failed" : "Success"}
                </div>
                <div
                  className={
                    error
                      ? "mt-1 text-sm text-destructive/90"
                      : "mt-1 text-sm text-muted-foreground"
                  }
                >
                  {error || message}
                </div>
              </div>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                aria-label="Dismiss"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                }}
              >
                ×
              </Button>
            </div>
          </div>
        </div>
      )}

      <GuestModal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        guests={guests}
        onSave={setGuests}
      />

      <CollaboratorModal
        isOpen={isCollaboratorModalOpen}
        onClose={() => setIsCollaboratorModalOpen(false)}
        collaborators={collaborators}
        onSave={setCollaborators}
      />
    </div>
  );
}

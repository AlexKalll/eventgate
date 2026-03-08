"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, isBefore } from "date-fns";
import { Trash2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
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
import { GuestModal } from "@/components/guest-modal";
import { CollaboratorModal } from "@/components/collaborator-modal";

export default function NewProposalPage() {
  const { data } = useSession();
  const router = useRouter();

  const minDateTimeValue = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM for datetime-local

  type EventOccurrenceForm = {
    startDateTime: string;
    endDateTime: string;
    location: string;
  };

  const [clubInfo, setClubInfo] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [officers, setOfficers] = useState<{
    president: { email: string; name: string | null } | null;
    vicePresident: { email: string; name: string | null } | null;
    secretary: { email: string; name: string | null } | null;
  }>({
    president: null,
    vicePresident: null,
    secretary: null,
  });
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
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getFieldIdFromErrorKey = (key: string) => {
    if (key === "title") return "title";
    if (key === "description") return "description";
    if (key === "presidentName") return "presidentName";
    if (key.startsWith("occurrences.")) {
      const parts = key.split(".");
      const idx = parts[1];
      const field = parts[2];
      if (field === "startDateTime") return `startDateTime-${idx}`;
      if (field === "endDateTime") return `endDateTime-${idx}`;
      if (field === "location") return `location-${idx}`;
    }
    return null;
  };

  const scrollToFirstInvalidField = (nextErrors: Record<string, string>) => {
    const firstKey = Object.keys(nextErrors).find((key) =>
      Boolean(getFieldIdFromErrorKey(key)),
    );
    if (!firstKey) return;

    const fieldId = getFieldIdFromErrorKey(firstKey);
    if (!fieldId) return;

    const field = document.getElementById(fieldId) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (!field) return;

    // Use explicit page scroll for reliable positioning across browsers.
    window.requestAnimationFrame(() => {
      const rect = field.getBoundingClientRect();
      const top = Math.max(0, window.scrollY + rect.top - 140);
      window.scrollTo({ top, behavior: "smooth" });
      window.setTimeout(() => {
        field.focus({ preventScroll: true });
      }, 180);
    });
  };

  const getFirstFieldError = (nextErrors: Record<string, string>) => {
    const firstKey = Object.keys(nextErrors).find((key) =>
      Boolean(getFieldIdFromErrorKey(key)),
    );
    if (!firstKey) return null;
    return { key: firstKey, message: nextErrors[firstKey] };
  };
  useEffect(() => {
    const fetchClubInfo = async () => {
      try {
        const response = await fetch("/api/club", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setClubInfo(data.club);
          const safeOfficers = data.officers || {
            president: null,
            vicePresident: null,
            secretary: null,
          };
          setOfficers(safeOfficers);

          // Auto-fill officer names if available
          if (safeOfficers.president?.name) {
            setPresidentName(safeOfficers.president.name);
          }
          if (safeOfficers.vicePresident?.name) {
            setVpName(safeOfficers.vicePresident.name);
          }
          if (safeOfficers.secretary?.name) {
            setSecretaryName(safeOfficers.secretary.name);
          }
        }
      } catch (error) {
        console.error("Failed to fetch club info:", error);
      }
    };
    fetchClubInfo();
  }, []);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const normalizedPresidentName = presidentName.trim();

    if (!normalizedTitle) nextErrors.title = "Title is required.";

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
      if (!String(o.location || "").trim()) {
        nextErrors[locationKey] = "Location is required.";
      }

      const start = o.startDateTime ? new Date(o.startDateTime) : null;
      const end = o.endDateTime ? new Date(o.endDateTime) : null;

      if (start && Number.isNaN(start.getTime())) {
        nextErrors[startKey] = "Enter a valid start date/time.";
      }

      if (end && Number.isNaN(end.getTime())) {
        nextErrors[endKey] = "Enter a valid end date/time.";
      }

      if (
        start &&
        end &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime())
      ) {
        if (end.getTime() <= start.getTime()) {
          nextErrors[endKey] = "End date/time must be after the start.";
        }
      }
    });

    const parsed = occurrences
      .map((o) => ({
        start: new Date(o.startDateTime),
        end: new Date(o.endDateTime),
      }))
      .filter(
        (o) =>
          !Number.isNaN(o.start.getTime()) && !Number.isNaN(o.end.getTime()),
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (parsed.length > 0) {
      // Removed: Event must be at least 7 days from now validation

      for (let i = 0; i < parsed.length - 1; i++) {
        if (parsed[i].end.getTime() > parsed[i + 1].start.getTime()) {
          nextErrors.occurrences = "Event sessions cannot overlap.";
          break;
        }
      }
    }

    if (!normalizedDescription) nextErrors.description = "Summary is required.";
    if (!normalizedPresidentName)
      nextErrors.presidentName = "President name is required.";
    return nextErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setFormError(null);
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstFieldError = getFirstFieldError(nextErrors);
      setFormError(firstFieldError?.message || "Please fix the highlighted fields.");
      scrollToFirstInvalidField(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventTitle: title.trim(),
          eventDescription: description.trim(),
          eventLocation: String(occurrences?.[0]?.location || "").trim(),
          eventOccurrences: occurrences.map((o) => ({
            startTime: o.startDateTime,
            endTime: o.endDateTime,
            location: o.location,
          })),
          presidentName: presidentName.trim(),
          vpName: vpName.trim(),
          secretaryName: secretaryName.trim(),
          collaboratingOrgs: collaborators.filter((c) => c.trim() !== ""),
          invitedGuests: guests.filter((g) => g.name.trim() !== ""),
          clubId: clubInfo?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit proposal");
      }

      setMessage(
        "Proposal submitted successfully and sent to club leads for review!",
      );

      // Clear form state immediately
      setTitle("");
      setOccurrences([{ startDateTime: "", endDateTime: "", location: "" }]);
      setDescription("");
      setPresidentName("");
      setVpName("");
      setSecretaryName("");
      setCollaborators([]);
      setGuests([]);
      setErrors({});

      // Redirect after a delay
      setTimeout(() => {
        router.push("/president");
      }, 2000);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to submit proposal",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateOccurrence = (
    index: number,
    patch: Partial<EventOccurrenceForm>,
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
      <div className="container  px-4 py-10 max-w-5xl ">
        <div className="">
          {clubInfo && (
            <div className="absolute top-22 left-20 font-serif text-slate-900 flex">
              <p className="text-sm font-medium text-gray-700">
                {clubInfo.name.toUpperCase()}
              </p>
              <p className="text-[10px] absolute top-5 left-7 text-muted-foreground">
                President Account
              </p>
            </div>
          )}
        </div>
      </div>

      <main className="container mx-auto px-4 max-w-5xl">
        <Card className="shadow-none rounded-none">
          <CardHeader>
            <CardTitle className="text-xl text-gray-700">
              Event Details
            </CardTitle>
            <CardDescription>Fill out the information below.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="grid gap-6">
              {/* Club Information Display */}
              <div className="grid gap-2">
                <Label>Club</Label>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-none">
                  {clubInfo ? (
                    <>
                      <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                      <span className="font-medium">
                        {clubInfo.name.toUpperCase()}
                      </span>
                      <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                        <img
                          src="/verified.png"
                          alt="Verified president"
                          width={14}
                          height={14}
                          className="h-3.5 w-3.5"
                          loading="lazy"
                        />
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Loading club information...
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  placeholder="Annual Budget Review Summit"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title)
                      setErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  className="rounded-none shadow-none focus-visible:ring-0"
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Label>Event Sessions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addOccurrence}
                    className="rounded-none"
                  >
                    Add another day/session
                  </Button>
                </div>

                {errors.occurrences && (
                  <p className="text-xs text-destructive">
                    {errors.occurrences}
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
                            disabled={occurrences.length <= 1}
                            className="rounded-none"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className=" sm:grid-cols-2 gap-4 sm:gap-6">
                          <div className="grid gap-2">
                            <Label htmlFor={`startDateTime-${idx}`}>
                              Start Date &amp; Time
                            </Label>
                            <div className="relative">
                              <Input
                                id={`startDateTime-${idx}`}
                                type="datetime-local"
                                required
                                min={minDateTimeValue}
                                step={60}
                                value={o.startDateTime}
                                onChange={(e) => {
                                  updateOccurrence(idx, {
                                    startDateTime: e.target.value,
                                  });
                                  if (errors[startKey]) {
                                    setErrors((prev) => ({
                                      ...prev,
                                      [startKey]: "",
                                    }));
                                  }
                                }}
                                className={`rounded-none shadow-none focus-visible:ring-0 peer  w-50 ${
                                  !o.startDateTime
                                    ? "text-transparent [&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent [&::-webkit-datetime-edit-ampm-field]:text-transparent [&::-webkit-datetime-edit-hour-field]:text-transparent [&::-webkit-datetime-edit-minute-field]:text-transparent [&::-webkit-datetime-edit-day-field]:text-transparent [&::-webkit-datetime-edit-month-field]:text-transparent [&::-webkit-datetime-edit-year-field]:text-transparent"
                                    : ""
                                }`}
                              />
                              {!o.startDateTime && (
                                <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-sm text-muted-foreground/80">
                                  Select date & time
                                </div>
                              )}
                            </div>
                            {errors[startKey] && (
                              <p className="text-xs text-destructive">
                                {errors[startKey]}
                              </p>
                            )}
                          </div>

                          <div className="grid gap-2 pt-4">
                            <Label htmlFor={`endDateTime-${idx}`}>
                              End Date &amp; Time
                            </Label>
                            <div className="relative">
                              <Input
                                id={`endDateTime-${idx}`}
                                type="datetime-local"
                                required
                                min={minDateTimeValue}
                                step={60}
                                value={o.endDateTime}
                                onChange={(e) => {
                                  updateOccurrence(idx, {
                                    endDateTime: e.target.value,
                                  });
                                  if (errors[endKey]) {
                                    setErrors((prev) => ({
                                      ...prev,
                                      [endKey]: "",
                                    }));
                                  }
                                }}
                                className={`rounded-none shadow-none focus-visible:ring-0 peer w-50 ${
                                  !o.endDateTime
                                    ? "text-transparent [&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent [&::-webkit-datetime-edit-ampm-field]:text-transparent [&::-webkit-datetime-edit-hour-field]:text-transparent [&::-webkit-datetime-edit-minute-field]:text-transparent [&::-webkit-datetime-edit-day-field]:text-transparent [&::-webkit-datetime-edit-month-field]:text-transparent [&::-webkit-datetime-edit-year-field]:text-transparent"
                                    : ""
                                }`}
                              />
                              {!o.endDateTime && (
                                <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-sm text-muted-foreground/80">
                                  Select date & time
                                </div>
                              )}
                            </div>
                            {errors[endKey] && (
                              <p className="text-xs text-destructive">
                                {errors[endKey]}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`location-${idx}`}>Location</Label>
                          <Input
                            id={`location-${idx}`}
                            required
                            placeholder="Conference Hall A"
                            value={o.location}
                            onChange={(e) => {
                              updateOccurrence(idx, {
                                location: e.target.value,
                              });
                              if (errors[locationKey]) {
                                setErrors((prev) => ({
                                  ...prev,
                                  [locationKey]: "",
                                }));
                              }
                            }}
                            className="rounded-none shadow-none focus-visible:ring-0"
                          />
                          {errors[locationKey] && (
                            <p className="text-xs text-destructive">
                              {errors[locationKey]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="presidentName">President Name</Label>
                  <div className="relative">
                    <Input
                      id="presidentName"
                      required
                      placeholder="John Doe"
                      value={presidentName}
                      onChange={(e) => {
                        setPresidentName(e.target.value);
                        if (errors.presidentName)
                          setErrors((prev) => ({ ...prev, presidentName: "" }));
                      }}
                      className="rounded-none shadow-none focus-visible:ring-0 pr-10"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <div
                        className="w-2 h-2 bg-emerald-600 rounded-full"
                        title={`Logged in: ${
                          officers.president?.name
                            ? officers.president.name + " • "
                            : ""
                        }${officers.president?.email || data?.user?.email}`}
                      ></div>
                    </div>
                  </div>
                  {officers.president && (
                    <p className="text-xs text-muted-foreground">
                      {officers.president.name
                        ? `${officers.president.name} • `
                        : ""}
                      {officers.president.email}
                    </p>
                  )}
                  {errors.presidentName && (
                    <p className="text-xs text-destructive">
                      {errors.presidentName}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="vpName">Vice President Name</Label>
                  <div className="relative">
                    <Input
                      id="vpName"
                      placeholder="Jane Smith"
                      value={vpName}
                      onChange={(e) => setVpName(e.target.value)}
                      className="rounded-none shadow-none focus-visible:ring-0 pr-10"
                    />
                    {officers.vicePresident && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div
                          className="w-2 h-2 bg-emerald-600 rounded-full"
                          title={`Registered: ${
                            officers.vicePresident.name
                              ? officers.vicePresident.name + " • "
                              : ""
                          }${officers.vicePresident.email}`}
                        ></div>
                      </div>
                    )}
                  </div>
                  {officers.vicePresident && (
                    <p className="text-xs text-muted-foreground">
                      {officers.vicePresident.name
                        ? `${officers.vicePresident.name} • `
                        : ""}
                      {officers.vicePresident.email}
                    </p>
                  )}
                  {!officers.vicePresident && (
                    <p className="text-xs text-muted-foreground italic">
                      No Vice President registered
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="secretaryName">Secretary Name</Label>
                  <div className="relative">
                    <Input
                      id="secretaryName"
                      placeholder="Bob Johnson"
                      value={secretaryName}
                      onChange={(e) => setSecretaryName(e.target.value)}
                      className="rounded-none shadow-none focus-visible:ring-0 pr-10"
                    />
                    {officers.secretary && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div
                          className="w-2 h-2 bg-emerald-600 rounded-full"
                          title={`Registered: ${
                            officers.secretary.name
                              ? officers.secretary.name + " • "
                              : ""
                          }${officers.secretary.email}`}
                        ></div>
                      </div>
                    )}
                  </div>
                  {officers.secretary && (
                    <p className="text-xs text-muted-foreground">
                      {officers.secretary.name
                        ? `${officers.secretary.name} • `
                        : ""}
                      {officers.secretary.email}
                    </p>
                  )}
                  {!officers.secretary && (
                    <p className="text-xs text-muted-foreground italic">
                      No Secretary registered
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">
                  {" "}
                  Event Description: Please provide Specific Details of your
                  event
                </Label>
                <Textarea
                  id="description"
                  required
                  rows={5}
                  placeholder="Describe the event objectives, attendees, and logistical needs."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description)
                      setErrors((prev) => ({ ...prev, description: "" }));
                  }}
                  className="rounded-none shadow-none focus-visible:ring-0"
                />
                {errors.description && (
                  <p className="text-xs text-destructive">
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Collaborators Section */}
              <div className="space-y-4  bg-gray-500/5 p-4 rounded-none">
                <div className="flex items-center justify-start gap-3">
                  <Label className="text-base font-medium">
                    Collaborating Organizations
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCollaboratorModalOpen(true)}
                    className="rounded-none"
                  >
                    + Collaborators
                  </Button>
                </div>
                {collaborators.length > 0 ? (
                  <div className="space-y-2">
                    {collaborators.map((collaborator, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 bg-muted/30 rounded-none"
                      >
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span className="text-sm">{collaborator}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No collaborators added yet
                  </p>
                )}
              </div>

              {/* Guests Section */}
              <div className="space-y-4 bg-gray-500/5 p-4 rounded-none">
                <div className="flex items-center justify-start gap-3">
                  <Label className="text-base font-medium">
                    Invited Guests
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsGuestModalOpen(true)}
                    className="rounded-none"
                  >
                    + Guests
                  </Button>
                </div>
                {guests.length > 0 ? (
                  <div className="space-y-3">
                    {guests.map((guest, index) => (
                      <div
                        key={index}
                        className="p-4 border border-border bg-background space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
                          <div className="flex-1 space-y-1">
                            <p className="font-medium">{guest.name}</p>
                            <p className="text-sm text-muted-foreground">
                              <strong>Expertise:</strong> {guest.expertise}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <strong>Reason:</strong> {guest.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No guests added yet
                  </p>
                )}
              </div>

              {message && <p className="text-sm text-emerald-700">{message}</p>}
              {formError && (
                <div
                  className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  role="alert"
                >
                  <span>{formError}</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none h-8 border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => scrollToFirstInvalidField(errors)}
                  >
                    Go to field
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full md:w-auto rounded-none"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Proposal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Modals */}
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

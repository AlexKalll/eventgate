import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EDITABLE_STATUSES = new Set([
  "LEAD_REJECTED",
  "SU_REJECTED",
  "DIRECTOR_REJECTED",
  "RESUBMISSION_REQUIRED",
]);

type EventOccurrenceInput = {
  startTime: string;
  endTime: string;
  location?: string;
};

function parseOccurrences(body: any) {
  const raw = Array.isArray(body?.eventOccurrences)
    ? body.eventOccurrences
    : null;

  const occurrences: Array<{
    startTime: Date;
    endTime: Date;
    location: string;
  }> =
    raw && raw.length > 0
      ? raw.map((o: EventOccurrenceInput) => ({
          startTime: new Date(String(o?.startTime ?? "")),
          endTime: new Date(String(o?.endTime ?? "")),
          location: String(o?.location ?? body?.eventLocation ?? "").trim(),
        }))
      : [
          {
            startTime: new Date(String(body?.eventStartTime ?? "")),
            endTime: new Date(String(body?.eventEndTime ?? "")),
            location: String(body?.eventLocation ?? "").trim(),
          },
        ];

  return occurrences;
}

function validateOccurrences(
  occurrences: Array<{ startTime: Date; endTime: Date; location: string }>
) {
  if (!occurrences || occurrences.length === 0) {
    return "At least one event date/time is required";
  }

  for (const [idx, o] of occurrences.entries()) {
    if (
      Number.isNaN(o.startTime.getTime()) ||
      Number.isNaN(o.endTime.getTime())
    ) {
      return `Invalid date/time in session #${idx + 1}`;
    }
    if (o.endTime.getTime() <= o.startTime.getTime()) {
      return `End time must be after start time in session #${idx + 1}`;
    }
    if (!o.location) {
      return `Location is required in session #${idx + 1}`;
    }
  }

  // Disallow overlaps across all sessions
  const sorted = [...occurrences].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.endTime.getTime() > next.startTime.getTime()) {
      return "Event sessions cannot overlap";
    }
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!proposalId) {
    return NextResponse.json(
      { message: "Missing proposal id" },
      { status: 400 }
    );
  }

  if (!user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { message: "Email verification required" },
      { status: 403 }
    );
  }

  const presidentGrant = await prisma.clubRoleGrant.findFirst({
    where: {
      email: user.email.toLowerCase(),
      role: "PRESIDENT",
    },
    select: { clubId: true },
  });

  if (!presidentGrant) {
    return NextResponse.json(
      { message: "Only club presidents can view proposals" },
      { status: 403 }
    );
  }

  const proposal = await prisma.proposal.findFirst({
    where: {
      id: proposalId,
      clubId: presidentGrant.clubId,
    },
    include: {
      event: { include: { occurrences: true } },
      contacts: true,
      collaborators: true,
      guests: true,
      leadApprovals: true,
      reviews: true,
      club: { select: { name: true } },
    },
  });

  if (!proposal) {
    return NextResponse.json(
      { message: "Proposal not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ proposal });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!proposalId) {
    return NextResponse.json(
      { message: "Missing proposal id" },
      { status: 400 }
    );
  }

  if (!user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { message: "Email verification required" },
      { status: 403 }
    );
  }

  const presidentGrant = await prisma.clubRoleGrant.findFirst({
    where: {
      email: user.email.toLowerCase(),
      role: "PRESIDENT",
    },
    select: { clubId: true },
  });

  if (!presidentGrant) {
    return NextResponse.json(
      { message: "Only club presidents can edit proposals" },
      { status: 403 }
    );
  }

  const existing = await prisma.proposal.findFirst({
    where: {
      id: proposalId,
      clubId: presidentGrant.clubId,
    },
    select: {
      id: true,
      status: true,
      eventId: true,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { message: "Proposal not found" },
      { status: 404 }
    );
  }

  if (!EDITABLE_STATUSES.has(existing.status)) {
    return NextResponse.json(
      {
        message:
          "Editing is not allowed at this stage. You can only edit after a rejection or when resubmission is required.",
      },
      { status: 403 }
    );
  }

  const body = await request.json();

  const {
    eventTitle,
    eventDescription,
    eventStartTime,
    eventEndTime,
    eventLocation,
    eventOccurrences,
    presidentName,
    vpName,
    secretaryName,
    collaboratingOrgs,
    invitedGuests,
  } = body ?? {};

  if (!existing.eventId) {
    return NextResponse.json(
      { message: "Proposal is missing event" },
      { status: 400 }
    );
  }

  const eventId = existing.eventId;

  try {
    const occurrences = parseOccurrences({
      eventStartTime,
      eventEndTime,
      eventLocation,
      eventOccurrences,
    });
    const occurrencesError = validateOccurrences(occurrences);
    if (occurrencesError) {
      return NextResponse.json({ message: occurrencesError }, { status: 400 });
    }

    const summaryStart = new Date(
      Math.min(...occurrences.map((o) => o.startTime.getTime()))
    );
    const summaryEnd = new Date(
      Math.max(...occurrences.map((o) => o.endTime.getTime()))
    );
    const summaryLocation = String(
      eventLocation ?? occurrences[0]?.location ?? ""
    ).trim();

    const updated = await prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: eventId },
        data: {
          title: String(eventTitle ?? "").trim(),
          description: String(eventDescription ?? "").trim(),
          location: summaryLocation,
          startTime: summaryStart,
          endTime: summaryEnd,
        },
      });

      await tx.eventOccurrence.deleteMany({ where: { eventId } });
      await tx.eventOccurrence.createMany({
        data: occurrences.map((o) => ({
          eventId,
          startTime: o.startTime,
          endTime: o.endTime,
          location: o.location,
        })),
      });

      if (presidentName) {
        await tx.proposalContact.upsert({
          where: {
            proposalId_role: { proposalId, role: "PRESIDENT" },
          },
          create: {
            proposalId,
            role: "PRESIDENT",
            name: String(presidentName).trim(),
            email: user.email.toLowerCase(),
          },
          update: {
            name: String(presidentName).trim(),
            email: user.email.toLowerCase(),
          },
        });
      }

      if (vpName !== undefined) {
        const normalized = String(vpName ?? "").trim();
        if (normalized) {
          await tx.proposalContact.upsert({
            where: {
              proposalId_role: { proposalId, role: "VICE_PRESIDENT" },
            },
            create: {
              proposalId,
              role: "VICE_PRESIDENT",
              name: normalized,
              email: null,
            },
            update: {
              name: normalized,
            },
          });
        }
      }

      if (secretaryName !== undefined) {
        const normalized = String(secretaryName ?? "").trim();
        if (normalized) {
          await tx.proposalContact.upsert({
            where: {
              proposalId_role: { proposalId, role: "SECRETARY" },
            },
            create: {
              proposalId,
              role: "SECRETARY",
              name: normalized,
              email: null,
            },
            update: {
              name: normalized,
            },
          });
        }
      }

      await tx.proposalCollaborator.deleteMany({ where: { proposalId } });
      const collaboratorNames: string[] = Array.isArray(collaboratingOrgs)
        ? collaboratingOrgs
        : [];
      const collaboratorData = collaboratorNames
        .filter((c) => String(c).trim() !== "")
        .map((c) => ({
          proposalId,
          name: String(c).trim(),
          type: "Organization",
        }));
      if (collaboratorData.length > 0) {
        await tx.proposalCollaborator.createMany({ data: collaboratorData });
      }

      await tx.proposalGuest.deleteMany({ where: { proposalId } });
      const guestItems: any[] = Array.isArray(invitedGuests)
        ? invitedGuests
        : [];
      const guestData = guestItems
        .filter((g) => g?.name && String(g.name).trim() !== "")
        .map((g) => ({
          proposalId,
          name: String(g.name).trim(),
          affiliation: g?.expertise ? String(g.expertise).trim() : null,
          reason: g?.reason ? String(g.reason).trim() : null,
        }));
      if (guestData.length > 0) {
        await tx.proposalGuest.createMany({ data: guestData });
      }

      return tx.proposal.findUnique({
        where: { id: proposalId },
        include: {
          event: { include: { occurrences: true } },
          contacts: true,
          collaborators: true,
          guests: true,
          leadApprovals: true,
          reviews: true,
          club: { select: { name: true } },
        },
      });
    });

    return NextResponse.json({
      message: "Proposal updated",
      proposal: updated,
    });
  } catch (error) {
    console.error("Proposal update error:", error);
    const detail = error instanceof Error ? error.message : undefined;
    return NextResponse.json(
      { message: detail || "Failed to update proposal" },
      { status: 500 }
    );
  }
}

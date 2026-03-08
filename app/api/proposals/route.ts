import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendProposalStatusEmail } from "@/lib/email";

// Cache for 60 seconds - use revalidate to refresh
export const revalidate = 60;

// Note: dynamic = force-dynamic was removed to allow caching

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const RESUBMITTABLE_STATUSES = new Set([
  "LEAD_REJECTED",
  "SU_REJECTED",
  "DIRECTOR_REJECTED",
  "RESUBMISSION_REQUIRED",
]);

function latestDate(dates: Array<Date | null | undefined>) {
  const valid = dates.filter(Boolean) as Date[];
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

function getLatestRejectionAt(proposal: any) {
  const lead = (proposal.leadApprovals || [])
    .filter((a: any) => !a.approved)
    .map((a: any) => a.updatedAt);
  const su = (proposal.reviews || [])
    .filter((r: any) => r.reviewerRole === "STUDENT_UNION" && !r.approved)
    .map((r: any) => r.updatedAt);
  const director = (proposal.reviews || [])
    .filter((r: any) => r.reviewerRole === "DIRECTOR" && !r.approved)
    .map((r: any) => r.updatedAt);
  return latestDate([...lead, ...su, ...director]);
}

function getLatestContentEditAt(proposal: any) {
  return latestDate([
    proposal.event?.updatedAt,
    ...(proposal.event?.occurrences || []).map(
      (o: any) => o.updatedAt || o.createdAt,
    ),
    ...(proposal.contacts || []).map((c: any) => c.updatedAt || c.createdAt),
    ...(proposal.collaborators || []).map((c: any) => c.createdAt),
    ...(proposal.guests || []).map((g: any) => g.createdAt),
  ]);
}

function computeResubmissionReady(proposal: any) {
  if (!RESUBMITTABLE_STATUSES.has(proposal.status)) return true;
  const rejectionAt = getLatestRejectionAt(proposal);
  const editAt = getLatestContentEditAt(proposal);
  return Boolean(
    rejectionAt && editAt && editAt.getTime() > rejectionAt.getTime(),
  );
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

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
  occurrences: Array<{ startTime: Date; endTime: Date; location: string }>,
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

  // Disallow overlaps across all sessions (including same day)
  const sorted = [...occurrences].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
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

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!user?.email) {
    console.info("[api/proposals][POST] unauthorized (no session)");
    return jsonNoStore({ message: "Unauthorized" }, { status: 401 });
  }

  if (!user.emailVerified) {
    console.info("[api/proposals][POST] forbidden (email not verified)", {
      email: user.email,
    });
    return jsonNoStore(
      { message: "Email verification required" },
      { status: 403 },
    );
  }

  // Check if user is a club president
  const userEmail = String(user.email).trim();
  const presidentGrant = await prisma.clubRoleGrant.findFirst({
    where: {
      email: { equals: userEmail, mode: "insensitive" },
      role: "PRESIDENT",
    },
    include: {
      club: true,
    },
  });

  if (!presidentGrant) {
    console.info("[api/proposals][POST] forbidden (not a club president)", {
      email: user.email,
    });
    return jsonNoStore(
      { message: "Only club presidents can submit proposals" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    const occurrences = parseOccurrences(body);
    const occurrencesError = validateOccurrences(occurrences);
    if (occurrencesError) {
      return jsonNoStore({ message: occurrencesError }, { status: 400 });
    }

    const summaryStart = new Date(
      Math.min(...occurrences.map((o) => o.startTime.getTime())),
    );
    const summaryEnd = new Date(
      Math.max(...occurrences.map((o) => o.endTime.getTime())),
    );
    const summaryLocation = String(
      body?.eventLocation ?? occurrences[0]?.location ?? "",
    ).trim();

    // Create the proposal first
    const proposal = await prisma.proposal.create({
      data: {
        clubId: presidentGrant.clubId,
        submittedBy: user.email.toLowerCase(),
        status: "LEAD_REVIEW", // Start with lead review stage
      },
      include: {
        event: true,
        contacts: true,
        collaborators: true,
        guests: true,
        club: true,
      },
    });

    // Create the event with the proposalId
    const event = await prisma.event.create({
      data: {
        proposalId: proposal.id,
        title: body.eventTitle,
        description: body.eventDescription,
        location: summaryLocation,
        startTime: summaryStart,
        endTime: summaryEnd,
        occurrences: {
          create: occurrences.map((o) => ({
            startTime: o.startTime,
            endTime: o.endTime,
            location: o.location,
          })),
        },
      },
      include: { occurrences: true },
    });

    // Update the proposal with the eventId
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { eventId: event.id },
    });

    // Create president contact (required)
    await prisma.proposalContact.create({
      data: {
        proposalId: proposal.id,
        role: "PRESIDENT",
        name: body.presidentName,
        email: user.email.toLowerCase(),
      },
    });

    // Create VP contact (optional)
    if (body.vpName && body.vpName.trim()) {
      await prisma.proposalContact.create({
        data: {
          proposalId: proposal.id,
          role: "VICE_PRESIDENT",
          name: body.vpName.trim(),
        },
      });
    }

    // Create secretary contact (optional)
    if (body.secretaryName && body.secretaryName.trim()) {
      await prisma.proposalContact.create({
        data: {
          proposalId: proposal.id,
          role: "SECRETARY",
          name: body.secretaryName.trim(),
        },
      });
    }

    // Create collaborators (if any)
    if (body.collaboratingOrgs && body.collaboratingOrgs.length > 0) {
      await prisma.proposalCollaborator.createMany({
        data: body.collaboratingOrgs
          .filter((org: string) => org.trim() !== "")
          .map((org: string) => ({
            proposalId: proposal.id,
            name: org.trim(),
            type: "Organization",
          })),
      });
    }

    // Create guests (if any)
    if (body.invitedGuests && body.invitedGuests.length > 0) {
      await prisma.proposalGuest.createMany({
        data: body.invitedGuests
          .filter((guest: any) => guest.name && guest.name.trim() !== "")
          .map((guest: any) => ({
            proposalId: proposal.id,
            name: guest.name.trim(),
            affiliation: guest.expertise?.trim() || null,
            reason: guest.reason?.trim() || null,
          })),
      });
    }

    // Create lead approval tracking entries for VP and Secretary only (not President)
    const clubLeads = await prisma.clubRoleGrant.findMany({
      where: {
        clubId: presidentGrant.clubId,
        role: {
          in: ["VP", "SECRETARY"], // Only VP and Secretary review proposals
        },
      },
      select: {
        role: true,
        email: true,
      },
    });

    // Create lead approval records
    if (clubLeads.length > 0) {
      await prisma.proposalLeadApproval.createMany({
        data: clubLeads.map((lead) => ({
          proposalId: proposal.id,
          leadRole: lead.role,
          leadEmail: lead.email,
          approved: false, // Initial state - not yet approved
        })),
      });
    }

    // Notify club leads (VP / Secretary) about the new proposal
    if (clubLeads.length > 0) {
      const eventTitle = String(body.eventTitle || "Untitled Event");
      await Promise.all(
        clubLeads.map(async (lead) => {
          const recipientEmail = lead.email.toLowerCase();
          const comment = "New proposal awaiting your review.";
          const existing = await prisma.presidentNotification.findFirst({
            where: {
              recipientEmail,
              proposalId: proposal.id,
              stage: "LEAD",
              decision: "APPROVED",
              actorRole: "PRESIDENT",
              comment,
              deletedAt: null,
            },
            select: { id: true },
          });
          if (!existing) {
            await prisma.presidentNotification.create({
              data: {
                recipientEmail,
                proposalId: proposal.id,
                eventTitle,
                stage: "LEAD",
                decision: "APPROVED",
                actorRole: "PRESIDENT",
                comment,
              },
            });
          }
        }),
      );

      await Promise.all(
        clubLeads.map((lead) =>
          sendProposalStatusEmail({
            to: lead.email,
            proposalId: proposal.id,
            eventTitle,
            subject: "EventGate: New proposal awaiting your review",
            heading: "New Proposal Submitted",
            message:
              "A new event proposal has been submitted and requires your review. Please review it at your earliest convenience.",
            actionLabel: "Review Proposal",
            actionPath: lead.role === "VP" ? "/vp" : "/secretary",
          }),
        ),
      );
    }

    return jsonNoStore(
      {
        message:
          "Proposal submitted successfully and sent to club leads for review",
        proposal: {
          ...proposal,
          leadApprovals: clubLeads.map((lead) => ({
            leadRole: lead.role,
            leadEmail: lead.email,
            approved: false, // Initial state - not yet approved
            comments: null,
          })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Proposal submission error:", error);
    return jsonNoStore(
      {
        message: "Failed to submit proposal",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!user?.email) {
    console.info("[api/proposals][GET] unauthorized (no session)");
    return jsonNoStore({ message: "Unauthorized" }, { status: 401 });
  }

  if (!user.emailVerified) {
    console.info("[api/proposals][GET] forbidden (email not verified)", {
      email: user.email,
    });
    return jsonNoStore(
      { message: "Email verification required" },
      { status: 403 },
    );
  }

  // Check if user is a club president
  const userEmail = String(user.email).trim();
  const presidentGrant = await prisma.clubRoleGrant.findFirst({
    where: {
      email: { equals: userEmail, mode: "insensitive" },
      role: "PRESIDENT",
    },
    include: {
      club: true,
    },
  });

  if (!presidentGrant) {
    console.info("[api/proposals][GET] forbidden (not a club president)", {
      email: user.email,
    });
    return jsonNoStore(
      { message: "Only club presidents can view proposals" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as any;
    const archived = searchParams.get("archived") === "1";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const archiveCutoff = new Date(Date.now() - ONE_DAY_MS);
    await prisma.proposal.updateMany({
      where: {
        clubId: presidentGrant.clubId,
        archivedAt: null,
        event: {
          OR: [
            {
              occurrences: { none: {} },
              endTime: { lt: archiveCutoff },
            },
            {
              occurrences: {
                some: {},
                none: { endTime: { gte: archiveCutoff } },
              },
            },
          ],
        },
      },
      data: { archivedAt: new Date() },
    });

    const cutoff = new Date(Date.now() - TWO_DAYS_MS);
    await prisma.proposal.deleteMany({
      where: {
        clubId: presidentGrant.clubId,
        archivedAt: { lt: cutoff },
      },
    });

    const where = {
      clubId: presidentGrant.clubId,
      ...(status && { status }),
      ...(archived ? { archivedAt: { not: null } } : { archivedAt: null }),
    };

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          event: { include: { occurrences: true } },
          contacts: true,
          collaborators: true,
          guests: true,
          reviews: {
            where: { reviewerRole: { in: ["STUDENT_UNION", "DIRECTOR"] } },
            select: { reviewerRole: true, approved: true, updatedAt: true },
          },
          club: {
            select: { name: true },
          },
          leadApprovals: {
            include: {
              proposal: {
                include: {
                  event: {
                    select: {
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.proposal.count({ where }),
    ]);

    const proposalsWithResubmissionReady = proposals.map((proposal) => ({
      ...proposal,
      resubmissionReady: computeResubmissionReady(proposal),
    }));

    return jsonNoStore({
      proposals: proposalsWithResubmissionReady,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Proposals fetch error:", error);
    return jsonNoStore(
      {
        message: "Failed to fetch proposals",
      },
      { status: 500 },
    );
  }
}

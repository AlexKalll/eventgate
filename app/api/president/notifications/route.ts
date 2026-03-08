import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type NotificationItem = {
  id: string;
  proposalId: string;
  eventTitle: string;
  stage: "LEAD" | "STUDENT_UNION" | "DIRECTOR";
  decision: "APPROVED" | "REJECTED";
  role: string;
  comment: string | null;
  timestamp: string;
  readAt: string | null;
};

async function requirePresident(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!user?.email) return { error: "Unauthorized", status: 401 as const };
  if (!user.emailVerified)
    return { error: "Email verification required", status: 403 as const };

  const email = user.email.toLowerCase();

  const presidentGrant = await prisma.clubRoleGrant.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      role: "PRESIDENT",
    },
    select: { id: true, clubId: true },
  });

  if (!presidentGrant) {
    return {
      error: "Only club presidents can view notifications",
      status: 403 as const,
    };
  }

  return { email, clubId: presidentGrant.clubId };
}

async function backfillHistoricalNotifications(email: string, clubId: string) {
  const proposals = await prisma.proposal.findMany({
    where: {
      clubId,
      archivedAt: null,
    },
    select: {
      id: true,
      event: { select: { title: true } },
      leadApprovals: {
        select: {
          leadRole: true,
          approved: true,
          comments: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      reviews: {
        where: {
          reviewerRole: {
            in: ["STUDENT_UNION", "DIRECTOR"],
          },
        },
        select: {
          reviewerRole: true,
          approved: true,
          comments: true,
          updatedAt: true,
        },
      },
    },
    take: 200,
  });

  for (const proposal of proposals) {
    const eventTitle = proposal.event?.title || "Untitled Event";

    for (const approval of proposal.leadApprovals) {
      const isReviewed =
        approval.updatedAt.getTime() > approval.createdAt.getTime() ||
        approval.approved ||
        Boolean(approval.comments?.trim());
      if (!isReviewed) continue;

      const existing = await prisma.presidentNotification.findFirst({
        where: {
          recipientEmail: email,
          proposalId: proposal.id,
          stage: "LEAD",
          actorRole: approval.leadRole,
          decision: approval.approved ? "APPROVED" : "REJECTED",
          comment: approval.comments?.trim() || null,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!existing) {
        await prisma.presidentNotification.create({
          data: {
            recipientEmail: email,
            proposalId: proposal.id,
            eventTitle,
            stage: "LEAD",
            decision: approval.approved ? "APPROVED" : "REJECTED",
            actorRole: approval.leadRole,
            comment: approval.comments?.trim() || null,
            createdAt: approval.updatedAt,
            // Historical records are treated as already seen.
            readAt: new Date(),
          },
        });
      }
    }

    for (const review of proposal.reviews) {
      const stage =
        review.reviewerRole === "STUDENT_UNION" ? "STUDENT_UNION" : "DIRECTOR";
      const role = review.reviewerRole;
      const decision = review.approved ? "APPROVED" : "REJECTED";
      const comment = review.comments?.trim() || null;

      const existing = await prisma.presidentNotification.findFirst({
        where: {
          recipientEmail: email,
          proposalId: proposal.id,
          stage,
          actorRole: role,
          decision,
          comment,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!existing) {
        await prisma.presidentNotification.create({
          data: {
            recipientEmail: email,
            proposalId: proposal.id,
            eventTitle,
            stage,
            decision,
            actorRole: role,
            comment,
            createdAt: review.updatedAt,
            // Historical records are treated as already seen.
            readAt: new Date(),
          },
        });
      }
    }
  }
}

export async function GET(request: Request) {
  const authz = await requirePresident(request);
  if ("error" in authz) {
    return NextResponse.json({ message: authz.error }, { status: authz.status });
  }

  const url = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit") || 30)),
  );
  const tab = String(url.searchParams.get("tab") || "all").toLowerCase();

  await backfillHistoricalNotifications(authz.email, authz.clubId);

  let whereByTab: any = {
    recipientEmail: authz.email,
    deletedAt: null,
  };
  if (tab === "archived") {
    whereByTab = {
      recipientEmail: authz.email,
      deletedAt: { not: null },
    };
  } else if (tab === "unread") {
    whereByTab.readAt = null;
  } else if (tab === "important") {
    whereByTab.decision = "REJECTED";
  }

  const rows = await prisma.presidentNotification.findMany({
    where: whereByTab,
    select: {
      id: true,
      proposalId: true,
      eventTitle: true,
      stage: true,
      decision: true,
      actorRole: true,
      comment: true,
      createdAt: true,
      readAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Guard against historical duplicates: keep one row per logical event.
  const deduped = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = [
      row.proposalId,
      row.stage,
      row.actorRole,
      row.decision,
      row.comment ?? "",
    ].join("|");
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, row);
      continue;
    }

    const existingUnread = existing.readAt == null;
    const rowUnread = row.readAt == null;
    if (rowUnread && !existingUnread) {
      deduped.set(key, row);
      continue;
    }
    if (row.createdAt > existing.createdAt) {
      deduped.set(key, row);
    }
  }

  const uniqueRows = Array.from(deduped.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const unreadCount = await prisma.presidentNotification.count({
    where: {
      recipientEmail: authz.email,
      deletedAt: null,
      readAt: null,
    },
  });

  return NextResponse.json({
    notifications: uniqueRows.map(
      (row): NotificationItem => ({
        id: row.id,
        proposalId: row.proposalId,
        eventTitle: row.eventTitle,
        stage: row.stage,
        decision: row.decision,
        role: row.actorRole,
        comment: row.comment,
        timestamp: row.createdAt.toISOString(),
        readAt: row.readAt ? row.readAt.toISOString() : null,
      }),
    ),
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const authz = await requirePresident(request);
  if ("error" in authz) {
    return NextResponse.json({ message: authz.error }, { status: authz.status });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action !== "markAllRead") {
    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  }

  await prisma.presidentNotification.updateMany({
    where: {
      recipientEmail: authz.email,
      deletedAt: null,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ message: "Notifications marked as read" });
}

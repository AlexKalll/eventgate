import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Audience = "vp" | "secretary" | "student-union" | "director";
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

function isAudience(value: string): value is Audience {
  return (
    value === "vp" ||
    value === "secretary" ||
    value === "student-union" ||
    value === "director"
  );
}

async function requireAudienceMember(request: Request, audience: Audience) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!user?.email) return { error: "Unauthorized", status: 401 as const };
  if (!user.emailVerified)
    return { error: "Email verification required", status: 403 as const };

  const email = user.email.toLowerCase();

  if (audience === "vp" || audience === "secretary") {
    const role = audience === "vp" ? "VP" : "SECRETARY";
    const grant = await prisma.clubRoleGrant.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        role,
      },
      select: { id: true },
    });
    if (!grant) {
      return {
        error: `Only ${role} users can view notifications`,
        status: 403 as const,
      };
    }
    return { email };
  }

  const role = audience === "student-union" ? "STUDENT_UNION" : "DIRECTOR";
  const grant = await prisma.systemRoleGrant.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      role,
    },
    select: { id: true },
  });
  if (!grant) {
    return {
      error: `Only ${role} users can view notifications`,
      status: 403 as const,
    };
  }

  return { email };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ audience: string }> },
) {
  const { audience: rawAudience } = await params;
  if (!isAudience(rawAudience)) {
    return NextResponse.json({ message: "Invalid audience" }, { status: 400 });
  }

  const authz = await requireAudienceMember(request, rawAudience);
  if ("error" in authz) {
    return NextResponse.json({ message: authz.error }, { status: authz.status });
  }

  const url = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit") || 30)),
  );
  const tab = String(url.searchParams.get("tab") || "all").toLowerCase();

  let whereByTab: Prisma.PresidentNotificationWhereInput = {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ audience: string }> },
) {
  const { audience: rawAudience } = await params;
  if (!isAudience(rawAudience)) {
    return NextResponse.json({ message: "Invalid audience" }, { status: 400 });
  }

  const authz = await requireAudienceMember(request, rawAudience);
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

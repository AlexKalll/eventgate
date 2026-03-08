import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requirePresidentEmail(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!user?.email) return { error: "Unauthorized", status: 401 as const };
  if (!user.emailVerified)
    return { error: "Email verification required", status: 403 as const };

  const email = user.email.toLowerCase();
  const grant = await prisma.clubRoleGrant.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      role: "PRESIDENT",
    },
    select: { id: true },
  });

  if (!grant) {
    return {
      error: "Only club presidents can manage notifications",
      status: 403 as const,
    };
  }

  return { email };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePresidentEmail(request);
  if ("error" in authz) {
    return NextResponse.json({ message: authz.error }, { status: authz.status });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "markRead");

  let data: Record<string, unknown>;
  if (action === "archive") {
    data = { deletedAt: new Date() };
  } else if (action === "unarchive") {
    data = { deletedAt: null };
  } else {
    data = { readAt: new Date() };
  }

  const updated = await prisma.presidentNotification.updateMany({
    where: {
      id,
      recipientEmail: authz.email,
    },
    data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ message: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Notification updated" });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePresidentEmail(request);
  if ("error" in authz) {
    return NextResponse.json({ message: authz.error }, { status: authz.status });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  const updated = await prisma.presidentNotification.updateMany({
    where: {
      id,
      recipientEmail: authz.email,
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json({ message: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Notification deleted" });
}

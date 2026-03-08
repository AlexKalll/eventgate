import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Audience = "vp" | "secretary" | "student-union" | "director";

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
        error: `Only ${role} users can manage notifications`,
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
      error: `Only ${role} users can manage notifications`,
      status: 403 as const,
    };
  }

  return { email };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ audience: string; id: string }> },
) {
  const { audience: rawAudience, id } = await params;
  if (!isAudience(rawAudience)) {
    return NextResponse.json({ message: "Invalid audience" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  const authz = await requireAudienceMember(request, rawAudience);
  if ("error" in authz) {
    return NextResponse.json({ message: authz.error }, { status: authz.status });
  }

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
    return NextResponse.json(
      { message: "Notification not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ message: "Notification updated" });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ audience: string; id: string }> },
) {
  const { audience: rawAudience, id } = await params;
  if (!isAudience(rawAudience)) {
    return NextResponse.json({ message: "Invalid audience" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  const authz = await requireAudienceMember(request, rawAudience);
  if ("error" in authz) {
    return NextResponse.json({ message: authz.error }, { status: authz.status });
  }

  const updated = await prisma.presidentNotification.updateMany({
    where: {
      id,
      recipientEmail: authz.email,
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { message: "Notification not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ message: "Notification deleted" });
}


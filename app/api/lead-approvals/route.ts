import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendProposalStatusEmail } from "@/lib/email";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { message: "Email verification required" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { proposalId, approved, comments, leadRole } = body;

    if (!proposalId || typeof approved !== "boolean" || !leadRole) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify that the leadRole is valid (VP or SECRETARY only)
    const validRoles = ["VP", "SECRETARY"];
    if (!validRoles.includes(leadRole)) {
      console.error("[lead-approvals] Invalid leadRole:", leadRole);
      return NextResponse.json(
        { message: `Invalid lead role: ${leadRole}. Must be VP or SECRETARY` },
        { status: 400 },
      );
    }

    // Debug: Log the incoming request details
    console.log("[lead-approvals] Processing approval request:", {
      userEmail: user.email.toLowerCase(),
      proposalId,
      leadRole,
      approved,
    });

    // Verify that the user has the correct role for this proposal
    // The leadRole in the request must match the user's actual role in the club
    const userRoleGrants = await prisma.clubRoleGrant.findMany({
      where: {
        email: user.email.toLowerCase(),
      },
      select: {
        role: true,
        clubId: true,
      },
    });

    // Find the user's role for this specific club
    const userRoleForClub = userRoleGrants.find(
      (grant) => grant.role === leadRole,
    );

    if (!userRoleForClub) {
      return NextResponse.json(
        { message: `You do not have the role of ${leadRole} in any club` },
        { status: 403 },
      );
    }

    // Check if user is authorized to approve this proposal
    const leadGrant = await prisma.clubRoleGrant.findFirst({
      where: {
        email: user.email.toLowerCase(),
        role: leadRole,
      },
      include: {
        club: true,
      },
    });

    if (!leadGrant) {
      return NextResponse.json(
        { message: "You are not authorized to approve this proposal" },
        { status: 403 },
      );
    }

    // Update or create lead approval
    const leadApproval = await prisma.proposalLeadApproval.upsert({
      where: {
        proposalId_leadRole: {
          proposalId,
          leadRole,
        },
      },
      update: {
        approved,
        comments,
        leadEmail: user.email.toLowerCase(),
      },
      create: {
        proposalId,
        leadRole,
        leadEmail: user.email.toLowerCase(),
        approved,
        comments,
      },
    });

    // Debug: Log the result of the upsert
    console.log("[lead-approvals] Upsert result:", {
      id: leadApproval.id,
      proposalId: leadApproval.proposalId,
      leadRole: leadApproval.leadRole,
      leadEmail: leadApproval.leadEmail,
      approved: leadApproval.approved,
    });

    // Check if all leads have approved
    const allApprovals = await prisma.proposalLeadApproval.findMany({
      where: { proposalId },
    });

    // Get the proposal's club so we know how many leads are expected
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { clubId: true },
    });

    const expectedLeadsCount = proposal
      ? await prisma.clubRoleGrant.count({
          where: {
            clubId: proposal.clubId,
            role: { in: ["VP", "SECRETARY"] },
          },
        })
      : 2;

    const allApproved = allApprovals.every((approval) => approval.approved);
    const anyRejected = allApprovals.some(
      (approval) => !approval.approved && approval.comments,
    );

    // Update proposal status based on lead approvals
    let newStatus:
      | "LEAD_REVIEW"
      | "LEAD_APPROVED"
      | "LEAD_REJECTED"
      | "PENDING"
      | "SU_APPROVED"
      | "SU_REJECTED"
      | "DIRECTOR_APPROVED"
      | "DIRECTOR_REJECTED"
      | "RESUBMISSION_REQUIRED";
    if (anyRejected) {
      newStatus = "LEAD_REJECTED";
    } else if (allApproved && allApprovals.length >= expectedLeadsCount) {
      newStatus = "PENDING"; // Move to Student Union review
    } else {
      newStatus = "LEAD_REVIEW"; // Still waiting for other leads
    }

    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: newStatus },
    });

    const proposalForNotification = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        submittedBy: true,
        event: { select: { title: true } },
      },
    });

    if (proposalForNotification?.submittedBy) {
      await prisma.presidentNotification.create({
        data: {
          recipientEmail: proposalForNotification.submittedBy.toLowerCase(),
          proposalId,
          eventTitle: proposalForNotification.event?.title || "Untitled Event",
          stage: "LEAD",
          decision: approved ? "APPROVED" : "REJECTED",
          actorRole: leadRole,
          comment: String(comments || "").trim() || null,
        },
      });
    }

    if (newStatus === "LEAD_REJECTED") {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          submittedBy: true,
          event: { select: { title: true } },
        },
      });

      const rejecting = allApprovals
        .filter((a) => !a.approved && a.comments)
        .map((a) => `(${a.leadRole}) ${a.comments}`)
        .join("\n");

      if (proposal?.submittedBy) {
        await sendProposalStatusEmail({
          to: proposal.submittedBy,
          proposalId,
          eventTitle: proposal.event?.title || "Untitled Event",
          subject: "EventGate: Proposal needs changes (Lead review)",
          heading: "Proposal needs changes (Lead review)",
          message:
            "Your proposal was rejected during lead review. Please review the comments below, fix the issues, and resubmit.\n\n" +
            rejecting,
          actionLabel: "Open Proposal",
          actionPath: `/proposals/${proposalId}/edit`,
        });
      }
    }

    // When all leads approve → notify Student Union members
    if (newStatus === "PENDING") {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          event: { select: { title: true } },
        },
      });

      const suGrants = await prisma.systemRoleGrant.findMany({
        where: { role: "STUDENT_UNION" },
        select: { email: true },
      });

      if (suGrants.length > 0) {
        const eventTitle = proposal?.event?.title || "Untitled Event";
        await Promise.all(
          suGrants.map(async (grant) => {
            const recipientEmail = grant.email.toLowerCase();
            const comment = "Proposal is now awaiting Student Union review.";
            const existing = await prisma.presidentNotification.findFirst({
              where: {
                recipientEmail,
                proposalId,
                stage: "STUDENT_UNION",
                decision: "APPROVED",
                actorRole: "SYSTEM",
                comment,
                deletedAt: null,
              },
              select: { id: true },
            });
            if (!existing) {
              await prisma.presidentNotification.create({
                data: {
                  recipientEmail,
                  proposalId,
                  eventTitle,
                  stage: "STUDENT_UNION",
                  decision: "APPROVED",
                  actorRole: "SYSTEM",
                  comment,
                },
              });
            }
          }),
        );

        await Promise.all(
          suGrants.map((grant) =>
            sendProposalStatusEmail({
              to: grant.email,
              proposalId,
              eventTitle,
              subject: "EventGate: Proposal awaiting Student Union review",
              heading: "Proposal Ready for Review",
              message:
                "A proposal has been approved by the club leads and is now awaiting Student Union review.",
              actionLabel: "Review Proposal",
              actionPath: "/student-union",
            }),
          ),
        );
      }
    }

    return NextResponse.json({
      message: `Proposal ${approved ? "approved" : "rejected"} by ${leadRole}`,
      leadApproval,
      newStatus,
      allApprovals: allApprovals.map((a) => ({
        id: a.id,
        leadRole: a.leadRole,
        leadEmail: a.leadEmail,
        approved: a.approved,
      })),
    });
  } catch (error) {
    console.error("Lead approval error:", error);
    return NextResponse.json(
      { message: "Failed to process approval" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;

  if (!user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { message: "Email verification required" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const proposalId = searchParams.get("proposalId");

    if (proposalId) {
      // Get lead approvals for a specific proposal
      const approvals = await prisma.proposalLeadApproval.findMany({
        where: { proposalId },
        include: {
          proposal: {
            include: {
              event: {
                select: {
                  title: true,
                  description: true,
                  location: true,
                  startTime: true,
                  endTime: true,
                },
              },
              collaborators: true,
              guests: true,
              club: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json({ approvals });
    } else {
      // Get all proposals that need this user's review
      const userRoleGrants = await prisma.clubRoleGrant.findMany({
        where: {
          email: user.email.toLowerCase(),
          role: {
            in: ["VP", "SECRETARY"],
          },
        },
        select: {
          role: true,
          clubId: true,
        },
      });

      if (userRoleGrants.length === 0) {
        return NextResponse.json({ approvals: [] });
      }

      // Get all proposals for the user's clubs
      const proposals = await prisma.proposal.findMany({
        where: {
          clubId: {
            in: userRoleGrants.map((g) => g.clubId),
          },
          status: {
            in: ["LEAD_REVIEW", "LEAD_APPROVED", "LEAD_REJECTED"],
          },
        },
        include: {
          event: {
            select: {
              title: true,
              description: true,
              location: true,
              startTime: true,
              endTime: true,
            },
          },
          collaborators: true,
          guests: true,
          club: {
            select: {
              name: true,
            },
          },
          leadApprovals: {
            orderBy: {
              leadRole: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return NextResponse.json({ approvals: proposals });
    }
  } catch (error) {
    console.error("Get lead approvals error:", error);
    return NextResponse.json(
      { message: "Failed to fetch approvals" },
      { status: 500 },
    );
  }
}

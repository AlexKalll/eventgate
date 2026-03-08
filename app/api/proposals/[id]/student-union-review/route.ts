import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendProposalStatusEmail } from "@/lib/email";

export async function POST(
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

  // Check if user is Student Union member
  const suGrant = await prisma.systemRoleGrant.findFirst({
    where: {
      email: user.email.toLowerCase(),
      role: "STUDENT_UNION",
    },
  });

  if (!suGrant) {
    return NextResponse.json(
      { message: "Only Student Union members can review proposals" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { suRecommendation, suComments } = body;

    if (!suRecommendation) {
      return NextResponse.json(
        {
          message: "Recommendation is required",
        },
        { status: 400 }
      );
    }

    const normalizedRecommendation = String(suRecommendation);
    const suApproved = normalizedRecommendation === "Recommended";
    const normalizedComments = String(suComments ?? "").trim();

    if (!suApproved && !normalizedComments) {
      return NextResponse.json(
        {
          message: "Rejection must include comments explaining the reason",
        },
        { status: 400 },
      );
    }

    const updatedProposal = await prisma.$transaction(async (tx) => {
      await tx.proposalReview.upsert({
        where: {
          proposalId_reviewerRole: {
            proposalId,
            reviewerRole: "STUDENT_UNION",
          },
        },
        create: {
          proposalId,
          reviewerRole: "STUDENT_UNION",
          reviewerEmail: user.email.toLowerCase(),
          recommendation: normalizedRecommendation,
          comments: normalizedComments,
          approved: suApproved,
        },
        update: {
          reviewerEmail: user.email.toLowerCase(),
          recommendation: normalizedRecommendation,
          comments: normalizedComments,
          approved: suApproved,
        },
      });

      return tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: suApproved ? "SU_APPROVED" : "SU_REJECTED",
        },
      });
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
          stage: "STUDENT_UNION",
          decision: suApproved ? "APPROVED" : "REJECTED",
          actorRole: "STUDENT_UNION",
          comment: normalizedComments || null,
        },
      });
    }

    if (!suApproved) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          submittedBy: true,
          event: { select: { title: true } },
        },
      });

      if (proposal?.submittedBy) {
        await sendProposalStatusEmail({
          to: proposal.submittedBy,
          proposalId,
          eventTitle: proposal.event?.title || "Untitled Event",
          subject: "EventGate: Proposal rejected by Student Union",
          heading: "Proposal rejected by Student Union",
          message:
            "Your proposal was rejected by the Student Union. Please review the comment below, fix the issues, and resubmit.\n\n" +
            normalizedComments,
          actionLabel: "Fix & Resubmit",
          actionPath: `/proposals/${proposalId}/edit`,
        });
      }
    }

    // When SU approves → notify Director(s)
    if (suApproved) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        select: {
          id: true,
          event: { select: { title: true } },
        },
      });

      const directorGrants = await prisma.systemRoleGrant.findMany({
        where: { role: "DIRECTOR" },
        select: { email: true },
      });

      if (directorGrants.length > 0) {
        const eventTitle = proposal?.event?.title || "Untitled Event";
        await Promise.all(
          directorGrants.map(async (grant) => {
            const recipientEmail = grant.email.toLowerCase();
            const comment = "Proposal approved by Student Union and awaiting your review.";
            const existing = await prisma.presidentNotification.findFirst({
              where: {
                recipientEmail,
                proposalId,
                stage: "DIRECTOR",
                decision: "APPROVED",
                actorRole: "STUDENT_UNION",
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
                  stage: "DIRECTOR",
                  decision: "APPROVED",
                  actorRole: "STUDENT_UNION",
                  comment,
                },
              });
            }
          }),
        );

        await Promise.all(
          directorGrants.map((grant) =>
            sendProposalStatusEmail({
              to: grant.email,
              proposalId,
              eventTitle,
              subject: "EventGate: Proposal awaiting Director review",
              heading: "Proposal Ready for Director Review",
              message:
                "A proposal has been approved by the Student Union and is now awaiting your review.",
              actionLabel: "Review Proposal",
              actionPath: "/director",
            }),
          ),
        );
      }
    }

    return NextResponse.json({
      message: `Proposal ${
        suApproved ? "approved" : "rejected"
      } by Student Union`,
      proposal: updatedProposal,
    });
  } catch (error) {
    console.error("Student Union review error:", error);
    const detail = error instanceof Error ? error.message : undefined;
    return NextResponse.json(
      {
        message: detail || "Failed to review proposal",
      },
      { status: 500 }
    );
  }
}

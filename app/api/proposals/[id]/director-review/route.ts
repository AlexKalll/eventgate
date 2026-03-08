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

  // Check if user is Director
  const directorGrant = await prisma.systemRoleGrant.findFirst({
    where: {
      email: user.email.toLowerCase(),
      role: "DIRECTOR",
    },
  });

  if (!directorGrant) {
    return NextResponse.json(
      { message: "Only Directors can review proposals" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { directorApproval, directorComments } = body;

    if (
      directorApproval === undefined ||
      directorApproval === null ||
      (directorApproval === "Rejected" && !directorComments)
    ) {
      return NextResponse.json(
        {
          message: "Rejection must include comments explaining the reason",
        },
        { status: 400 }
      );
    }

    const normalizedDecision = String(directorApproval);
    const directorApproved = normalizedDecision === "Approved";

    // Update proposal with Director review
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: directorApproved ? "DIRECTOR_APPROVED" : "DIRECTOR_REJECTED",
        reviews: {
          upsert: {
            where: {
              proposalId_reviewerRole: {
                proposalId,
                reviewerRole: "DIRECTOR",
              },
            },
            create: {
              reviewerRole: "DIRECTOR",
              reviewerEmail: user.email.toLowerCase(),
              recommendation: directorApproved
                ? "Recommended"
                : "Not Recommended",
              comments: directorComments,
              approved: directorApproved,
            },
            update: {
              reviewerEmail: user.email.toLowerCase(),
              recommendation: directorApproved
                ? "Recommended"
                : "Not Recommended",
              comments: directorComments,
              approved: directorApproved,
            },
          },
        },
      },
    });

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        submittedBy: true,
        event: { select: { title: true } },
        contacts: {
          where: { role: "PRESIDENT" },
          select: { email: true },
        },
      },
    });

    const presidentEmail =
      proposal?.contacts?.[0]?.email || proposal?.submittedBy || null;
    const eventTitle = proposal?.event?.title || "Untitled Event";

    console.info("[director-review] decision", {
      proposalId,
      directorApproved,
      presidentEmail,
    });

    if (presidentEmail) {
      await prisma.presidentNotification.create({
        data: {
          recipientEmail: presidentEmail.toLowerCase(),
          proposalId,
          eventTitle,
          stage: "DIRECTOR",
          decision: directorApproved ? "APPROVED" : "REJECTED",
          actorRole: "DIRECTOR",
          comment: String(directorComments || "").trim() || null,
        },
      });
    }

    if (presidentEmail) {
      if (directorApproved) {
        console.info("[director-review] sending approval email", {
          to: presidentEmail,
          proposalId,
          subject: "EventGate: Proposal approved by Director",
        });
        await sendProposalStatusEmail({
          to: presidentEmail,
          proposalId,
          eventTitle,
          subject: "EventGate: Proposal approved by Director",
          heading: "Congratulations — Director Approved",
          message:
            "Your event proposal has been approved by the Director. You may proceed with the next steps.",
          actionLabel: "View Proposal",
          actionPath: "/proposals",
        });
      } else {
        console.info("[director-review] sending rejection email", {
          to: presidentEmail,
          proposalId,
          subject: "EventGate: Proposal rejected by Director",
        });
        await sendProposalStatusEmail({
          to: presidentEmail,
          proposalId,
          eventTitle,
          subject: "EventGate: Proposal rejected by Director",
          heading: "Proposal rejected by Director",
          message:
            "Your proposal was rejected by the Director. Please review the reason below, fix the issues, and resubmit (it will go back to Student Union review).\n\n" +
            String(directorComments),
          actionLabel: "Fix & Resubmit",
          actionPath: `/proposals/${proposalId}/edit`,
        });
      }
    }

    // TODO: If approved, send guest ID request email

    return NextResponse.json({
      message: `Proposal ${
        directorApproved ? "approved" : "rejected"
      } by Director`,
      proposal: updatedProposal,
    });
  } catch (error) {
    console.error("Director review error:", error);
    return NextResponse.json(
      {
        message: "Failed to review proposal",
      },
      { status: 500 }
    );
  }
}

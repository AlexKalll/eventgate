import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ProposalStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AcademicYearRange = {
  label: string;
  start: Date;
  endExclusive: Date;
};

type ClubMetric = {
  clubId: string;
  clubName: string;
  totalProposals: number;
  approved: number;
  rejected: number;
  pending: number;
  events: Array<{
    proposalId: string;
    title: string;
    description: string;
    status: ProposalStatus;
    createdAt: Date;
    location: string;
    startTime: Date;
    endTime: Date;
  }>;
  leadership: {
    president: string | null;
    vicePresident: string | null;
    secretary: string | null;
  };
};

const REJECTED_STATUSES: ProposalStatus[] = [
  "LEAD_REJECTED",
  "SU_REJECTED",
  "DIRECTOR_REJECTED",
];

function getAcademicYearFromDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startYear = month >= 8 ? year : year - 1; // Sep = 8
  return `${startYear}-${startYear + 1}`;
}

function academicYearToRange(label: string): AcademicYearRange | null {
  const match = /^(\d{4})-(\d{4})$/.exec(label);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || endYear !== startYear + 1) return null;

  return {
    label,
    start: new Date(Date.UTC(startYear, 8, 1, 0, 0, 0, 0)),
    endExclusive: new Date(Date.UTC(endYear, 8, 1, 0, 0, 0, 0)),
  };
}

function buildAcademicYearOptions(minDate: Date | null, maxDate: Date | null) {
  if (!minDate || !maxDate) {
    const now = new Date();
    const current = getAcademicYearFromDate(now);
    const prevStart = Number(current.slice(0, 4)) - 1;
    return [current, `${prevStart}-${prevStart + 1}`];
  }

  const minStartYear =
    minDate.getUTCMonth() >= 8 ? minDate.getUTCFullYear() : minDate.getUTCFullYear() - 1;
  const maxStartYear =
    maxDate.getUTCMonth() >= 8 ? maxDate.getUTCFullYear() : maxDate.getUTCFullYear() - 1;

  const options: string[] = [];
  for (let y = maxStartYear; y >= minStartYear; y--) {
    options.push(`${y}-${y + 1}`);
  }
  return options;
}

function mapStatusBucket(status: ProposalStatus) {
  if (status === "DIRECTOR_APPROVED") return "approved" as const;
  if (REJECTED_STATUSES.includes(status)) return "rejected" as const;
  return "pending" as const;
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

  const grant = await prisma.systemRoleGrant.findUnique({
    where: {
      email_role: {
        email: user.email.toLowerCase(),
        role: "DIRECTOR",
      },
    },
    select: { id: true },
  });

  if (!grant) {
    return NextResponse.json(
      { message: "Only directors can access analytics" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const selectedYear = String(url.searchParams.get("academicYear") || "").trim();
  const q = String(url.searchParams.get("q") || "").trim();

  const [minMax, proposalDates] = await Promise.all([
    prisma.proposal.aggregate({
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.proposal.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
  ]);

  const academicYears = buildAcademicYearOptions(
    minMax._min.createdAt ?? null,
    minMax._max.createdAt ?? null,
  );
  const defaultYear =
    selectedYear && academicYears.includes(selectedYear)
      ? selectedYear
      : academicYears[0] || getAcademicYearFromDate(proposalDates[0]?.createdAt || new Date());

  const yearRange = academicYearToRange(defaultYear);
  if (!yearRange) {
    return NextResponse.json({ message: "Invalid academic year" }, { status: 400 });
  }

  const proposals = await prisma.proposal.findMany({
    where: {
      createdAt: {
        gte: yearRange.start,
        lt: yearRange.endExclusive,
      },
      ...(q
        ? {
            OR: [
              {
                club: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
              {
                event: {
                  title: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      clubId: true,
      club: { select: { name: true } },
      event: {
        select: {
          title: true,
          description: true,
          location: true,
          startTime: true,
          endTime: true,
        },
      },
      contacts: {
        select: {
          role: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const clubMap = new Map<
    string,
    ClubMetric & {
      _leadershipUpdatedAt: {
        president: Date | null;
        vicePresident: Date | null;
        secretary: Date | null;
      };
    }
  >();

  let totalProposals = 0;
  let approvedEvents = 0;
  let totalRejections = 0;

  for (const proposal of proposals) {
    totalProposals += 1;
    const bucket = mapStatusBucket(proposal.status);
    if (bucket === "approved") approvedEvents += 1;
    if (bucket === "rejected") totalRejections += 1;

    const existing = clubMap.get(proposal.clubId) ?? {
      clubId: proposal.clubId,
      clubName: proposal.club.name,
      totalProposals: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      events: [],
      leadership: {
        president: null,
        vicePresident: null,
        secretary: null,
      },
      _leadershipUpdatedAt: {
        president: null,
        vicePresident: null,
        secretary: null,
      },
    };

    existing.totalProposals += 1;
    if (bucket === "approved") existing.approved += 1;
    else if (bucket === "rejected") existing.rejected += 1;
    else existing.pending += 1;

    if (proposal.event) {
      existing.events.push({
        proposalId: proposal.id,
        title: proposal.event.title,
        description: String(proposal.event.description || ""),
        status: proposal.status,
        createdAt: proposal.createdAt,
        location: proposal.event.location,
        startTime: proposal.event.startTime,
        endTime: proposal.event.endTime,
      });
    }

    for (const contact of proposal.contacts) {
      const name = String(contact.name || "").trim();
      if (!name) continue;
      if (
        contact.role === "PRESIDENT" &&
        (!existing._leadershipUpdatedAt.president ||
          proposal.createdAt > existing._leadershipUpdatedAt.president)
      ) {
        existing.leadership.president = name;
        existing._leadershipUpdatedAt.president = proposal.createdAt;
      } else if (
        contact.role === "VICE_PRESIDENT" &&
        (!existing._leadershipUpdatedAt.vicePresident ||
          proposal.createdAt > existing._leadershipUpdatedAt.vicePresident)
      ) {
        existing.leadership.vicePresident = name;
        existing._leadershipUpdatedAt.vicePresident = proposal.createdAt;
      } else if (
        contact.role === "SECRETARY" &&
        (!existing._leadershipUpdatedAt.secretary ||
          proposal.createdAt > existing._leadershipUpdatedAt.secretary)
      ) {
        existing.leadership.secretary = name;
        existing._leadershipUpdatedAt.secretary = proposal.createdAt;
      }
    }

    clubMap.set(proposal.clubId, existing);
  }

  const clubs = Array.from(clubMap.values())
    .map((club) => ({
      clubId: club.clubId,
      clubName: club.clubName,
      totalProposals: club.totalProposals,
      approved: club.approved,
      rejected: club.rejected,
      pending: club.pending,
      events: club.events.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
      leadership: club.leadership,
    }))
    .sort((a, b) => b.totalProposals - a.totalProposals);

  return NextResponse.json({
    academicYear: defaultYear,
    academicYears,
    totals: {
      totalProposals,
      approvedEvents,
      totalRejections,
      totalPending: Math.max(0, totalProposals - approvedEvents - totalRejections),
    },
    clubs,
  });
}

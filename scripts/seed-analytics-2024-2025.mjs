import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ACADEMIC_YEAR = "2024-2025";
const SEED_EMAIL = "analytics-seed@eventgate.local";

const yearStart = new Date(Date.UTC(2024, 8, 1, 0, 0, 0, 0)); // Sep 1, 2024
const yearEndExclusive = new Date(Date.UTC(2025, 8, 1, 0, 0, 0, 0)); // Sep 1, 2025

const testProposals = [
  {
    title: "[Analytics Seed] Robotics Orientation",
    status: "DIRECTOR_APPROVED",
    createdAt: new Date(Date.UTC(2024, 8, 10, 9, 0, 0, 0)),
  },
  {
    title: "[Analytics Seed] Embedded Systems Workshop",
    status: "DIRECTOR_APPROVED",
    createdAt: new Date(Date.UTC(2024, 10, 18, 12, 0, 0, 0)),
  },
  {
    title: "[Analytics Seed] Tech Ethics Debate",
    status: "SU_APPROVED",
    createdAt: new Date(Date.UTC(2024, 11, 5, 8, 30, 0, 0)),
  },
  {
    title: "[Analytics Seed] National Innovation Expo",
    status: "LEAD_APPROVED",
    createdAt: new Date(Date.UTC(2025, 0, 20, 7, 15, 0, 0)),
  },
  {
    title: "[Analytics Seed] Community STEM Day",
    status: "SU_REJECTED",
    createdAt: new Date(Date.UTC(2025, 1, 14, 10, 45, 0, 0)),
  },
  {
    title: "[Analytics Seed] AI Career Week",
    status: "DIRECTOR_REJECTED",
    createdAt: new Date(Date.UTC(2025, 2, 8, 11, 0, 0, 0)),
  },
  {
    title: "[Analytics Seed] Women in Engineering Forum",
    status: "LEAD_REJECTED",
    createdAt: new Date(Date.UTC(2025, 4, 2, 13, 20, 0, 0)),
  },
  {
    title: "[Analytics Seed] Summer Coding Bootcamp",
    status: "PENDING",
    createdAt: new Date(Date.UTC(2025, 6, 6, 9, 10, 0, 0)),
  },
];

async function main() {
  const club = await prisma.club.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (!club) {
    throw new Error(
      "No club found. Create at least one club first, then run this seed.",
    );
  }

  // Idempotent cleanup for this seed data and academic year.
  await prisma.proposal.deleteMany({
    where: {
      submittedBy: SEED_EMAIL,
      createdAt: {
        gte: yearStart,
        lt: yearEndExclusive,
      },
    },
  });

  for (const item of testProposals) {
    const startTime = new Date(item.createdAt.getTime() + 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    await prisma.proposal.create({
      data: {
        clubId: club.id,
        submittedBy: SEED_EMAIL,
        status: item.status,
        createdAt: item.createdAt,
        event: {
          create: {
            title: item.title,
            description:
              "Seeded proposal for testing academic-year analytics filtering.",
            location: "AAU Main Campus",
            startTime,
            endTime,
          },
        },
        contacts: {
          create: [
            {
              role: "PRESIDENT",
              name: "Seed President 2024-2025",
              email: "seed-president@aau.edu.et",
            },
            {
              role: "VICE_PRESIDENT",
              name: "Seed VP 2024-2025",
              email: "seed-vp@aau.edu.et",
            },
            {
              role: "SECRETARY",
              name: "Seed Secretary 2024-2025",
              email: "seed-secretary@aau.edu.et",
            },
          ],
        },
      },
    });
  }

  console.log(`Seeded ${testProposals.length} proposals for ${ACADEMIC_YEAR}.`);
  console.log(`Club used: ${club.name}`);
  console.log(
    "Expected summary for this seed: total=8, approved=2, rejected=3, pending=3.",
  );
}

try {
  await main();
} catch (error) {
  console.error("Error seeding 2024-2025 analytics data:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}


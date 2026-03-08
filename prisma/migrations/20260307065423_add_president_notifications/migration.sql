-- CreateEnum
CREATE TYPE "NotificationStage" AS ENUM ('LEAD', 'STUDENT_UNION', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "NotificationDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PresidentNotification" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "stage" "NotificationStage" NOT NULL,
    "decision" "NotificationDecision" NOT NULL,
    "actorRole" TEXT NOT NULL,
    "comment" TEXT,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresidentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresidentNotification_recipientEmail_deletedAt_createdAt_idx" ON "PresidentNotification"("recipientEmail", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "PresidentNotification_recipientEmail_deletedAt_readAt_idx" ON "PresidentNotification"("recipientEmail", "deletedAt", "readAt");

-- AddForeignKey
ALTER TABLE "PresidentNotification" ADD CONSTRAINT "PresidentNotification_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

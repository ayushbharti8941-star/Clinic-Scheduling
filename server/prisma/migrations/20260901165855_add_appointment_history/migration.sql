-- CreateEnum
CREATE TYPE "AppointmentHistoryType" AS ENUM ('STATUS_CHANGE', 'SUPPORTING_PROVIDER_ADDED', 'SUPPORTING_PROVIDER_REMOVED', 'CANCELLATION', 'VISIT_NOTE_ADDED');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'CANCELLED';

-- CreateTable
CREATE TABLE "AppointmentHistory" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "type" "AppointmentHistoryType" NOT NULL,
    "oldStatus" "AppointmentStatus",
    "newStatus" "AppointmentStatus",
    "providerId" INTEGER,
    "visitNoteId" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentHistory_appointmentId_createdAt_idx" ON "AppointmentHistory"("appointmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

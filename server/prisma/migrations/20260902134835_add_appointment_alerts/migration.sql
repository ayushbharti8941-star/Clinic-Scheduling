-- DropForeignKey
ALTER TABLE "AppointmentHistory" DROP CONSTRAINT "AppointmentHistory_providerId_fkey";

-- DropForeignKey
ALTER TABLE "AppointmentHistory" DROP CONSTRAINT "AppointmentHistory_visitNoteId_fkey";

-- CreateTable
CREATE TABLE "AppointmentAlert" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentAlert_appointmentId_key" ON "AppointmentAlert"("appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentAlert_dismissedAt_idx" ON "AppointmentAlert"("dismissedAt");

-- AddForeignKey
ALTER TABLE "AppointmentAlert" ADD CONSTRAINT "AppointmentAlert_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AppointmentSupport" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "providerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentSupport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentSupport_appointmentId_providerId_key" ON "AppointmentSupport"("appointmentId", "providerId");

-- AddForeignKey
ALTER TABLE "AppointmentSupport" ADD CONSTRAINT "AppointmentSupport_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSupport" ADD CONSTRAINT "AppointmentSupport_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

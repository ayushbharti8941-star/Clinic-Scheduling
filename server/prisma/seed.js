require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("../lib/prisma");

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const frontDesk = await prisma.user.upsert({
    where: {
      email: "frontdesk@clinic.com",
    },
    update: {},
    create: {
      email: "frontdesk@clinic.com",
      passwordHash,
      role: "FRONT_DESK",
    },
  });

  const providerUser = await prisma.user.upsert({
    where: {
      email: "provider@clinic.com",
    },
    update: {},
    create: {
      email: "provider@clinic.com",
      passwordHash,
      role: "PROVIDER",
    },
  });

  const provider = await prisma.provider.upsert({
    where: {
      userId: providerUser.id,
    },
    update: {},
    create: {
      userId: providerUser.id,
      name: "Dr. Priya Sharma",
    },
  });

  const providerUser2 = await prisma.user.upsert({
    where: {
      email: "provider2@clinic.com",
    },
    update: {},
    create: {
      email: "provider2@clinic.com",
      passwordHash,
      role: "PROVIDER",
    },
  });

  const provider2 = await prisma.provider.upsert({
    where: {
      userId: providerUser2.id,
    },
    update: {},
    create: {
      userId: providerUser2.id,
      name: "Dr. Arjun Mehta",
    },
  });

  let patient = await prisma.patient.findFirst({
    where: { email: "anita@example.com" },
  });

  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        name: "Anita Verma",
        email: "anita@example.com",
        phone: "555-0101",
      },
    });
  }

  const existingBooked = await prisma.appointment.findFirst({
    where: {
      providerId: provider.id,
      status: { not: "AVAILABLE" },
    },
  });

  if (!existingBooked) {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(10, 0, 0, 0);

    const appointment = await prisma.appointment.create({
      data: {
        providerId: provider.id,
        patientId: patient.id,
        startTime,
        duration: 45,
        status: "REQUESTED",
      },
    });

    await prisma.appointmentSupport.create({
      data: {
        appointmentId: appointment.id,
        providerId: provider2.id,
      },
    });
  }

  console.log("Users created:");
  console.log(frontDesk);
  console.log(providerUser);
  console.log(providerUser2);
  console.log("Providers created:");
  console.log(provider);
  console.log(provider2);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
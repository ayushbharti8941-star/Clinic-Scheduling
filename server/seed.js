require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("./lib/prisma");

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

  console.log("Users created:");
  console.log(frontDesk);
  console.log(providerUser);
  console.log("Provider created:");
  console.log(provider);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
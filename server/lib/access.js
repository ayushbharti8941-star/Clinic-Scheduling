const prisma = require("./prisma");

async function getProviderForUser(userId) {
  return prisma.provider.findUnique({
    where: { userId },
  });
}

function isSchedulingProvider(appointment, provider) {
  return Boolean(provider) && appointment.providerId === provider.id;
}

function isSupportingProvider(appointment, provider) {
  if (!provider || !appointment.supportingProviders) {
    return false;
  }

  return appointment.supportingProviders.some(
    (support) => support.providerId === provider.id
  );
}

function canViewAppointment(user, provider, appointment) {
  if (user.role === "FRONT_DESK") {
    return true;
  }

  return (
    isSchedulingProvider(appointment, provider) ||
    isSupportingProvider(appointment, provider)
  );
}

function canManageCareTeam(user, provider, appointment) {
  if (user.role === "FRONT_DESK") {
    return true;
  }

  return isSchedulingProvider(appointment, provider);
}

const appointmentInclude = {
  provider: {
    select: {
      id: true,
      name: true,
    },
  },
  patient: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  supportingProviders: {
    include: {
      provider: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
};

module.exports = {
  getProviderForUser,
  isSchedulingProvider,
  isSupportingProvider,
  canViewAppointment,
  canManageCareTeam,
  appointmentInclude,
};

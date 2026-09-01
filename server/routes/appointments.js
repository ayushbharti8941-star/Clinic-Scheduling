const express = require("express");

const prisma = require("../lib/prisma");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const {
  getProviderForUser,
  canViewAppointment,
  canManageCareTeam,
  appointmentInclude,
} = require("../lib/access");

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const { startTime, duration } = req.body;

      if (!startTime || !duration) {
        return res.status(400).json({
          message: "startTime and duration are required",
        });
      }

      if (duration <= 0) {
        return res.status(400).json({
          message: "Duration must be greater than 0",
        });
      }

      const provider = await prisma.provider.findUnique({
        where: {
          userId: req.user.id,
        },
      });

      if (!provider) {
        return res.status(404).json({
          message: "Provider profile not found",
        });
      }

      const appointment = await prisma.appointment.create({
        data: {
          providerId: provider.id,
          startTime: new Date(startTime),
          duration: Number(duration),
          status: "AVAILABLE",
        },
      });

      return res.status(201).json({
        message: "Appointment slot created",
        appointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);
router.get(
  "/",
  authenticateToken,
  async (req, res) => {
    try {
      const appointments = await prisma.appointment.findMany({
        where: {
          status: "AVAILABLE",
          archived: false,
        },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startTime: "asc",
        },
      });

      return res.json({
        appointments,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);

router.get("/schedule", authenticateToken, async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user.id);

    const where =
      req.user.role === "FRONT_DESK"
        ? { archived: false }
        : {
            archived: false,
            OR: [
              { providerId: provider?.id ?? -1 },
              {
                supportingProviders: {
                  some: {
                    providerId: provider?.id ?? -1,
                  },
                },
              },
            ],
          };

    const appointments = await prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: {
        startTime: "asc",
      },
    });

    return res.json({ appointments });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const appointmentId = Number(req.params.id);

    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({
        message: "Invalid appointment ID",
      });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        ...appointmentInclude,
        visitNotes: {
          orderBy: { createdAt: "asc" },
          include: {
            provider: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found",
      });
    }

    const provider = await getProviderForUser(req.user.id);

    if (!canViewAppointment(req.user, provider, appointment)) {
      return res.status(403).json({
        message: "You can only view appointments on your own schedule",
      });
    }

    return res.json({ appointment });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.put(
  "/:id",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      const { startTime, duration } = req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      if (!startTime && !duration) {
        return res.status(400).json({
          message: "Provide startTime or duration to update",
        });
      }

      if (duration !== undefined && Number(duration) <= 0) {
        return res.status(400).json({
          message: "Duration must be greater than 0",
        });
      }

      const provider = await prisma.provider.findUnique({
        where: {
          userId: req.user.id,
        },
      });

      if (!provider) {
        return res.status(404).json({
          message: "Provider profile not found",
        });
      }

      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          providerId: provider.id,
        },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status !== "AVAILABLE" || appointment.archived) {
        return res.status(400).json({
          message: "Only unbooked, active slots can be edited",
        });
      }

      const updatedAppointment = await prisma.appointment.update({
        where: {
          id: appointmentId,
        },
        data: {
          ...(startTime && {
            startTime: new Date(startTime),
          }),
          ...(duration !== undefined && {
            duration: Number(duration),
          }),
        },
      });

      return res.json({
        message: "Appointment slot updated",
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);
router.post(
  "/:id/request",
  authenticateToken,
  requireRole("FRONT_DESK"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      const { patientId } = req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      if (!patientId) {
        return res.status(400).json({
          message: "patientId is required",
        });
      }

      const appointment = await prisma.appointment.findUnique({
        where: {
          id: appointmentId,
        },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status !== "AVAILABLE" || appointment.archived) {
        return res.status(400).json({
          message: "Only available, active slots can be requested",
        });
      }

      const patient = await prisma.patient.findUnique({
        where: {
          id: Number(patientId),
        },
      });

      if (!patient) {
        return res.status(404).json({
          message: "Patient not found",
        });
      }

      const updatedAppointment = await prisma.appointment.update({
        where: {
          id: appointmentId,
        },
        data: {
          patientId: Number(patientId),
          status: "REQUESTED",
        },
      });

      return res.json({
        message: "Appointment requested",
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);
router.patch(
  "/:id/archive",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const provider = await prisma.provider.findUnique({
        where: {
          userId: req.user.id,
        },
      });

      if (!provider) {
        return res.status(404).json({
          message: "Provider profile not found",
        });
      }

      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          providerId: provider.id,
        },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.archived) {
        return res.status(400).json({
          message: "Appointment is already archived",
        });
      }

      const updatedAppointment = await prisma.appointment.update({
        where: {
          id: appointmentId,
        },
        data: {
          archived: true,
        },
      });

      return res.json({
        message: "Appointment archived",
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);
router.patch(
  "/:id/restore",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const provider = await prisma.provider.findUnique({
        where: {
          userId: req.user.id,
        },
      });

      if (!provider) {
        return res.status(404).json({
          message: "Provider profile not found",
        });
      }

      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          providerId: provider.id,
        },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (!appointment.archived) {
        return res.status(400).json({
          message: "Appointment is not archived",
        });
      }

      const updatedAppointment = await prisma.appointment.update({
        where: {
          id: appointmentId,
        },
        data: {
          archived: false,
        },
      });

      return res.json({
        message: "Appointment restored",
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);
router.patch(
  "/:id/confirm",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const provider = await prisma.provider.findUnique({
        where: {
          userId: req.user.id,
        },
      });

      if (!provider) {
        return res.status(404).json({
          message: "Provider profile not found",
        });
      }

      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          providerId: provider.id,
        },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status !== "REQUESTED") {
        return res.status(400).json({
          message: "Only requested appointments can be confirmed",
        });
      }

      const updatedAppointment = await prisma.appointment.update({
        where: {
          id: appointment.id,
        },
        data: {
          status: "CONFIRMED",
        },
      });

      return res.json({
        message: "Appointment confirmed",
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);
router.patch(
  "/:id/check-in",
  authenticateToken,
  requireRole("FRONT_DESK"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const appointment = await prisma.appointment.findUnique({
        where: {
          id: appointmentId,
        },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status !== "CONFIRMED") {
        return res.status(400).json({
          message: "Only confirmed appointments can be checked in",
        });
      }

      const updatedAppointment = await prisma.appointment.update({
        where: {
          id: appointment.id,
        },
        data: {
          status: "CHECKED_IN",
        },
      });

      return res.json({
        message: "Patient checked in",
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);
router.patch(
  "/:id/complete",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const provider = await prisma.provider.findUnique({
        where: {
          userId: req.user.id,
        },
      });

      if (!provider) {
        return res.status(404).json({
          message: "Provider profile not found",
        });
      }

      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          providerId: provider.id,
        },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.status !== "CHECKED_IN") {
        return res.status(400).json({
          message: "Only checked-in appointments can be completed",
        });
      }

      const updatedAppointment = await prisma.appointment.update({
        where: {
          id: appointment.id,
        },
        data: {
          status: "COMPLETED",
        },
      });

      return res.json({
        message: "Appointment completed",
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);
router.post(
  "/:id/supporting-providers",
  authenticateToken,
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      const { providerId } = req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      if (!providerId) {
        return res.status(400).json({
          message: "providerId is required",
        });
      }

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { supportingProviders: true },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      const actorProvider = await getProviderForUser(req.user.id);

      if (!canManageCareTeam(req.user, actorProvider, appointment)) {
        return res.status(403).json({
          message:
            "Only front-desk staff or the scheduling provider can add supporting providers",
        });
      }

      const supportingProvider = await prisma.provider.findUnique({
        where: { id: Number(providerId) },
      });

      if (!supportingProvider) {
        return res.status(404).json({
          message: "Provider not found",
        });
      }

      if (appointment.providerId === supportingProvider.id) {
        return res.status(400).json({
          message:
            "Scheduling provider cannot be added as a supporting provider",
        });
      }

      const existingSupport = await prisma.appointmentSupport.findUnique({
        where: {
          appointmentId_providerId: {
            appointmentId: appointment.id,
            providerId: supportingProvider.id,
          },
        },
      });

      if (existingSupport) {
        return res.status(400).json({
          message: "Provider is already a supporting provider",
        });
      }

      const support = await prisma.appointmentSupport.create({
        data: {
          appointmentId: appointment.id,
          providerId: supportingProvider.id,
        },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return res.status(201).json({
        message: "Supporting provider added",
        support,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);

router.delete(
  "/:id/supporting-providers/:providerId",
  authenticateToken,
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      const providerId = Number(req.params.providerId);

      if (Number.isNaN(appointmentId) || Number.isNaN(providerId)) {
        return res.status(400).json({
          message: "Invalid appointment or provider ID",
        });
      }

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { supportingProviders: true },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      const actorProvider = await getProviderForUser(req.user.id);

      if (!canManageCareTeam(req.user, actorProvider, appointment)) {
        return res.status(403).json({
          message:
            "Only front-desk staff or the scheduling provider can remove supporting providers",
        });
      }

      const support = await prisma.appointmentSupport.findUnique({
        where: {
          appointmentId_providerId: {
            appointmentId,
            providerId,
          },
        },
      });

      if (!support) {
        return res.status(404).json({
          message: "Supporting provider is not on this appointment",
        });
      }

      await prisma.appointmentSupport.delete({
        where: { id: support.id },
      });

      return res.json({
        message: "Supporting provider removed",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);

module.exports = router;

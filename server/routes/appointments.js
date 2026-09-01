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


// ============================================================
// CREATE APPOINTMENT SLOT
// ============================================================

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


// ============================================================
// AVAILABLE APPOINTMENT SLOTS
// ============================================================

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


// ============================================================
// GOAL 6 — SEARCH APPOINTMENTS
// ============================================================

router.get(
  "/search",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        q,
        patient,
        providerId,
        status,
        from,
        to,
        sort = "date",
        order = "asc",
        page = "1",
        pageSize = "10",
      } = req.query;

      const currentPage = Math.max(Number(page) || 1, 1);
      const currentPageSize = Math.min(
        Math.max(Number(pageSize) || 10, 1),
        100
      );

      const where = {
        archived: false,
      };

      const provider = await getProviderForUser(req.user.id);

      if (req.user.role === "PROVIDER") {
        where.OR = [
          {
            providerId: provider?.id ?? -1,
          },
          {
            supportingProviders: {
              some: {
                providerId: provider?.id ?? -1,
              },
            },
          },
        ];
      }

      const searchText = q || patient;

      if (searchText) {
        where.patient = {
          name: {
            contains: searchText,
            mode: "insensitive",
          },
        };
      }

      if (providerId) {
        where.providerId = Number(providerId);
      }

      if (status) {
        where.status = status;
      }

      if (from || to) {
        where.startTime = {};

        if (from) {
          where.startTime.gte = new Date(`${from}T00:00:00.000Z`);
        }

        if (to) {
          where.startTime.lt = new Date(
            `${to}T00:00:00.000Z`
          );
          where.startTime.lt.setUTCDate(
            where.startTime.lt.getUTCDate() + 1
          );
        }
      }

      let orderBy;

      if (sort === "status") {
        orderBy = {
          status: order === "desc" ? "desc" : "asc",
        };
      } else if (sort === "provider") {
        orderBy = {
          provider: {
            name: order === "desc" ? "desc" : "asc",
          },
        };
      } else {
        orderBy = {
          startTime: order === "desc" ? "desc" : "asc",
        };
      }

      const [appointments, total] = await Promise.all([
        prisma.appointment.findMany({
          where,
          include: appointmentInclude,
          orderBy,
          skip: (currentPage - 1) * currentPageSize,
          take: currentPageSize,
        }),

        prisma.appointment.count({
          where,
        }),
      ]);

      return res.json({
        appointments,
        total,
        page: currentPage,
        pageSize: currentPageSize,
        totalPages: Math.ceil(total / currentPageSize),
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);


// ============================================================
// CARE TEAM SCHEDULE
// ============================================================

router.get(
  "/schedule",
  authenticateToken,
  async (req, res) => {
    try {
      const provider = await getProviderForUser(req.user.id);

      const where =
        req.user.role === "FRONT_DESK"
          ? {
              archived: false,
            }
          : {
              archived: false,
              OR: [
                {
                  providerId: provider?.id ?? -1,
                },
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


// ============================================================
// GOAL 7A — BULK RECURRING AVAILABILITY
// ============================================================

router.post(
  "/bulk-availability",
  authenticateToken,
  requireRole("FRONT_DESK"),
  async (req, res) => {
    try {
      const {
        providerId,
        startDate,
        endDate,
        weeklySlots,
      } = req.body;

      if (
        !providerId ||
        !startDate ||
        !endDate ||
        !weeklySlots
      ) {
        return res.status(400).json({
          message:
            "providerId, startDate, endDate and weeklySlots are required",
        });
      }

      const numericProviderId = Number(providerId);

      if (Number.isNaN(numericProviderId)) {
        return res.status(400).json({
          message: "Invalid providerId",
        });
      }

      const provider = await prisma.provider.findUnique({
        where: {
          id: numericProviderId,
        },
      });

      if (!provider) {
        return res.status(404).json({
          message: "Provider not found",
        });
      }

      const from = new Date(
        `${startDate}T00:00:00.000Z`
      );

      const to = new Date(
        `${endDate}T23:59:59.999Z`
      );

      if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime())
      ) {
        return res.status(400).json({
          message: "Invalid startDate or endDate",
        });
      }

      if (from > to) {
        return res.status(400).json({
          message:
            "startDate must be before or equal to endDate",
        });
      }

      if (
        !Array.isArray(weeklySlots) ||
        weeklySlots.length === 0
      ) {
        return res.status(400).json({
          message:
            "weeklySlots must contain at least one time block",
        });
      }

      // Validate every weekly block.
      for (const slot of weeklySlots) {
        const dayOfWeek = Number(slot.dayOfWeek);
        const duration = Number(slot.duration);

        if (
          slot.dayOfWeek === undefined ||
          !slot.startTime ||
          slot.duration === undefined
        ) {
          return res.status(400).json({
            message:
              "Each weekly slot needs dayOfWeek, startTime and duration",
          });
        }

        if (
          !Number.isInteger(dayOfWeek) ||
          dayOfWeek < 0 ||
          dayOfWeek > 6
        ) {
          return res.status(400).json({
            message:
              "dayOfWeek must be an integer from 0 to 6",
          });
        }

        if (!/^\d{2}:\d{2}$/.test(slot.startTime)) {
          return res.status(400).json({
            message:
              "startTime must use HH:MM format",
          });
        }

        const [hours, minutes] =
          slot.startTime.split(":").map(Number);

        if (
          hours < 0 ||
          hours > 23 ||
          minutes < 0 ||
          minutes > 59
        ) {
          return res.status(400).json({
            message: "Invalid startTime",
          });
        }

        if (
          !Number.isFinite(duration) ||
          duration <= 0
        ) {
          return res.status(400).json({
            message:
              "Duration must be greater than 0",
          });
        }
      }

      const created = [];
      const skipped = [];

      // Generate every matching date in the range.
      for (
        let current = new Date(from);
        current <= to;
        current.setUTCDate(
          current.getUTCDate() + 1
        )
      ) {
        const dayOfWeek = current.getUTCDay();

        const matchingSlots = weeklySlots.filter(
          (slot) =>
            Number(slot.dayOfWeek) === dayOfWeek
        );

        for (const slot of matchingSlots) {
          const [hours, minutes] =
            slot.startTime.split(":").map(Number);

          const startTime = new Date(current);

          startTime.setUTCHours(
            hours,
            minutes,
            0,
            0
          );

          const duration = Number(slot.duration);

          const endTime = new Date(
            startTime.getTime() +
              duration * 60 * 1000
          );

          // Find existing active appointments/slots
          // that could overlap this generated slot.
          const existingAppointments =
            await prisma.appointment.findMany({
              where: {
                providerId: numericProviderId,
                archived: false,
                startTime: {
                  lt: endTime,
                },
              },
            });

          const collision =
            existingAppointments.find(
              (existing) => {
                const existingEnd = new Date(
                  existing.startTime.getTime() +
                    existing.duration * 60 * 1000
                );

                return (
                  existing.startTime < endTime &&
                  existingEnd > startTime
                );
              }
            );

          if (collision) {
            skipped.push({
              startTime: startTime.toISOString(),
              duration,
              reason:
                "Collides with an existing appointment or slot",
              existingAppointmentId: collision.id,
            });

            continue;
          }

          const appointment =
            await prisma.appointment.create({
              data: {
                providerId: numericProviderId,
                startTime,
                duration,
                status: "AVAILABLE",
                archived: false,
              },
            });

          created.push({
            id: appointment.id,
            startTime:
              appointment.startTime,
            duration:
              appointment.duration,
          });
        }
      }

      return res.status(201).json({
        message:
          "Bulk availability generation completed",

        provider: {
          id: provider.id,
          name: provider.name,
        },

        created,

        skipped,

        summary: {
          created: created.length,
          skipped: skipped.length,
          total:
            created.length + skipped.length,
        },
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);


// ============================================================
// GOAL 7B — SINGLE DAY CSV EXPORT
// ============================================================

router.get(
  "/export",
  authenticateToken,
  requireRole("FRONT_DESK"),
  async (req, res) => {
    try {
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          message:
            "date query parameter is required",
        });
      }

      const startOfDay = new Date(
        `${date}T00:00:00.000Z`
      );

      if (Number.isNaN(startOfDay.getTime())) {
        return res.status(400).json({
          message: "Invalid date",
        });
      }

      const startOfNextDay = new Date(startOfDay);

      startOfNextDay.setUTCDate(
        startOfNextDay.getUTCDate() + 1
      );

      const appointments =
        await prisma.appointment.findMany({
          where: {
            startTime: {
              gte: startOfDay,
              lt: startOfNextDay,
            },
            archived: false,
          },

          include: {
            patient: {
              select: {
                name: true,
              },
            },

            provider: {
              select: {
                name: true,
              },
            },

            supportingProviders: {
              include: {
                provider: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },

          orderBy: {
            startTime: "asc",
          },
        });

      function csvEscape(value) {
        const text = String(value ?? "");

        if (
          text.includes(",") ||
          text.includes('"') ||
          text.includes("\n")
        ) {
          return `"${text.replace(
            /"/g,
            '""'
          )}"`;
        }

        return text;
      }

      const rows = [
        [
          "When",
          "Patient",
          "Scheduling Provider",
          "Supporting Providers",
          "Status",
          "Duration",
        ],
      ];

      for (const appointment of appointments) {
        const supportingProviders =
          appointment.supportingProviders
            .map(
              (support) =>
                support.provider.name
            )
            .join("; ");

        rows.push([
          appointment.startTime.toISOString(),
          appointment.patient?.name || "",
          appointment.provider.name,
          supportingProviders,
          appointment.status,
          appointment.duration,
        ]);
      }

      const csv = rows
        .map((row) =>
          row.map(csvEscape).join(",")
        )
        .join("\n");

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="clinic-schedule-${date}.csv"`
      );

      return res.send(csv);
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);


// ============================================================
// APPOINTMENT DETAIL
// ============================================================

router.get(
  "/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      const appointment =
        await prisma.appointment.findUnique({
          where: {
            id: appointmentId,
          },

          include: {
            ...appointmentInclude,

            visitNotes: {
              orderBy: {
                createdAt: "asc",
              },

              include: {
                provider: {
                  select: {
                    id: true,
                    name: true,
                  },
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

      const provider =
        await getProviderForUser(
          req.user.id
        );

      if (
        !canViewAppointment(
          req.user,
          provider,
          appointment
        )
      ) {
        return res.status(403).json({
          message:
            "You can only view appointments on your own schedule",
        });
      }

      return res.json({
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


// ============================================================
// EDIT AVAILABLE SLOT
// ============================================================

router.put(
  "/:id",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      const {
        startTime,
        duration,
      } = req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      if (!startTime && !duration) {
        return res.status(400).json({
          message:
            "Provide startTime or duration to update",
        });
      }

      if (
        duration !== undefined &&
        Number(duration) <= 0
      ) {
        return res.status(400).json({
          message:
            "Duration must be greater than 0",
        });
      }

      const provider =
        await prisma.provider.findUnique({
          where: {
            userId: req.user.id,
          },
        });

      if (!provider) {
        return res.status(404).json({
          message:
            "Provider profile not found",
        });
      }

      const appointment =
        await prisma.appointment.findFirst({
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

      if (
        appointment.status !==
          "AVAILABLE" ||
        appointment.archived
      ) {
        return res.status(400).json({
          message:
            "Only unbooked, active slots can be edited",
        });
      }

      const updatedAppointment =
        await prisma.appointment.update({
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
        message:
          "Appointment slot updated",
        appointment:
          updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


// ============================================================
// REQUEST APPOINTMENT
// ============================================================

router.post(
  "/:id/request",
  authenticateToken,
  requireRole("FRONT_DESK"),
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      const { patientId } = req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      if (!patientId) {
        return res.status(400).json({
          message:
            "patientId is required",
        });
      }

      const appointment =
        await prisma.appointment.findUnique({
          where: {
            id: appointmentId,
          },
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      if (
        appointment.status !==
          "AVAILABLE" ||
        appointment.archived
      ) {
        return res.status(400).json({
          message:
            "Only available, active slots can be requested",
        });
      }

      const patient =
        await prisma.patient.findUnique({
          where: {
            id: Number(patientId),
          },
        });

      if (!patient) {
        return res.status(404).json({
          message:
            "Patient not found",
        });
      }

      const updatedAppointment =
        await prisma.appointment.update({
          where: {
            id: appointmentId,
          },

          data: {
            patientId: Number(
              patientId
            ),
            status: "REQUESTED",
          },
        });

      return res.json({
        message:
          "Appointment requested",
        appointment:
          updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


// ============================================================
// ARCHIVE APPOINTMENT
// ============================================================

router.patch(
  "/:id/archive",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      const provider =
        await prisma.provider.findUnique({
          where: {
            userId: req.user.id,
          },
        });

      if (!provider) {
        return res.status(404).json({
          message:
            "Provider profile not found",
        });
      }

      const appointment =
        await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            providerId: provider.id,
          },
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      if (appointment.archived) {
        return res.status(400).json({
          message:
            "Appointment is already archived",
        });
      }

      const updatedAppointment =
        await prisma.appointment.update({
          where: {
            id: appointmentId,
          },

          data: {
            archived: true,
          },
        });

      return res.json({
        message:
          "Appointment archived",
        appointment:
          updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


// ============================================================
// RESTORE APPOINTMENT
// ============================================================

router.patch(
  "/:id/restore",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      const provider =
        await prisma.provider.findUnique({
          where: {
            userId: req.user.id,
          },
        });

      if (!provider) {
        return res.status(404).json({
          message:
            "Provider profile not found",
        });
      }

      const appointment =
        await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            providerId: provider.id,
          },
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      if (!appointment.archived) {
        return res.status(400).json({
          message:
            "Appointment is not archived",
        });
      }

      const updatedAppointment =
        await prisma.appointment.update({
          where: {
            id: appointmentId,
          },

          data: {
            archived: false,
          },
        });

      return res.json({
        message:
          "Appointment restored",
        appointment:
          updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


// ============================================================
// CONFIRM APPOINTMENT
// ============================================================

router.patch(
  "/:id/confirm",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      const provider =
        await prisma.provider.findUnique({
          where: {
            userId: req.user.id,
          },
        });

      if (!provider) {
        return res.status(404).json({
          message:
            "Provider profile not found",
        });
      }

      const appointment =
        await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            providerId: provider.id,
          },
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      if (
        appointment.status !==
        "REQUESTED"
      ) {
        return res.status(400).json({
          message:
            "Only requested appointments can be confirmed",
        });
      }

      const updatedAppointment =
        await prisma.appointment.update({
          where: {
            id: appointment.id,
          },

          data: {
            status: "CONFIRMED",
          },
        });

      return res.json({
        message:
          "Appointment confirmed",
        appointment:
          updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


// ============================================================
// CHECK IN
// ============================================================

router.patch(
  "/:id/check-in",
  authenticateToken,
  requireRole("FRONT_DESK"),
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      const appointment =
        await prisma.appointment.findUnique({
          where: {
            id: appointmentId,
          },
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      if (
        appointment.status !==
        "CONFIRMED"
      ) {
        return res.status(400).json({
          message:
            "Only confirmed appointments can be checked in",
        });
      }

      const updatedAppointment =
        await prisma.appointment.update({
          where: {
            id: appointment.id,
          },

          data: {
            status: "CHECKED_IN",
          },
        });

      return res.json({
        message:
          "Patient checked in",
        appointment:
          updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


// ============================================================
// COMPLETE APPOINTMENT
// ============================================================

router.patch(
  "/:id/complete",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      const provider =
        await prisma.provider.findUnique({
          where: {
            userId: req.user.id,
          },
        });

      if (!provider) {
        return res.status(404).json({
          message:
            "Provider profile not found",
        });
      }

      const appointment =
        await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            providerId: provider.id,
          },
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      if (
        appointment.status !==
        "CHECKED_IN"
      ) {
        return res.status(400).json({
          message:
            "Only checked-in appointments can be completed",
        });
      }

      const updatedAppointment =
        await prisma.appointment.update({
          where: {
            id: appointment.id,
          },

          data: {
            status: "COMPLETED",
          },
        });

      return res.json({
        message:
          "Appointment completed",
        appointment:
          updatedAppointment,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


// ============================================================
// ADD SUPPORTING PROVIDER
// ============================================================

router.post(
  "/:id/supporting-providers",
  authenticateToken,
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      const { providerId } =
        req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      if (!providerId) {
        return res.status(400).json({
          message:
            "providerId is required",
        });
      }

      const appointment =
        await prisma.appointment.findUnique({
          where: {
            id: appointmentId,
          },

          include: {
            supportingProviders: true,
          },
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      const actorProvider =
        await getProviderForUser(
          req.user.id
        );

      if (
        !canManageCareTeam(
          req.user,
          actorProvider,
          appointment
        )
      ) {
        return res.status(403).json({
          message:
            "Only front-desk staff or the scheduling provider can add supporting providers",
        });
      }

      const supportingProvider =
        await prisma.provider.findUnique({
          where: {
            id: Number(providerId),
          },
        });

      if (!supportingProvider) {
        return res.status(404).json({
          message:
            "Provider not found",
        });
      }

      if (
        appointment.providerId ===
        supportingProvider.id
      ) {
        return res.status(400).json({
          message:
            "Scheduling provider cannot be added as a supporting provider",
        });
      }

      const existingSupport =
        await prisma.appointmentSupport.findUnique(
          {
            where: {
              appointmentId_providerId: {
                appointmentId:
                  appointment.id,
                providerId:
                  supportingProvider.id,
              },
            },
          }
        );

      if (existingSupport) {
        return res.status(400).json({
          message:
            "Provider is already a supporting provider",
        });
      }

      const support =
        await prisma.appointmentSupport.create(
          {
            data: {
              appointmentId:
                appointment.id,

              providerId:
                supportingProvider.id,
            },

            include: {
              provider: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          }
        );

      return res.status(201).json({
        message:
          "Supporting provider added",
        support,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


// ============================================================
// REMOVE SUPPORTING PROVIDER
// ============================================================

router.delete(
  "/:id/supporting-providers/:providerId",
  authenticateToken,
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      const providerId = Number(
        req.params.providerId
      );

      if (
        Number.isNaN(appointmentId) ||
        Number.isNaN(providerId)
      ) {
        return res.status(400).json({
          message:
            "Invalid appointment or provider ID",
        });
      }

      const appointment =
        await prisma.appointment.findUnique({
          where: {
            id: appointmentId,
          },

          include: {
            supportingProviders: true,
          },
        });

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      const actorProvider =
        await getProviderForUser(
          req.user.id
        );

      if (
        !canManageCareTeam(
          req.user,
          actorProvider,
          appointment
        )
      ) {
        return res.status(403).json({
          message:
            "Only front-desk staff or the scheduling provider can remove supporting providers",
        });
      }

      const support =
        await prisma.appointmentSupport.findUnique(
          {
            where: {
              appointmentId_providerId: {
                appointmentId,
                providerId,
              },
            },
          }
        );

      if (!support) {
        return res.status(404).json({
          message:
            "Supporting provider is not on this appointment",
        });
      }

      await prisma.appointmentSupport.delete({
        where: {
          id: support.id,
        },
      });

      return res.json({
        message:
          "Supporting provider removed",
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);


module.exports = router;
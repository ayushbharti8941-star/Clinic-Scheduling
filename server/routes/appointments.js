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
  async (req, res) => {
    try {
      const { startTime, duration, providerId } = req.body;

      if (!startTime || duration === undefined) {
        return res.status(400).json({
          message: "startTime and duration are required",
        });
      }

      if (Number(duration) <= 0) {
        return res.status(400).json({
          message: "Duration must be greater than 0",
        });
      }

      let targetProviderId;
      if (req.user.role === "FRONT_DESK") {
        if (!providerId) {
          return res.status(400).json({
            message: "providerId is required for front-desk staff",
          });
        }
        const numericProviderId = Number(providerId);
        const providerExists = await prisma.provider.findUnique({
          where: { id: numericProviderId },
        });
        if (!providerExists) {
          return res.status(404).json({
            message: "Provider not found",
          });
        }
        targetProviderId = numericProviderId;
      } else if (req.user.role === "PROVIDER") {
        const provider = await getProviderForUser(req.user.id);
        if (!provider) {
          return res.status(404).json({
            message: "Provider profile not found",
          });
        }
        targetProviderId = provider.id;
      } else {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      const slotStart = new Date(startTime);
      if (Number.isNaN(slotStart.getTime())) {
        return res.status(400).json({
          message: "Invalid startTime",
        });
      }
      const slotEnd = new Date(slotStart.getTime() + Number(duration) * 60000);

      // Check for collision with existing appointments for this provider
      const existingAppointments = await prisma.appointment.findMany({
        where: {
          providerId: targetProviderId,
          archived: false,
          status: {
            not: "CANCELLED",
          },
        },
        select: {
          id: true,
          startTime: true,
          duration: true,
        },
      });

      const collides = existingAppointments.some((appt) => {
        const apptStart = new Date(appt.startTime);
        const apptEnd = new Date(apptStart.getTime() + appt.duration * 60000);
        return slotStart < apptEnd && apptStart < slotEnd;
      });

      if (collides) {
        return res.status(400).json({
          message: "Appointment slot collides with an existing booking for this provider",
        });
      }

      const appointment = await prisma.appointment.create({
        data: {
          providerId: targetProviderId,
          startTime: slotStart,
          duration: Number(duration),
          status: "AVAILABLE",
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
          where.startTime.gte = new Date(
            `${from}T00:00:00.000Z`
          );
        }

        if (to) {
          const endDate = new Date(
            `${to}T00:00:00.000Z`
          );

          endDate.setUTCDate(
            endDate.getUTCDate() + 1
          );

          where.startTime.lt = endDate;
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
        totalPages: Math.ceil(
          total / currentPageSize
        ),
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

      const appointments =
        await prisma.appointment.findMany({
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
              startTime:
                startTime.toISOString(),
              duration,
              reason:
                "Collides with an existing appointment or slot",
              existingAppointmentId:
                collision.id,
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
            startTime: appointment.startTime,
            duration: appointment.duration,
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
        await getProviderForUser(req.user.id);

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
// GOAL 9 — APPOINTMENT HISTORY / TIMELINE
// ============================================================

router.get(
  "/:id/history",
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
        });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      const provider =
        await getProviderForUser(req.user.id);

      if (
        !canViewAppointment(
          req.user,
          provider,
          appointment
        )
      ) {
        return res.status(403).json({
          message:
            "You can only view history for appointments on your schedule",
        });
      }

      const rawHistory =
        await prisma.appointmentHistory.findMany({
          where: {
            appointmentId,
          },

          orderBy: {
            createdAt: "asc",
          },

          include: {
            actor: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
        });

      const providerIds = [
        ...new Set(
          rawHistory
            .map((h) => h.providerId)
            .filter(Boolean)
        ),
      ];

      const providers =
        providerIds.length > 0
          ? await prisma.provider.findMany({
              where: {
                id: { in: providerIds },
              },
              select: {
                id: true,
                name: true,
              },
            })
          : [];

      const providerMap = new Map(
        providers.map((p) => [p.id, p])
      );

      const noteIds = [
        ...new Set(
          rawHistory
            .map((h) => h.visitNoteId)
            .filter(Boolean)
        ),
      ];

      const notes =
        noteIds.length > 0
          ? await prisma.visitNote.findMany({
              where: {
                id: { in: noteIds },
              },
              select: {
                id: true,
                content: true,
                provider: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            })
          : [];

      const noteMap = new Map(
        notes.map((n) => [n.id, n])
      );

      const history = rawHistory.map((h) => ({
        ...h,
        provider: h.providerId
          ? providerMap.get(h.providerId) || null
          : null,
        visitNote: h.visitNoteId
          ? noteMap.get(h.visitNoteId) || null
          : null,
      }));

      return res.json({
        appointmentId,
        history,
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

      if (!startTime && duration === undefined) {
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

      let appointment;
      if (req.user.role === "FRONT_DESK") {
        appointment = await prisma.appointment.findUnique({
          where: {
            id: appointmentId,
          },
        });
      } else if (req.user.role === "PROVIDER") {
        const provider = await getProviderForUser(req.user.id);
        if (!provider) {
          return res.status(404).json({
            message: "Provider profile not found",
          });
        }
        appointment = await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            providerId: provider.id,
          },
        });
      } else {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (
        appointment.status !== "AVAILABLE" ||
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
// Goal 10 — CREATE UNCONFIRMED ALERT
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

      const { patientId, name, patientName, email, phone } = req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      let patient;
      if (patientId) {
        patient = await prisma.patient.findUnique({
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
      } else if (name || patientName) {
        const pName = (name || patientName).trim();
        if (!pName) {
          return res.status(400).json({
            message: "Patient name is required",
          });
        }
        patient = await prisma.patient.create({
          data: {
            name: pName,
            email: email?.trim() || null,
            phone: phone?.trim() || null,
          },
        });
      } else {
        return res.status(400).json({
          message:
            "patientId or patient name is required",
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
        appointment.status !== "AVAILABLE" ||
        appointment.archived
      ) {
        return res.status(400).json({
          message:
            "Only available, active slots can be requested",
        });
      }

      const result =
        await prisma.$transaction(async (tx) => {
          // Change appointment to REQUESTED
          const updatedAppointment =
            await tx.appointment.update({
              where: {
                id: appointmentId,
              },

              data: {
                patientId: patient.id,
                status: "REQUESTED",
              },
            });

          // Goal 9 — record status change
          await tx.appointmentHistory.create({
            data: {
              appointmentId,
              actorUserId: req.user.id,
              type: "STATUS_CHANGE",
              oldStatus: appointment.status,
              newStatus: "REQUESTED",
            },
          });

          // Goal 10 — create alert
          await tx.appointmentAlert.create({
            data: {
              appointmentId: appointment.id,
            },
          });

          return updatedAppointment;
        });

      return res.json({
        message:
          "Appointment requested",
        appointment:
          result,
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

      let appointment;
      if (req.user.role === "FRONT_DESK") {
        appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
        });
      } else if (req.user.role === "PROVIDER") {
        const provider = await getProviderForUser(req.user.id);
        if (!provider) {
          return res.status(404).json({
            message: "Provider profile not found",
          });
        }
        appointment = await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            providerId: provider.id,
          },
        });
      } else {
        return res.status(403).json({
          message: "Access denied",
        });
      }

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

      let appointment;
      if (req.user.role === "FRONT_DESK") {
        appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
        });
      } else if (req.user.role === "PROVIDER") {
        const provider = await getProviderForUser(req.user.id);
        if (!provider) {
          return res.status(404).json({
            message: "Provider profile not found",
          });
        }
        appointment = await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            providerId: provider.id,
          },
        });
      } else {
        return res.status(403).json({
          message: "Access denied",
        });
      }

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
// Goal 9 — STATUS HISTORY
// ============================================================

router.patch(
  "/:id/confirm",
  authenticateToken,
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

      let appointment;
      if (req.user.role === "FRONT_DESK") {
        appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
        });
      } else if (req.user.role === "PROVIDER") {
        const provider = await getProviderForUser(req.user.id);
        if (!provider) {
          return res.status(404).json({
            message: "Provider profile not found",
          });
        }
        appointment = await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            OR: [
              { providerId: provider.id },
              { supportingProviders: { some: { providerId: provider.id } } },
            ],
          },
        });
      } else {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found",
        });
      }

      if (appointment.status !== "REQUESTED") {
        return res.status(400).json({
          message:
            "Only requested appointments can be confirmed",
        });
      }

      const result =
        await prisma.$transaction(async (tx) => {
          const updatedAppointment =
            await tx.appointment.update({
              where: {
                id: appointment.id,
              },

              data: {
                status: "CONFIRMED",
              },
            });

          await tx.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              actorUserId: req.user.id,
              type: "STATUS_CHANGE",
              oldStatus: "REQUESTED",
              newStatus: "CONFIRMED",
            },
          });

          return updatedAppointment;
        });

      return res.json({
        message:
          "Appointment confirmed",
        appointment:
          result,
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
// Goal 9 — STATUS HISTORY
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

      if (appointment.status !== "CONFIRMED") {
        return res.status(400).json({
          message:
            "Only confirmed appointments can be checked in",
        });
      }

      const result =
        await prisma.$transaction(async (tx) => {
          const updatedAppointment =
            await tx.appointment.update({
              where: {
                id: appointment.id,
              },

              data: {
                status: "CHECKED_IN",
              },
            });

          await tx.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              actorUserId: req.user.id,
              type: "STATUS_CHANGE",
              oldStatus: "CONFIRMED",
              newStatus: "CHECKED_IN",
            },
          });

          return updatedAppointment;
        });

      return res.json({
        message:
          "Patient checked in",
        appointment:
          result,
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
// Goal 9 — STATUS HISTORY
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

      if (appointment.status !== "CHECKED_IN") {
        return res.status(400).json({
          message:
            "Only checked-in appointments can be completed",
        });
      }

      const result =
        await prisma.$transaction(async (tx) => {
          const updatedAppointment =
            await tx.appointment.update({
              where: {
                id: appointment.id,
              },

              data: {
                status: "COMPLETED",
              },
            });

          await tx.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              actorUserId: req.user.id,
              type: "STATUS_CHANGE",
              oldStatus: "CHECKED_IN",
              newStatus: "COMPLETED",
            },
          });

          return updatedAppointment;
        });

      return res.json({
        message:
          "Appointment completed",
        appointment:
          result,
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
// MARK NO SHOW
// Goal 4 + Goal 9
// ============================================================

router.patch(
  "/:id/no-show",
  authenticateToken,
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

      if (req.user.role === "PROVIDER") {
        const provider = await getProviderForUser(req.user.id);
        if (!canViewAppointment(req.user, provider, appointment)) {
          return res.status(403).json({
            message:
              "You can only mark no-show for appointments on your schedule",
          });
        }
      } else if (req.user.role !== "FRONT_DESK") {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      if (appointment.status !== "CONFIRMED") {
        return res.status(400).json({
          message:
            "Only confirmed appointments can be marked as no-show",
        });
      }

      const now = new Date();

      if (appointment.startTime > now) {
        return res.status(400).json({
          message:
            "An appointment can only be marked no-show after its scheduled time has passed",
        });
      }

      const result =
        await prisma.$transaction(async (tx) => {
          const updatedAppointment =
            await tx.appointment.update({
              where: {
                id: appointment.id,
              },

              data: {
                status: "NO_SHOW",
              },
            });

          await tx.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              actorUserId: req.user.id,
              type: "STATUS_CHANGE",
              oldStatus: "CONFIRMED",
              newStatus: "NO_SHOW",
            },
          });

          return updatedAppointment;
        });

      return res.json({
        message:
          "Appointment marked as no-show",
        appointment:
          result,
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
// CANCEL APPOINTMENT
// Goal 4 + Goal 9
// ============================================================

router.patch(
  "/:id/cancel",
  authenticateToken,
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      const { reason } = req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message:
            "Invalid appointment ID",
        });
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          message:
            "Cancellation reason is required",
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
        appointment.status === "CHECKED_IN" ||
        appointment.status === "COMPLETED"
      ) {
        return res.status(400).json({
          message:
            "Appointments cannot be cancelled after check-in",
        });
      }

      if (appointment.status === "CANCELLED") {
        return res.status(400).json({
          message:
            "Appointment is already cancelled",
        });
      }

      if (appointment.status === "NO_SHOW") {
        return res.status(400).json({
          message:
            "A no-show appointment cannot be cancelled",
        });
      }

      const actorProvider =
        await getProviderForUser(req.user.id);

      if (req.user.role === "PROVIDER") {
        if (
          !actorProvider ||
          appointment.providerId !== actorProvider.id
        ) {
          return res.status(403).json({
            message:
              "Providers can only cancel appointments on their own schedule",
          });
        }
      }

      if (
        req.user.role !== "FRONT_DESK" &&
        req.user.role !== "PROVIDER"
      ) {
        return res.status(403).json({
          message:
            "You are not allowed to cancel appointments",
        });
      }

      const result =
        await prisma.$transaction(async (tx) => {
          const updatedAppointment =
            await tx.appointment.update({
              where: {
                id: appointment.id,
              },

              data: {
                status: "CANCELLED",
              },
            });

          await tx.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              actorUserId: req.user.id,
              type: "CANCELLATION",
              oldStatus: appointment.status,
              newStatus: "CANCELLED",
              reason: reason.trim(),
            },
          });

          return updatedAppointment;
        });

      return res.json({
        message:
          "Appointment cancelled",
        appointment:
          result,
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
// REASSIGN APPOINTMENT BETWEEN PROVIDERS
// Goal 1: Front-desk can reassign appointments between providers.
// Providers cannot reassign an appointment away from themselves.
// ============================================================

router.patch(
  "/:id/reassign",
  authenticateToken,
  requireRole("FRONT_DESK"),
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

      const targetProviderId = Number(providerId);
      if (Number.isNaN(targetProviderId)) {
        return res.status(400).json({
          message: "Invalid providerId",
        });
      }

      const targetProvider = await prisma.provider.findUnique({
        where: { id: targetProviderId },
      });

      if (!targetProvider) {
        return res.status(404).json({
          message: "Target provider not found",
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

      if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
        return res.status(400).json({
          message: "Cannot reassign a cancelled or completed appointment",
        });
      }

      if (appointment.providerId === targetProviderId) {
        return res.status(400).json({
          message: "Appointment is already assigned to this provider",
        });
      }

      // Check collision for target provider at this time
      const apptStart = new Date(appointment.startTime);
      const apptEnd = new Date(apptStart.getTime() + appointment.duration * 60000);

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          providerId: targetProviderId,
          archived: false,
          id: { not: appointment.id },
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          startTime: true,
          duration: true,
        },
      });

      const collides = existingAppointments.some((appt) => {
        const start = new Date(appt.startTime);
        const end = new Date(start.getTime() + appt.duration * 60000);
        return apptStart < end && start < apptEnd;
      });

      if (collides) {
        return res.status(400).json({
          message: "The target provider has a schedule conflict at this time",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // If target provider is currently a supporting provider on this appointment, remove that support
        const existingSupport = appointment.supportingProviders.find(
          (support) => support.providerId === targetProviderId
        );
        if (existingSupport) {
          await tx.appointmentSupport.delete({
            where: { id: existingSupport.id },
          });
        }

        const updated = await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            providerId: targetProviderId,
          },
          include: {
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
            },
          },
        });

        return updated;
      });

      return res.json({
        message: "Appointment reassigned successfully",
        appointment: result,
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
// ADD SUPPORTING PROVIDER
// Goal 5 + Goal 9
// ============================================================

router.post(
  "/:id/supporting-providers",
  authenticateToken,
  async (req, res) => {
    try {
      const appointmentId = Number(
        req.params.id
      );

      const { providerId } = req.body;

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
        await prisma.appointmentSupport.findUnique({
          where: {
            appointmentId_providerId: {
              appointmentId:
                appointment.id,
              providerId:
                supportingProvider.id,
            },
          },
        });

      if (existingSupport) {
        return res.status(400).json({
          message:
            "Provider is already a supporting provider",
        });
      }

      const result =
        await prisma.$transaction(async (tx) => {
          const support =
            await tx.appointmentSupport.create({
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
            });

          await tx.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              actorUserId: req.user.id,
              type:
                "SUPPORTING_PROVIDER_ADDED",
              providerId:
                supportingProvider.id,
            },
          });

          return support;
        });

      return res.status(201).json({
        message:
          "Supporting provider added",
        support:
          result,
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
// Goal 5 + Goal 9
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
        await prisma.appointmentSupport.findUnique({
          where: {
            appointmentId_providerId: {
              appointmentId,
              providerId,
            },
          },
        });

      if (!support) {
        return res.status(404).json({
          message:
            "Supporting provider is not on this appointment",
        });
      }

      await prisma.$transaction(
        async (tx) => {
          await tx.appointmentSupport.delete({
            where: {
              id: support.id,
            },
          });

          await tx.appointmentHistory.create({
            data: {
              appointmentId,
              actorUserId: req.user.id,
              type:
                "SUPPORTING_PROVIDER_REMOVED",
              providerId,
            },
          });
        }
      );

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
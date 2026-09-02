const express = require("express");

const prisma = require("../lib/prisma");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();


// ============================================================
// GOAL 10 — GET UNCONFIRMED APPOINTMENT ALERTS
//
// An appointment is an alert when:
// - status is REQUESTED
// - appointment is not archived
// - appointment is within 24 hours of scheduled time
//
// Dismissal rules:
// - If dismissed, hide it until the final hour.
// - If it is still REQUESTED within 1 hour of startTime,
//   show it again regardless of dismissal.
// ============================================================

router.get(
  "/",
  authenticateToken,
  requireRole("FRONT_DESK"),
  async (req, res) => {
    try {
      const now = new Date();

      const twentyFourHoursFromNow = new Date(
        now.getTime() + 24 * 60 * 60 * 1000
      );

      const oneHourFromNow = new Date(
        now.getTime() + 60 * 60 * 1000
      );

      const alerts =
        await prisma.appointmentAlert.findMany({
          where: {
            appointment: {
              status: "REQUESTED",
              archived: false,
              startTime: {
                gte: now,
                lte: twentyFourHoursFromNow,
              },
            },

            OR: [
              // Never dismissed
              {
                dismissedAt: null,
              },

              // Dismissed, but appointment is now
              // within the final hour.
              {
                dismissedAt: {
                  not: null,
                },

                appointment: {
                  startTime: {
                    lte: oneHourFromNow,
                  },
                },
              },
            ],
          },

          include: {
            appointment: {
              include: {
                patient: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                  },
                },

                provider: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },

          orderBy: {
            appointment: {
              startTime: "asc",
            },
          },
        });

      return res.json({
        count: alerts.length,
        alerts,
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
// GOAL 10 — DISMISS ALERT
// ============================================================

router.patch(
  "/:id/dismiss",
  authenticateToken,
  requireRole("FRONT_DESK"),
  async (req, res) => {
    try {
      const alertId = Number(req.params.id);

      if (Number.isNaN(alertId)) {
        return res.status(400).json({
          message: "Invalid alert ID",
        });
      }

      const alert =
        await prisma.appointmentAlert.findUnique({
          where: {
            id: alertId,
          },

          include: {
            appointment: true,
          },
        });

      if (!alert) {
        return res.status(404).json({
          message: "Alert not found",
        });
      }

      // Once the appointment is no longer REQUESTED,
      // there is nothing left to dismiss.
      if (
        alert.appointment.status !== "REQUESTED"
      ) {
        return res.status(400).json({
          message:
            "This appointment is no longer awaiting confirmation",
        });
      }

      const updatedAlert =
        await prisma.appointmentAlert.update({
          where: {
            id: alertId,
          },

          data: {
            dismissedAt: new Date(),
          },
        });

      return res.json({
        message: "Alert dismissed",
        alert: updatedAlert,
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
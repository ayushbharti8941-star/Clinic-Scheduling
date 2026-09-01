const express = require("express");
const prisma = require("../lib/prisma");

const {
  authenticateToken,
} = require("../middleware/auth");

const router = express.Router();

// ============================================================
// GOAL 8 — DASHBOARD
// ============================================================

router.get(
  "/",
  authenticateToken,
  async (req, res) => {
    try {
      const now = new Date();

      // ========================================================
      // TODAY
      // ========================================================

      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(
        startOfTomorrow.getDate() + 1
      );

      // ========================================================
      // THIS WEEK
      // Monday -> Sunday
      // ========================================================

      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);

      const day = startOfWeek.getDay();

      const daysFromMonday =
        day === 0 ? 6 : day - 1;

      startOfWeek.setDate(
        startOfWeek.getDate() - daysFromMonday
      );

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(
        endOfWeek.getDate() + 7
      );

      // ========================================================
      // 1. APPOINTMENTS TODAY
      // ========================================================

      const appointmentsToday =
        await prisma.appointment.count({
          where: {
            archived: false,

            startTime: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },

            // AVAILABLE slots are not appointments yet.
            status: {
              not: "AVAILABLE",
            },
          },
        });

      // ========================================================
      // 2. PATIENTS CHECKED IN RIGHT NOW
      // ========================================================

      const checkedInNow =
        await prisma.appointment.count({
          where: {
            archived: false,
            status: "CHECKED_IN",
          },
        });

      // ========================================================
      // 3. NO-SHOWS THIS WEEK
      // ========================================================

      const noShowsThisWeek =
        await prisma.appointment.count({
          where: {
            archived: false,
            status: "NO_SHOW",

            startTime: {
              gte: startOfWeek,
              lt: endOfWeek,
            },
          },
        });

      // ========================================================
      // 4. UPCOMING CONFIRMED APPOINTMENTS
      // ========================================================

      const upcomingConfirmed =
        await prisma.appointment.count({
          where: {
            archived: false,
            status: "CONFIRMED",

            startTime: {
              gt: now,
            },
          },
        });

      // ========================================================
      // 5A. APPOINTMENTS BY PROVIDER
      // ========================================================

      const providerGroups =
        await prisma.appointment.groupBy({
          by: ["providerId"],

          where: {
            archived: false,

            status: {
              not: "AVAILABLE",
            },
          },

          _count: {
            _all: true,
          },
        });

      const providerIds =
        providerGroups.map(
          (group) => group.providerId
        );

      const providers =
        providerIds.length > 0
          ? await prisma.provider.findMany({
              where: {
                id: {
                  in: providerIds,
                },
              },

              select: {
                id: true,
                name: true,
              },
            })
          : [];

      const providerNameMap =
        new Map(
          providers.map((provider) => [
            provider.id,
            provider.name,
          ])
        );

      const byProvider =
        providerGroups.map((group) => ({
          providerId: group.providerId,

          provider:
            providerNameMap.get(
              group.providerId
            ) || "Unknown",

          count: group._count._all,
        }));

      // ========================================================
      // 5B. APPOINTMENTS BY STATUS
      // ========================================================

      const statusGroups =
        await prisma.appointment.groupBy({
          by: ["status"],

          where: {
            archived: false,
          },

          _count: {
            _all: true,
          },
        });

      const byStatus =
        statusGroups.map((group) => ({
          status: group.status,
          count: group._count._all,
        }));

      // ========================================================
      // 6. NO-SHOW RATE — LAST 8 WEEKS
      // ========================================================

      // Start exactly 7 weeks before the current week.
      // Together with the current week, this gives 8 weeks.

      const eightWeeksAgo =
        new Date(startOfWeek);

      eightWeeksAgo.setDate(
        eightWeeksAgo.getDate() - 7 * 7
      );

      // We only need appointments that could contribute
      // to the no-show rate.
      //
      // AVAILABLE and REQUESTED appointments are excluded
      // because they were never confirmed appointments.

      const appointmentsForNoShowRate =
        await prisma.appointment.findMany({
          where: {
            archived: false,

            status: {
              in: [
                "CONFIRMED",
                "CHECKED_IN",
                "COMPLETED",
                "NO_SHOW",
              ],
            },

            startTime: {
              gte: eightWeeksAgo,
              lt: endOfWeek,
            },
          },

          select: {
            startTime: true,
            status: true,
          },
        });

      // Always return exactly 8 weeks.
      const weeklyNoShowRate = [];

      for (let i = 0; i < 8; i++) {
        const weekStart =
          new Date(startOfWeek);

        weekStart.setDate(
          weekStart.getDate() -
            7 * (7 - i)
        );

        const weekEnd =
          new Date(weekStart);

        weekEnd.setDate(
          weekEnd.getDate() + 7
        );

        const weekAppointments =
          appointmentsForNoShowRate.filter(
            (appointment) => {
              const appointmentTime =
                new Date(
                  appointment.startTime
                );

              return (
                appointmentTime >=
                  weekStart &&
                appointmentTime <
                  weekEnd
              );
            }
          );

        const total =
          weekAppointments.length;

        const noShows =
          weekAppointments.filter(
            (appointment) =>
              appointment.status ===
              "NO_SHOW"
          ).length;

        const rate =
          total === 0
            ? 0
            : Number(
                (
                  (noShows / total) *
                  100
                ).toFixed(2)
              );

        weeklyNoShowRate.push({
          weekStart:
            weekStart.toISOString(),

          weekEnd:
            weekEnd.toISOString(),

          total,
          noShows,
          rate,
        });
      }

      // ========================================================
      // RESPONSE
      // ========================================================

      return res.json({
        headline: {
          appointmentsToday,
          checkedInNow,
          noShowsThisWeek,
          upcomingConfirmed,
        },

        breakdown: {
          byProvider,
          byStatus,
        },

        weeklyNoShowRate,
      });
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );

      return res.status(500).json({
        message:
          "Internal server error",
      });
    }
  }
);

module.exports = router;
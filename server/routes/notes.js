const express = require("express");

const prisma = require("../lib/prisma");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();


// ============================================================
// CREATE VISIT NOTE
// Goal 3 + Goal 9
// ============================================================

router.post(
  "/appointments/:id/notes",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const appointmentId = Number(req.params.id);
      const { content } = req.body;

      if (Number.isNaN(appointmentId)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      if (!content || !content.trim()) {
        return res.status(400).json({
          message: "Note content is required",
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
          OR: [
            { providerId: provider.id },
            {
              supportingProviders: {
                some: {
                  providerId: provider.id,
                },
              },
            },
          ],
        },
      });

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found on your schedule",
        });
      }

      // Create the visit note and its history entry
      // in one transaction so they cannot get out of sync.
      const result = await prisma.$transaction(async (tx) => {
        const note = await tx.visitNote.create({
          data: {
            appointmentId: appointment.id,
            providerId: provider.id,
            content: content.trim(),
          },
        });

        await tx.appointmentHistory.create({
          data: {
            appointmentId: appointment.id,
            actorUserId: req.user.id,
            type: "VISIT_NOTE_ADDED",
            visitNoteId: note.id,
          },
        });

        return note;
      });

      return res.status(201).json({
        message: "Visit note created",
        note: result,
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
// GET VISIT NOTES
// ============================================================

router.get(
  "/appointments/:id/notes",
  authenticateToken,
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

      const notes = await prisma.visitNote.findMany({
        where: {
          appointmentId,
        },

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
      });

      return res.json({
        appointmentId,
        notes,
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
// EDIT VISIT NOTE
// Goal 3
//
// Important:
// Editing a note does NOT edit or delete the history event.
// The history remains immutable.
// ============================================================

router.put(
  "/notes/:id",
  authenticateToken,
  requireRole("PROVIDER"),
  async (req, res) => {
    try {
      const noteId = Number(req.params.id);
      const { content } = req.body;

      if (Number.isNaN(noteId)) {
        return res.status(400).json({
          message: "Invalid note ID",
        });
      }

      if (!content || !content.trim()) {
        return res.status(400).json({
          message: "Note content is required",
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

      const note = await prisma.visitNote.findUnique({
        where: {
          id: noteId,
        },
      });

      if (!note) {
        return res.status(404).json({
          message: "Visit note not found",
        });
      }

      if (note.providerId !== provider.id) {
        return res.status(403).json({
          message: "You can only edit notes you created",
        });
      }

      const updatedNote = await prisma.visitNote.update({
        where: {
          id: noteId,
        },

        data: {
          content: content.trim(),
        },
      });

      return res.json({
        message: "Visit note updated",
        note: updatedNote,
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
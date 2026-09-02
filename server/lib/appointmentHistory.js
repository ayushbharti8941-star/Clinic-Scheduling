const prisma = require("./prisma");

async function createAppointmentHistory({
  appointmentId,
  actorUserId,
  type,
  oldStatus = null,
  newStatus = null,
  providerId = null,
  visitNoteId = null,
  reason = null,
}) {
  return prisma.appointmentHistory.create({
    data: {
      appointmentId,
      actorUserId,
      type,
      oldStatus,
      newStatus,
      providerId,
      visitNoteId,
      reason,
    },
  });
}

module.exports = {
  createAppointmentHistory,
};
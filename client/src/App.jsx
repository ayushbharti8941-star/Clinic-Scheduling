import { useEffect, useState } from "react";
import {
  api,
  apiUrl,
  clearSession,
  getUser,
  setSession,
} from "./api";
import "./App.css";

function formatWhen(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  const diffMs = target - now;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffMins = Math.round(diffMs / (1000 * 60));

  if (diffMs < 0) {
    const pastMins = Math.abs(diffMins);
    if (pastMins < 60) return `${pastMins}m ago`;
    return `${Math.abs(diffHours)}h ago`;
  }
  if (diffMins < 60) return `in ${diffMins}m`;
  return `in ${diffHours}h`;
}

function StatusBadge({ status, archived }) {
  if (archived) {
    return <span className="status-badge status-archived">Archived</span>;
  }
  return (
    <span className={`status-badge status-${(status || "").toLowerCase()}`}>
      {(status || "").replaceAll("_", " ")}
    </span>
  );
}

function initialsFromEmail(email) {
  return (email || "?").slice(0, 2).toUpperCase();
}

// ============================================================
// LOGIN
// ============================================================

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("frontdesk@clinic.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setSession(data.token, data.user);
      onLoggedIn(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="brand-mark" aria-hidden="true" />
        <p className="eyebrow">Clinic operations</p>

        <h1>Sign in to Clinic Schedule</h1>

        <p className="muted">
          Use a front-desk or provider account. Demo password is{" "}
          <code>password123</code>.
        </p>

        {error ? <p className="error">{error}</p> : null}

        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </label>

        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <div className="demo-accounts">
          <button
            type="button"
            className="chip"
            onClick={() => setEmail("frontdesk@clinic.com")}
          >
            Front desk
          </button>

          <button
            type="button"
            className="chip"
            onClick={() => setEmail("provider@clinic.com")}
          >
            Dr. Priya
          </button>

          <button
            type="button"
            className="chip"
            onClick={() => setEmail("provider2@clinic.com")}
          >
            Dr. Arjun
          </button>
        </div>
      </form>
    </main>
  );
}

// ============================================================
// ROLE LABEL
// ============================================================

function roleLabel(appointment, userProviderId) {
  if (!userProviderId) {
    return "Clinic";
  }

  if (appointment.providerId === userProviderId) {
    return "Scheduling";
  }

  return "Supporting";
}

// ============================================================
// GOAL 8 — DASHBOARD WITH VISUAL CHART
// ============================================================

function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const data = await api("/api/dashboard");
      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <section className="card">
        <h2>Clinic dashboard</h2>
        <p className="muted">Loading dashboard…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <h2>Clinic dashboard</h2>
        <p className="error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={loadDashboard}>
          Try again
        </button>
      </section>
    );
  }

  if (!dashboard) {
    return null;
  }

  const { headline, breakdown, weeklyNoShowRate } = dashboard;
  const maxRate = Math.max(...weeklyNoShowRate.map((w) => w.rate), 10);

  return (
    <section className="card">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Clinic dashboard</h2>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadDashboard}
        >
          Refresh
        </button>
      </div>

      {/* HEADLINE METRICS */}
      <div className="dashboard-grid">
        <div className="dashboard-stat">
          <span className="muted">Appointments today</span>
          <strong>{headline.appointmentsToday}</strong>
        </div>

        <div className="dashboard-stat">
          <span className="muted">Checked in now</span>
          <strong>{headline.checkedInNow}</strong>
        </div>

        <div className="dashboard-stat">
          <span className="muted">No-shows this week</span>
          <strong>{headline.noShowsThisWeek}</strong>
        </div>

        <div className="dashboard-stat">
          <span className="muted">Upcoming confirmed</span>
          <strong>{headline.upcomingConfirmed}</strong>
        </div>
      </div>

      {/* BREAKDOWN */}
      <div className="dashboard-sections">
        <div className="panel">
          <h3>Appointments by provider</h3>
          {breakdown.byProvider.length === 0 ? (
            <p className="muted">No appointment data available.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Appointments</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.byProvider.map((item) => (
                  <tr key={item.providerId}>
                    <td>{item.provider}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>Appointments by status</h3>
          {breakdown.byStatus.length === 0 ? (
            <p className="muted">No status data available.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.byStatus.map((item) => (
                  <tr key={item.status}>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* GOAL 8: VISUAL NO-SHOW RATE CHART */}
      <div className="panel" style={{ marginTop: "16px" }}>
        <h3>Weekly No-Show Rate Trend (Last 8 Weeks)</h3>

        {weeklyNoShowRate.length === 0 ? (
          <p className="muted">No historical appointment data available.</p>
        ) : (
          <>
            {/* Visual SVG Bar Chart */}
            <div className="chart-container">
              <svg className="no-show-chart" viewBox="0 0 800 180" preserveAspectRatio="none">
                {/* Horizontal Grid lines */}
                <line x1="40" y1="20" x2="780" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="40" y1="80" x2="780" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="40" y1="140" x2="780" y2="140" stroke="#cbd5e1" strokeWidth="1.5" />

                {/* Y-axis labels */}
                <text x="32" y="24" textAnchor="end" fontSize="10" fill="#64748b">
                  {Math.round(maxRate)}%
                </text>
                <text x="32" y="84" textAnchor="end" fontSize="10" fill="#64748b">
                  {Math.round(maxRate / 2)}%
                </text>
                <text x="32" y="144" textAnchor="end" fontSize="10" fill="#64748b">
                  0%
                </text>

                {weeklyNoShowRate.map((week, index) => {
                  const barWidth = 48;
                  const totalSlots = weeklyNoShowRate.length;
                  const step = (740 - 50) / totalSlots;
                  const x = 60 + index * step;
                  const barHeight = Math.max((week.rate / maxRate) * 110, 4);
                  const y = 140 - barHeight;
                  const weekLabel = new Date(week.weekStart).toLocaleDateString([], {
                    month: "numeric",
                    day: "numeric",
                  });

                  return (
                    <g key={week.weekStart}>
                      {/* Bar Background / Bar */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        fill={week.rate > 0 ? (week.rate > 25 ? "#ef4444" : "#0f5c56") : "#94a3b8"}
                        opacity="0.85"
                      />
                      {/* Rate label above bar */}
                      <text
                        x={x + barWidth / 2}
                        y={y - 6}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="bold"
                        fill="#1e293b"
                      >
                        {week.rate}%
                      </text>
                      {/* Week label below bar */}
                      <text
                        x={x + barWidth / 2}
                        y="160"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#64748b"
                      >
                        {weekLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Structured Data Table */}
            <table style={{ marginTop: "16px" }}>
              <thead>
                <tr>
                  <th>Week Range</th>
                  <th>Confirmed / Scheduled</th>
                  <th>No-Shows</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {weeklyNoShowRate.map((week) => (
                  <tr key={week.weekStart}>
                    <td>
                      {new Date(week.weekStart).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      –{" "}
                      {new Date(week.weekEnd).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>{week.total}</td>
                    <td>{week.noShows}</td>
                    <td>
                      <strong>{week.rate}%</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================
// GOAL 10 — UNCONFIRMED ALERTS BANNER
// ============================================================

function AlertsBanner({ alerts, onDismiss, onConfirm, onView }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <section className="card alerts-card">
      <div className="alerts-header">
        <div className="alerts-title-wrap">
          <span className="alert-pulse-icon" aria-hidden="true" />
          <div>
            <h2 style={{ margin: 0, color: "#991b1b" }}>
              Unconfirmed Appointment Alerts ({alerts.length})
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              Appointments awaiting confirmation within 24 hours of scheduled time.
            </p>
          </div>
        </div>
      </div>

      <div className="alerts-list">
        {alerts.map((item) => {
          const appt = item.appointment;
          const isFinalHour = new Date(appt.startTime) - new Date() <= 3600000;

          return (
            <div key={item.id} className={`alert-item ${isFinalHour ? "alert-item-critical" : ""}`}>
              <div className="alert-meta">
                <div className="alert-patient">
                  <strong>{appt.patient?.name || "Unassigned Patient"}</strong>
                  <span className="alert-timing">
                    {formatWhen(appt.startTime)} ({formatRelativeTime(appt.startTime)})
                  </span>
                </div>
                <div className="alert-submeta">
                  <span>Provider: <strong>{appt.provider?.name}</strong></span>
                  {appt.patient?.phone ? <span>· 📞 {appt.patient.phone}</span> : null}
                  {isFinalHour ? (
                    <span className="badge-critical">⚠️ Less than 1 hr remaining!</span>
                  ) : null}
                </div>
              </div>

              <div className="alert-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onConfirm(appt.id)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => onView(appt.id)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => onDismiss(item.id)}
                  title="Dismiss alert until 1 hour before scheduled time"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// APPOINTMENT DETAIL (GOALS 1, 2, 3, 4, 5, 9)
// ============================================================

function AppointmentDetail({
  appointment,
  providers,
  patients,
  user,
  onBack,
  onChanged,
}) {
  const [providerId, setProviderId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Status Action State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reassignProviderId, setReassignProviderId] = useState("");
  const [showReassignModal, setShowReassignModal] = useState(false);

  // Slot Edit State
  const [showEditSlotModal, setShowEditSlotModal] = useState(false);
  const [editStartTime, setEditStartTime] = useState(
    appointment.startTime ? new Date(appointment.startTime).toISOString().slice(0, 16) : ""
  );
  const [editDuration, setEditDuration] = useState(String(appointment.duration));

  // Patient Booking State
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientEmail, setNewPatientEmail] = useState("");

  // Visit Note State
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteContent, setEditNoteContent] = useState("");

  // History Timeline State
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const isFrontDesk = user.role === "FRONT_DESK";
  const isScheduling = user.providerId === appointment.providerId;
  const isSupporting = appointment.supportingProviders?.some(
    (s) => s.providerId === user.providerId
  );
  const isCareTeamMember = isScheduling || isSupporting;
  const canManageCareTeam = isFrontDesk || isScheduling;

  const availableSupports = providers.filter(
    (provider) =>
      provider.id !== appointment.providerId &&
      !appointment.supportingProviders?.some(
        (support) => support.providerId === provider.id
      )
  );

  const availableReassignProviders = providers.filter(
    (provider) => provider.id !== appointment.providerId
  );

  // Load History Timeline (Goal 9)
  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const data = await api(`/api/appointments/${appointment.id}/history`);
      setHistory(data.history || []);
    } catch {
      // Non-critical if history fails to load
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id]);

  // Status Transitions
  async function handleConfirm() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/confirm`, {
        method: "PATCH",
      });
      setSuccess("Appointment confirmed successfully.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckIn() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/check-in`, {
        method: "PATCH",
      });
      setSuccess("Patient checked in.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/complete`, {
        method: "PATCH",
      });
      setSuccess("Appointment marked as completed.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleNoShow() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/no-show`, {
        method: "PATCH",
      });
      setSuccess("Appointment marked as No-Show.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(event) {
    event.preventDefault();
    if (!cancelReason.trim()) {
      setError("Cancellation reason is required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason: cancelReason }),
      });
      setShowCancelModal(false);
      setCancelReason("");
      setSuccess("Appointment cancelled.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Reassignment (Goal 1)
  async function handleReassign(event) {
    event.preventDefault();
    if (!reassignProviderId) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/reassign`, {
        method: "PATCH",
        body: JSON.stringify({ providerId: Number(reassignProviderId) }),
      });
      setShowReassignModal(false);
      setReassignProviderId("");
      setSuccess("Appointment reassigned to new provider.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Archiving & Restoring (Goal 2)
  async function handleArchive() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/archive`, {
        method: "PATCH",
      });
      setSuccess("Appointment slot archived.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/restore`, {
        method: "PATCH",
      });
      setSuccess("Appointment slot restored.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Slot Editing (Goal 2)
  async function handleEditSlot(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}`, {
        method: "PUT",
        body: JSON.stringify({
          startTime: editStartTime ? new Date(editStartTime).toISOString() : undefined,
          duration: Number(editDuration),
        }),
      });
      setShowEditSlotModal(false);
      setSuccess("Appointment slot updated.");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Book Slot for Patient (Goal 2)
  async function handleBookSlot(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = selectedPatientId
        ? { patientId: Number(selectedPatientId) }
        : {
            name: newPatientName,
            phone: newPatientPhone,
            email: newPatientEmail,
          };

      await api(`/api/appointments/${appointment.id}/request`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShowBookModal(false);
      setSelectedPatientId("");
      setNewPatientName("");
      setNewPatientPhone("");
      setNewPatientEmail("");
      setSuccess("Appointment successfully requested for patient.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Care Team (Goal 5)
  async function addSupport(event) {
    event.preventDefault();
    if (!providerId) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/supporting-providers`, {
        method: "POST",
        body: JSON.stringify({ providerId: Number(providerId) }),
      });
      setProviderId("");
      setSuccess("Supporting provider added.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSupport(id) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/supporting-providers/${id}`, {
        method: "DELETE",
      });
      setSuccess("Supporting provider removed.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Visit Notes (Goal 3)
  async function handleAddNote(event) {
    event.preventDefault();
    if (!noteContent.trim()) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/appointments/${appointment.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: noteContent }),
      });
      setNoteContent("");
      setSuccess("Visit note added.");
      await onChanged();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEditNote(noteId) {
    if (!editNoteContent.trim()) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api(`/api/notes/${noteId}`, {
        method: "PUT",
        body: JSON.stringify({ content: editNoteContent }),
      });
      setEditingNoteId(null);
      setEditNoteContent("");
      setSuccess("Visit note updated.");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isPastScheduledTime = new Date(appointment.startTime) <= new Date();

  return (
    <section className="card">
      <div className="detail-top-nav">
        <button type="button" className="linkish" onClick={onBack}>
          ← Back to schedule
        </button>

        <div className="status-header-badges">
          <StatusBadge status={appointment.status} archived={appointment.archived} />
          {appointment.archived ? (
            <span className="badge-muted">Archived from schedule</span>
          ) : null}
        </div>
      </div>

      <div className="appointment-header-info">
        <h2>{appointment.patient?.name || "Available Appointment Slot"}</h2>
        <p className="muted" style={{ fontSize: "1rem" }}>
          🗓️ <strong>{formatWhen(appointment.startTime)}</strong> ({appointment.duration} minutes)
        </p>

        {appointment.patient ? (
          <div className="patient-contact-chip">
            <span>👤 Patient: <strong>{appointment.patient.name}</strong></span>
            {appointment.patient.phone ? <span>· 📞 {appointment.patient.phone}</span> : null}
            {appointment.patient.email ? <span>· ✉️ {appointment.patient.email}</span> : null}
          </div>
        ) : null}

        <p style={{ marginTop: "8px" }}>
          Scheduling Provider: <strong>{appointment.provider.name}</strong>
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="success">{success}</p> : null}

      {/* ======================================================
          STATUS ACTION TOOLBAR (GOALS 1, 2, 4)
      ======================================================= */}
      <div className="action-toolbar">
        <h3>Appointment Actions</h3>
        <div className="action-button-group">
          {/* AVAILABLE SLOT ACTIONS */}
          {appointment.status === "AVAILABLE" && !appointment.archived ? (
            <>
              {isFrontDesk ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowBookModal(true)}
                  disabled={saving}
                >
                  📝 Book for Patient
                </button>
              ) : null}

              {(isFrontDesk || isScheduling) ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditSlotModal(true)}
                  disabled={saving}
                >
                  ✏️ Edit Slot
                </button>
              ) : null}

              {(isFrontDesk || isScheduling) ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleArchive}
                  disabled={saving}
                >
                  📦 Archive Slot
                </button>
              ) : null}
            </>
          ) : null}

          {/* RESTORE ARCHIVED SLOT */}
          {appointment.archived && (isFrontDesk || isScheduling) ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRestore}
              disabled={saving}
            >
              🔄 Restore to Schedule
            </button>
          ) : null}

          {/* REQUESTED STATUS ACTIONS */}
          {appointment.status === "REQUESTED" ? (
            <>
              {(isFrontDesk || isScheduling) ? (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleConfirm}
                  disabled={saving}
                >
                  ✅ Confirm Appointment
                </button>
              ) : null}

              {(isFrontDesk || isScheduling) ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setShowCancelModal(true)}
                  disabled={saving}
                >
                  🚫 Cancel Appointment
                </button>
              ) : null}

              {isFrontDesk ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReassignModal(true)}
                  disabled={saving}
                >
                  🔁 Reassign Provider
                </button>
              ) : null}
            </>
          ) : null}

          {/* CONFIRMED STATUS ACTIONS */}
          {appointment.status === "CONFIRMED" ? (
            <>
              {isFrontDesk ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCheckIn}
                  disabled={saving}
                >
                  🎟️ Check In Patient
                </button>
              ) : null}

              {(isFrontDesk || isScheduling) ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setShowCancelModal(true)}
                  disabled={saving}
                >
                  🚫 Cancel Appointment
                </button>
              ) : null}

              {(isFrontDesk || isScheduling) ? (
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={handleNoShow}
                  disabled={saving || !isPastScheduledTime}
                  title={
                    isPastScheduledTime
                      ? "Mark patient as No-Show"
                      : "Can only be marked No-Show after scheduled time has passed"
                  }
                >
                  ⚠️ Mark No-Show {!isPastScheduledTime ? "(Locked until slot time)" : ""}
                </button>
              ) : null}

              {isFrontDesk ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReassignModal(true)}
                  disabled={saving}
                >
                  🔁 Reassign Provider
                </button>
              ) : null}
            </>
          ) : null}

          {/* CHECKED IN ACTIONS */}
          {appointment.status === "CHECKED_IN" ? (
            <>
              {user.role === "PROVIDER" && isCareTeamMember ? (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleComplete}
                  disabled={saving}
                >
                  🏁 Complete Appointment
                </button>
              ) : (
                <span className="badge-muted">
                  Checked in — In visit with provider
                </span>
              )}
              <span className="muted" style={{ margin: 0, alignSelf: "center", fontSize: "0.85rem" }}>
                ℹ️ Checked-in appointments cannot be cancelled.
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* ======================================================
          CARE TEAM / SUPPORTING PROVIDERS (GOAL 5)
      ======================================================= */}
      <div className="panel" style={{ marginTop: "16px" }}>
        <h3>Care Team & Supporting Providers</h3>

        {appointment.supportingProviders?.length === 0 ? (
          <p className="muted">No supporting providers assigned yet.</p>
        ) : (
          <ul className="care-team">
            {appointment.supportingProviders.map((support) => (
              <li key={support.id}>
                <span>🩺 {support.provider.name}</span>
                {canManageCareTeam ? (
                  <button
                    type="button"
                    className="linkish"
                    disabled={saving}
                    onClick={() => removeSupport(support.providerId)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManageCareTeam && availableSupports.length > 0 ? (
          <form className="inline-form" onSubmit={addSupport}>
            <select
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              required
            >
              <option value="">Add supporting provider…</option>
              {availableSupports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary" disabled={saving}>
              {saving ? "Adding…" : "Add to Team"}
            </button>
          </form>
        ) : null}
      </div>

      {/* ======================================================
          VISIT NOTES (GOAL 3)
      ======================================================= */}
      <div className="panel" style={{ marginTop: "16px" }}>
        <h3>Visit Notes</h3>

        {appointment.visitNotes?.length ? (
          <ul className="notes">
            {appointment.visitNotes.map((note) => {
              const isAuthor = user.role === "PROVIDER" && user.providerId === note.providerId;

              return (
                <li key={note.id} className="visit-note-item">
                  <div className="note-header">
                    <div>
                      <strong>Dr. {note.provider.name}</strong>
                      <span className="muted" style={{ marginLeft: "8px" }}>
                        {formatWhen(note.createdAt)}
                      </span>
                    </div>

                    {isAuthor && editingNoteId !== note.id ? (
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditNoteContent(note.content);
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>

                  {editingNoteId === note.id ? (
                    <div className="edit-note-box">
                      <textarea
                        rows="3"
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        required
                      />
                      <div className="note-edit-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSaveEditNote(note.id)}
                          disabled={saving}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setEditingNoteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
                      {note.content}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No visit notes recorded yet.</p>
        )}

        {/* Add Note Form (Providers on Care Team) */}
        {user.role === "PROVIDER" && isCareTeamMember ? (
          <form onSubmit={handleAddNote} style={{ marginTop: "16px" }}>
            <label>
              Add clinical observation note
              <textarea
                rows="3"
                placeholder="Enter clinical observations, assessment, or visit notes…"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ marginTop: "8px" }}
            >
              {saving ? "Saving Note…" : "Record Visit Note"}
            </button>
          </form>
        ) : null}
      </div>

      {/* ======================================================
          IMMUTABLE APPOINTMENT TIMELINE (GOAL 9)
      ======================================================= */}
      <div className="panel" style={{ marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Appointment Timeline (Immutable Audit Trail)</h3>
          <span className="badge-permanent">🔒 Permanent Log</span>
        </div>
        <p className="muted" style={{ margin: "4px 0 16px" }}>
          Every status update, cancellation, care team change, and note is recorded and cannot be rewritten.
        </p>

        {loadingHistory ? (
          <p className="muted">Loading audit timeline…</p>
        ) : history.length === 0 ? (
          <p className="muted">No audit events recorded yet.</p>
        ) : (
          <div className="timeline">
            {history.map((evt) => (
              <div key={evt.id} className="timeline-entry">
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-type">
                      {evt.type === "STATUS_CHANGE" && (
                        <span>
                          Status: <strong>{evt.oldStatus}</strong> → <strong>{evt.newStatus}</strong>
                        </span>
                      )}
                      {evt.type === "CANCELLATION" && (
                        <span style={{ color: "#b42318" }}>
                          🚫 Appointment Cancelled
                        </span>
                      )}
                      {evt.type === "SUPPORTING_PROVIDER_ADDED" && (
                        <span>
                          ➕ Supporting Provider Added: <strong>{evt.provider?.name || "Provider"}</strong>
                        </span>
                      )}
                      {evt.type === "SUPPORTING_PROVIDER_REMOVED" && (
                        <span>
                          ➖ Supporting Provider Removed
                        </span>
                      )}
                      {evt.type === "VISIT_NOTE_ADDED" && (
                        <span>
                          📝 Visit Note Added by <strong>{evt.visitNote?.provider?.name || "Provider"}</strong>
                        </span>
                      )}
                    </span>

                    <span className="timeline-time muted">
                      {formatWhen(evt.createdAt)}
                    </span>
                  </div>

                  {evt.reason ? (
                    <p className="timeline-reason">
                      Reason: <em>"{evt.reason}"</em>
                    </p>
                  ) : null}

                  {evt.actor ? (
                    <span className="timeline-actor muted">
                      Logged by: {evt.actor.email} ({evt.actor.role.replaceAll("_", " ")})
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================
          MODALS
      ======================================================= */}

      {/* Cancel Modal with Required Reason */}
      {showCancelModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Cancel Appointment</h3>
            <p className="muted">
              Please provide a reason for cancellation. This will be recorded permanently in the appointment audit log.
            </p>
            <form onSubmit={handleCancel}>
              <label>
                Cancellation Reason *
                <textarea
                  rows="3"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Patient requested reschedule due to conflict"
                  required
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                >
                  Never mind
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={saving || !cancelReason.trim()}
                >
                  {saving ? "Cancelling…" : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Reassign Provider Modal */}
      {showReassignModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Reassign Appointment</h3>
            <p className="muted">
              Select a new scheduling provider. The system will verify there are no schedule conflicts before reassigning.
            </p>
            <form onSubmit={handleReassign}>
              <label>
                New Scheduling Provider *
                <select
                  value={reassignProviderId}
                  onChange={(e) => setReassignProviderId(e.target.value)}
                  required
                >
                  <option value="">Select new provider…</option>
                  {availableReassignProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowReassignModal(false);
                    setReassignProviderId("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !reassignProviderId}
                >
                  {saving ? "Reassigning…" : "Reassign Provider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Unbooked Slot Modal */}
      {showEditSlotModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Edit Unbooked Slot</h3>
            <p className="muted">
              You can adjust the scheduled start time and duration for this unbooked slot.
            </p>
            <form onSubmit={handleEditSlot}>
              <label>
                Start Date & Time *
                <input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  required
                />
              </label>

              <label>
                Duration (minutes) *
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  required
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditSlotModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Book Slot for Patient Modal */}
      {showBookModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Book Appointment Slot</h3>
            <p className="muted">
              Select an existing patient or register a new patient for this appointment.
            </p>
            <form onSubmit={handleBookSlot}>
              <label>
                Select Existing Patient
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  <option value="">— Or enter new patient details below —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {!selectedPatientId ? (
                <>
                  <label>
                    Patient Full Name *
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newPatientName}
                      onChange={(e) => setNewPatientName(e.target.value)}
                      required={!selectedPatientId}
                    />
                  </label>

                  <label>
                    Phone Number
                    <input
                      type="tel"
                      placeholder="555-0123"
                      value={newPatientPhone}
                      onChange={(e) => setNewPatientPhone(e.target.value)}
                    />
                  </label>

                  <label>
                    Email Address
                    <input
                      type="email"
                      placeholder="patient@example.com"
                      value={newPatientEmail}
                      onChange={(e) => setNewPatientEmail(e.target.value)}
                    />
                  </label>
                </>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowBookModal(false);
                    setSelectedPatientId("");
                    setNewPatientName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || (!selectedPatientId && !newPatientName.trim())}
                >
                  {saving ? "Booking…" : "Request Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ============================================================
// MAIN SCHEDULE COMPONENT
// ============================================================

function Schedule({ user, onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [patients, setPatients] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // GOAL 10: ALERTS
  const [alerts, setAlerts] = useState([]);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);

  // GOAL 2: SINGLE SLOT CREATION MODAL
  const [showCreateSlotModal, setShowCreateSlotModal] = useState(false);
  const [newSlotProviderId, setNewSlotProviderId] = useState(
    user.role === "PROVIDER" ? String(user.providerId || "") : ""
  );
  const [newSlotStartTime, setNewSlotStartTime] = useState("");
  const [newSlotDuration, setNewSlotDuration] = useState("30");
  const [createSlotLoading, setCreateSlotLoading] = useState(false);
  const [createSlotError, setCreateSlotError] = useState("");
  const [createSlotSuccess, setCreateSlotSuccess] = useState("");

  // GOAL 6: SEARCH / FILTER / SORT / PAGINATION
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // GOAL 7: BULK AVAILABILITY
  const [bulkProviderId, setBulkProviderId] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [bulkSlots, setBulkSlots] = useState([
    { dayOfWeek: "1", startTime: "09:00", duration: "30" },
  ]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");

  // GOAL 7: CSV EXPORT
  const [exportDate, setExportDate] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");

  // Load Alerts (Goal 10)
  async function loadAlerts() {
    if (user.role !== "FRONT_DESK") return;
    try {
      const data = await api("/api/alerts");
      setAlerts(data.alerts || []);
    } catch {
      // Ignore alerts fetch failures
    }
  }

  // Dismiss Alert
  async function handleDismissAlert(alertId) {
    try {
      await api(`/api/alerts/${alertId}/dismiss`, { method: "PATCH" });
      await loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  }

  // Quick Confirm from Alert
  async function handleConfirmAlert(appointmentId) {
    try {
      await api(`/api/appointments/${appointmentId}/confirm`, { method: "PATCH" });
      await loadAlerts();
      await searchAppointments(page);
      if (selectedId === appointmentId) {
        await loadDetail(appointmentId);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadDetail(id) {
    try {
      const data = await api(`/api/appointments/${id}`);
      setSelected(data.appointment);
    } catch (err) {
      setError(err.message);
    }
  }

  async function searchAppointments(requestedPage = page, overrides = {}) {
    const params = new URLSearchParams();

    const currentSearch = overrides.search !== undefined ? overrides.search : search;
    const currentProvider = overrides.providerFilter !== undefined ? overrides.providerFilter : providerFilter;
    const currentStatus = overrides.statusFilter !== undefined ? overrides.statusFilter : statusFilter;
    const currentFrom = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
    const currentTo = overrides.toDate !== undefined ? overrides.toDate : toDate;
    const currentSort = overrides.sortBy !== undefined ? overrides.sortBy : sortBy;
    const currentOrder = overrides.sortOrder !== undefined ? overrides.sortOrder : sortOrder;

    if (currentSearch.trim()) params.set("q", currentSearch.trim());
    if (currentProvider) params.set("providerId", currentProvider);
    if (currentStatus) params.set("status", currentStatus);
    if (currentFrom) params.set("from", currentFrom);
    if (currentTo) params.set("to", currentTo);

    params.set("sort", currentSort);
    params.set("order", currentOrder);
    params.set("page", requestedPage);
    params.set("pageSize", pageSize);

    const data = await api(`/api/appointments/search?${params.toString()}`);
    setAppointments(data.appointments || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
    setPage(data.page || requestedPage);
  }

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [providerData, patientData] = await Promise.all([
        api("/api/providers"),
        api("/api/patients").catch(() => ({ patients: [] })),
      ]);

      setProviders(providerData.providers || []);
      setPatients(patientData.patients || []);

      await Promise.all([searchAppointments(1), loadAlerts()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    loadDetail(selectedId);
  }, [selectedId]);

  async function handleSearch(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await searchAppointments(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePageChange(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    setError("");
    setLoading(true);
    try {
      await searchAppointments(newPage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function clearFilters() {
    const cleared = {
      search: "",
      providerFilter: "",
      statusFilter: "",
      fromDate: "",
      toDate: "",
      sortBy: "date",
      sortOrder: "asc",
    };
    setSearch("");
    setProviderFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setSortBy("date");
    setSortOrder("asc");

    setError("");
    setLoading(true);
    try {
      await searchAppointments(1, cleared);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleChanged() {
    await Promise.all([searchAppointments(page), loadAlerts()]);
    if (selectedId) {
      await loadDetail(selectedId);
    }
  }

  // Handle Single Slot Creation (Goal 2)
  async function handleCreateSingleSlot(event) {
    event.preventDefault();
    setCreateSlotError("");
    setCreateSlotSuccess("");
    setCreateSlotLoading(true);

    try {
      const payload = {
        startTime: new Date(newSlotStartTime).toISOString(),
        duration: Number(newSlotDuration),
        ...(user.role === "FRONT_DESK" ? { providerId: Number(newSlotProviderId) } : {}),
      };

      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCreateSlotSuccess("Slot created successfully!");
      setNewSlotStartTime("");
      setShowCreateSlotModal(false);
      await searchAppointments(1);
    } catch (err) {
      setCreateSlotError(err.message);
    } finally {
      setCreateSlotLoading(false);
    }
  }

  // Bulk Availability Handlers
  function addBulkSlot() {
    setBulkSlots((current) => [
      ...current,
      { dayOfWeek: "1", startTime: "09:00", duration: "30" },
    ]);
  }

  function removeBulkSlot(index) {
    setBulkSlots((current) => current.filter((_, i) => i !== index));
  }

  function updateBulkSlot(index, field, value) {
    setBulkSlots((current) =>
      current.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  }

  async function handleBulkAvailability(event) {
    event.preventDefault();
    setBulkMessage("");
    setBulkError("");

    if (!bulkProviderId) {
      setBulkError("Please select a provider.");
      return;
    }
    if (!bulkStartDate || !bulkEndDate) {
      setBulkError("Please select both start and end dates.");
      return;
    }
    if (bulkSlots.length === 0) {
      setBulkError("Please add at least one weekly time block.");
      return;
    }

    setBulkLoading(true);
    try {
      const data = await api("/api/appointments/bulk-availability", {
        method: "POST",
        body: JSON.stringify({
          providerId: Number(bulkProviderId),
          startDate: bulkStartDate,
          endDate: bulkEndDate,
          weeklySlots: bulkSlots.map((slot) => ({
            dayOfWeek: Number(slot.dayOfWeek),
            startTime: slot.startTime,
            duration: Number(slot.duration),
          })),
        }),
      });

      setBulkMessage(
        `Created ${data.summary.created} slot(s). Skipped ${data.summary.skipped} due to conflicts.`
      );
      await searchAppointments(1);
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkLoading(false);
    }
  }

  // CSV Export Handler
  async function handleExport() {
    setExportMessage("");
    setExportError("");

    if (!exportDate) {
      setExportError("Please select a date.");
      return;
    }

    setExportLoading(true);
    try {
      const token = localStorage.getItem("clinic.token");
      const response = await fetch(
        apiUrl(`/api/appointments/export?date=${encodeURIComponent(exportDate)}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        let message = "Failed to export CSV.";
        try {
          const data = await response.json();
          if (data.message) message = data.message;
        } catch {
          // not json
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinic-schedule-${exportDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setExportMessage(`CSV exported for ${exportDate}.`);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark brand-mark-sm" aria-hidden="true" />
          <div>
            <p className="eyebrow">Clinic schedule</p>
            <h1>Care team</h1>
          </div>
        </div>

        <div className="user-chip">
          {user.role === "FRONT_DESK" ? (
            <button
              type="button"
              className={`btn-alert-bell ${alerts.length > 0 ? "has-alerts" : ""}`}
              onClick={() => setShowAlertsDrawer(!showAlertsDrawer)}
              title="Toggle unconfirmed appointment alerts"
            >
              🔔 Alerts {alerts.length > 0 ? <span className="badge-count">{alerts.length}</span> : null}
            </button>
          ) : null}

          <div className="avatar" aria-hidden="true">
            {initialsFromEmail(user.email)}
          </div>

          <div className="user-meta">
            <strong>{user.email}</strong>
            <span className="role-pill">
              {user.role.replaceAll("_", " ")}
              {user.providerName ? ` · ${user.providerName}` : ""}
            </span>
          </div>

          <button type="button" className="btn btn-secondary" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {/* GOAL 10: ALERTS BANNER FOR FRONT DESK */}
      {user.role === "FRONT_DESK" && (alerts.length > 0 || showAlertsDrawer) ? (
        <AlertsBanner
          alerts={alerts}
          onDismiss={handleDismissAlert}
          onConfirm={handleConfirmAlert}
          onView={(id) => setSelectedId(id)}
        />
      ) : null}

      {/* DASHBOARD */}
      {!selected ? <Dashboard /> : null}

      {selected ? (
        <AppointmentDetail
          appointment={selected}
          providers={providers}
          patients={patients}
          user={user}
          onBack={() => setSelectedId(null)}
          onChanged={handleChanged}
        />
      ) : (
        <>
          {/* ACTION BAR: CREATE SLOT */}
          <div className="schedule-header-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowCreateSlotModal(true);
                setCreateSlotError("");
                setCreateSlotSuccess("");
              }}
            >
              ➕ Create Single Slot
            </button>
          </div>

          {/* GOAL 7: FRONT DESK BULK TOOLS */}
          {user.role === "FRONT_DESK" ? (
            <>
              <section className="card">
                <p className="eyebrow">Front desk</p>
                <h2>Bulk availability</h2>
                <p className="muted">
                  Generate recurring available appointment slots for a provider.
                </p>

                {bulkError ? <p className="error">{bulkError}</p> : null}
                {bulkMessage ? <p className="success">{bulkMessage}</p> : null}

                <form className="search-panel" onSubmit={handleBulkAvailability}>
                  <div>
                    <label>
                      Provider
                      <select
                        value={bulkProviderId}
                        onChange={(e) => setBulkProviderId(e.target.value)}
                        required
                      >
                        <option value="">Select provider</option>
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
                    <label>
                      Start date
                      <input
                        type="date"
                        value={bulkStartDate}
                        onChange={(e) => setBulkStartDate(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  <div>
                    <label>
                      End date
                      <input
                        type="date"
                        value={bulkEndDate}
                        onChange={(e) => setBulkEndDate(e.target.value)}
                        required
                      />
                    </label>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <h3>Weekly time blocks</h3>
                    {bulkSlots.map((slot, index) => (
                      <div
                        key={index}
                        className="inline-form"
                        style={{ marginBottom: "10px" }}
                      >
                        <select
                          value={slot.dayOfWeek}
                          onChange={(e) =>
                            updateBulkSlot(index, "dayOfWeek", e.target.value)
                          }
                        >
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </select>

                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) =>
                            updateBulkSlot(index, "startTime", e.target.value)
                          }
                        />

                        <input
                          type="number"
                          min="1"
                          value={slot.duration}
                          onChange={(e) =>
                            updateBulkSlot(index, "duration", e.target.value)
                          }
                          placeholder="Duration"
                        />

                        {bulkSlots.length > 1 ? (
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => removeBulkSlot(index)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ))}

                    <button
                      type="button"
                      className="linkish"
                      onClick={addBulkSlot}
                    >
                      + Add weekly time block
                    </button>
                  </div>

                  <div className="search-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={bulkLoading}
                    >
                      {bulkLoading ? "Generating…" : "Generate slots"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card">
                <p className="eyebrow">Front desk</p>
                <h2>Export daily schedule</h2>
                <p className="muted">
                  Export the clinic schedule for a single day as CSV.
                </p>

                {exportError ? <p className="error">{exportError}</p> : null}
                {exportMessage ? <p className="success">{exportMessage}</p> : null}

                <div className="inline-form">
                  <input
                    type="date"
                    value={exportDate}
                    onChange={(e) => setExportDate(e.target.value)}
                  />

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleExport}
                    disabled={exportLoading}
                  >
                    {exportLoading ? "Exporting…" : "Export CSV"}
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {/* SCHEDULE / SEARCH (GOAL 6) */}
          <section className="card">
            <div className="section-intro">
              <div>
                <p className="eyebrow">Schedule</p>
                <h2>Appointments</h2>
                <p className="muted">
                  Providers see visits they schedule or join as support. Front desk sees the full clinic list.
                </p>
              </div>
            </div>

            <form className="search-panel" onSubmit={handleSearch}>
              <div>
                <label>
                  Patient search
                  <input
                    type="text"
                    placeholder="Search patient name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <label>
                  Provider
                  <select
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                  >
                    <option value="">All providers</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label>
                  Status
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="REQUESTED">Requested</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CHECKED_IN">Checked in</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="NO_SHOW">No show</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
              </div>

              <div>
                <label>
                  From
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <label>
                  To
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <label>
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      searchAppointments(1, { sortBy: e.target.value });
                    }}
                  >
                    <option value="date">Date & time</option>
                    <option value="status">Status</option>
                    <option value="provider">Provider</option>
                  </select>
                </label>
              </div>

              <div>
                <label>
                  Order
                  <select
                    value={sortOrder}
                    onChange={(e) => {
                      setSortOrder(e.target.value);
                      searchAppointments(1, { sortOrder: e.target.value });
                    }}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </label>
              </div>

              <div className="search-actions">
                <button type="submit" className="btn btn-primary">
                  Search
                </button>
                <button type="button" className="linkish" onClick={clearFilters}>
                  Clear
                </button>
              </div>
            </form>

            <div className="results-summary">
              <span>
                {total} appointment{total === 1 ? "" : "s"} found
              </span>
              {totalPages > 1 ? (
                <span>
                  Page {page} of {totalPages}
                </span>
              ) : null}
            </div>

            {loading ? (
              <p className="muted">Loading schedule…</p>
            ) : appointments.length === 0 ? (
              <p className="muted">No appointments match the current filters.</p>
            ) : (
              <div className="table-wrap">
                <table className="table-interactive">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Patient</th>
                      <th>Scheduling</th>
                      <th>Supporting</th>
                      <th>Your role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appt) => (
                      <tr key={appt.id} onClick={() => setSelectedId(appt.id)}>
                        <td>{formatWhen(appt.startTime)}</td>
                        <td>{appt.patient?.name || "— (Available)"}</td>
                        <td>{appt.provider?.name || "—"}</td>
                        <td>
                          {appt.supportingProviders?.length
                            ? appt.supportingProviders.map((s) => s.provider.name).join(", ")
                            : "—"}
                        </td>
                        <td>{roleLabel(appt, user.providerId)}</td>
                        <td>
                          <StatusBadge status={appt.status} archived={appt.archived} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && totalPages > 1 ? (
              <div className="pagination">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>

          {/* CREATE SINGLE SLOT MODAL */}
          {showCreateSlotModal ? (
            <div className="modal-backdrop">
              <div className="modal-card">
                <h3>Create New Appointment Slot</h3>
                <p className="muted">
                  Create an available appointment slot for a provider.
                </p>

                {createSlotError ? <p className="error">{createSlotError}</p> : null}
                {createSlotSuccess ? <p className="success">{createSlotSuccess}</p> : null}

                <form onSubmit={handleCreateSingleSlot}>
                  {user.role === "FRONT_DESK" ? (
                    <label>
                      Provider *
                      <select
                        value={newSlotProviderId}
                        onChange={(e) => setNewSlotProviderId(e.target.value)}
                        required
                      >
                        <option value="">Select provider…</option>
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label>
                    Date & Start Time *
                    <input
                      type="datetime-local"
                      value={newSlotStartTime}
                      onChange={(e) => setNewSlotStartTime(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Duration (minutes) *
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={newSlotDuration}
                      onChange={(e) => setNewSlotDuration(e.target.value)}
                      required
                    />
                  </label>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowCreateSlotModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={createSlotLoading || !newSlotStartTime}
                    >
                      {createSlotLoading ? "Creating…" : "Create Slot"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

// ============================================================
// APP ENTRY POINT
// ============================================================

function App() {
  const [user, setUser] = useState(getUser());

  if (!user) {
    return <Login onLoggedIn={setUser} />;
  }

  return (
    <Schedule
      user={user}
      onLogout={() => {
        clearSession();
        setUser(null);
      }}
    />
  );
}

export default App;

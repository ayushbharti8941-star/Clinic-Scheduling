
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
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      {status.replaceAll("_", " ")}
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
// GOAL 8 — DASHBOARD
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

  const {
    headline,
    breakdown,
    weeklyNoShowRate,
  } = dashboard;

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

      {/* ======================================================
          HEADLINE METRICS
      ======================================================= */}

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

      {/* ======================================================
          BREAKDOWN
      ======================================================= */}

      <div className="dashboard-sections">
        <div className="panel">
          <h3>Appointments by provider</h3>

          {breakdown.byProvider.length === 0 ? (
            <p className="muted">
              No appointment data available.
            </p>
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
            <p className="muted">
              No status data available.
            </p>
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

      {/* ======================================================
          NO-SHOW RATE
      ======================================================= */}

      <div className="panel">
        <h3>Weekly no-show rate</h3>

        {weeklyNoShowRate.length === 0 ? (
          <p className="muted">
            No historical appointment data available.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Total</th>
                <th>No-shows</th>
                <th>Rate</th>
              </tr>
            </thead>

            <tbody>
              {weeklyNoShowRate.map((week) => (
                <tr key={week.weekStart}>
                  <td>
                    {new Date(
                      week.weekStart
                    ).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                    {" – "}
                    {new Date(
                      week.weekEnd
                    ).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>

                  <td>{week.total}</td>

                  <td>{week.noShows}</td>

                  <td>{week.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ============================================================
// APPOINTMENT DETAIL
// ============================================================

function AppointmentDetail({
  appointment,
  providers,
  user,
  onBack,
  onChanged,
}) {
  const [providerId, setProviderId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage =
    user.role === "FRONT_DESK" ||
    user.providerId === appointment.providerId;

  const availableSupports = providers.filter(
    (provider) =>
      provider.id !== appointment.providerId &&
      !appointment.supportingProviders.some(
        (support) => support.providerId === provider.id
      )
  );

  async function addSupport(event) {
    event.preventDefault();

    if (!providerId) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api(
        `/api/appointments/${appointment.id}/supporting-providers`,
        {
          method: "POST",
          body: JSON.stringify({
            providerId: Number(providerId),
          }),
        }
      );

      setProviderId("");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeSupport(id) {
    setSaving(true);
    setError("");

    try {
      await api(
        `/api/appointments/${appointment.id}/supporting-providers/${id}`,
        {
          method: "DELETE",
        }
      );

      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <button
        type="button"
        className="linkish"
        onClick={onBack}
      >
        ← Back to schedule
      </button>

      <h2>{appointment.patient?.name || "Open slot"}</h2>

      <p className="muted">
        {formatWhen(appointment.startTime)} ·{" "}
        {appointment.duration} min ·{" "}
        <StatusBadge status={appointment.status} />
      </p>

      <p>
        Scheduling provider:{" "}
        <strong>{appointment.provider.name}</strong>
      </p>

      {error ? <p className="error">{error}</p> : null}

      <h3>Care team</h3>

      {appointment.supportingProviders.length === 0 ? (
        <p className="muted">
          No supporting providers yet.
        </p>
      ) : (
        <ul className="care-team">
          {appointment.supportingProviders.map((support) => (
            <li key={support.id}>
              <span>{support.provider.name}</span>

              {canManage ? (
                <button
                  type="button"
                  className="linkish"
                  disabled={saving}
                  onClick={() =>
                    removeSupport(support.providerId)
                  }
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage && availableSupports.length > 0 ? (
        <form
          className="inline-form"
          onSubmit={addSupport}
        >
          <select
            value={providerId}
            onChange={(event) =>
              setProviderId(event.target.value)
            }
            required
          >
            <option value="">
              Add supporting provider
            </option>

            {availableSupports.map((provider) => (
              <option
                key={provider.id}
                value={provider.id}
              >
                {provider.name}
              </option>
            ))}
          </select>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </button>
        </form>
      ) : null}

      <h3>Visit notes</h3>

      {appointment.visitNotes?.length ? (
        <ul className="notes">
          {appointment.visitNotes.map((note) => (
            <li key={note.id}>
              <strong>{note.provider.name}</strong>

              <span className="muted">
                {formatWhen(note.createdAt)}
              </span>

              <p>{note.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          No notes on this visit yet.
        </p>
      )}
    </section>
  );
}

// ============================================================
// SCHEDULE
// ============================================================

function Schedule({ user, onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // ============================================================
  // GOAL 6 — SEARCH / FILTER / SORT / PAGINATION
  // ============================================================

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

  // ============================================================
  // GOAL 7 — BULK AVAILABILITY
  // ============================================================

  const [bulkProviderId, setBulkProviderId] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");

  const [bulkSlots, setBulkSlots] = useState([
    {
      dayOfWeek: "1",
      startTime: "09:00",
      duration: "30",
    },
  ]);

  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkError, setBulkError] = useState("");

  // ============================================================
  // GOAL 7 — CSV EXPORT
  // ============================================================

  const [exportDate, setExportDate] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");

  // ============================================================
  // SCHEDULE LOADING
  // ============================================================

  async function loadDetail(id) {
    const data = await api(`/api/appointments/${id}`);

    setSelected(data.appointment);
  }

  // ============================================================
  // GOAL 6 — SEARCH
  // ============================================================

  async function searchAppointments(
    requestedPage = page,
    overrides = {}
  ) {
    const params = new URLSearchParams();

    const currentSearch =
      overrides.search !== undefined
        ? overrides.search
        : search;

    const currentProvider =
      overrides.providerFilter !== undefined
        ? overrides.providerFilter
        : providerFilter;

    const currentStatus =
      overrides.statusFilter !== undefined
        ? overrides.statusFilter
        : statusFilter;

    const currentFrom =
      overrides.fromDate !== undefined
        ? overrides.fromDate
        : fromDate;

    const currentTo =
      overrides.toDate !== undefined
        ? overrides.toDate
        : toDate;

    const currentSort =
      overrides.sortBy !== undefined
        ? overrides.sortBy
        : sortBy;

    const currentOrder =
      overrides.sortOrder !== undefined
        ? overrides.sortOrder
        : sortOrder;

    if (currentSearch.trim()) {
      params.set("q", currentSearch.trim());
    }

    if (currentProvider) {
      params.set("providerId", currentProvider);
    }

    if (currentStatus) {
      params.set("status", currentStatus);
    }

    if (currentFrom) {
      params.set("from", currentFrom);
    }

    if (currentTo) {
      params.set("to", currentTo);
    }

    params.set("sort", currentSort);
    params.set("order", currentOrder);
    params.set("page", requestedPage);
    params.set("pageSize", pageSize);

    const data = await api(
      `/api/appointments/search?${params.toString()}`
    );

    setAppointments(data.appointments || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
    setPage(data.page || requestedPage);
  }

  async function refresh() {
    setError("");
    setLoading(true);

    try {
      const providerData = await api("/api/providers");

      setProviders(providerData.providers);

      await searchAppointments(1);
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

    loadDetail(selectedId).catch((err) =>
      setError(err.message)
    );
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
    if (newPage < 1 || newPage > totalPages) {
      return;
    }

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

  async function handleSortChange(event) {
    const value = event.target.value;

    setSortBy(value);

    setError("");
    setLoading(true);

    try {
      await searchAppointments(1, {
        sortBy: value,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSortOrderChange(event) {
    const value = event.target.value;

    setSortOrder(value);

    setError("");
    setLoading(true);

    try {
      await searchAppointments(1, {
        sortOrder: value,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleChanged() {
    await searchAppointments(page);

    if (selectedId) {
      await loadDetail(selectedId);
    }
  }

  // ============================================================
  // GOAL 7A — BULK AVAILABILITY
  // ============================================================

  function addBulkSlot() {
    setBulkSlots((current) => [
      ...current,
      {
        dayOfWeek: "1",
        startTime: "09:00",
        duration: "30",
      },
    ]);
  }

  function removeBulkSlot(index) {
    setBulkSlots((current) =>
      current.filter((_, slotIndex) => slotIndex !== index)
    );
  }

  function updateBulkSlot(index, field, value) {
    setBulkSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index
          ? {
              ...slot,
              [field]: value,
            }
          : slot
      )
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
      setBulkError(
        "Please select both start and end dates."
      );
      return;
    }

    if (bulkSlots.length === 0) {
      setBulkError(
        "Please add at least one weekly time block."
      );
      return;
    }

    setBulkLoading(true);

    try {
      const data = await api(
        "/api/appointments/bulk-availability",
        {
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
        }
      );

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

  // ============================================================
  // GOAL 7B — CSV EXPORT
  // ============================================================

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
        apiUrl(
          `/api/appointments/export?date=${encodeURIComponent(
            exportDate
          )}`
        ),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let message = "Failed to export CSV.";

        try {
          const data = await response.json();

          if (data.message) {
            message = data.message;
          }
        } catch {
          // Response was not JSON.
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

      setExportMessage(
        `CSV exported for ${exportDate}.`
      );
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
          <div className="avatar" aria-hidden="true">
            {initialsFromEmail(user.email)}
          </div>

          <div className="user-meta">
            <strong>{user.email}</strong>
            <span className="role-pill">
              {user.role.replaceAll("_", " ")}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onLogout}
          >
            Sign out
          </button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {/* =====================================================
          GOAL 8 — DASHBOARD
      ====================================================== */}

      {!selected ? <Dashboard /> : null}

      {selected ? (
        <AppointmentDetail
          appointment={selected}
          providers={providers}
          user={user}
          onBack={() => setSelectedId(null)}
          onChanged={handleChanged}
        />
      ) : (
        <>
          {/* =====================================================
              GOAL 7 — FRONT DESK TOOLS
          ====================================================== */}

          {user.role === "FRONT_DESK" ? (
            <>
              <section className="card">
                <p className="eyebrow">Front desk</p>
                <h2>Bulk availability</h2>

                <p className="muted">
                  Generate recurring available appointment
                  slots for a provider.
                </p>

                {bulkError ? (
                  <p className="error">{bulkError}</p>
                ) : null}

                {bulkMessage ? (
                  <p className="success">{bulkMessage}</p>
                ) : null}

                <form
                  className="search-panel"
                  onSubmit={handleBulkAvailability}
                >
                  <div>
                    <label>
                      Provider
                      <select
                        value={bulkProviderId}
                        onChange={(event) =>
                          setBulkProviderId(
                            event.target.value
                          )
                        }
                        required
                      >
                        <option value="">
                          Select provider
                        </option>

                        {providers.map((provider) => (
                          <option
                            key={provider.id}
                            value={provider.id}
                          >
                            {provider.name}
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
                        onChange={(event) =>
                          setBulkStartDate(
                            event.target.value
                          )
                        }
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
                        onChange={(event) =>
                          setBulkEndDate(
                            event.target.value
                          )
                        }
                        required
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      gridColumn: "1 / -1",
                    }}
                  >
                    <h3>Weekly time blocks</h3>

                    {bulkSlots.map((slot, index) => (
                      <div
                        key={index}
                        className="inline-form"
                        style={{
                          marginBottom: "10px",
                        }}
                      >
                        <select
                          value={slot.dayOfWeek}
                          onChange={(event) =>
                            updateBulkSlot(
                              index,
                              "dayOfWeek",
                              event.target.value
                            )
                          }
                        >
                          <option value="0">
                            Sunday
                          </option>

                          <option value="1">
                            Monday
                          </option>

                          <option value="2">
                            Tuesday
                          </option>

                          <option value="3">
                            Wednesday
                          </option>

                          <option value="4">
                            Thursday
                          </option>

                          <option value="5">
                            Friday
                          </option>

                          <option value="6">
                            Saturday
                          </option>
                        </select>

                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(event) =>
                            updateBulkSlot(
                              index,
                              "startTime",
                              event.target.value
                            )
                          }
                        />

                        <input
                          type="number"
                          min="1"
                          value={slot.duration}
                          onChange={(event) =>
                            updateBulkSlot(
                              index,
                              "duration",
                              event.target.value
                            )
                          }
                          placeholder="Duration"
                        />

                        {bulkSlots.length > 1 ? (
                          <button
                            type="button"
                            className="linkish"
                            onClick={() =>
                              removeBulkSlot(index)
                            }
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
                      {bulkLoading
                        ? "Generating…"
                        : "Generate slots"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card">
                <p className="eyebrow">Front desk</p>
                <h2>Export daily schedule</h2>

                <p className="muted">
                  Export the clinic schedule for a single
                  day as CSV.
                </p>

                {exportError ? (
                  <p className="error">
                    {exportError}
                  </p>
                ) : null}

                {exportMessage ? (
                  <p className="success">{exportMessage}</p>
                ) : null}

                <div className="inline-form">
                  <input
                    type="date"
                    value={exportDate}
                    onChange={(event) =>
                      setExportDate(
                        event.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleExport}
                    disabled={exportLoading}
                  >
                    {exportLoading
                      ? "Exporting…"
                      : "Export CSV"}
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {/* =====================================================
              SCHEDULE / GOAL 6
          ====================================================== */}

          <section className="card">
            <div className="section-intro">
              <div>
                <p className="eyebrow">Schedule</p>
                <h2>Appointments</h2>
                <p className="muted">
                  Providers see visits they schedule or join as support.
                  Front desk sees the full clinic list.
                </p>
              </div>
            </div>

            <form
              className="search-panel"
              onSubmit={handleSearch}
            >
              <div>
                <label>
                  Patient search
                  <input
                    type="text"
                    placeholder="Search patient name"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                  />
                </label>
              </div>

              <div>
                <label>
                  Provider
                  <select
                    value={providerFilter}
                    onChange={(event) =>
                      setProviderFilter(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      All providers
                    </option>

                    {providers.map((provider) => (
                      <option
                        key={provider.id}
                        value={provider.id}
                      >
                        {provider.name}
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
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      All statuses
                    </option>

                    <option value="AVAILABLE">
                      Available
                    </option>

                    <option value="REQUESTED">
                      Requested
                    </option>

                    <option value="CONFIRMED">
                      Confirmed
                    </option>

                    <option value="CHECKED_IN">
                      Checked in
                    </option>

                    <option value="COMPLETED">
                      Completed
                    </option>

                    <option value="NO_SHOW">
                      No show
                    </option>
                  </select>
                </label>
              </div>

              <div>
                <label>
                  From
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) =>
                      setFromDate(
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <div>
                <label>
                  To
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) =>
                      setToDate(
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <div>
                <label>
                  Sort by
                  <select
                    value={sortBy}
                    onChange={handleSortChange}
                  >
                    <option value="date">
                      Date & time
                    </option>

                    <option value="status">
                      Status
                    </option>

                    <option value="provider">
                      Provider
                    </option>
                  </select>
                </label>
              </div>

              <div>
                <label>
                  Order
                  <select
                    value={sortOrder}
                    onChange={handleSortOrderChange}
                  >
                    <option value="asc">
                      Ascending
                    </option>

                    <option value="desc">
                      Descending
                    </option>
                  </select>
                </label>
              </div>

              <div className="search-actions">
                <button type="submit" className="btn btn-primary">
                  Search
                </button>

                <button
                  type="button"
                  className="linkish"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="results-summary">
              <span>
                {total} appointment
                {total === 1 ? "" : "s"} found
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
              <p className="muted">
                No appointments match the current
                filters.
              </p>
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
                  {appointments.map((appointment) => (
                    <tr
                      key={appointment.id}
                      onClick={() =>
                        setSelectedId(
                          appointment.id
                        )
                      }
                    >
                      <td>
                        {formatWhen(
                          appointment.startTime
                        )}
                      </td>

                      <td>
                        {appointment.patient?.name ||
                          "—"}
                      </td>

                      <td>
                        {appointment.provider?.name ||
                          "—"}
                      </td>

                      <td>
                        {appointment.supportingProviders
                          ?.length
                          ? appointment.supportingProviders
                              .map(
                                (support) =>
                                  support.provider.name
                              )
                              .join(", ")
                          : "—"}
                      </td>

                      <td>
                        {roleLabel(
                          appointment,
                          user.providerId
                        )}
                      </td>

                      <td>
                        <StatusBadge status={appointment.status} />
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
                  onClick={() =>
                    handlePageChange(page - 1)
                  }
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
                  onClick={() =>
                    handlePageChange(page + 1)
                  }
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}

// ============================================================
// APP
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


import { useEffect, useState } from "react";
import { api, clearSession, getUser, setSession } from "./api";
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
        <p className="eyebrow">BUSY Infotech take-home</p>
        <h1>Clinic scheduling</h1>
        <p className="muted">
          Sign in as front desk or a provider. Demo password is{" "}
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
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <div className="demo-accounts">
          <button
            type="button"
            className="linkish"
            onClick={() => setEmail("frontdesk@clinic.com")}
          >
            Front desk
          </button>
          <button
            type="button"
            className="linkish"
            onClick={() => setEmail("provider@clinic.com")}
          >
            Dr. Priya
          </button>
          <button
            type="button"
            className="linkish"
            onClick={() => setEmail("provider2@clinic.com")}
          >
            Dr. Arjun
          </button>
        </div>
      </form>
    </main>
  );
}

function roleLabel(appointment, userProviderId) {
  if (!userProviderId) {
    return "Clinic";
  }
  if (appointment.providerId === userProviderId) {
    return "Scheduling";
  }
  return "Supporting";
}

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
    user.role === "FRONT_DESK" || user.providerId === appointment.providerId;

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
      await api(`/api/appointments/${appointment.id}/supporting-providers`, {
        method: "POST",
        body: JSON.stringify({ providerId: Number(providerId) }),
      });
      setProviderId("");
      onChanged();
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
        { method: "DELETE" }
      );
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <button type="button" className="linkish" onClick={onBack}>
        ← Back to schedule
      </button>
      <h2>{appointment.patient?.name || "Open slot"}</h2>
      <p className="muted">
        {formatWhen(appointment.startTime)} · {appointment.duration} min ·{" "}
        {appointment.status.replaceAll("_", " ")}
      </p>
      <p>
        Scheduling provider: <strong>{appointment.provider.name}</strong>
      </p>
      {error ? <p className="error">{error}</p> : null}

      <h3>Care team</h3>
      {appointment.supportingProviders.length === 0 ? (
        <p className="muted">No supporting providers yet.</p>
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
                  onClick={() => removeSupport(support.providerId)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage && availableSupports.length > 0 ? (
        <form className="inline-form" onSubmit={addSupport}>
          <select
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
            required
          >
            <option value="">Add supporting provider</option>
            {availableSupports.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={saving}>
            Add
          </button>
        </form>
      ) : null}

      <h3>Visit notes</h3>
      {appointment.visitNotes?.length ? (
        <ul className="notes">
          {appointment.visitNotes.map((note) => (
            <li key={note.id}>
              <strong>{note.provider.name}</strong>
              <span className="muted">{formatWhen(note.createdAt)}</span>
              <p>{note.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No notes on this visit yet.</p>
      )}
    </section>
  );
}

function Schedule({ user, onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadSchedule() {
    const data = await api("/api/appointments/schedule");
    setAppointments(data.appointments);
  }

  async function loadDetail(id) {
    const data = await api(`/api/appointments/${id}`);
    setSelected(data.appointment);
  }

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [scheduleData, providerData] = await Promise.all([
        api("/api/appointments/schedule"),
        api("/api/providers"),
      ]);
      setAppointments(scheduleData.appointments);
      setProviders(providerData.providers);
      if (selectedId) {
        const data = await api(`/api/appointments/${selectedId}`);
        setSelected(data.appointment);
      }
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
    loadDetail(selectedId).catch((err) => setError(err.message));
  }, [selectedId]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Clinic schedule</p>
          <h1>Care team view</h1>
        </div>
        <div className="user-chip">
          <span>
            {user.email} · {user.role.replaceAll("_", " ")}
          </span>
          <button type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {selected ? (
        <AppointmentDetail
          appointment={selected}
          providers={providers}
          user={user}
          onBack={() => setSelectedId(null)}
          onChanged={() => {
            loadSchedule();
            loadDetail(selected.id);
          }}
        />
      ) : (
        <section className="card">
          <p className="muted">
            Providers see every appointment they schedule or join as support.
            Front desk sees the full clinic list.
          </p>
          {loading ? (
            <p>Loading schedule…</p>
          ) : appointments.length === 0 ? (
            <p>No appointments on this schedule yet.</p>
          ) : (
            <table>
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
                    onClick={() => setSelectedId(appointment.id)}
                  >
                    <td>{formatWhen(appointment.startTime)}</td>
                    <td>{appointment.patient?.name || "—"}</td>
                    <td>{appointment.provider.name}</td>
                    <td>
                      {appointment.supportingProviders.length
                        ? appointment.supportingProviders
                            .map((support) => support.provider.name)
                            .join(", ")
                        : "—"}
                    </td>
                    <td>{roleLabel(appointment, user.providerId)}</td>
                    <td>{appointment.status.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}

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

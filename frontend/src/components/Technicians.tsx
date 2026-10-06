import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, Plus, Search, Pencil, CalendarDays } from "lucide-react";
import api from "../api/api";
import {
  getAll,
  invalidateOperations,
  isOpenJob,
  manilaDay,
  manilaDate,
} from "../api/operational";
import { Booking, Branch, Technician } from "../types";
import { useAuth } from "../auth/AuthContext";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Spinner,
  StatusBadge,
  inputClass,
} from "./ui";
import { Avatar } from "./Visuals";
import Modal from "./Modal";
import WorkOrderModal from "./WorkOrderModal";
import { useSearchParams } from "react-router-dom";

export default function Technicians() {
  const client = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  useEffect(() => {
    setSearch(params.get("q") ?? "");
  }, [params]);
  const [filter, setFilter] = useState("active");
  const [branchFilter, setBranchFilter] = useState("");
  const [day, setDay] = useState(manilaDay());
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<Technician | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const techs = useQuery({
    queryKey: ["technicians", "all"],
    queryFn: () =>
      getAll<Technician>("/technicians", { includeInactive: "true" }),
  });
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getAll<Booking>("/bookings"),
  });
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => getAll<Branch>("/branches"),
  });
  const openForm = (tech: Technician | null = null) => {
    setEditing(tech);
    setName(tech?.name ?? "");
    setPhone(tech?.phone ?? "");
    setBranchId(
      tech?.branchId ??
        user?.branchId ??
        (branches.data?.length === 1 ? branches.data[0].id : ""),
    );
    setActive(tech?.isActive ?? true);
    setError("");
    setForm(true);
  };
  const save = useMutation({
    mutationFn: async () => {
      if (editing)
        await api.patch("/technicians/" + editing.id, {
          name: name.trim(),
          phone: phone.trim() || null,
          branchId,
          isActive: active,
        });
      else
        await api.post("/technicians", {
          name: name.trim(),
          phone: phone.trim() || undefined,
          branchId,
        });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["technicians"] });
      invalidateOperations(client);
      setForm(false);
    },
    onError: (err: Error) => setError(err.message),
  });
  if (techs.isLoading) return <Spinner label="Loading your team…" />;
  if (techs.isError)
    return <ErrorState error={techs.error} onRetry={() => techs.refetch()} />;
  const rows = (techs.data ?? []).filter(
    (t) =>
      (filter === "all" || (filter === "active" ? t.isActive : !t.isActive)) &&
      (!branchFilter || t.branchId === branchFilter) &&
      [t.name, t.phone, t.branch?.name]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <div className="page-stack">
      <PageHeader
        title="Technician dispatch"
        subtitle="A clear view of your team's visits and availability."
        action={
          <Button onClick={() => openForm()}>
            <Plus size={16} /> Add technician
          </Button>
        }
      />
      <Card>
        <div className="page-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search technicians"
              className={inputClass}
              placeholder="Search your team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter branch"
            className={inputClass}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">All branches</option>
            {branches.data?.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Dispatch date (Manila)"
            type="date"
            className={inputClass}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
        <div className="tab-bar">
          {["active", "inactive", "all"].map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </Card>
      {bookings.isError && (
        <ErrorState error={bookings.error} onRetry={() => bookings.refetch()} />
      )}
      {rows.length ? (
        <div className="team-grid">
          {rows.map((t) => {
            const visits = (bookings.data ?? [])
              .filter(
                (b) =>
                  b.technicianId === t.id &&
                  manilaDay(b.scheduledAt) === day &&
                  b.status !== "CANCELLED",
              )
              .sort(
                (a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt),
              );
            const current = visits.find((b) => b.status === "ON_SITE");
            const workload = visits
              .filter((b) => isOpenJob(b.status))
              .reduce((sum, b) => sum + (b.durationMinutes ?? 120), 0);
            return (
              <Card key={t.id}>
                <div className="panel-header">
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} />
                    <div>
                      <h3>{t.name}</h3>
                      <small className="muted">{t.branch?.name}</small>
                    </div>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={"Edit " + t.name}
                    onClick={() => openForm(t)}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <div className="panel-body form-stack">
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        "badge " +
                        (!t.isActive
                          ? "badge-muted"
                          : current
                            ? "badge-blue"
                            : "badge-green")
                      }
                    >
                      {!t.isActive
                        ? "Inactive"
                        : current
                          ? "On site"
                          : "Active"}
                    </span>
                    {t.phone && (
                      <a
                        className="icon-button"
                        href={"tel:" + t.phone}
                        aria-label={"Call " + t.name}
                      >
                        <Phone size={16} />
                      </a>
                    )}
                  </div>
                  {bookings.data === undefined ? (
                    <div className="notice notice-warning" role="status">
                      <CalendarDays size={18} />
                      <p className="muted">
                        {bookings.isError
                          ? "Schedule unavailable. Visit count and workload are unknown."
                          : "Loading the visit schedule…"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {bookings.isError && (
                        <p className="field-hint" role="status">
                          Showing the last loaded schedule; it could not be refreshed.
                        </p>
                      )}
                      {visits.length > 0 && (
                        <div className="dispatch-stat">
                          <strong>{visits.length}</strong>
                          <span className="muted">
                            {visits.length === 1 ? "scheduled visit" : "scheduled visits"}
                            {workload > 0 && (
                              <> · {workload / 60} {workload === 60 ? "hour" : "hours"} of open work</>
                            )}
                          </span>
                        </div>
                      )}
                      {visits.length ? (
                        <div className="dispatch-list">
                          {visits.map((b) => (
                            <button
                              className="history-entry"
                              key={b.id}
                              onClick={() => setSelectedJob(b.id)}
                            >
                              <div>
                                <strong>{b.customer?.name}</strong>
                                <small>
                                  {manilaDate(b.scheduledAt, true)} ·{" "}
                                  {b.serviceType}
                                </small>
                              </div>
                              <StatusBadge status={b.status} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="notice">
                          <CalendarDays size={18} />
                          <p className="muted">No visits scheduled on this date.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No technicians match"
            message="Adjust the filter or add a technician to your branch."
          />
        </Card>
      )}
      <Modal
        isOpen={form}
        onClose={() => setForm(false)}
        title={editing ? "Edit technician" : "Add technician"}
      >
        <form
          className="panel-body form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Name" htmlFor="tech-name">
            <input
              id="tech-name"
              required
              maxLength={120}
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="tech-phone">
            <input
              id="tech-phone"
              type="tel"
              minLength={8}
              maxLength={20}
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field
            label="Branch"
            htmlFor="tech-branch"
            hint={
              editing
                ? "Branch changes are checked against existing assignments."
                : undefined
            }
          >
            <select
              id="tech-branch"
              required
              disabled={!isAdmin}
              className={inputClass}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Select a branch</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          {editing && (
            <label className="inspection-item">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span>Active and eligible for assignment</span>
            </label>
          )}
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save technician
            </Button>
          </div>
        </form>
      </Modal>
      <WorkOrderModal
        bookingId={selectedJob}
        isOpen={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  History,
  Pencil,
  Plus,
  Search,
  Snowflake,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import api from "../api/api";
import {
  getAll,
  invalidateOperations,
  jobNumber,
  manilaDate,
  manilaDay,
} from "../api/operational";
import { Booking, Customer, ServiceSite, Unit } from "../types";
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
import Modal from "./Modal";
import WorkOrderModal from "./WorkOrderModal";

const emptyForm = {
  customerId: "",
  serviceSiteId: "",
  name: "",
  brand: "",
  model: "",
  serialNumber: "",
  type: "Split type",
  capacity: "",
  location: "",
  installedAt: "",
  nextMaintenanceAt: "",
  notes: "",
};
const dateValue = (value?: string | null) => (value ? manilaDay(value) : "");
const dateIso = (value: string) =>
  value ? new Date(value + "T00:00:00+08:00").toISOString() : null;
const isDue = (unit: Unit) =>
  Boolean(
    unit.nextMaintenanceAt && manilaDay(unit.nextMaintenanceAt) <= manilaDay(),
  );

export default function Units() {
  const client = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const dueOnly = params.get("due") === "1";
  const setDueOnly = (enabled: boolean) => setParams(current => {
    const next = new URLSearchParams(current);
    if (enabled) next.set("due", "1"); else next.delete("due");
    return next;
  });
  const [editing, setEditing] = useState<Unit | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [historyUnit, setHistoryUnit] = useState<Unit | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const units = useQuery({
    queryKey: ["units"],
    queryFn: () => getAll<Unit>("/units"),
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => getAll<Customer>("/customers"),
  });
  const sites = useQuery({
    queryKey: ["service-sites", "active"],
    queryFn: () => getAll<ServiceSite>("/service-sites"),
  });
  const history = useQuery({
    queryKey: ["bookings", "unit-history", historyUnit?.id],
    queryFn: () => getAll<Booking>("/bookings", { unitId: historyUnit!.id }),
    enabled: Boolean(historyUnit),
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        installedAt: dateIso(form.installedAt),
        nextMaintenanceAt: dateIso(form.nextMaintenanceAt),
      };
      return editing
        ? api.patch("/units/" + editing.id, body)
        : api.post("/units", body);
    },
    onSuccess: () => {
      setIsOpen(false);
      setError("");
      invalidateOperations(client);
    },
    onError: (err: Error) => setError(err.message),
  });
  const open = (unit?: Unit) => {
    setError("");
    setEditing(unit ?? null);
    setForm(
      unit
        ? {
            customerId: unit.customerId,
            serviceSiteId: unit.serviceSiteId ?? "",
            name: unit.name,
            brand: unit.brand ?? "",
            model: unit.model ?? "",
            serialNumber: unit.serialNumber ?? "",
            type: unit.type,
            capacity: unit.capacity ?? "",
            location: unit.location ?? "",
            installedAt: dateValue(unit.installedAt),
            nextMaintenanceAt: dateValue(unit.nextMaintenanceAt),
            notes: unit.notes ?? "",
          }
        : { ...emptyForm },
    );
    setIsOpen(true);
  };
  const update = (key: keyof typeof emptyForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    save.mutate();
  };
  const all = units.data ?? [];
  const rows = all.filter(
    (unit) =>
      (!dueOnly || isDue(unit)) &&
      [
        unit.name,
        unit.customer?.name,
        unit.brand,
        unit.model,
        unit.serialNumber,
        unit.location,
      ].some((value) => value?.toLowerCase().includes(search.toLowerCase())),
  );
  const siteChoices = (sites.data ?? []).filter(
    (site) => site.customerId === form.customerId && site.isActive,
  );
  const dueCount = all.filter(isDue).length;
  if (units.isLoading) return <Spinner label="Loading registered units…" />;
  if (units.isError)
    return <ErrorState error={units.error} onRetry={() => units.refetch()} />;
  return (
    <div className="page-stack">
      <PageHeader
        title="Every unit, accounted for"
        subtitle="Equipment records, service history, and the next visit — in one place."
        action={
          <Button onClick={() => open()}>
            <Plus size={16} /> Register unit
          </Button>
        }
      />
      <Card>
        <div className="page-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              className={inputClass}
              aria-label="Search units"
              placeholder="Search unit, client, or serial number…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="tab-bar">
            <button
              className={!dueOnly ? "active" : ""}
              onClick={() => setDueOnly(false)}
            >
              All units · {all.length}
            </button>
            <button
              className={dueOnly ? "active" : ""}
              onClick={() => setDueOnly(true)}
            >
              Service due · {dueCount}
            </button>
          </div>
        </div>
      </Card>
      {!rows.length ? (
        <Card>
          <EmptyState
            title={
              dueOnly
                ? "No units due for service"
                : search
                  ? "No matching units"
                  : "Start with your first unit"
            }
            message={
              dueOnly
                ? "Set a next-service date on each unit to plan preventive maintenance."
                : search
                  ? "Try a different client, brand, or serial number."
                  : "Register the equipment you service to keep its maintenance history together."
            }
            action={
              !search && !dueOnly ? (
                <Button onClick={() => open()}>Register unit</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="unit-grid">
          {rows.map((unit) => (
            <Card key={unit.id}>
              <div className="panel-header">
                <h2>
                  <Snowflake size={17} /> {unit.name}
                </h2>
                <button
                  className="icon-button"
                  aria-label={"Edit " + unit.name}
                  onClick={() => open(unit)}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <div className="panel-body">
                <p className="muted">
                  {unit.customer?.name ?? "Client"}
                  {unit.location ? " · " + unit.location : ""}
                </p>
                {unit.serviceSite?.name && (
                  <p className="muted">Service site · {unit.serviceSite.name}</p>
                )}
                <dl className="detail-grid">
                  <div>
                    <dt>Equipment</dt>
                    <dd>
                      {unit.brand}
                      {unit.model ? " · " + unit.model : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Type / capacity</dt>
                    <dd>
                      {unit.type}
                      {unit.capacity ? " · " + unit.capacity : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Serial number</dt>
                    <dd>{unit.serialNumber || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Installed</dt>
                    <dd>
                      {unit.installedAt
                        ? manilaDate(unit.installedAt)
                        : "Not recorded"}
                    </dd>
                  </div>
                </dl>
                <div
                  className={"notice " + (isDue(unit) ? "notice-warning" : "")}
                >
                  <CalendarClock size={16} />{" "}
                  {unit.nextMaintenanceAt ? (
                    <span>
                      Next service ·{" "}
                      <strong>{manilaDate(unit.nextMaintenanceAt)}</strong>
                      {isDue(unit) ? " · Due" : ""}
                    </span>
                  ) : (
                    <span>Next service date has not been set.</span>
                  )}
                </div>
                <div className="workorder-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setHistoryUnit(unit)}
                  >
                    <History size={15} /> Service history
                  </Button>
                  <Button variant="secondary" onClick={() => open(unit)}>
                    Edit record
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        isOpen={isOpen}
        onClose={() => !save.isPending && setIsOpen(false)}
        title={editing ? "Edit unit record" : "Register an aircon unit"}
        subtitle="Keep each unit connected to its owner and service history."
      >
        <form className="form-stack" onSubmit={submit}>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          {customers.isError && (
            <p className="notice notice-error" role="alert">
              {customers.error.message}
            </p>
          )}
          {sites.isError && (
            <p className="notice notice-error" role="alert">
              Could not load service sites: {sites.error.message}
            </p>
          )}
          <div className="form-grid">
            <Field label="Client">
              <select
                className={inputClass}
                value={form.customerId}
                onChange={(e) => setForm((current) => ({ ...current, customerId: e.target.value, serviceSiteId: "" }))}
                required
                disabled={customers.isLoading}
              >
                <option value="">Choose client</option>
                {customers.data?.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Service site"
              hint={isAdmin ? "Optional for organization records." : "Choose a site in your branch so this unit stays in your service scope."}
            >
              <select
                className={inputClass}
                value={form.serviceSiteId}
                onChange={(event) => update("serviceSiteId", event.target.value)}
                required={!isAdmin}
                disabled={!form.customerId || sites.isLoading || sites.isError}
              >
                <option value="">{isAdmin ? "No assigned site" : "Choose a service site"}</option>
                {siteChoices.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} · {site.address}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit name">
              <input
                className={inputClass}
                required
                minLength={2}
                maxLength={120}
                placeholder="Reception split unit"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="Brand">
              <input
                className={inputClass}
                required
                maxLength={80}
                placeholder="Daikin, Carrier, Panasonic…"
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
              />
            </Field>
            <Field label="Model">
              <input
                className={inputClass}
                maxLength={100}
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
              />
            </Field>
            <Field label="Serial number">
              <input
                className={inputClass}
                maxLength={100}
                value={form.serialNumber}
                onChange={(e) => update("serialNumber", e.target.value)}
              />
            </Field>
            <Field label="Unit type">
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => update("type", e.target.value)}
              >
                {[
                  "Split type",
                  "Window type",
                  "Cassette",
                  "Floor standing",
                  "Ducted",
                  "Other",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
                {form.type &&
                  ![
                    "Split type",
                    "Window type",
                    "Cassette",
                    "Floor standing",
                    "Ducted",
                    "Other",
                  ].includes(form.type) && <option>{form.type}</option>}
              </select>
            </Field>
            <Field label="Capacity">
              <input
                className={inputClass}
                maxLength={80}
                placeholder="1.5 HP / 12,000 BTU"
                value={form.capacity}
                onChange={(e) => update("capacity", e.target.value)}
              />
            </Field>
            <Field label="Location">
              <input
                className={inputClass}
                maxLength={300}
                placeholder="Second floor, meeting room"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </Field>
            <Field label="Installation date">
              <input
                type="date"
                className={inputClass}
                value={form.installedAt}
                onChange={(e) => update("installedAt", e.target.value)}
              />
            </Field>
            <Field
              label="Next service date"
              hint="Choose a date based on usage and the manufacturer's guidance."
            >
              <input
                type="date"
                className={inputClass}
                value={form.nextMaintenanceAt}
                onChange={(e) => update("nextMaintenanceAt", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Equipment notes">
            <textarea
              className={inputClass}
              rows={3}
              maxLength={2000}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Field>
          {editing && (
            <p className="muted">
              A unit with service history stays with its original client.
            </p>
          )}
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={save.isPending}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={!customers.data?.length || (!isAdmin && (!siteChoices.length || sites.isLoading || sites.isError))}
            >
              {editing ? "Save unit" : "Register unit"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(historyUnit)}
        onClose={() => setHistoryUnit(null)}
        title={historyUnit?.name ?? "Service history"}
        subtitle={
          (historyUnit?.customer?.name ?? "Client") + " · Service history"
        }
      >
        <div className="modal-body">
          {history.isLoading ? (
            <Spinner label="Loading unit history…" />
          ) : history.isError ? (
            <ErrorState
              error={history.error}
              onRetry={() => history.refetch()}
            />
          ) : !history.data?.length ? (
            <EmptyState
              title="No accessible service visits yet"
              message="Choose this unit when creating a booking. Linked visits appear here within your branch access."
            />
          ) : (
            <div className="history-list">
              {[...history.data]
                .sort(
                  (a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt),
                )
                .map((job) => (
                  <div className="history-entry" key={job.id}>
                    <div className="panel-header">
                      <button
                        className="text-button"
                        onClick={() => {
                          setJobId(job.id);
                          setHistoryUnit(null);
                        }}
                      >
                        {jobNumber(job.id)} · {job.serviceType}
                      </button>
                      <StatusBadge status={job.status} />
                    </div>
                    <small>
                      {manilaDate(job.scheduledAt, true)} ·{" "}
                      {job.technician?.name ?? "Unassigned"}
                    </small>
                    {job.diagnosis && <p>{job.diagnosis}</p>}
                  </div>
                ))}
            </div>
          )}
        </div>
      </Modal>
      <WorkOrderModal
        bookingId={jobId}
        isOpen={Boolean(jobId)}
        onClose={() => setJobId(null)}
      />
    </div>
  );
}

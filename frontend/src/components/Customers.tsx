import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  MapPin,
  Pencil,
  Plus,
  Search,
  Users,
} from "lucide-react";
import api from "../api/api";
import {
  getAll,
  invalidateOperations,
  jobNumber,
  manilaDate,
} from "../api/operational";
import { Booking, Customer, Unit } from "../types";
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
import BookingModal from "./BookingModal";
import WorkOrderModal from "./WorkOrderModal";
import { Avatar } from "./Visuals";
import { useSearchParams } from "react-router-dom";

export default function Customers() {
  const client = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  useEffect(() => {
    setSearch(params.get("q") ?? "");
  }, [params]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [customerType, setCustomerType] = useState("Residential");
  const [contactPerson, setContactPerson] = useState("");
  const [error, setError] = useState("");
  const [bookingClient, setBookingClient] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => getAll<Customer>("/customers"),
  });
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getAll<Booking>("/bookings"),
  });
  const units = useQuery({
    queryKey: ["units"],
    queryFn: () => getAll<Unit>("/units"),
  });
  const openForm = (customer: Customer | null = null) => {
    setEditing(customer);
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setAddress(customer?.address ?? "");
    setEmail(customer?.email ?? "");
    setCustomerType(customer?.type ?? "Residential");
    setContactPerson(customer?.contactPerson ?? "");
    setError("");
    setForm(true);
  };
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim() || null,
        type: customerType,
        contactPerson: contactPerson.trim() || null,
      };
      const response = editing
        ? await api.patch<Customer>("/customers/" + editing.id, body)
        : await api.post<Customer>("/customers", body);
      return response.data;
    },
    onSuccess: (data) => {
      invalidateOperations(client);
      if (selected?.id === data.id) setSelected(data);
      setForm(false);
    },
    onError: (err: Error) => setError(err.message),
  });
  if (customers.isLoading) return <Spinner label="Loading clients…" />;
  if (customers.isError)
    return (
      <ErrorState error={customers.error} onRetry={() => customers.refetch()} />
    );
  const rows = (customers.data ?? []).filter((c) =>
    [c.name, c.phone, c.address]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const history = (bookings.data ?? [])
    .filter((b) => b.customerId === selected?.id)
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
  const equipment = (units.data ?? []).filter(
    (u) => u.customerId === selected?.id,
  );
  return (
    <div className="page-stack">
      <PageHeader
        title="Clients"
        subtitle="People, properties and a complete service history."
        action={
          <Button onClick={() => openForm()}>
            <Plus size={16} /> Add client
          </Button>
        }
      />
      <Card>
        <div className="page-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              className={inputClass}
              aria-label="Search clients"
              placeholder="Search name, phone or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="muted">{rows.length} clients</span>
        </div>
      </Card>
      <Card>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Service address</th>
                  <th>Visits</th>
                  <th>Equipment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <button
                          className="text-button"
                          onClick={() => setSelected(c)}
                        >
                          {c.name}
                        </button>
                      </div>
                    </td>
                    <td>
                      <a href={"tel:" + c.phone}>{c.phone}</a>
                    </td>
                    <td>
                      {c.address || (
                        <span className="muted">No address saved</span>
                      )}
                    </td>
                    <td>
                      {bookings.isLoading
                        ? "…"
                        : bookings.isError
                          ? "—"
                          : (bookings.data ?? []).filter(
                              (b) => b.customerId === c.id,
                            ).length}
                    </td>
                    <td>
                      {units.isLoading
                        ? "…"
                        : units.isError
                          ? "—"
                          : (units.data ?? []).filter(
                              (u) => u.customerId === c.id,
                            ).length}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="icon-button"
                          aria-label={"Edit " + c.name}
                          onClick={() => openForm(c)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={"Open " + c.name}
                          onClick={() => setSelected(c)}
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No clients found"
            message="Add your first client or try a different search."
            action={<Button onClick={() => openForm()}>Add client</Button>}
          />
        )}
      </Card>
      <Modal
        isOpen={Boolean(selected) && !form && !bookingClient && !job}
        onClose={() => setSelected(null)}
        title="Client profile"
        subtitle={selected?.name}
      >
        {selected && (
          <div className="panel-body form-stack">
            <div className="workorder-heading">
              <Users size={24} />
              <div>
                <h3>{selected.name}</h3>
                <a href={"tel:" + selected.phone}>{selected.phone}</a>
              </div>
            </div>
            <p className="muted flex gap-2">
              <MapPin size={16} />
              {selected.address || "No service address saved"}
            </p>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => openForm(selected)}>
                <Pencil size={16} /> Edit client
              </Button>
              <Button onClick={() => setBookingClient(selected.id)}>
                <Plus size={16} /> Book service
              </Button>
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Property type</dt>
                <dd>{selected.type ?? "Residential"}</dd>
              </div>
              <div>
                <dt>Contact person</dt>
                <dd>{selected.contactPerson || selected.name}</dd>
              </div>
              {selected.email && (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={"mailto:" + selected.email}>{selected.email}</a>
                  </dd>
                </div>
              )}
            </dl>
            <h3>Registered equipment</h3>
            {units.isLoading ? (
              <Spinner label="Loading equipment…" />
            ) : units.isError ? (
              <ErrorState error={units.error} onRetry={() => units.refetch()} />
            ) : equipment.length ? (
              equipment.map((u) => (
                <div className="notice" key={u.id}>
                  <strong>{u.name}</strong>
                  <p className="muted">
                    {[u.brand, u.model, u.capacity, u.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {u.nextMaintenanceAt && (
                    <p className="muted">
                      Next service: {manilaDate(u.nextMaintenanceAt)}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="muted">No equipment registered yet.</p>
            )}
            <h3>Service history</h3>
            {bookings.isLoading ? (
              <Spinner label="Loading service history…" />
            ) : bookings.isError ? (
              <ErrorState
                error={bookings.error}
                onRetry={() => bookings.refetch()}
              />
            ) : history.length ? (
              <div className="history-list">
                {history.map((b) => (
                  <button
                    className="history-entry"
                    key={b.id}
                    onClick={() => setJob(b.id)}
                  >
                    <div>
                      <strong>{b.serviceType}</strong>
                      <small>
                        {jobNumber(b.id)} · {manilaDate(b.scheduledAt)}
                      </small>
                    </div>
                    <StatusBadge status={b.status} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">No service visits recorded.</p>
            )}
          </div>
        )}
      </Modal>
      <Modal
        isOpen={form}
        onClose={() => setForm(false)}
        title={editing ? "Edit client" : "Add client"}
      >
        <form
          className="panel-body form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Client name" htmlFor="client-name">
            <input
              id="client-name"
              required
              minLength={2}
              maxLength={100}
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="client-phone">
            <input
              id="client-phone"
              type="tel"
              required
              minLength={7}
              maxLength={20}
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="Service address" htmlFor="client-address">
            <textarea
              id="client-address"
              rows={3}
              maxLength={300}
              className={inputClass}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <Field label="Client type" htmlFor="client-type">
            <select
              id="client-type"
              className={inputClass}
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
            >
              {[
                ...new Set([
                  "Residential",
                  "Commercial",
                  "Industrial",
                  customerType,
                ]),
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Contact person" htmlFor="client-contact">
            <input
              id="client-contact"
              maxLength={120}
              className={inputClass}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="client-email">
            <input
              id="client-email"
              type="email"
              maxLength={150}
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="notice notice-error">
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
              Save client
            </Button>
          </div>
        </form>
      </Modal>
      <BookingModal
        isOpen={Boolean(bookingClient)}
        initialCustomerId={bookingClient}
        onClose={() => setBookingClient("")}
      />
      <WorkOrderModal
        bookingId={job}
        isOpen={Boolean(job)}
        onClose={() => setJob(null)}
      />
    </div>
  );
}

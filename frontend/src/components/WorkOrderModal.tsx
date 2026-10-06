import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Pencil, Plus, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import api, { formatCurrency } from "../api/api";
import { clearIdempotencyKey, getIdempotencyKey } from "../api/idempotency";
import { useAuth } from "../auth/AuthContext";
import {
  bookingServiceLocation,
  getAll,
  invalidateOperations,
  isOpenJob,
  jobNumber,
  manilaDate,
} from "../api/operational";
import {
  ALLOWED_TRANSITIONS,
  Booking,
  BookingStatus,
  InspectionItem,
  InspectionOutcome,
  InventoryItem,
} from "../types";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  PaymentBadge,
  Spinner,
  StatusBadge,
  inputClass,
} from "./ui";
import Modal from "./Modal";
import BookingModal from "./BookingModal";
import InvoiceModal from "./InvoiceModal";

const INSPECTION: InspectionItem[] = [
  {
    id: "visual",
    label: "Visual inspection of indoor and outdoor units",
    outcome: "PENDING",
    checked: false,
  },
  {
    id: "filter",
    label: "Air filter condition and cleaning",
    outcome: "PENDING",
    checked: false,
  },
  {
    id: "coils",
    label: "Evaporator and condenser coil condition",
    outcome: "PENDING",
    checked: false,
  },
  {
    id: "drain",
    label: "Condensate drainage and leaks",
    outcome: "PENDING",
    checked: false,
  },
  {
    id: "airflow",
    label: "Airflow and temperature difference",
    outcome: "PENDING",
    checked: false,
  },
  {
    id: "electrical",
    label: "Electrical connections and safety controls",
    outcome: "PENDING",
    checked: false,
  },
  {
    id: "refrigerant",
    label: "Refrigerant and leak observations",
    outcome: "PENDING",
    checked: false,
  },
  {
    id: "test",
    label: "Final operation test and client handover",
    outcome: "PENDING",
    checked: false,
  },
];
const INSPECTION_OUTCOMES: { value: InspectionOutcome; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "PASS", label: "Pass" },
  { value: "FOLLOW_UP", label: "Follow-up required" },
  { value: "NOT_APPLICABLE", label: "Not applicable" },
];

function getInspectionOutcome(item: InspectionItem): InspectionOutcome {
  if (item.outcome) return item.outcome;
  return item.checked ? "PASS" : "PENDING";
}

function withInspectionOutcome(
  item: InspectionItem,
  outcome: InspectionOutcome,
): InspectionItem {
  return { ...item, outcome, checked: outcome === "PASS" };
}

function normalizeChecklist(items: InspectionItem[]): InspectionItem[] {
  return items.map((item) =>
    withInspectionOutcome(item, getInspectionOutcome(item)),
  );
}
interface Activity {
  id: string;
  action: string;
  resourceId: string;
  createdAt: string;
  user?: { email: string };
}
interface Props {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
}
interface PartUseRequest {
  bookingId: string;
  inventoryItemId: string;
  quantity: number;
  idempotencyKey: string;
}
export default function WorkOrderModal({ bookingId, isOpen, onClose }: Props) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [tab, setTab] = useState("details");
  const [editing, setEditing] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const draftDirtyRef = useRef(false);
  const [checklist, setChecklist] = useState<InspectionItem[]>([]);
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const query = useQuery({
    queryKey: ["bookings", bookingId],
    queryFn: async () =>
      (await api.get<Booking>("/bookings/" + bookingId)).data,
    enabled: isOpen && Boolean(bookingId),
  });
  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: () => getAll<InventoryItem>("/inventory"),
    enabled: isOpen && tab === "parts",
  });
  const activity = useQuery({
    queryKey: ["activity", bookingId],
    queryFn: () => getAll<Activity>("/activity"),
    enabled: isOpen && tab === "history",
  });
  const booking = query.data;
  const serviceLocation = booking ? bookingServiceLocation(booking) : null;
  const partUseScope = `work-order-part-use:${user?.orgId ?? "unknown"}:${user?.email ?? "unknown"}`;
  useEffect(() => {
    if (isOpen) {
      setTab("details");
      setEditing(false);
      setInvoicing(false);
      setError("");
      setSaved("");
      setPartId("");
      draftDirtyRef.current = false;
      setDraftDirty(false);
    }
  }, [isOpen, bookingId]);
  useEffect(() => {
    if (booking && !draftDirtyRef.current) {
      setDiagnosis(booking.diagnosis ?? "");
      setNotes(booking.notes ?? "");
      setChecklist(
        booking.checklist?.length
          ? normalizeChecklist(booking.checklist)
          : INSPECTION.map((i) => ({ ...i })),
      );
    }
  }, [booking]);
  const markDraftDirty = () => {
    draftDirtyRef.current = true;
    setDraftDirty(true);
  };
  const clearDraftDirty = () => {
    draftDirtyRef.current = false;
    setDraftDirty(false);
  };
  const requestClose = () => {
    if (
      draftDirtyRef.current &&
      !window.confirm("Discard your unsaved work order changes?")
    )
      return false;
    clearDraftDirty();
    onClose();
    return true;
  };
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch("/bookings/" + bookingId, body),
    onSuccess: () => {
      clearDraftDirty();
      setError("");
      setSaved("Work order saved.");
      invalidateOperations(client);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSaved("");
    },
  });
  const addPart = useMutation({
    mutationFn: ({ bookingId, inventoryItemId, quantity, idempotencyKey }: PartUseRequest) =>
      api.post("/bookings/" + bookingId + "/parts", {
        inventoryItemId,
        quantity,
        idempotencyKey,
      }),
    onSuccess: (_result, request) => {
      const { idempotencyKey, ...payload } = request;
      clearIdempotencyKey(partUseScope, payload, idempotencyKey);
      setPartId("");
      setQuantity("1");
      setError("");
      setSaved("Part recorded and stock updated.");
      invalidateOperations(client);
    },
    onError: (err: Error) => setError(err.message),
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/bookings/" + bookingId),
    onSuccess: () => {
      invalidateOperations(client);
      clearDraftDirty();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });
  const open = booking ? isOpenJob(booking.status) : false;
  const transitions = booking ? ALLOWED_TRANSITIONS[booking.status] : [];
  const move = (status: BookingStatus) => {
    if (
      status === "CANCELLED" &&
      !window.confirm(
        "Cancel this service visit? Its saved history will remain available.",
      )
    )
      return;
    mutation.mutate({ status });
  };
  const parts = (inventory.data ?? []).filter(
    (p) => p.branchId === booking?.branchId && p.quantityOnHand > 0,
  );
  const submitPartUse = () => {
    if (!booking || !partId) return;
    const payload = {
      bookingId: booking.id,
      inventoryItemId: partId,
      quantity: Number(quantity),
    };
    addPart.mutate({
      ...payload,
      idempotencyKey: getIdempotencyKey(partUseScope, payload),
    });
  };
  return (
    <>
      <Modal
        isOpen={isOpen && !editing && !invoicing}
        onClose={requestClose}
        title="Work order"
        subtitle={bookingId ? jobNumber(bookingId) : ""}
        maxWidth="lg"
        footer={
          booking && tab === "details" ? (
            <div className="workorder-modal-actions">
              {open && (
                <div
                  className="workorder-footer-primary"
                  role="group"
                  aria-label="Save findings and progress visit"
                >
                  <Button
                    type="submit"
                    form="workorder-findings-form"
                    loading={mutation.isPending}
                  >
                    <Check size={16} /> Save findings
                  </Button>
                  {transitions
                    .filter((status) => status !== "CANCELLED")
                    .map((status) => (
                      <Button
                        key={status}
                        type="button"
                        disabled={draftDirty}
                        loading={mutation.isPending}
                        onClick={() => move(status)}
                      >
                        {status === "CONFIRMED"
                          ? "Confirm booking"
                          : status === "ON_SITE"
                            ? "Start visit"
                            : "Complete job"}
                      </Button>
                    ))}
                </div>
              )}
              {open && (
                <details className="workorder-footer-more">
                  <summary>More visit actions</summary>
                  <div
                    className="workorder-footer-more-actions"
                    role="group"
                    aria-label="Other visit actions"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={draftDirty}
                      onClick={() => setEditing(true)}
                    >
                      <Pencil size={15} /> Edit visit
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={draftDirty}
                      onClick={() => move("CANCELLED")}
                      loading={mutation.isPending}
                    >
                      Cancel visit
                    </Button>
                    {!booking.invoice && !booking.parts?.length && (
                      <button
                        type="button"
                        className="text-button text-danger workorder-delete-action"
                        disabled={remove.isPending || draftDirty}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Permanently delete this unbilled booking? Cancel the visit instead to retain its history.",
                            )
                          )
                            remove.mutate();
                        }}
                      >
                        Delete booking
                      </button>
                    )}
                  </div>
                </details>
              )}
            </div>
          ) : null
        }
      >
        {query.isLoading ? (
          <Spinner label="Opening work order…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          booking && (
            <div>
              <div className="workorder-heading panel-body">
                <div className="avatar avatar-lg">
                  {booking.customer?.name?.slice(0, 1) ?? "A"}
                </div>
                <div>
                  <h3>{booking.customer?.name ?? "Client"}</h3>
                  <p className="muted">
                    {booking.unit?.name ?? "No registered unit"} ·{" "}
                    {booking.serviceType}
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
              <section className="workorder-location" aria-label="Service location">
                <h4>Service location</h4>
                {serviceLocation?.siteName && (
                  <p>
                    <strong>Site:</strong> {serviceLocation.siteName}
                  </p>
                )}
                <p>
                  <strong>
                    {serviceLocation?.addressSource === "customer-fallback"
                      ? "Customer address fallback:"
                      : serviceLocation?.addressSource === "service-site"
                        ? "Service-site address:"
                        : "Visit address:"}
                  </strong>{" "}
                  {serviceLocation?.address ?? "No service address saved for this visit."}
                </p>
                {serviceLocation?.accessNotes && (
                  <p>
                    <strong>Access notes:</strong> {serviceLocation.accessNotes}
                  </p>
                )}
              </section>
              <div
                className="tab-bar"
                role="group"
                aria-label="Work order sections"
              >
                {["details", "checklist", "parts", "history"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
                    aria-pressed={tab === t}
                    onClick={() => {
                      setTab(t);
                      setSaved("");
                      setError("");
                    }}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="panel-body form-stack">
                {error && (
                  <p className="notice notice-error" role="alert">
                    {error}
                  </p>
                )}
                {saved && (
                  <p className="notice notice-success" role="status">
                    {saved}
                  </p>
                )}
                {draftDirty && (
                  <p className="notice notice-warning" role="status">
                    Save your findings before changing the visit status, editing
                    the visit or recording parts.
                  </p>
                )}
                {tab === "details" && (
                  <>
                    <dl className="detail-grid">
                      <div>
                        <dt>Scheduled</dt>
                        <dd>
                          {manilaDate(booking.scheduledAt, true)}
                          <small className="workorder-schedule-meta">
                            Manila · {booking.durationMinutes ?? 120} minutes
                          </small>
                        </dd>
                      </div>
                      <div>
                        <dt>Technician</dt>
                        <dd>{booking.technician?.name ?? "Unassigned"}</dd>
                      </div>
                      <div>
                        <dt>Service / priority</dt>
                        <dd>
                          {booking.serviceType} ·{" "}
                          {(booking.priority ?? "NORMAL").toLowerCase()}
                        </dd>
                      </div>
                      <div>
                        <dt>Phone</dt>
                        <dd>
                          {booking.customer?.phone ? (
                            <a href={"tel:" + booking.customer.phone}>
                              {booking.customer.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                    </dl>
                    {booking.serviceRequest && (
                      <section className="notice" aria-label="Service request context">
                        <strong>Customer-reported issue</strong>
                        <p>{booking.serviceRequest.reportedIssue}</p>
                        {booking.serviceRequest.preferredWindowStart && booking.serviceRequest.preferredWindowEnd && (
                          <small>
                            Preferred arrival · {manilaDate(booking.serviceRequest.preferredWindowStart, true)} to {manilaDate(booking.serviceRequest.preferredWindowEnd, true)} Manila
                          </small>
                        )}
                        {booking.serviceRequest.accessNotes && (
                          <p><strong>Request access notes:</strong> {booking.serviceRequest.accessNotes}</p>
                        )}
                      </section>
                    )}
                    {booking.estimateRevision?.status === "APPROVED" && (
                      <section className="form-stack" aria-label="Approved estimate scope">
                        <div className="panel-header">
                          <div>
                            <h3>Approved scope · Revision {booking.estimateRevision.revisionNumber}</h3>
                            {booking.estimateRevision.notes && <p className="muted">{booking.estimateRevision.notes}</p>}
                          </div>
                          <strong>{formatCurrency(booking.estimateRevision.total)}</strong>
                        </div>
                        <div className="table-wrap">
                          <table className="data-table">
                            <thead>
                              <tr><th scope="col">Work or material</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Approved amount</th></tr>
                            </thead>
                            <tbody>
                              {booking.estimateRevision.lineItems.map((line) => (
                                <tr key={line.id}>
                                  <td>{line.description}</td>
                                  <td>{line.quantity}</td>
                                  <td>{formatCurrency(line.unitPrice)}</td>
                                  <td>{formatCurrency(line.lineTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}
                    <form
                      id="workorder-findings-form"
                      className="form-stack"
                      onChange={markDraftDirty}
                      onSubmit={(e) => {
                        e.preventDefault();
                        mutation.mutate({
                          diagnosis: diagnosis.trim(),
                          notes: notes.trim(),
                        });
                      }}
                    >
                      <Field
                        label="Diagnosis and recommendations"
                        htmlFor="work-diagnosis"
                      >
                        <textarea
                          id="work-diagnosis"
                          rows={3}
                          maxLength={3000}
                          className={inputClass}
                          value={diagnosis}
                          readOnly={!open}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          placeholder="Findings, measurements and recommended work"
                        />
                      </Field>
                      <Field label="Visit notes" htmlFor="work-notes">
                        <textarea
                          id="work-notes"
                          rows={2}
                          maxLength={2000}
                          className={inputClass}
                          value={notes}
                          readOnly={!open}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </Field>
                    </form>
                    {booking.invoice ? (
                      <div className="notice">
                        <div className="flex items-center justify-between gap-3">
                          <strong>
                            Invoice · {formatCurrency(booking.invoice.amount)}
                          </strong>
                          <PaymentBadge
                            status={booking.invoice.paymentStatus}
                          />
                        </div>
                        {booking.invoice.needsReview ? (
                          <p className="text-amber">
                            Historical partial payment needs review. Paid amount
                            and balance are unknown.
                          </p>
                        ) : (
                          <p className="muted">
                            Balance: {formatCurrency(booking.invoice.balance)}
                          </p>
                        )}
                        <Link
                          className="text-button"
                          to="/financials"
                          onClick={(event) => {
                            if (!requestClose()) event.preventDefault();
                          }}
                        >
                          Open billing and receipts →
                        </Link>
                      </div>
                    ) : (
                      booking.status !== "CANCELLED" && (
                        <Button
                          variant="secondary"
                          disabled={draftDirty}
                          onClick={() => setInvoicing(true)}
                        >
                          <Receipt size={16} /> Create invoice
                        </Button>
                      )
                    )}
                  </>
                )}
                {tab === "checklist" && (
                  <form
                    className="form-stack"
                    onChange={markDraftDirty}
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutation.mutate({
                        checklist,
                        diagnosis: diagnosis.trim(),
                      });
                    }}
                  >
                    <p className="muted">
                      Record each inspection result. Add details for follow-up
                      work or exceptions in the findings.
                    </p>
                    <div className="inspection-list">
                      {checklist.map((item, index) => (
                        <div
                          key={item.id}
                          className="inspection-item"
                          style={{ flexWrap: "wrap" }}
                        >
                          <span
                            id={`checklist-label-${index}`}
                            style={{ flex: "1 1 180px" }}
                          >
                            {item.label}
                          </span>
                          {item.type === "MEASUREMENT" && (
                            <Field
                              label={`Reading · ${item.unitLabel?.trim() || "Unit not set"}`}
                              htmlFor={`checklist-reading-${index}`}
                            >
                              <input
                                id={`checklist-reading-${index}`}
                                type="text"
                                inputMode="decimal"
                                maxLength={80}
                                className={inputClass}
                                style={{
                                  flex: "1 1 150px",
                                  width: "auto",
                                  minWidth: 0,
                                }}
                                value={item.reading ?? ""}
                                disabled={!open}
                                onChange={(event) => {
                                  const reading = event.target.value;
                                  setChecklist((list) =>
                                    list.map((current, itemIndex) =>
                                      itemIndex === index
                                        ? { ...current, reading: reading || null }
                                        : current,
                                    ),
                                  );
                                }}
                              />
                            </Field>
                          )}
                          <select
                            className={inputClass}
                            style={{
                              flex: "1 1 180px",
                              width: "auto",
                              minWidth: 0,
                            }}
                            aria-labelledby={`checklist-label-${index}`}
                            disabled={!open}
                            value={getInspectionOutcome(item)}
                            onChange={(e) => {
                              const outcome = e.target
                                .value as InspectionOutcome;
                              setChecklist((list) =>
                                list.map((i, n) =>
                                  n === index
                                    ? withInspectionOutcome(i, outcome)
                                    : i,
                                ),
                              );
                            }}
                          >
                            {INSPECTION_OUTCOMES.map((outcome) => (
                              <option key={outcome.value} value={outcome.value}>
                                {outcome.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <Field
                      label="Findings / exceptions"
                      htmlFor="checklist-findings"
                    >
                      <textarea
                        id="checklist-findings"
                        className={inputClass}
                        rows={3}
                        readOnly={!open}
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                      />
                    </Field>
                    {open && (
                      <Button type="submit" loading={mutation.isPending}>
                        <ClipboardCheck size={16} /> Save inspection
                      </Button>
                    )}
                  </form>
                )}
                {tab === "parts" && (
                  <>
                    <p className="muted">
                      Recorded parts reduce stock at this job's branch.
                    </p>
                    {booking.parts?.length ? (
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Part</th>
                              <th>Quantity</th>
                              <th>Recorded cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {booking.parts.map((p) => (
                              <tr key={p.id}>
                                <td>
                                  {p.inventoryItem.name}
                                  <small>{p.inventoryItem.sku}</small>
                                </td>
                                <td>
                                  {p.quantity} {p.inventoryItem.unit}
                                </td>
                                <td>
                                  {formatCurrency(
                                    Number(p.unitPrice) * p.quantity,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        title="No parts recorded"
                        message="Add parts used during the visit."
                      />
                    )}
                    {open && !booking.invoice && (
                      <form
                        className="form-stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitPartUse();
                        }}
                      >
                        {inventory.isError && (
                          <ErrorState
                            error={inventory.error}
                            onRetry={() => inventory.refetch()}
                          />
                        )}
                        <Field label="Part in stock" htmlFor="work-part">
                          <select
                            id="work-part"
                            required
                            className={inputClass}
                            value={partId}
                            onChange={(e) => setPartId(e.target.value)}
                          >
                            <option value="">Select a part</option>
                            {parts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {p.quantityOnHand} {p.unit} available
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Quantity used" htmlFor="work-quantity">
                          <input
                            id="work-quantity"
                            required
                            type="number"
                            min={1}
                            step={1}
                            value={quantity}
                            className={inputClass}
                            onChange={(e) => setQuantity(e.target.value)}
                          />
                        </Field>
                        <Button
                          type="submit"
                          loading={addPart.isPending}
                          disabled={!partId || draftDirty}
                        >
                          <Plus size={16} /> Record part use
                        </Button>
                      </form>
                    )}
                    {booking.invoice && (
                      <p className="muted">Parts are locked after invoicing.</p>
                    )}
                  </>
                )}
                {tab === "history" &&
                  (activity.isLoading ? (
                    <Spinner label="Loading history…" />
                  ) : activity.isError ? (
                    <ErrorState
                      error={activity.error}
                      onRetry={() => activity.refetch()}
                    />
                  ) : (
                    <div className="history-list">
                      <div>
                        <strong>Booking created</strong>
                        <small>{manilaDate(booking.createdAt, true)}</small>
                      </div>
                      {(activity.data ?? [])
                        .filter(
                          (a) =>
                            a.resourceId === booking.id ||
                            a.resourceId === booking.invoice?.id,
                        )
                        .map((a) => (
                          <div key={a.id}>
                            <strong>
                              {a.action.replaceAll("_", " ").toLowerCase()}
                            </strong>
                            <small>
                              {manilaDate(a.createdAt, true)} · {a.user?.email}
                            </small>
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            </div>
          )
        )}
      </Modal>
      <BookingModal
        isOpen={isOpen && editing}
        onClose={() => setEditing(false)}
        booking={booking}
      />
      <InvoiceModal
        booking={isOpen && invoicing && booking ? booking : null}
        onClose={() => setInvoicing(false)}
      />
    </>
  );
}

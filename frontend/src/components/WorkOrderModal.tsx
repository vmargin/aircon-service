import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Pencil, Plus, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import api, { formatCurrency } from "../api/api";
import { clearIdempotencyKey, getIdempotencyKey } from "../api/idempotency";
import { useAuth } from "../auth/AuthContext";
import {
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
  const partUseScope = `work-order-part-use:${user?.orgId ?? "unknown"}:${user?.email ?? "unknown"}`;
  useEffect(() => {
    if (isOpen) {
      setTab("details");
      setEditing(false);
      setInvoicing(false);
      setError("");
      setSaved("");
      setPartId("");
    }
  }, [isOpen, bookingId]);
  useEffect(() => {
    if (booking) {
      setDiagnosis(booking.diagnosis ?? "");
      setNotes(booking.notes ?? "");
      setChecklist(
        booking.checklist?.length
          ? normalizeChecklist(booking.checklist)
          : INSPECTION.map((i) => ({ ...i })),
      );
    }
  }, [booking]);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch("/bookings/" + bookingId, body),
    onSuccess: () => {
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
        onClose={onClose}
        title="Work order"
        subtitle={bookingId ? jobNumber(bookingId) : ""}
        maxWidth="lg"
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
                    {booking.customer?.address ?? booking.branch?.name}
                  </p>
                  <p className="muted">
                    {booking.unit?.name ?? "No registered unit"} ·{" "}
                    {booking.serviceType}
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
              <div className="tab-bar">
                {["details", "checklist", "parts", "history"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
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
                {tab === "details" && (
                  <>
                    <dl className="detail-grid">
                      <div>
                        <dt>Scheduled</dt>
                        <dd>
                          {manilaDate(booking.scheduledAt, true)}
                          <small>
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
                    <form
                      className="form-stack"
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
                      {open && (
                        <Button type="submit" loading={mutation.isPending}>
                          <Check size={16} /> Save findings
                        </Button>
                      )}
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
                          onClick={onClose}
                        >
                          Open billing and receipts →
                        </Link>
                      </div>
                    ) : (
                      booking.status !== "CANCELLED" && (
                        <Button
                          variant="secondary"
                          onClick={() => setInvoicing(true)}
                        >
                          <Receipt size={16} /> Create invoice
                        </Button>
                      )
                    )}
                    {open && (
                      <div className="workorder-actions">
                        <Button
                          variant="secondary"
                          onClick={() => setEditing(true)}
                        >
                          <Pencil size={15} /> Edit visit
                        </Button>
                        {transitions
                          .filter((s) => s !== "CANCELLED")
                          .map((s) => (
                            <Button
                              key={s}
                              disabled={s === "COMPLETED" && !booking.invoice}
                              loading={mutation.isPending}
                              onClick={() => move(s)}
                            >
                              {s === "CONFIRMED"
                                ? "Confirm booking"
                                : s === "ON_SITE"
                                  ? "Start visit"
                                  : "Complete job"}
                            </Button>
                          ))}
                        <Button
                          variant="danger"
                          onClick={() => move("CANCELLED")}
                          loading={mutation.isPending}
                        >
                          Cancel visit
                        </Button>
                      </div>
                    )}
                    {booking.status === "ON_SITE" && !booking.invoice && (
                      <p className="muted">
                        Issue an invoice before completing this job.
                      </p>
                    )}
                    {open && !booking.invoice && !booking.parts?.length && (
                      <button
                        className="text-button text-danger"
                        disabled={remove.isPending}
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
                  </>
                )}
                {tab === "checklist" && (
                  <form
                    className="form-stack"
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
                          disabled={!partId}
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

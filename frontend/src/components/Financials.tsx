import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Printer, Receipt, Search } from "lucide-react";
import api, { formatCurrency } from "../api/api";
import {
  getAll,
  invalidateOperations,
  jobNumber,
  manilaDate,
} from "../api/operational";
import { Invoice, PAYMENT_METHODS, PaymentStatus } from "../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PaymentBadge,
  Spinner,
  inputClass,
} from "./ui";
import Modal from "./Modal";

const cents = (amount: string | number | null | undefined) =>
  Math.round(Number(amount ?? 0) * 100);
export default function Financials() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | PaymentStatus | "REVIEW">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collect, setCollect] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("CASH");
  const [reference, setReference] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const query = useQuery({
    queryKey: ["invoices"],
    queryFn: () => getAll<Invoice>("/invoices"),
  });
  const invoices = query.data ?? [];
  const selected = invoices.find((i) => i.id === selectedId);
  const totals = invoices.reduce(
    (sum, i) => ({
      invoiced: sum.invoiced + cents(i.amount),
      collected: sum.collected + (i.needsReview ? 0 : cents(i.amountPaid)),
      outstanding: sum.outstanding + (i.needsReview ? 0 : cents(i.balance)),
      review: sum.review + (i.needsReview ? 1 : 0),
    }),
    { invoiced: 0, collected: 0, outstanding: 0, review: 0 },
  );
  const rows = invoices.filter(
    (i) =>
      (status === "ALL" ||
        (status === "REVIEW" ? i.needsReview : i.paymentStatus === status)) &&
      [i.booking?.customer?.name, i.booking?.serviceType, i.id, i.booking?.id]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const beginPayment = () => {
    if (!selected || selected.needsReview) return;
    setCollect(true);
    setAmount(String(selected.balance ?? ""));
    setMethod("CASH");
    setReference("");
    setKey(crypto.randomUUID());
    setError("");
    setSuccess("");
  };
  const payment = useMutation({
    mutationFn: async () => {
      if (!selected || selected.needsReview)
        throw new Error("This historical invoice needs payment review first.");
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || cents(amount) <= 0)
        throw new Error(
          "Enter a positive amount with at most two decimal places.",
        );
      if (cents(amount) > cents(selected.balance))
        throw new Error("The payment cannot exceed the outstanding balance.");
      return api.post<Invoice>("/invoices/" + selected.id + "/payments", {
        amount: Number(amount),
        method,
        reference: reference.trim() || undefined,
        idempotencyKey: key,
      });
    },
    onSuccess: ({ data }) => {
      client.setQueryData<Invoice[]>(["invoices"], (current) =>
        (current ?? []).map((i) => (i.id === data.id ? data : i)),
      );
      invalidateOperations(client);
      setCollect(false);
      setSuccess("Payment recorded. Receipt saved.");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });
  const openInvoice = (invoice: Invoice) => {
    setSelectedId(invoice.id);
    setCollect(false);
    setError("");
    setSuccess("");
  };
  if (query.isLoading) return <Spinner label="Loading billing and receipts…" />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <div className="page-stack">
      <PageHeader
        title="Billing & payments"
        subtitle="Clear invoices. Every payment backed by a saved receipt."
      />
      <div className="metric-grid">
        {[
          { label: "Invoiced", value: totals.invoiced },
          { label: "Recorded collections", value: totals.collected },
          { label: "Known outstanding", value: totals.outstanding },
        ].map((t) => (
          <Card key={t.label} className="metric-card">
            <Receipt size={20} />
            <p className="muted">{t.label}</p>
            <strong>{formatCurrency(t.value / 100)}</strong>
          </Card>
        ))}
        <Card className="metric-card">
          <CreditCard size={20} />
          <p className="muted">Invoices</p>
          <strong>{invoices.length}</strong>
        </Card>
      </div>
      {totals.review > 0 && (
        <p className="notice notice-warning" role="status">
          {totals.review} historical partial invoice
          {totals.review === 1 ? "" : "s"} need review. Their paid amounts and
          balances are unknown and excluded from collection and outstanding
          totals.
        </p>
      )}
      <Card>
        <div className="page-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search invoices"
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client or invoice…"
            />
          </div>
        </div>
        <div className="tab-bar">
          {(["ALL", "UNPAID", "PARTIAL", "PAID", "REVIEW"] as const).map(
            (s) => (
              <button
                key={s}
                className={status === s ? "active" : ""}
                onClick={() => setStatus(s)}
              >
                {s === "ALL"
                  ? "All invoices"
                  : s === "REVIEW"
                    ? "Needs review"
                    : s === "UNPAID"
                      ? "Unpaid"
                      : s === "PARTIAL"
                        ? "Partial"
                        : "Paid"}
              </button>
            ),
          )}
        </div>
      </Card>
      <Card>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice / client</th>
                  <th>Service</th>
                  <th>Issued</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => openInvoice(i)}
                      >
                        {i.booking?.customer?.name ?? "Client"}
                      </button>
                      <small>{"INV-" + i.id.slice(-8).toUpperCase()}</small>
                    </td>
                    <td>
                      {i.booking?.serviceType}
                      <small>{i.booking?.branch?.name}</small>
                    </td>
                    <td>{manilaDate(i.issuedAt)}</td>
                    <td className="money">{formatCurrency(i.amount)}</td>
                    <td className="money">
                      {i.needsReview ? "Unknown" : formatCurrency(i.amountPaid)}
                    </td>
                    <td className="money">
                      {i.needsReview ? "Unknown" : formatCurrency(i.balance)}
                    </td>
                    <td>
                      {i.needsReview ? (
                        <span className="badge badge-amber">Needs review</span>
                      ) : (
                        <PaymentBadge status={i.paymentStatus} />
                      )}
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        onClick={() => openInvoice(i)}
                      >
                        View invoice
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No invoices match"
            message="Invoices are issued from a work order. Try a different filter."
          />
        )}
      </Card>
      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={collect ? "Record payment" : "Invoice & receipts"}
        subtitle={selected ? "INV-" + selected.id.slice(-8).toUpperCase() : ""}
        maxWidth="lg"
      >
        {selected && (
          <div className="panel-body form-stack">
            {success && (
              <p className="notice notice-success" role="status">
                {success}
              </p>
            )}
            {collect ? (
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  payment.mutate();
                }}
              >
                <div className="notice">
                  <strong>{selected.booking?.customer?.name}</strong>
                  <p className="muted">
                    Outstanding balance: {formatCurrency(selected.balance)}
                  </p>
                </div>
                <Field label="Payment amount (PHP)" htmlFor="payment-amount">
                  <input
                    id="payment-amount"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={Number(selected.balance)}
                    className={inputClass}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label="Payment method" htmlFor="payment-method">
                  <select
                    id="payment-method"
                    className={inputClass}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Reference / receipt note"
                  htmlFor="payment-reference"
                  hint="Save the bank, e-wallet or cheque reference where available."
                >
                  <input
                    id="payment-reference"
                    maxLength={120}
                    className={inputClass}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
                {error && (
                  <p className="notice notice-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="form-actions">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setCollect(false)}
                    disabled={payment.isPending}
                  >
                    Back to invoice
                  </Button>
                  <Button type="submit" loading={payment.isPending}>
                    Save payment receipt
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="invoice-document">
                  <div className="invoice-heading">
                    <div>
                      <h2>ARCTIC</h2>
                      <p className="muted">Aircon Service Management</p>
                    </div>
                    <div>
                      <strong>
                        {"INV-" + selected.id.slice(-8).toUpperCase()}
                      </strong>
                      <p className="muted">{manilaDate(selected.issuedAt)}</p>
                    </div>
                  </div>
                  <dl className="detail-grid">
                    <div>
                      <dt>Billed to</dt>
                      <dd>
                        {selected.booking?.customer?.name}
                        <small>{selected.booking?.customer?.address}</small>
                        <small>{selected.booking?.customer?.phone}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Service visit</dt>
                      <dd>
                        {selected.booking?.serviceType}
                        <small>
                          {selected.booking
                            ? jobNumber(selected.booking.id)
                            : ""}
                        </small>
                        <small>
                          {selected.booking
                            ? manilaDate(selected.booking.scheduledAt, true)
                            : ""}
                        </small>
                      </dd>
                    </div>
                  </dl>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          {selected.booking?.serviceType ?? "Aircon service"} ·
                          agreed total service charge
                        </td>
                        <td>{formatCurrency(selected.amount)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="invoice-total">
                    <span>Invoice total</span>
                    <strong>{formatCurrency(selected.amount)}</strong>
                  </div>
                  {selected.needsReview ? (
                    <p className="notice notice-warning">
                      Historical partial payment requires review. Paid amount
                      and outstanding balance are unknown.
                    </p>
                  ) : (
                    <dl className="detail-grid">
                      <div>
                        <dt>Recorded paid</dt>
                        <dd>{formatCurrency(selected.amountPaid)}</dd>
                      </div>
                      <div>
                        <dt>Outstanding balance</dt>
                        <dd>{formatCurrency(selected.balance)}</dd>
                      </div>
                    </dl>
                  )}
                  <h3>Payment receipts</h3>
                  {selected.legacyBaseline && (
                    <p className="muted">
                      This invoice was paid in the previous system. Its settled
                      total is retained; individual historical receipts are
                      unavailable.
                    </p>
                  )}
                  {selected.payments?.length ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date / receipt</th>
                            <th>Method / reference</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.payments.map((p) => (
                            <tr key={p.id}>
                              <td>
                                {manilaDate(p.paidAt ?? p.createdAt, true)}
                                <small>{p.id.slice(-8).toUpperCase()}</small>
                              </td>
                              <td>
                                {p.method.replaceAll("_", " ")}
                                <small>{p.reference || "—"}</small>
                              </td>
                              <td>{formatCurrency(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">No individual receipts recorded.</p>
                  )}
                </div>
                <div className="form-actions">
                  <Button variant="secondary" onClick={() => window.print()}>
                    <Printer size={16} /> Print invoice
                  </Button>
                  {!selected.needsReview && Number(selected.balance) > 0 && (
                    <Button onClick={beginPayment}>
                      <CreditCard size={16} /> Record payment
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

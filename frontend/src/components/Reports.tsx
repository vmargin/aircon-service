import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "../api/api";
import { getAll, manilaDay } from "../api/operational";
import { useAuth } from "../auth/AuthContext";
import { Booking, BookingStatus, Branch, Invoice, STATUS_LABELS } from "../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Spinner,
  inputClass,
} from "./ui";

const cents = (value: string | number | null | undefined) =>
  Math.round(Number(value ?? 0) * 100);
const dayOrdinal = (value: string) => {
  const [year, month, day] = manilaDay(value).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
const RECEIVABLE_AGE_BANDS = [
  { label: "0–30 days", min: 0, max: 30 },
  { label: "31–60 days", min: 31, max: 60 },
  { label: "61–90 days", min: 61, max: 90 },
  { label: "91+ days", min: 91, max: Number.POSITIVE_INFINITY },
];
const before = (days: number) =>
  manilaDay(new Date(Date.now() - days * 86400000));
const csvCell = (value: unknown) => {
  const s = String(value ?? "");
  return '"' + (/^[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
};
export default function Reports() {
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState(before(29));
  const [to, setTo] = useState(manilaDay());
  const [branchId, setBranchId] = useState("");
  const { isAdmin } = useAuth();
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => getAll<Branch>("/branches"),
    enabled: isAdmin,
  });
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getAll<Booking>("/bookings"),
  });
  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: () => getAll<Invoice>("/invoices"),
  });
  const inRange = (value: string) => {
    const day = manilaDay(value);
    return (!from || day >= from) && (!to || day <= to);
  };
  const report = useMemo(() => {
    const scopedJobs = (bookings.data ?? []).filter(
      (booking) => !branchId || booking.branchId === branchId,
    );
    const scopedInvoices = (invoices.data ?? []).filter(
      (invoice) => !branchId || invoice.booking?.branchId === branchId,
    );
    const jobs = scopedJobs.filter((booking) => inRange(booking.scheduledAt));
    const bills = scopedInvoices.filter((invoice) => inRange(invoice.issuedAt));
    const byStatus = jobs.reduce<Record<string, number>>(
      (sum, b) => ({ ...sum, [b.status]: (sum[b.status] ?? 0) + 1 }),
      {},
    );
    const byService = jobs.reduce<Record<string, number>>(
      (sum, b) => ({ ...sum, [b.serviceType]: (sum[b.serviceType] ?? 0) + 1 }),
      {},
    );
    const techs = new Map<
      string,
      { name: string; jobs: number; completed: number; collected: number }
    >();
    for (const b of jobs) {
      if (!b.technician) continue;
      const entry = techs.get(b.technician.id) ?? {
        name: b.technician.name,
        jobs: 0,
        completed: 0,
        collected: 0,
      };
      entry.jobs += 1;
      if (b.status === "COMPLETED") entry.completed += 1;
      techs.set(b.technician.id, entry);
    }
    let collected = 0;
    let undatedLegacy = 0;
    for (const i of scopedInvoices) {
      let received = 0;
      for (const p of i.payments ?? [])
        if (inRange(p.paidAt ?? p.createdAt)) received += cents(p.amount);
      if (i.legacyBaseline) {
        if (i.paidAt && inRange(i.paidAt)) received += cents(i.amount);
        else if (!i.paidAt) {
          undatedLegacy += 1;
          if (!from && !to) received += cents(i.amount);
        }
      }
      collected += received;
      const tech = i.booking?.technician;
      if (tech && received) {
        const entry = techs.get(tech.id) ?? {
          name: tech.name,
          jobs: 0,
          completed: 0,
          collected: 0,
        };
        entry.collected += received;
        techs.set(tech.id, entry);
      }
    }
    const invoiced = bills.reduce((sum, i) => sum + cents(i.amount), 0);
    const outstanding = bills
      .filter((i) => !i.needsReview)
      .reduce((sum, i) => sum + cents(i.balance), 0);
    const asOfDay = manilaDay();
    const openReceivables = scopedInvoices
      .filter((invoice) => !invoice.needsReview && invoice.balance != null && cents(invoice.balance) > 0)
      .map((invoice) => ({
        invoice,
        ageDays: Math.max(0, dayOrdinal(asOfDay) - dayOrdinal(invoice.issuedAt)),
      }));
    const receivableAging = RECEIVABLE_AGE_BANDS.map((band) => {
      const invoices = openReceivables.filter(
        ({ ageDays }) => ageDays >= band.min && ageDays <= band.max,
      );
      return {
        ...band,
        invoiceCount: invoices.length,
        balanceCents: invoices.reduce(
          (sum, { invoice }) => sum + cents(invoice.balance),
          0,
        ),
      };
    });
    const completed = byStatus.COMPLETED ?? 0;
    const eligible = jobs.length - (byStatus.CANCELLED ?? 0);
    return {
      jobs,
      bills,
      byStatus,
      byService,
      collected,
      invoiced,
      outstanding,
      completed,
      completionRate: eligible ? Math.round((completed / eligible) * 100) : 0,
      technicians: [...techs.values()].sort(
        (a, b) => b.completed - a.completed,
      ),
      review: bills.filter((i) => i.needsReview).length,
      undatedLegacy,
      receivableAging,
      openReceivableCount: openReceivables.length,
      openReceivableCents: openReceivables.reduce(
        (sum, { invoice }) => sum + cents(invoice.balance),
        0,
      ),
      unknownReceivableCount: scopedInvoices.filter((invoice) => invoice.needsReview).length,
    };
  }, [bookings.data, invoices.data, from, to, branchId]);
  const quickRange = (value: string) => {
    setRange(value);
    setTo(value === "all" ? "" : manilaDay());
    setFrom(value === "all" ? "" : before(Number(value) - 1));
  };
  const exportCsv = () => {
    const data = [
      [
        "Invoice",
        "Client",
        "Branch",
        "Service",
        "Issued at",
        "Amount PHP",
        "Paid PHP",
        "Balance PHP",
        "Status",
      ],
      ...report.bills.map((i) => [
        i.id,
        i.booking?.customer?.name,
        i.booking?.branch?.name,
        i.booking?.serviceType,
        i.issuedAt,
        i.amount,
        i.needsReview ? "UNKNOWN" : i.amountPaid,
        i.needsReview ? "UNKNOWN" : i.balance,
        i.needsReview ? "NEEDS REVIEW" : i.paymentStatus,
      ]),
    ];
    const blob = new Blob(
      ["\uFEFF" + data.map((row) => row.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "arctic-billing-" + (branchId || "all-branches") + "-" + (from || "all") + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  if (bookings.isLoading || invoices.isLoading || (isAdmin && branches.isLoading))
    return <Spinner label="Building your service report…" />;
  if (bookings.isError || invoices.isError || (isAdmin && branches.isError))
    return (
      <ErrorState
        error={bookings.error || invoices.error || branches.error}
        onRetry={() => {
          void bookings.refetch();
          void invoices.refetch();
          if (isAdmin) void branches.refetch();
        }}
      />
    );
  const invalid = Boolean(from && to && from > to);
  return (
    <div className="page-stack">
      <PageHeader
        title="Analytics & reports"
        subtitle="Saved jobs, issued invoices and actual payment receipts."
        action={
          <Button variant="secondary" onClick={exportCsv} disabled={invalid}>
            <Download size={16} /> Export billing CSV
          </Button>
        }
      />
      <Card>
        <div className="page-toolbar">
          <div className="tab-bar">
            {[
              ["7", "7 days"],
              ["30", "30 days"],
              ["90", "90 days"],
              ["all", "All time"],
            ].map(([v, label]) => (
              <button
                key={v}
                className={range === v ? "active" : ""}
                aria-pressed={range === v}
                onClick={() => quickRange(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className={`form-grid report-filter-grid${isAdmin ? " has-branch" : ""}`}
          >
            {isAdmin && (
              <Field label="Branch" htmlFor="report-branch">
                <select
                  id="report-branch"
                  className={inputClass}
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                >
                  <option value="">All branches</option>
                  {branches.data?.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="From (Manila)" htmlFor="report-from">
              <input
                id="report-from"
                type="date"
                value={from}
                className={inputClass}
                onChange={(e) => {
                  setRange("custom");
                  setFrom(e.target.value);
                }}
              />
            </Field>
            <Field label="Through (Manila)" htmlFor="report-to">
              <input
                id="report-to"
                type="date"
                value={to}
                className={inputClass}
                onChange={(e) => {
                  setRange("custom");
                  setTo(e.target.value);
                }}
              />
            </Field>
          </div>
        </div>
      </Card>
      {invalid ? (
        <p role="alert" className="notice notice-error">
          The start date must be on or before the end date.
        </p>
      ) : (
        <>
          <div className="metric-grid">
            {[
              {
                label: "Scheduled visits",
                value: String(report.jobs.length),
                icon: BarChart3,
              },
              {
                label: "Completed",
                value: report.completed + " · " + report.completionRate + "%",
                icon: CheckCircle2,
              },
              {
                label: "Collected in period",
                value: formatCurrency(report.collected / 100),
                icon: CreditCard,
              },
              {
                label: "Invoiced in period",
                value: formatCurrency(report.invoiced / 100),
                icon: Wallet,
              },
            ].map((m) => (
              <Card className="metric-card" key={m.label}>
                <m.icon size={20} />
                <p className="muted">{m.label}</p>
                <strong>{m.value}</strong>
              </Card>
            ))}
          </div>
          {report.review > 0 && (
            <p className="notice notice-warning">
              {report.review} historical partial invoice
              {report.review === 1 ? "" : "s"} have unknown paid amounts and
              balances. Collection and outstanding figures exclude those unknown
              amounts.
            </p>
          )}
          {report.undatedLegacy > 0 && (
            <p className="notice">
              {report.undatedLegacy} historical settled invoice
              {report.undatedLegacy === 1 ? "" : "s"} lack a receipt date. They
              count in all-time collections and are excluded from dated
              collections.
            </p>
          )}
          <p className="muted report-note">
            Visits use their scheduled date. Invoiced totals use issue dates.
            Collections use receipt dates. Known current balance for invoices
            issued in this period: {formatCurrency(report.outstanding / 100)}.
            Completion excludes cancelled visits.
          </p>
          <Card>
            <div className="panel-header">
              <h3>Open balance by invoice age</h3>
              <span className="muted">All issue dates · current branch scope</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Days since issue</th>
                    <th scope="col">Invoices</th>
                    <th scope="col">Open balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.receivableAging.map((band) => (
                    <tr key={band.label}>
                      <th scope="row">{band.label}</th>
                      <td>{band.invoiceCount}</td>
                      <td>{formatCurrency(band.balanceCents / 100)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Known open balance</th>
                    <td>{report.openReceivableCount} invoices</td>
                    <td>{formatCurrency(report.openReceivableCents / 100)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="muted report-note">
              Age is measured from invoice issue date. These bands do not set
              payment terms or determine whether an invoice is overdue.
            </p>
            {report.unknownReceivableCount > 0 && (
              <p className="notice notice-warning">
                {report.unknownReceivableCount} historical invoice
                {report.unknownReceivableCount === 1 ? " has" : "s have"} an
                unknown balance and {report.unknownReceivableCount === 1 ? "is" : "are"} excluded.
              </p>
            )}
          </Card>
          <div className="report-grid">
            <Card>
              <div className="panel-header">
                <h3>Service job status</h3>
                <span className="muted">{report.jobs.length} visits</span>
              </div>
              <div className="panel-body report-bars">
                {(Object.keys(STATUS_LABELS) as BookingStatus[]).map((s) => {
                  const count = report.byStatus[s] ?? 0;
                  return (
                    <div key={s}>
                      <div className="flex justify-between">
                        <span>{STATUS_LABELS[s]}</span>
                        <span className="muted">{count}</span>
                      </div>
                      <div className="progress-track">
                        <div
                          className={
                            "progress-fill progress-" + s.toLowerCase()
                          }
                          style={{
                            width: report.jobs.length
                              ? (count / report.jobs.length) * 100 + "%"
                              : "0%",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card>
              <div className="panel-header">
                <h3>Services performed</h3>
              </div>
              <div className="panel-body report-bars">
                {Object.entries(report.byService).length ? (
                  Object.entries(report.byService)
                    .sort((a, b) => b[1] - a[1])
                    .map(([s, count]) => (
                      <div key={s}>
                        <div className="flex justify-between">
                          <span>{s}</span>
                          <span className="muted">{count}</span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: (count / report.jobs.length) * 100 + "%",
                            }}
                          />
                        </div>
                      </div>
                    ))
                ) : (
                  <EmptyState title="No visits in this period" />
                )}
              </div>
            </Card>
          </div>
          <Card>
            <div className="panel-header">
              <h3>Technician performance</h3>
              <span className="muted">
                Jobs by schedule · receipts by payment date
              </span>
            </div>
            {report.technicians.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Technician</th>
                      <th>Visits</th>
                      <th>Completed</th>
                      <th>Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.technicians.map((t) => (
                      <tr key={t.name}>
                        <td>
                          <strong>{t.name}</strong>
                        </td>
                        <td>{t.jobs}</td>
                        <td>{t.completed}</td>
                        <td>{formatCurrency(t.collected / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No technician activity in this period" />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

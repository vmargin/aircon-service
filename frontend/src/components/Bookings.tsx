import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  bookingServiceLocation,
  getAll,
  jobNumber,
  manilaDate,
} from "../api/operational";
import { Booking, BookingStatus, STATUS_LABELS } from "../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  PaymentBadge,
  Spinner,
  StatusBadge,
  inputClass,
} from "./ui";
import BookingModal from "./BookingModal";
import WorkOrderModal from "./WorkOrderModal";

export default function Bookings() {
  const [params] = useSearchParams();
  const attentionOnly = params.get("attention") === "1";
  const pageSize =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 760px)").matches
      ? 6
      : 12;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<"ALL" | BookingStatus>("ALL");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [newBooking, setNewBooking] = useState(false);
  const [selected, setSelected] = useState<string | null>(params.get("job"));
  useEffect(() => {
    setSearch(params.get("q") ?? "");
    setSelected(params.get("job"));
  }, [params]);
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [search, status, attentionOnly, pageSize]);
  const query = useQuery({
    queryKey: ["bookings", { attention: attentionOnly }],
    queryFn: () =>
      getAll<Booking>(
        "/bookings",
        attentionOnly ? { attention: "1" } : undefined,
      ),
  });
  const rows = query.data ?? [];
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (b) =>
            (status === "ALL" || b.status === status) &&
            [
              b.customer?.name,
              b.customer?.phone,
              b.serviceType,
              b.unit?.name,
              b.technician?.name,
              jobNumber(b.id),
            ]
              .join(" ")
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt)),
    [rows, search, status],
  );
  const visibleRows = filtered.slice(0, visibleCount);
  if (query.isLoading) return <Spinner label="Loading service jobs…" />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <div className="page-stack">
      <PageHeader
        title={attentionOnly ? "Jobs requiring attention" : "Service jobs"}
        subtitle={
          attentionOnly
            ? "Priority or overdue open jobs, unfinished checks, follow-up findings, and completed work without an invoice."
            : "Every visit, from the first booking to the final receipt."
        }
        action={
          <Button onClick={() => setNewBooking(true)}>
            <Plus size={16} /> New booking
          </Button>
        }
      />
      <Card>
        {attentionOnly && (
          <div className="attention-filter notice notice-warning" role="status">
            Showing jobs that need dispatch, inspection follow-up, or billing attention.
            <Link className="text-button" to="/bookings">
              Clear filter
            </Link>
          </div>
        )}
        <div className="page-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search jobs"
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, equipment or job…"
            />
          </div>
          <span className="record-count muted" role="status" aria-live="polite">
            Showing {visibleRows.length} of {filtered.length} jobs
          </span>
        </div>
        <div className="tab-bar">
          {(
            ["ALL", ...Object.keys(STATUS_LABELS)] as Array<
              "ALL" | BookingStatus
            >
          ).map((s) => (
            <button
              key={s}
              className={status === s ? "active" : ""}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s === "ALL" ? "All jobs" : STATUS_LABELS[s]}{" "}
              <span>
                {s === "ALL"
                  ? rows.length
                  : rows.filter((b) => b.status === s).length}
              </span>
            </button>
          ))}
        </div>
      </Card>
      <Card>
        {!filtered.length ? (
          <EmptyState
            title={attentionOnly ? "No jobs need attention" : "No matching jobs"}
            message={
              attentionOnly
                ? "No open high-priority or overdue jobs are in your authorized branch scope."
                : "Adjust your filters or schedule a new service visit."
            }
            action={
              <Button onClick={() => setNewBooking(true)}>New booking</Button>
            }
          />
        ) : (
          <>
          <div className="table-wrap record-table-wrap">
            <table id="service-job-table" className="data-table">
              <thead>
                <tr>
                  <th>Client / location</th>
                  <th>Service / equipment</th>
                  <th>Technician</th>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th>Billing</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((b) => {
                  const location = bookingServiceLocation(b);
                  return (
                  <tr key={b.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(b.id)}
                      >
                        {b.customer?.name ?? "Client"}
                      </button>
                      <small>
                        {location.siteName && <>Site: {location.siteName} · </>}
                        {location.addressSource === "customer-fallback" &&
                          "Customer address fallback: "}
                        {location.address ?? "No service address saved"}
                      </small>
                      {location.accessNotes && (
                        <small>Access notes: {location.accessNotes}</small>
                      )}
                    </td>
                    <td>
                      <strong>{b.serviceType}</strong>
                      <small>{b.unit?.name ?? jobNumber(b.id)}</small>
                    </td>
                    <td>
                      {b.technician?.name ?? (
                        <span className="text-amber">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                      {b.priority && b.priority !== "NORMAL" && (
                        <small className="text-amber">
                          {b.priority.toLowerCase()} priority
                        </small>
                      )}
                    </td>
                    <td>
                      {manilaDate(b.scheduledAt, true)}
                      <small>{b.durationMinutes ?? 120} min · Manila</small>
                    </td>
                    <td>
                      {b.invoice ? (
                        <PaymentBadge status={b.invoice.paymentStatus} />
                      ) : (
                        <span className="muted">Not billed</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"Open job for " + b.customer?.name}
                        onClick={() => setSelected(b.id)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            id="service-job-cards"
            className="record-card-list"
            role="list"
            aria-label="Service job results"
          >
            {visibleRows.map((b) => {
              const location = bookingServiceLocation(b);
              const clientName = b.customer?.name ?? "Client";
              return (
                <article className="record-card" role="listitem" key={b.id}>
                  <div className="record-card-heading">
                    <div className="record-card-heading-main">
                      <button
                        type="button"
                        className="record-card-link"
                        onClick={() => setSelected(b.id)}
                        aria-label={`Open work order for ${clientName}, ${jobNumber(b.id)}`}
                      >
                        {clientName}
                      </button>
                      <small className="mono">{jobNumber(b.id)}</small>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="record-card-subtitle">
                    {b.serviceType} · {b.unit?.name ?? "Equipment not linked"}
                  </p>
                  {b.priority && b.priority !== "NORMAL" && (
                    <p className="record-card-priority text-amber">
                      {b.priority.toLowerCase()} priority
                    </p>
                  )}
                  <dl className="record-card-details">
                    <div>
                      <dt>Service site</dt>
                      <dd>
                        {location.siteName && `${location.siteName} · `}
                        {location.addressSource === "customer-fallback" &&
                          "Customer address fallback: "}
                        {location.address ?? "No service address saved"}
                      </dd>
                    </div>
                    <div>
                      <dt>Branch</dt>
                      <dd>{b.branch?.name ?? "Branch not assigned"}</dd>
                    </div>
                    <div>
                      <dt>Visit</dt>
                      <dd>
                        {manilaDate(b.scheduledAt, true)} · {b.durationMinutes ?? 120} min · Manila
                      </dd>
                    </div>
                    <div>
                      <dt>Technician</dt>
                      <dd>{b.technician?.name ?? "Unassigned"}</dd>
                    </div>
                    <div>
                      <dt>Billing</dt>
                      <dd>
                        {b.invoice ? (
                          <PaymentBadge status={b.invoice.paymentStatus} />
                        ) : (
                          "Not billed"
                        )}
                      </dd>
                    </div>
                  </dl>
                  {location.accessNotes && (
                    <p className="record-card-note">
                      <strong>Access notes:</strong> {location.accessNotes}
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(b.id)}
                    aria-label={`Open job for ${clientName}`}
                  >
                    <ArrowUpRight size={16} /> Open job
                  </Button>
                </article>
              );
            })}
          </div>
          {visibleRows.length < filtered.length && (
            <div className="record-load-more">
              <Button
                variant="secondary"
                onClick={() =>
                  setVisibleCount((count) =>
                    Math.min(count + pageSize, filtered.length),
                  )
                }
                aria-controls="service-job-table service-job-cards"
              >
                Show next {Math.min(pageSize, filtered.length - visibleRows.length)} jobs
              </Button>
            </div>
          )}
          </>
        )}
      </Card>
      <BookingModal isOpen={newBooking} onClose={() => setNewBooking(false)} />
      <WorkOrderModal
        bookingId={selected}
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { getAll, jobNumber, manilaDate } from "../api/operational";
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
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<"ALL" | BookingStatus>("ALL");
  const [newBooking, setNewBooking] = useState(false);
  const [selected, setSelected] = useState<string | null>(params.get("job"));
  useEffect(() => {
    setSearch(params.get("q") ?? "");
    setSelected(params.get("job"));
  }, [params]);
  const query = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getAll<Booking>("/bookings"),
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
  if (query.isLoading) return <Spinner label="Loading service jobs…" />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <div className="page-stack">
      <PageHeader
        title="Service jobs"
        subtitle="Every visit, from the first booking to the final receipt."
        action={
          <Button onClick={() => setNewBooking(true)}>
            <Plus size={16} /> New booking
          </Button>
        }
      />
      <Card>
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
          <span className="muted">{filtered.length} jobs</span>
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
            title="No matching jobs"
            message="Adjust your filters or schedule a new service visit."
            action={
              <Button onClick={() => setNewBooking(true)}>New booking</Button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
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
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(b.id)}
                      >
                        {b.customer?.name ?? "Client"}
                      </button>
                      <small>{b.customer?.address || b.branch?.name}</small>
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
                ))}
              </tbody>
            </table>
          </div>
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

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getAll, manilaDay } from "../api/operational";
import { Booking, Technician } from "../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  inputClass,
} from "./ui";
import BookingModal from "./BookingModal";
import WorkOrderModal from "./WorkOrderModal";

const atNoon = (value: string) => new Date(value + "T12:00:00Z");
const shiftDay = (value: string, offset: number) => {
  const date = atNoon(value);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const time = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
export default function Calendar() {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [day, setDay] = useState(manilaDay());
  const [technician, setTechnician] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getAll<Booking>("/bookings"),
  });
  const techs = useQuery({
    queryKey: ["technicians"],
    queryFn: () => getAll<Technician>("/technicians"),
  });
  const days = useMemo(() => {
    if (view === "day") return [day];
    const date = atNoon(day);
    if (view === "week") {
      const monday = shiftDay(day, -((date.getUTCDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
    }
    const first = day.slice(0, 7) + "-01";
    const start = shiftDay(first, -((atNoon(first).getUTCDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => shiftDay(start, i));
  }, [day, view]);
  const rows = (bookings.data ?? []).filter(
    (b) =>
      b.status !== "CANCELLED" &&
      (!technician || b.technicianId === technician),
  );
  const move = (direction: number) => {
    if (view !== "month") {
      setDay(shiftDay(day, direction * (view === "week" ? 7 : 1)));
      return;
    }
    const date = atNoon(day);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + direction);
    setDay(date.toISOString().slice(0, 10));
  };
  const periodLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
    ...(view === "day" ? { day: "numeric" } : {}),
  }).format(atNoon(day));
  if (bookings.isLoading) return <Spinner label="Loading your schedule…" />;
  if (bookings.isError)
    return (
      <ErrorState error={bookings.error} onRetry={() => bookings.refetch()} />
    );
  return (
    <div className="page-stack">
      <PageHeader
        title="Service calendar"
        subtitle="Plan the week. Keep every technician on schedule."
        action={
          <Button onClick={() => setNewSchedule(day + "T09:00")}>
            <Plus size={16} /> New booking
          </Button>
        }
      />
      <Card>
        <div className="page-toolbar">
          <div className="tab-bar">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => setView(v)}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="calendar-navigation">
            <button
              className="icon-button"
              onClick={() => move(-1)}
              aria-label="Previous period"
            >
              <ChevronLeft size={18} />
            </button>
            <strong>{periodLabel}</strong>
            <button
              className="icon-button"
              onClick={() => move(1)}
              aria-label="Next period"
            >
              <ChevronRight size={18} />
            </button>
            <Button variant="secondary" onClick={() => setDay(manilaDay())}>
              Today
            </Button>
          </div>
          <select
            aria-label="Filter by technician"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            className={inputClass}
          >
            <option value="">All technicians</option>
            {techs.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="calendar-meta">
          <span className="muted">All times are in Manila (UTC+8)</span>
          <input
            type="date"
            aria-label="Go to date"
            className={inputClass}
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
        </div>
      </Card>
      <Card>
        <div className="calendar-scroll">
          <div className={"calendar-grid calendar-" + view}>
            {days.map((d) => {
              const visits = rows
                .filter((b) => manilaDay(b.scheduledAt) === d)
                .sort(
                  (a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt),
                );
              const today = d === manilaDay();
              return (
                <div
                  key={d}
                  className={
                    "calendar-day " +
                    (today ? "is-today " : "") +
                    (view === "month" && !d.startsWith(day.slice(0, 7))
                      ? "outside-month"
                      : "")
                  }
                >
                  <div className="calendar-day-header">
                    <button
                      onClick={() => {
                        setDay(d);
                        if (view === "month") setView("day");
                      }}
                      className="text-button"
                      aria-label={"View " + d}
                    >
                      <span>
                        {new Intl.DateTimeFormat("en-PH", {
                          timeZone: "UTC",
                          weekday: "short",
                        }).format(atNoon(d))}
                      </span>
                      <strong>{atNoon(d).getUTCDate()}</strong>
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => setNewSchedule(d + "T09:00")}
                      aria-label={"Book service on " + d}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="calendar-events">
                    {visits.map((b) => (
                      <button
                        key={b.id}
                        className={
                          "calendar-event event-" + b.status.toLowerCase()
                        }
                        onClick={() => setJob(b.id)}
                      >
                        <strong>{b.customer?.name ?? "Client"}</strong>
                        <span>
                          {time(b.scheduledAt)} · {b.durationMinutes ?? 120} min
                        </span>
                        <small>
                          {b.serviceType}
                          {view !== "month"
                            ? " · " + (b.technician?.name ?? "Unassigned")
                            : ""}
                        </small>
                      </button>
                    ))}
                    {!visits.length && view !== "month" && (
                      <p className="calendar-empty">No visits</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      {!rows.some((b) => days.includes(manilaDay(b.scheduledAt))) && (
        <EmptyState
          title="A clear schedule"
          message="Add a booking to plan a service visit in this period."
        />
      )}
      <BookingModal
        isOpen={Boolean(newSchedule)}
        initialSchedule={newSchedule}
        onClose={() => setNewSchedule("")}
      />
      <WorkOrderModal
        bookingId={job}
        isOpen={Boolean(job)}
        onClose={() => setJob(null)}
      />
    </div>
  );
}

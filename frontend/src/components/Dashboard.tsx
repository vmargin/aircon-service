import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  TriangleAlert,
  Plus,
  ChevronRight,
  ArrowUpRight,
  ClipboardList,
  Wrench,
  Package,
  Clock3,
  Receipt,
  Activity,
  AirVent,
  MapPin,
} from "lucide-react";
import api, { formatCurrency, formatDate } from "../api/api";
import { Booking, BookingStatus, Invoice, Technician } from "../types";
import {
  Card,
  Button,
  ErrorState,
  Spinner,
  StatusBadge,
  PaymentBadge,
  EmptyState,
} from "./ui";
import { Avatar, PropertyThumb } from "./Visuals";
import BookingModal from "./BookingModal";
import WorkOrderModal from "./WorkOrderModal";

interface Overview {
  summary: {
    scheduledJobs: number;
    completedJobs: number;
    inProgressJobs: number;
    attentionJobs: number;
    collected: string;
    outstanding: string;
    totalJobs: number;
    completionRate: number;
    needsReviewInvoices: number;
  };
  todayJobs: Booking[];
  technicians: Array<Technician & { todayJobs: number }>;
  monthlyService: Array<{
    month: string;
    completed: number;
    scheduled: number;
    inProgress: number;
    collected: number;
  }>;
  activity: Array<{
    id: string;
    action: string;
    resourceId: string;
    createdAt: string;
    user?: { email: string };
  }>;
  lowStock: Array<{
    id: string;
    name: string;
    quantityOnHand: number;
    unit: string;
    reorderLevel: number;
  }>;
  dueUnits: Array<{
    id: string;
    name: string;
    brand: string;
    nextMaintenanceAt: string;
    customer?: { name: string };
  }>;
  recentInvoices: Invoice[];
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone = "",
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof CalendarDays;
  tone?: string;
}) {
  return (
    <Card className="metric">
      <div className={`metric-icon ${tone}`}>
        <Icon size={21} />
      </div>
      <div>
        <p className="metric-number">{value.toString().padStart(2, "0")}</p>
        <p className="metric-label">{label}</p>
        <p className={`metric-note ${tone === "green" ? "green" : ""}`}>
          {note}
        </p>
      </div>
    </Card>
  );
}
function PanelTitle({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CalendarDays;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <h2>
        <Icon />
        {title}
      </h2>
      {children}
    </div>
  );
}
const time = (value: string) =>
  new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export default function Dashboard() {
  const [newBooking, setNewBooking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | BookingStatus>("ALL");
  const [chartRange, setChartRange] = useState(6);
  const query = useQuery({
    queryKey: ["overview"],
    queryFn: async () => (await api.get<Overview>("/overview")).data,
  });
  if (query.isLoading) return <Spinner label="Preparing your service day…" />;
  if (query.isError || !query.data)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data;
  const { summary: summary, todayJobs: jobs } = data;
  const chart = data.monthlyService.slice(-chartRange);
  const maximum = Math.max(
    4,
    ...chart.map((m) => m.completed + m.scheduled + m.inProgress),
  );
  const filteredJobs = jobs.filter(
    (job) => filter === "ALL" || job.status === filter,
  );
  const activeTech = data.technicians.filter((t) => t.todayJobs > 0);
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Manila",
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      <div className="eyebrow">YOUR BUSINESS, AT A GLANCE</div>
      <div className="page-header">
        <div>
          <h1>{greeting}, team.</h1>
          <p>
            Here’s what’s happening with your aircon service business today.
          </p>
        </div>
        <div className="page-actions">
          <Link className="date-chip" to="/calendar">
            <CalendarDays size={15} />
            {formatDate(new Date())}
            <ChevronRight size={13} />
          </Link>
          <Button onClick={() => setNewBooking(true)}>
            <Plus size={15} />
            New booking
          </Button>
        </div>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Jobs scheduled today"
          value={summary.scheduledJobs}
          note="Your service day, planned"
          icon={CalendarDays}
        />
        <Metric
          label="Completed today"
          value={summary.completedJobs}
          note="Ready for the next cool space"
          icon={CheckCircle2}
          tone="green"
        />
        <Metric
          label="On site now"
          value={summary.inProgressJobs}
          note="Service in progress"
          icon={CircleDashed}
        />
        <Metric
          label="Requires attention"
          value={summary.attentionJobs}
          note="Priority or overdue open jobs"
          icon={TriangleAlert}
          tone="red"
        />
      </div>
      <div className="dashboard-top">
        <Card>
          <PanelTitle icon={CalendarDays} title="Today’s jobs">
            <Link className="text-link" to="/calendar">
              View calendar
              <ArrowUpRight size={13} />
            </Link>
          </PanelTitle>
          {jobs.length ? (
            <div className="today-list">
              {jobs.slice(0, 4).map((job) => (
                <button
                  key={job.id}
                  className="today-job"
                  onClick={() => setSelected(job.id)}
                >
                  <span className="job-time mono">{time(job.scheduledAt)}</span>
                  <PropertyThumb name={job.customer?.name} />
                  <div>
                    <p className="job-title">
                      {job.customer?.name ?? "Client"}
                    </p>
                    <p className="job-description">
                      {job.serviceType} ·{" "}
                      {job.technician?.name?.split(" ")[0] ?? "Unassigned"}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                  <ChevronRight size={12} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="A clear schedule"
              message="Book your next service visit to get the day moving."
              action={
                <Button onClick={() => setNewBooking(true)}>New booking</Button>
              }
            />
          )}
          <div className="dispatch-foot">
            <Clock3 size={12} />
            {jobs.length} scheduled visits · All times in Manila
            <Link
              to="/bookings"
              className="text-link"
              style={{ marginLeft: "auto" }}
            >
              All jobs
              <ChevronRight size={12} />
            </Link>
          </div>
        </Card>
        <Card>
          <PanelTitle icon={Activity} title="Service overview">
            <label className="sr-only" htmlFor="chart-range">
              Service overview date range
            </label>
            <select
              id="chart-range"
              className="chart-controls"
              value={chartRange}
              onChange={(e) => setChartRange(Number(e.target.value))}
            >
              <option value={6}>Last 6 months</option>
              <option value={3}>Last 3 months</option>
            </select>
          </PanelTitle>
          <div
            className="chart-area"
            role="img"
            aria-label={`Jobs by month: ${chart.map((m) => `${m.month}: ${m.completed} completed, ${m.inProgress} on site, ${m.scheduled} scheduled`).join("; ")}`}
          >
            <div className="chart-axis">
              <span>{maximum}</span>
              <span>{Math.round(maximum * 0.75)}</span>
              <span>{Math.round(maximum * 0.5)}</span>
              <span>{Math.round(maximum * 0.25)}</span>
              <span>0</span>
            </div>
            <div className="chart-bars">
              {chart.map((month) => {
                const total =
                  month.completed + month.inProgress + month.scheduled;
                return (
                  <div className="chart-column" key={month.month}>
                    <div
                      className="chart-stack"
                      style={{ height: `${(total / maximum) * 100}%` }}
                      title={`${month.month}: ${total} jobs`}
                    >
                      <span
                        className="chart-completed"
                        style={{
                          height: `${(month.completed / Math.max(1, total)) * 100}%`,
                        }}
                      />
                      <span
                        className="chart-progress"
                        style={{
                          height: `${(month.inProgress / Math.max(1, total)) * 100}%`,
                        }}
                      />
                      <span
                        className="chart-scheduled"
                        style={{
                          height: `${(month.scheduled / Math.max(1, total)) * 100}%`,
                        }}
                      />
                    </div>
                    <small>{month.month}</small>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot" style={{ background: "var(--chart-completed)" }} />
              Completed
            </span>
            <span>
              <i className="legend-dot" style={{ background: "var(--chart-progress)" }} />
              On site
            </span>
            <span>
              <i className="legend-dot" style={{ background: "var(--chart-scheduled)" }} />
              Scheduled
            </span>
          </div>
          <div className="chart-summary">
            <div>
              <strong>{summary.totalJobs}</strong>
              <small>Total service jobs</small>
            </div>
            <div>
              <strong>{summary.completionRate}%</strong>
              <small>Completion rate</small>
            </div>
            <div>
              <strong>
                {formatCurrency(summary.collected).replace(".00", "")}
              </strong>
              <small>Payments collected</small>
            </div>
          </div>
        </Card>
      </div>
      <div className="dashboard-middle">
        <Card>
          <PanelTitle icon={Wrench} title="Technician dispatch">
            <Link className="text-link" to="/technicians">
              View all
              <ArrowUpRight size={13} />
            </Link>
          </PanelTitle>
          <div className="dispatch-list">
            {data.technicians.slice(0, 4).map((tech) => (
              <Link
                to={`/technicians?q=${encodeURIComponent(tech.name)}`}
                key={tech.id}
                className="dispatch-person"
              >
                <Avatar name={tech.name} />
                <div>
                  <strong>{tech.name}</strong>
                  <p>
                    {tech.todayJobs > 0
                      ? `${tech.todayJobs} ${tech.todayJobs === 1 ? "job" : "jobs"} today`
                      : "Available for assignment"}{" "}
                    · {tech.branch?.name ?? "Branch"}
                  </p>
                </div>
                <span className="dispatch-state" />
              </Link>
            ))}
            {!data.technicians.length && (
              <EmptyState
                title="Build your service team"
                message="Add a technician to start assigning jobs."
              />
            )}
          </div>
          <div className="dispatch-foot">
            <MapPin size={12} />
            {activeTech.length} technicians scheduled today
          </div>
        </Card>
        <Card>
          <div className="panel-header job-board-header">
            <h2>
              <ClipboardList />
              Service job board
            </h2>
            <div className="tab-bar">
              {(
                [
                  { key: "ALL", label: "All jobs" },
                  { key: "CONFIRMED", label: "Scheduled" },
                  { key: "ON_SITE", label: "On site" },
                  { key: "COMPLETED", label: "Completed" },
                ] as Array<{ key: "ALL" | BookingStatus; label: string }>
              ).map((tab) => (
                <button
                  key={tab.key}
                  className={filter === tab.key ? "active" : ""}
                  onClick={() => setFilter(tab.key)}
                  aria-pressed={filter === tab.key}
                >
                  {tab.label}
                  <span className="tab-count">
                    {tab.key === "ALL"
                      ? jobs.length
                      : jobs.filter((j) => j.status === tab.key).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client / location</th>
                  <th>Service type</th>
                  <th>Technician</th>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th>
                    <span className="sr-only">Open work order</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.slice(0, 4).map((job) => (
                  <tr key={job.id}>
                    <td>
                      <div className="client-cell">
                        <PropertyThumb name={job.customer?.name} />
                        <div>
                          <strong>{job.customer?.name}</strong>
                          <small>{job.branch?.name}</small>
                        </div>
                      </div>
                    </td>
                    <td>{job.serviceType}</td>
                    <td>
                      <div className="technician-cell">
                        {job.technician && (
                          <Avatar name={job.technician.name} small />
                        )}
                        {job.technician?.name ?? "Unassigned"}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td>
                      <span className="job-time">Today</span>
                      <small
                        style={{
                          display: "block",
                          color: "var(--muted)",
                          marginTop: 5,
                        }}
                      >
                        {time(job.scheduledAt)}
                      </small>
                    </td>
                    <td>
                      <button
                        className="table-chevron"
                        onClick={() => setSelected(job.id)}
                        aria-label={`Open work order for ${job.customer?.name}`}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredJobs.length && (
            <EmptyState
              title="No jobs in this status today"
              message="Choose another status to see today’s service visits."
            />
          )}
          <div className="dispatch-foot">
            Today’s service board
            <Link
              className="text-link"
              style={{ marginLeft: "auto" }}
              to="/bookings"
            >
              View all service jobs
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Card>
          <PanelTitle icon={TriangleAlert} title="Needs your attention">
            <Link className="text-link" to="/units?due=1">
              View reminders
              <ArrowUpRight size={12} />
            </Link>
          </PanelTitle>
          {data.lowStock.slice(0, 2).map((part) => (
            <Link className="attention-row" to="/inventory" key={part.id}>
              <Package size={15} />
              <div>
                <strong>{part.name}</strong>
                <small>
                  Low stock · {part.quantityOnHand} {part.unit || "pieces"}{" "}
                  remaining
                </small>
              </div>
              <ChevronRight size={12} style={{ marginLeft: "auto" }} />
            </Link>
          ))}
          {data.dueUnits.slice(0, 2).map((unit) => (
            <Link className="attention-row" to="/units?due=1" key={unit.id}>
              <AirVent size={15} />
              <div>
                <strong>
                  {unit.customer?.name} · {unit.name}
                </strong>
                <small>
                  Maintenance due {formatDate(unit.nextMaintenanceAt)}
                </small>
              </div>
              <ChevronRight size={12} style={{ marginLeft: "auto" }} />
            </Link>
          ))}
          {!data.lowStock.length && !data.dueUnits.length && (
            <EmptyState
              title="All caught up"
              message="No low stock or maintenance reminders right now."
            />
          )}
        </Card>
        <Card>
          <PanelTitle icon={Receipt} title="Invoices & payments">
            <Link className="text-link" to="/invoices">
              View all
              <ArrowUpRight size={12} />
            </Link>
          </PanelTitle>
          {data.recentInvoices.slice(0, 3).map((invoice) => (
            <Link className="payment-row" to="/invoices" key={invoice.id}>
              <div>
                <strong>
                  {invoice.booking?.customer?.name ?? "Service invoice"}
                </strong>
                <small>
                  {formatCurrency(invoice.amount)} ·{" "}
                  {invoice.booking?.serviceType}
                </small>
              </div>
              <PaymentBadge status={invoice.paymentStatus} />
            </Link>
          ))}
          {!data.recentInvoices.length && (
            <EmptyState
              title="Ready to bill"
              message="Create an invoice from a work order."
            />
          )}
          <div className="dispatch-foot">
            Outstanding balance
            <strong
              style={{ color: "var(--text)", marginLeft: "auto", fontWeight: 500 }}
            >
              {formatCurrency(summary.outstanding)}
            </strong>
          </div>
          {summary.needsReviewInvoices > 0 && (
            <div className="dispatch-foot">
              {summary.needsReviewInvoices} historical partial invoices require
              review.
            </div>
          )}
        </Card>
        <Card>
          <PanelTitle icon={Activity} title="Recent activity">
            <Link className="text-link" to="/reports">
              Reports
              <ArrowUpRight size={12} />
            </Link>
          </PanelTitle>
          {data.activity.slice(0, 3).map((event) => (
            <div className="attention-row" key={event.id}>
              <i className="activity-dot" />
              <div>
                <strong>
                  {event.action
                    .toLowerCase()
                    .replaceAll("_", " ")
                    .replace(/^./, (c) => c.toUpperCase())}
                </strong>
                <small>
                  {event.user?.email?.split("@")[0]} ·{" "}
                  {formatDate(event.createdAt, true)}
                </small>
              </div>
            </div>
          ))}
          {!data.activity.length && (
            <EmptyState
              title="A fresh start"
              message="Saved changes will appear in your activity history."
            />
          )}
        </Card>
      </div>
      <BookingModal isOpen={newBooking} onClose={() => setNewBooking(false)} />
      <WorkOrderModal
        bookingId={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

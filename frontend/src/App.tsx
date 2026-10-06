import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  Snowflake,
  LayoutDashboard,
  Inbox,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  Users,
  Wrench,
  AirVent,
  Package,
  Receipt,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { getAllList } from "./api/api";
import { Booking, Customer } from "./types";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Bookings from "./components/Bookings";
import Customers from "./components/Customers";
import Technicians from "./components/Technicians";
import Financials from "./components/Financials";
import Reports from "./components/Reports";
import Calendar from "./components/Calendar";
import Units from "./components/Units";
import Inventory from "./components/Inventory";
import Settings from "./components/Settings";
import ServiceDesk from "./components/ServiceDesk";
import InspectionTemplates from "./components/InspectionTemplates";
import WorkOrderModal from "./components/WorkOrderModal";
import Modal from "./components/Modal";
import { Avatar } from "./components/Visuals";
import { jobNumber } from "./api/operational";
import { Spinner, ErrorState } from "./components/ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
  },
});
type ThemeMode = "dark" | "light";
const THEME_STORAGE_KEY = "arctic-theme";

function readThemePreference(): ThemeMode {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

type NavEntry = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};
type NavGroup = { section: string; entries: NavEntry[] };

const NAV: NavGroup[] = [
  {
    section: "SERVICE",
    entries: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/service-desk", label: "Service desk", icon: Inbox },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/bookings", label: "Service jobs", icon: ClipboardList },
      { to: "/inspection-templates", label: "Inspection templates", icon: ClipboardCheck, adminOnly: true },
    ],
  },
  {
    section: "PEOPLE & ASSETS",
    entries: [
      { to: "/customers", label: "Clients", icon: Users },
      { to: "/technicians", label: "Technicians", icon: Wrench },
      { to: "/units", label: "Aircon units", icon: AirVent },
      { to: "/inventory", label: "Parts inventory", icon: Package },
    ],
  },
  {
    section: "BUSINESS",
    entries: [
      { to: "/invoices", label: "Invoices & payments", icon: Receipt },
      { to: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];
function SearchDialog({
  open,
  onClose,
  onJob,
}: {
  open: boolean;
  onClose: () => void;
  onJob: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const result = useQuery({
    queryKey: ["global-search"],
    enabled: open,
    queryFn: async () => {
      const [jobs, clients] = await Promise.all([
        getAllList<Booking>("/bookings"),
        getAllList<Customer>("/customers"),
      ]);
      return { jobs, clients };
    },
  });
  const q = search.trim().toLowerCase();
  const jobs = (result.data?.jobs ?? [])
    .filter(
      (j) =>
        !q ||
        [j.id, jobNumber(j.id), j.customer?.name, j.serviceType, j.notes].some((v) =>
          v?.toLowerCase().includes(q),
        ),
    )
    .slice(0, 7);
  const clients = q
    ? (result.data?.clients ?? [])
        .filter((c) =>
          [c.name, c.phone, c.address].some((v) =>
            v?.toLowerCase().includes(q),
          ),
        )
        .slice(0, 5)
    : [];
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Search service jobs and clients"
      subtitle="Search by work-order ID, client, service, or phone"
      className="search-dialog"
    >
      <div className="search-modal-content">
        <label className="sr-only" htmlFor="global-query">
          Search service jobs and clients
        </label>
        <input
          id="global-query"
          className="field-input"
          placeholder="Client, WO-XXXXXXXX, service or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {result.isLoading ? (
          <Spinner label="Finding your records…" />
        ) : result.isError ? (
          <ErrorState error={result.error} onRetry={() => result.refetch()} />
        ) : (
          <div className="search-results">
            {jobs.map((job) => (
              <button
                key={job.id}
                className="search-result"
                onClick={() => {
                  onClose();
                  onJob(job.id);
                }}
              >
                <ClipboardList size={17} />
                <div>
                  {job.customer?.name}
                  <small>
                    {job.serviceType} · {jobNumber(job.id)}
                  </small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
            {clients.map((client) => (
              <button
                key={client.id}
                className="search-result"
                onClick={() => {
                  navigate(`/customers?q=${encodeURIComponent(client.name)}`);
                  onClose();
                }}
              >
                <Users size={17} />
                <div>
                  {client.name}
                  <small>{client.phone} · Client</small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
            {jobs.length + clients.length === 0 && (
              <div className="empty-state">
                <p>No matches. Try a client name or service type.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
function SidebarContent({
  onNavigate,
  onClose,
}: {
  onNavigate: () => void;
  onClose?: () => void;
}) {
  const { logout, isAdmin } = useAuth();
  return (
    <>
      {onClose && (
        <button
          className="icon-button sidebar-mobile-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      )}
      <NavLink className="brand" to="/" onClick={onNavigate}>
        <Snowflake />
        ARCTIC
      </NavLink>
      <div className="brand-caption">AIRCON SERVICE MANAGEMENT</div>
      <nav aria-label="Main navigation">
        {NAV.map((group) => {
          const entries = group.entries.filter((entry) => !entry.adminOnly || isAdmin);
          return entries.length ? (
            <div className="nav-group" key={group.section}>
              <p className="nav-label">{group.section}</p>
              {entries.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <Icon />
                  {label}
                </NavLink>
              ))}
            </div>
          ) : null;
        })}
      </nav>
      <div className="sidebar-bottom">
        <NavLink
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          to="/settings"
          onClick={onNavigate}
        >
          <SettingsIcon />
          Settings
        </NavLink>
        <button
          className="nav-item"
          style={{ width: "100%", background: "transparent" }}
          onClick={() => {
            onNavigate();
            logout();
          }}
        >
          <LogOut />
          Sign out
        </button>
        <div className="sidebar-tagline">
          <p>Keep every space cool.</p>
          <small>Service. People. Peace of mind.</small>
        </div>
      </div>
    </>
  );
}
function AppLayout({
  theme,
  onToggleTheme,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const current =
    NAV.flatMap((g) => g.entries).find((n) => n.to === location.pathname)
      ?.label ?? "Settings";
  useEffect(() => {
    document.title = `${current} | ARCTIC`;
    setDrawer(false);
  }, [current]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDrawer(false);
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!drawer) return;
    const dialog = drawerRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(".sidebar-mobile-close")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      drawerTriggerRef.current?.focus();
    };
  }, [drawer]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1021px)");
    const closeAtDesktop = () => {
      if (desktop.matches) setDrawer(false);
    };
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar desktop-sidebar">
        <SidebarContent onNavigate={() => setDrawer(false)} />
      </aside>
      <dialog
        ref={drawerRef}
        id="mobile-navigation"
        className="drawer-dialog"
        aria-label="Navigation menu"
        onCancel={(event) => {
          event.preventDefault();
          setDrawer(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDrawer(false);
        }}
      >
        <div className="sidebar drawer-sidebar">
          <SidebarContent
            onNavigate={() => setDrawer(false)}
            onClose={() => setDrawer(false)}
          />
        </div>
      </dialog>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-left">
            <button
              ref={drawerTriggerRef}
              className="icon-button mobile-menu"
              aria-controls="mobile-navigation"
              aria-haspopup="dialog"
              aria-label="Open navigation"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              Workspace<span>/</span>
              {current}
            </div>
            <button
              className="global-search"
              aria-label="Search jobs and clients"
              onClick={() => setSearch(true)}
            >
              <Search size={15} />
              <span>Search jobs, clients…</span>
              <kbd>Ctrl / ⌘ K</kbd>
            </button>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button theme-toggle"
              type="button"
              aria-label="Light theme"
              aria-pressed={theme === "light"}
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              onClick={onToggleTheme}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <NavLink
              className="icon-button"
              to="/units?due=1"
              aria-label="View service reminders"
              title="Service reminders"
            >
              <Bell size={18} />
            </NavLink>
            <NavLink
              className="account"
              to="/settings"
              aria-label="View account settings"
            >
              <Avatar name={isAdmin ? "Arctic Admin" : "Branch Leader"} />
              <div>
                <strong>{isAdmin ? "Administrator" : "Branch leader"}</strong>
                <small>
                  {isAdmin ? "Organization workspace" : user?.branchName}
                </small>
              </div>
              <ChevronRight size={12} />
            </NavLink>
          </div>
        </header>
        <main className="app-main" id="main-content" tabIndex={-1}>
          <Outlet />
          <footer className="app-footer">
            <span>
              <strong>ARCTIC</strong>Keep every space cool.
            </span>
            <span>Aircon service management for a cooler tomorrow.</span>
          </footer>
        </main>
      </div>
      <SearchDialog
        open={search}
        onClose={() => setSearch(false)}
        onJob={setJobId}
      />
      <WorkOrderModal
        bookingId={jobId}
        isOpen={!!jobId}
        onClose={() => setJobId(null)}
      />
    </div>
  );
}
function RequireAuth({
  theme,
  onToggleTheme,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const { user, loading } = useAuth();
  return loading ? (
    <div className="app">
      <Spinner label="Opening your workspace…" />
    </div>
  ) : user ? (
    <AppLayout theme={theme} onToggleTheme={onToggleTheme} />
  ) : (
    <Navigate to="/login" replace />
  );
}
function LoginRoute() {
  const { user, loading } = useAuth();
  return loading ? <Spinner /> : user ? <Navigate to="/" replace /> : <Login />;
}
function AdminInspectionTemplates() {
  const { isAdmin } = useAuth();
  return isAdmin ? <InspectionTemplates /> : <Navigate to="/" replace />;
}
export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(readThemePreference);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f3f7f9" : "#071c25");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The current page still follows the selected theme when storage is unavailable.
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((current) => (current === "light" ? "dark" : "light"));

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              element={<RequireAuth theme={theme} onToggleTheme={toggleTheme} />}
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/service-desk" element={<ServiceDesk />} />
              <Route path="/inspection-templates" element={<AdminInspectionTemplates />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route
                path="/jobs"
                element={<Navigate to="/bookings" replace />}
              />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/technicians" element={<Technicians />} />
              <Route path="/units" element={<Units />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/invoices" element={<Financials />} />
              <Route
                path="/financials"
                element={<Navigate to="/invoices" replace />}
              />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

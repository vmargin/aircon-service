import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getAll } from "../api/operational";
import { useAuth } from "../auth/AuthContext";
import { Branch } from "../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from "./ui";

export default function Settings() {
  const { user, isAdmin, logout } = useAuth();
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => getAll<Branch>("/branches"),
  });
  return (
    <div className="page-stack">
      <PageHeader
        title="Your workspace"
        subtitle="Account access, branch coverage, and the way your team works."
      />
      <div className="settings-grid">
        <Card>
          <div className="panel-header">
            <h2>
              <UserRound size={17} /> Account and session
            </h2>
            <span className="badge payment-paid">
              <i /> Signed in
            </span>
          </div>
          <div className="panel-body">
            <dl className="detail-grid">
              <div>
                <dt>Email</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{isAdmin ? "Administrator" : "Branch leader"}</dd>
              </div>
              <div>
                <dt>Organization</dt>
                <dd>{user?.orgName}</dd>
              </div>
              <div>
                <dt>Branch access</dt>
                <dd>
                  {isAdmin
                    ? "All organization branches"
                    : (user?.branchName ?? "Assigned branch")}
                </dd>
              </div>
            </dl>
            <p className="muted">
              Sign out when you finish using a shared computer.
            </p>
            <div className="workorder-actions">
              <Button variant="secondary" onClick={logout}>
                <LogOut size={15} /> Sign out
              </Button>
            </div>
          </div>
        </Card>
        <Card>
          <div className="panel-header">
            <h2>
              <ShieldCheck size={17} /> Access and financial safeguards
            </h2>
          </div>
          <div className="panel-body">
            <div className="history-list">
              <div className="history-entry">
                <strong>Organization and branch access</strong>
                <small>
                  Clients and units belong to your organization. Work orders,
                  technician dispatch, inventory, and billing respect your
                  branch permissions.
                </small>
              </div>
              <div className="history-entry">
                <strong>Protected service history</strong>
                <small>
                  Completed and cancelled work orders are final. Invoiced work
                  orders cannot be deleted.
                </small>
              </div>
              <div className="history-entry">
                <strong>Recorded collections</strong>
                <small>
                  Payments are recorded as receipts. Historical partial-payment
                  amounts remain flagged for review when the amount is unknown.
                </small>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="panel-header">
            <h2>
              <Building2 size={17} /> Branch coverage
            </h2>
            <span className="muted">
              {branches.data?.length ?? 0} accessible
            </span>
          </div>
          <div className="panel-body">
            {branches.isLoading ? (
              <Spinner label="Loading branches…" />
            ) : branches.isError ? (
              <ErrorState
                error={branches.error}
                onRetry={() => branches.refetch()}
              />
            ) : !branches.data?.length ? (
              <EmptyState
                title="No accessible branches"
                message="Your account needs an assigned branch before dispatch and stock operations."
              />
            ) : (
              <div className="history-list">
                {branches.data.map((branch) => (
                  <div className="history-entry" key={branch.id}>
                    <strong>{branch.name}</strong>
                    <small>
                      {branch.location || "Location not recorded"}
                      {user?.branchId === branch.id ? " · Your branch" : ""}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <div className="panel-header">
            <h2>
              <CalendarClock size={17} /> Service workflow
            </h2>
            <span className="muted">Manila · UTC+8</span>
          </div>
          <div className="panel-body">
            <div className="history-list">
              <div className="history-entry">
                <strong>1. Know the client and equipment</strong>
                <small>
                  Register the client and unit, including model, capacity, and
                  location.
                </small>
                <Link className="text-button" to="/units">
                  Open unit records →
                </Link>
              </div>
              <div className="history-entry">
                <strong>2. Plan and deliver the visit</strong>
                <small>
                  Book a duration, assign an available technician, then confirm
                  and start on-site work. Record the inspection, diagnosis, and
                  parts before invoicing.
                </small>
                <Link className="text-button" to="/calendar">
                  Open service calendar →
                </Link>
              </div>
              <div className="history-entry">
                <strong>3. Bill, collect, and follow up</strong>
                <small>
                  Issue the invoice before completion, record each payment, and
                  set the unit's next service date based on its needs.
                </small>
                <Link className="text-button" to="/invoices">
                  Open invoices →
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

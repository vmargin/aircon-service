import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  MapPin,
  Plus,
  Search,
  Send,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api, { formatCurrency, formatDate } from "../api/api";
import {
  getAll,
  invalidateOperations,
  jobNumber,
  manilaInput,
  scheduleIso,
} from "../api/operational";
import { useAuth } from "../auth/AuthContext";
import {
  ALLOWED_SERVICE_REQUEST_TRANSITIONS,
  Branch,
  Customer,
  EstimateApprovalMethod,
  EstimateRevision,
  InspectionTemplate,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_TYPES,
  ServiceRequest,
  ServiceRequestStatus,
  ServiceSite,
  Technician,
  Unit,
} from "../types";
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
import Modal from "./Modal";

type DeskTab = "requests" | "sites";
type Dialog = "new-request" | "request-detail" | "site" | "estimate" | "convert" | null;
type EstimateLineDraft = { description: string; quantity: string; unitPrice: string };

const blankLine = (): EstimateLineDraft => ({ description: "", quantity: "1", unitPrice: "" });
const requestStatuses = Object.keys(
  SERVICE_REQUEST_STATUS_LABELS,
) as ServiceRequestStatus[];
const requestBadgeClass: Record<ServiceRequestStatus, string> = {
  NEW: "status-pending",
  NEEDS_ASSESSMENT: "status-pending",
  READY_TO_SCHEDULE: "status-confirmed",
  CONVERTED: "status-completed",
  CLOSED: "status-cancelled",
};
const estimateBadgeClass: Record<EstimateRevision["status"], string> = {
  DRAFT: "status-pending",
  SENT: "status-confirmed",
  APPROVED: "status-completed",
  DECLINED: "status-cancelled",
};

function invalidateServiceDesk(client: ReturnType<typeof useQueryClient>) {
  invalidateOperations(client);
  void client.invalidateQueries({ queryKey: ["service-requests"] });
  void client.invalidateQueries({ queryKey: ["service-sites"] });
  void client.invalidateQueries({ queryKey: ["inspection-templates"] });
}

function currentRevision(request: ServiceRequest): EstimateRevision | undefined {
  return request.estimate?.revisions[0];
}

function RequestStatus({ status }: { status: ServiceRequestStatus }) {
  return (
    <span className={`badge ${requestBadgeClass[status]}`}>
      <i /> {SERVICE_REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

function EstimateStatus({ status }: { status: EstimateRevision["status"] }) {
  return (
    <span className={`badge ${estimateBadgeClass[status]}`}>
      <i /> {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function shortRequestNumber(id: string) {
  return `REQ-${id.slice(-8).toUpperCase()}`;
}

export default function ServiceDesk() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState<DeskTab>("requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceRequestStatus | "ALL">("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSnapshot, setSelectedSnapshot] = useState<ServiceRequest | null>(null);
  const [editingSite, setEditingSite] = useState<ServiceSite | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const requests = useQuery({
    queryKey: ["service-requests"],
    queryFn: () => getAll<ServiceRequest>("/service-requests"),
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => getAll<Customer>("/customers"),
  });
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => getAll<Branch>("/branches"),
    enabled: isAdmin,
  });
  const allSites = useQuery({
    queryKey: ["service-sites", isAdmin ? "all" : "active"],
    queryFn: () =>
      getAll<ServiceSite>(
        "/service-sites",
        isAdmin ? { includeInactive: "true" } : undefined,
      ),
  });
  const units = useQuery({
    queryKey: ["units"],
    queryFn: () => getAll<Unit>("/units"),
  });
  const technicians = useQuery({
    queryKey: ["technicians"],
    queryFn: () => getAll<Technician>("/technicians"),
  });
  const templates = useQuery({
    queryKey: ["inspection-templates"],
    queryFn: () => getAll<InspectionTemplate>("/inspection-templates"),
    enabled: dialog === "convert",
  });

  const selectedRequest =
    requests.data?.find((request) => request.id === selectedId) ??
    (selectedSnapshot?.id === selectedId ? selectedSnapshot : null);
  const storeRequest = (request: ServiceRequest) => {
    setSelectedSnapshot(request);
    client.setQueryData<ServiceRequest[]>(["service-requests"], (current) =>
      current?.map((item) => (item.id === request.id ? request : item)),
    );
  };
  const storeRevision = (requestId: string, revision: EstimateRevision) => {
    const request =
      selectedSnapshot?.id === requestId
        ? selectedSnapshot
        : requests.data?.find((item) => item.id === requestId);
    if (!request) return;

    const previousEstimate = request.estimate;
    const revisions = [
      revision,
      ...(previousEstimate?.revisions ?? []).filter((item) => item.id !== revision.id),
    ].sort((left, right) => right.revisionNumber - left.revisionNumber);
    const updated: ServiceRequest = {
      ...request,
      status: revision.status === "APPROVED" ? "READY_TO_SCHEDULE" : request.status,
      estimate: {
        id: previousEstimate?.id ?? revision.estimateId,
        serviceRequestId: request.id,
        revisions,
        createdAt: previousEstimate?.createdAt ?? revision.createdAt,
        updatedAt: previousEstimate?.updatedAt ?? revision.createdAt,
      },
    };
    storeRequest(updated);
  };
  const queryError = requests.error || customers.error || (isAdmin ? branches.error : null);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (requests.data ?? []).filter((request) => {
      if (statusFilter !== "ALL" && request.status !== statusFilter) return false;
      if (isAdmin && branchFilter !== "ALL" && request.branchId !== branchFilter) return false;
      if (!query) return true;
      return [
        shortRequestNumber(request.id),
        request.customer?.name,
        request.customer?.phone,
        request.serviceType,
        request.reportedIssue,
        request.serviceAddress,
        request.branch?.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [requests.data, search, statusFilter, branchFilter, isAdmin]);

  const openRequest = (request: ServiceRequest) => {
    setSelectedId(request.id);
    setSelectedSnapshot(request);
    setActionError("");
    setDialog("request-detail");
  };

  const requestUpdate = useMutation({
    mutationFn: async (values: { request: ServiceRequest; status: ServiceRequestStatus; internalNotes: string; serviceSiteId?: string | null; unitId?: string | null }) => {
      const body: { status?: ServiceRequestStatus; internalNotes?: string | null; serviceSiteId?: string | null; unitId?: string | null } = {
        internalNotes: values.internalNotes.trim() || null,
      };
      if (values.status !== values.request.status) body.status = values.status;
      if (values.serviceSiteId !== undefined) body.serviceSiteId = values.serviceSiteId;
      if (values.unitId !== undefined) body.unitId = values.unitId;
      const { data } = await api.patch<ServiceRequest>(`/service-requests/${values.request.id}`, body);
      return data;
    },
    onSuccess: (request) => {
      storeRequest(request);
      setActionError("");
      invalidateServiceDesk(client);
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const createRequest = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<ServiceRequest>("/service-requests", body);
      return data;
    },
    onSuccess: (request) => {
      invalidateServiceDesk(client);
      setSelectedId(request.id);
      setSelectedSnapshot(request);
      setDialog("request-detail");
      setActionError("");
      setNotice(`${shortRequestNumber(request.id)} added to the service inbox.`);
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const siteMutation = useMutation({
    mutationFn: async (values: {
      customerId: string;
      name: string;
      address: string;
      contactName: string;
      phone: string;
      accessNotes: string;
      isActive: boolean;
    }) => {
      const body = {
        ...values,
        contactName: values.contactName.trim() || null,
        phone: values.phone.trim() || null,
        accessNotes: values.accessNotes.trim() || null,
      };
      const { data } = editingSite
        ? await api.patch<ServiceSite>(`/service-sites/${editingSite.id}`, body)
        : await api.post<ServiceSite>("/service-sites", body);
      return data;
    },
    onSuccess: (site) => {
      setEditingSite(null);
      setDialog(null);
      setActionError("");
      setNotice(`${site.name} saved under ${site.customer?.name ?? "the selected client"}.`);
      invalidateServiceDesk(client);
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const toggleSite = useMutation({
    mutationFn: async (site: ServiceSite) =>
      api.patch(`/service-sites/${site.id}`, { isActive: !site.isActive }),
    onSuccess: (_result, site) => {
      setActionError("");
      setNotice(`${site.name} ${site.isActive ? "deactivated" : "reactivated"}.`);
      invalidateServiceDesk(client);
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const approve = useMutation({
    mutationFn: async (values: { requestId: string; revisionId: string; method: EstimateApprovalMethod; contact: string; note: string }) => {
      const { data } = await api.post<EstimateRevision>(
        `/estimate-revisions/${values.revisionId}/approve`,
        { method: values.method, contact: values.contact.trim(), note: values.note.trim() || null },
      );
      return data;
    },
    onSuccess: (revision, values) => {
      storeRevision(values.requestId, revision);
      setActionError("");
      invalidateServiceDesk(client);
      setNotice("Estimate approval recorded. The request is ready to schedule.");
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const decline = useMutation({
    mutationFn: async (values: { requestId: string; revisionId: string; note: string }) => {
      const { data } = await api.post<EstimateRevision>(`/estimate-revisions/${values.revisionId}/decline`, { note: values.note.trim() || null });
      return data;
    },
    onSuccess: (revision, values) => {
      storeRevision(values.requestId, revision);
      setActionError("");
      invalidateServiceDesk(client);
      setNotice("Estimate decision recorded.");
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const sendEstimate = useMutation({
    mutationFn: async (values: { requestId: string; revisionId: string }) => {
      const { data } = await api.post<EstimateRevision>(`/estimate-revisions/${values.revisionId}/send`);
      return data;
    },
    onSuccess: (revision, values) => {
      storeRevision(values.requestId, revision);
      setActionError("");
      invalidateServiceDesk(client);
      setNotice("Estimate marked as sent. Record the customer’s decision when they respond.");
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const convert = useMutation({
    mutationFn: async (values: { requestId: string; scheduledAt: string; technicianId: string; durationMinutes: number; inspectionTemplateId: string }) => {
      const { data } = await api.post<{ id: string }>(`/service-requests/${values.requestId}/convert`, {
        scheduledAt: scheduleIso(values.scheduledAt),
        technicianId: values.technicianId || null,
        durationMinutes: values.durationMinutes,
        inspectionTemplateId: values.inspectionTemplateId || null,
      });
      return data;
    },
    onSuccess: (booking) => {
      setDialog(null);
      setActionError("");
      setNotice(`${jobNumber(booking.id)} created from the service request.`);
      invalidateServiceDesk(client);
    },
    onError: (error: Error) => setActionError(error.message),
  });

  if (requests.isLoading || customers.isLoading || (isAdmin && branches.isLoading)) {
    return <Spinner label="Loading service desk…" />;
  }
  if (queryError) {
    return (
      <ErrorState
        error={queryError}
        onRetry={() => {
          void requests.refetch();
          void customers.refetch();
          if (isAdmin) void branches.refetch();
        }}
      />
    );
  }

  const requestRows = requests.data ?? [];
  const siteRows = (allSites.data ?? []).filter((site) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      [site.name, site.address, site.customer?.name, site.contactName, site.phone]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  });

  const latest = selectedRequest ? currentRevision(selectedRequest) : undefined;
  const canConvert = Boolean(
    selectedRequest &&
      selectedRequest.status === "READY_TO_SCHEDULE" &&
      (!selectedRequest.estimate || latest?.status === "APPROVED"),
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="Service desk"
        subtitle="Capture unscheduled work, manage customer sites and carry approved scope into a service job."
        action={
          tab === "requests" ? (
            <Button onClick={() => { setActionError(""); setDialog("new-request"); }}>
              <Plus size={16} /> New request
            </Button>
          ) : (
            <Button onClick={() => { setEditingSite(null); setActionError(""); setDialog("site"); }}>
              <Plus size={16} /> Add service site
            </Button>
          )
        }
      />

      {notice && (
        <div className="notice notice-success" role="status">
          <div className="flex items-center justify-between gap-3">
            <span>{notice}</span>
            {notice.includes("created from the service request") && (
              <Button variant="secondary" onClick={() => navigate("/bookings")}>
                Open service jobs <ChevronRight size={15} />
              </Button>
            )}
          </div>
        </div>
      )}
      {actionError && dialog === null && (
        <p className="notice notice-error" role="alert">{actionError}</p>
      )}

      <Card>
        <div className="page-toolbar">
          <div className="tab-bar" role="tablist" aria-label="Service desk views">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "requests"}
              className={tab === "requests" ? "tab active" : "tab"}
              onClick={() => { setTab("requests"); setSearch(""); setActionError(""); }}
            >
              <ClipboardList size={15} /> Request inbox
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "sites"}
              className={tab === "sites" ? "tab active" : "tab"}
              onClick={() => { setTab("sites"); setSearch(""); setActionError(""); }}
            >
              <MapPin size={15} /> Service sites
            </button>
          </div>
          <div className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              className={inputClass}
              aria-label={tab === "requests" ? "Search service requests" : "Search service sites"}
              placeholder={tab === "requests" ? "Client, issue or request…" : "Site, client or address…"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {tab === "requests" && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Request status">
                <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ServiceRequestStatus | "ALL")}>
                  <option value="ALL">All statuses</option>
                  {requestStatuses.map((status) => <option value={status} key={status}>{SERVICE_REQUEST_STATUS_LABELS[status]}</option>)}
                </select>
              </Field>
              {isAdmin && (
                <Field label="Branch">
                  <select className={inputClass} value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
                    <option value="ALL">All branches</option>
                    {(branches.data ?? []).map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}
        </div>
      </Card>

      {tab === "requests" ? (
        <Card>
          {visibleRequests.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Client and service site</th>
                    <th>Issue</th>
                    <th>Preferred window</th>
                    <th>Branch</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <button className="text-button" onClick={() => openRequest(request)}>
                          {shortRequestNumber(request.id)}
                        </button>
                        <small>Received {formatDate(request.createdAt)}</small>
                      </td>
                      <td>
                        <strong>{request.customer?.name ?? "Client record unavailable"}</strong>
                        <small>{request.serviceSite?.name ?? request.serviceAddress}</small>
                      </td>
                      <td>
                        <strong>{request.serviceType}</strong>
                        <small>{request.reportedIssue}</small>
                      </td>
                      <td>
                        {request.preferredWindowStart && request.preferredWindowEnd ? (
                          <>
                            <strong>{formatDate(request.preferredWindowStart, true)}</strong>
                            <small>to {formatDate(request.preferredWindowEnd, true)}</small>
                          </>
                        ) : <span className="muted">Not set</span>}
                      </td>
                      <td>{request.branch?.name ?? "—"}</td>
                      <td>
                        <RequestStatus status={request.status} />
                        {currentRevision(request) && (
                          <small className="block mt-2" aria-label="Latest estimate status">
                            Estimate · <EstimateStatus status={currentRevision(request)!.status} />
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={requestRows.length ? "No matching requests" : "No requests in the inbox"}
              message={requestRows.length ? "Adjust the search or filters to see other requests." : "Log phone and web inquiries here before assigning an appointment."}
              action={<Button onClick={() => { setActionError(""); setDialog("new-request"); }}><Plus size={16} /> Create service request</Button>}
            />
          )}
        </Card>
      ) : (
        <Card>
          {allSites.isLoading ? (
            <Spinner label="Loading service sites…" />
          ) : allSites.isError ? (
            <ErrorState error={allSites.error} onRetry={() => void allSites.refetch()} />
          ) : siteRows.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Site</th><th>Client</th><th>Address and access</th><th>Contact</th><th>State</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {siteRows.map((site) => (
                    <tr key={site.id}>
                      <td><strong>{site.name}</strong></td>
                      <td>{site.customer?.name ?? "Client record unavailable"}</td>
                      <td>
                        {site.address}
                        {site.accessNotes && <small>{site.accessNotes}</small>}
                      </td>
                      <td>
                        {site.contactName || "—"}
                        {site.phone && <small>{site.phone}</small>}
                      </td>
                      <td>
                        <span className={`badge ${site.isActive ? "status-completed" : "status-cancelled"}`}>
                          <i /> {site.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => { setEditingSite(site); setActionError(""); setDialog("site"); }}>Edit</Button>
                          <Button
                            variant="secondary"
                            loading={toggleSite.isPending && toggleSite.variables?.id === site.id}
                            onClick={() => toggleSite.mutate(site)}
                          >
                            {site.isActive ? <Archive size={15} /> : <ArchiveRestore size={15} />}
                            {site.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={allSites.data?.length ? "No matching service sites" : "No service sites yet"}
              message={allSites.data?.length ? "Try another client, site name or address." : "Add a site to keep multi-property service addresses and access details with the client."}
              action={<Button onClick={() => { setEditingSite(null); setActionError(""); setDialog("site"); }}><Plus size={16} /> Add service site</Button>}
            />
          )}
        </Card>
      )}

      <NewRequestDialog
        isOpen={dialog === "new-request"}
        onClose={() => { setDialog(null); setActionError(""); }}
        customers={customers.data ?? []}
        branches={branches.data ?? []}
        units={units.data ?? []}
        isAdmin={isAdmin}
        userBranchId={user?.branchId ?? ""}
        sitesError={dialog === "new-request" && units.isError ? units.error.message : ""}
        error={actionError}
        loading={createRequest.isPending}
        onSubmit={(body) => createRequest.mutate(body)}
      />

      <SiteDialog
        isOpen={dialog === "site"}
        site={editingSite}
        customers={customers.data ?? []}
        error={actionError}
        loading={siteMutation.isPending}
        onClose={() => { setDialog(null); setEditingSite(null); setActionError(""); }}
        onSubmit={(values) => siteMutation.mutate(values)}
      />

      {selectedRequest && (
        <RequestDetailDialog
          isOpen={dialog === "request-detail"}
          request={selectedRequest}
          sites={allSites.data ?? []}
          units={units.data ?? []}
          linkageError={allSites.isError ? allSites.error.message : units.isError ? units.error.message : ""}
          linkageLoading={allSites.isLoading || units.isLoading}
          error={actionError}
          saving={requestUpdate.isPending}
          approving={approve.isPending}
          declining={decline.isPending}
          sending={sendEstimate.isPending}
          onClose={() => { setDialog(null); setActionError(""); }}
          onSave={(values) => requestUpdate.mutate({ request: selectedRequest, ...values })}
          onSend={(revisionId) => sendEstimate.mutate({ requestId: selectedRequest.id, revisionId })}
          onApprove={(values) => approve.mutate({ requestId: selectedRequest.id, ...values })}
          onDecline={(values) => decline.mutate({ requestId: selectedRequest.id, ...values })}
          onEditEstimate={() => { setActionError(""); setDialog("estimate"); }}
          onConvert={() => { setActionError(""); setDialog("convert"); }}
          canConvert={canConvert}
          onOpenBooking={() => { setDialog(null); navigate("/bookings"); }}
        />
      )}

      {selectedRequest && (
        <EstimateDialog
          isOpen={dialog === "estimate"}
          request={selectedRequest}
          error={actionError}
          loading={false}
          onClose={() => { setDialog("request-detail"); setActionError(""); }}
          onSave={async (values) => {
            try {
              const { data } = await api.post<EstimateRevision>(`/service-requests/${selectedRequest.id}/estimate`, values);
              setActionError("");
              storeRequest({ ...selectedRequest, estimate: {
                id: selectedRequest.estimate?.id ?? data.estimateId,
                serviceRequestId: selectedRequest.id,
                revisions: [data, ...(selectedRequest.estimate?.revisions ?? []).filter((revision) => revision.id !== data.id)],
                createdAt: selectedRequest.estimate?.createdAt ?? data.createdAt,
                updatedAt: data.createdAt,
              } });
              invalidateServiceDesk(client);
              setNotice(`Estimate revision ${data.revisionNumber} saved.`);
              setDialog("request-detail");
            } catch (error) {
              setActionError(error instanceof Error ? error.message : "Could not save the estimate.");
            }
          }}
        />
      )}

      {selectedRequest && (
        <ConvertDialog
          isOpen={dialog === "convert"}
          request={selectedRequest}
          technicians={(technicians.data ?? []).filter((technician) => technician.branchId === selectedRequest.branchId && technician.isActive)}
          templates={(templates.data ?? []).filter((template) => template.serviceType === selectedRequest.serviceType)}
          loading={convert.isPending}
          error={actionError}
          templateError={templates.isError ? templates.error.message : ""}
          onRetryTemplates={() => { setActionError(""); void templates.refetch(); }}
          onClose={() => { setDialog("request-detail"); setActionError(""); }}
          onSubmit={(values) => { setActionError(""); convert.mutate({ requestId: selectedRequest.id, ...values }); }}
        />
      )}
    </div>
  );
}

function NewRequestDialog({
  isOpen,
  onClose,
  customers,
  branches,
  units,
  isAdmin,
  userBranchId,
  sitesError,
  error,
  loading,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  branches: Branch[];
  units: Unit[];
  isAdmin: boolean;
  userBranchId: string;
  sitesError: string;
  error: string;
  loading: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [reportedIssue, setReportedIssue] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [sites, setSites] = useState<ServiceSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setCustomerId("");
    setBranchId(!isAdmin ? userBranchId : branches.length === 1 ? branches[0].id : "");
    setSiteId("");
    setUnitId("");
    setServiceType(SERVICE_TYPES[0]);
    setPriority("NORMAL");
    setReportedIssue("");
    setServiceAddress("");
    setAccessNotes("");
    setInternalNotes("");
    setWindowStart("");
    setWindowEnd("");
    setLocalError("");
  }, [isOpen, isAdmin, userBranchId, branches]);

  useEffect(() => {
    if (!isOpen || !customerId) {
      setSites([]);
      return;
    }
    let cancelled = false;
    setSitesLoading(true);
    getAll<ServiceSite>("/service-sites", { customerId })
      .then((rows) => { if (!cancelled) setSites(rows); })
      .catch((error: Error) => { if (!cancelled) setLocalError(error.message); })
      .finally(() => { if (!cancelled) setSitesLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, customerId]);

  const customerUnits = units.filter((unit) => unit.customerId === customerId);
  const selectedUnit = customerUnits.find((unit) => unit.id === unitId);
  const linkedSiteId = selectedUnit?.serviceSiteId ?? "";
  const allowedSites = linkedSiteId ? sites.filter((site) => site.id === linkedSiteId) : sites;
  const selectedSite = sites.find((site) => site.id === siteId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");
    if (!customerId) { setLocalError("Select a client."); return; }
    if (!branchId) { setLocalError("Select a branch for this service request."); return; }
    if (Boolean(windowStart) !== Boolean(windowEnd)) {
      setLocalError("Enter both ends of the preferred arrival window, or leave both blank.");
      return;
    }
    if (windowStart && windowEnd && new Date(windowStart) >= new Date(windowEnd)) {
      setLocalError("The preferred window end must be after its start.");
      return;
    }
    const address = selectedSite?.address ?? serviceAddress.trim();
    if (!address) { setLocalError("Enter a service address or choose a service site."); return; }
    onSubmit({
      branchId,
      customerId,
      serviceSiteId: siteId || null,
      unitId: unitId || null,
      serviceAddress: address,
      serviceType,
      reportedIssue: reportedIssue.trim(),
      priority,
      preferredWindowStart: windowStart ? scheduleIso(windowStart) : null,
      preferredWindowEnd: windowEnd ? scheduleIso(windowEnd) : null,
      accessNotes: accessNotes.trim() || null,
      internalNotes: internalNotes.trim() || null,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New service request" subtitle="Capture the issue and customer context before an appointment is assigned." maxWidth="lg">
      <form className="form-stack panel-body" onSubmit={submit}>
        {(error || localError || sitesError) && <p className="notice notice-error" role="alert">{error || localError || sitesError}</p>}
        <div className="form-grid">
          <Field label="Client">
            <select className={inputClass} value={customerId} required onChange={(event) => {
              setCustomerId(event.target.value); setSiteId(""); setUnitId(""); setServiceAddress(""); setAccessNotes("");
            }}>
              <option value="">Choose client…</option>
              {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} · {customer.phone}</option>)}
            </select>
          </Field>
          <Field label="Service type">
            <select className={inputClass} value={serviceType} onChange={(event) => setServiceType(event.target.value)}>
              {SERVICE_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          {isAdmin && (
            <Field label="Handling branch">
              <select className={inputClass} value={branchId} required onChange={(event) => setBranchId(event.target.value)}>
                <option value="">Choose branch…</option>
                {branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Priority">
            <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
              <option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
            </select>
          </Field>
          <Field label="Service site" hint={linkedSiteId ? "This unit is linked to the selected site." : "Optional. A saved site supplies its address."}>
            <select className={inputClass} value={siteId} disabled={!customerId || sitesLoading} onChange={(event) => {
              const nextId = event.target.value;
              const nextSite = sites.find((site) => site.id === nextId);
              setSiteId(nextId);
              if (nextSite) { setServiceAddress(nextSite.address); setAccessNotes(nextSite.accessNotes ?? ""); }
            }}>
              <option value="">No saved site</option>
              {allowedSites.map((site) => <option value={site.id} key={site.id}>{site.name} · {site.address}</option>)}
            </select>
          </Field>
          <Field label="Registered unit">
            <select className={inputClass} value={unitId} disabled={!customerId} onChange={(event) => {
              const nextId = event.target.value;
              const nextUnit = customerUnits.find((unit) => unit.id === nextId);
              setUnitId(nextId);
              if (nextUnit?.serviceSiteId) {
                setSiteId(nextUnit.serviceSiteId);
                const linkedSite = sites.find((site) => site.id === nextUnit.serviceSiteId);
                if (linkedSite) { setServiceAddress(linkedSite.address); setAccessNotes(linkedSite.accessNotes ?? ""); }
              }
            }}>
              <option value="">No unit selected</option>
              {customerUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}{unit.location ? ` · ${unit.location}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Service address" hint={selectedSite ? "Address is supplied by the selected site." : "Required when no saved service site is selected."}>
            <input className={inputClass} value={selectedSite?.address ?? serviceAddress} required={!selectedSite} readOnly={Boolean(selectedSite)} onChange={(event) => setServiceAddress(event.target.value)} placeholder="Street, building and unit" />
          </Field>
          <Field label="Preferred arrival starts" hint="Optional. If provided, enter both start and end.">
            <input type="datetime-local" className={inputClass} value={windowStart} onChange={(event) => setWindowStart(event.target.value)} />
          </Field>
          <Field label="Preferred arrival ends">
            <input type="datetime-local" className={inputClass} value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} />
          </Field>
          <div className="full-span">
            <Field label="Reported issue">
              <textarea className={inputClass} required minLength={3} maxLength={2000} value={reportedIssue} onChange={(event) => setReportedIssue(event.target.value)} placeholder="What did the customer report?" />
            </Field>
          </div>
          <div className="full-span">
            <Field label="Site access notes">
              <textarea className={inputClass} maxLength={1000} value={accessNotes} onChange={(event) => setAccessNotes(event.target.value)} placeholder="Entry instructions or access constraints" />
            </Field>
          </div>
          <div className="full-span">
            <Field label="Internal notes" hint="Staff only. These notes are carried into the work order on conversion.">
              <textarea className={inputClass} maxLength={2000} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Useful context for the service team" />
            </Field>
          </div>
        </div>
        <div className="form-actions">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}><Plus size={15} /> Add to inbox</Button>
        </div>
      </form>
    </Modal>
  );
}

function SiteDialog({
  isOpen,
  site,
  customers,
  error,
  loading,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  site: ServiceSite | null;
  customers: Customer[];
  error: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: { customerId: string; name: string; address: string; contactName: string; phone: string; accessNotes: string; isActive: boolean }) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setCustomerId(site?.customerId ?? "");
    setName(site?.name ?? "");
    setAddress(site?.address ?? "");
    setContactName(site?.contactName ?? "");
    setPhone(site?.phone ?? "");
    setAccessNotes(site?.accessNotes ?? "");
    setIsActive(site?.isActive ?? true);
  }, [isOpen, site]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ customerId, name: name.trim(), address: address.trim(), contactName, phone, accessNotes, isActive });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={site ? "Edit service site" : "Add service site"} subtitle="Sites belong to a client, so the same customer can have multiple service addresses." maxWidth="md">
      <form className="form-stack panel-body" onSubmit={submit}>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <Field label="Client">
          <select className={inputClass} value={customerId} required disabled={Boolean(site)} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Choose client…</option>
            {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Site name">
            <input className={inputClass} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Main office, branch or residence" />
          </Field>
          <Field label="Site contact">
            <input className={inputClass} maxLength={120} value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Contact person" />
          </Field>
          <Field label="Contact phone">
            <input className={inputClass} maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" />
          </Field>
          <Field label="Address">
            <input className={inputClass} required minLength={3} maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, building and unit" />
          </Field>
          <div className="full-span">
            <Field label="Access notes">
              <textarea className={inputClass} maxLength={1000} value={accessNotes} onChange={(event) => setAccessNotes(event.target.value)} placeholder="Entry instructions or site access limits" />
            </Field>
          </div>
        </div>
        {site && (
          <label className="checkbox-row">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            <span>Site is active and available for new service requests and bookings</span>
          </label>
        )}
        <div className="form-actions">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{site ? "Save site" : "Add site"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function RequestDetailDialog({
  isOpen,
  request,
  sites,
  units,
  linkageError,
  linkageLoading,
  error,
  saving,
  approving,
  declining,
  sending,
  onClose,
  onSave,
  onSend,
  onApprove,
  onDecline,
  onEditEstimate,
  onConvert,
  canConvert,
  onOpenBooking,
}: {
  isOpen: boolean;
  request: ServiceRequest;
  sites: ServiceSite[];
  units: Unit[];
  linkageError: string;
  linkageLoading: boolean;
  error: string;
  saving: boolean;
  approving: boolean;
  declining: boolean;
  sending: boolean;
  onClose: () => void;
  onSave: (values: { status: ServiceRequestStatus; internalNotes: string; serviceSiteId?: string | null; unitId?: string | null }) => void;
  onSend: (revisionId: string) => void;
  onApprove: (values: { revisionId: string; method: EstimateApprovalMethod; contact: string; note: string }) => void;
  onDecline: (values: { revisionId: string; note: string }) => void;
  onEditEstimate: () => void;
  onConvert: () => void;
  canConvert: boolean;
  onOpenBooking: () => void;
}) {
  const [status, setStatus] = useState<ServiceRequestStatus>(request.status);
  const [internalNotes, setInternalNotes] = useState(request.internalNotes ?? "");
  const [serviceSiteId, setServiceSiteId] = useState(request.serviceSiteId ?? "");
  const [unitId, setUnitId] = useState(request.unitId ?? "");
  const [approvalMethod, setApprovalMethod] = useState<EstimateApprovalMethod>("PHONE");
  const [approvalContact, setApprovalContact] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const latest = currentRevision(request);
  const editable = request.status !== "CLOSED" && request.status !== "CONVERTED";
  const availableSites = sites.filter((site) =>
    site.customerId === request.customerId && site.branchId === request.branchId && site.isActive,
  );
  const availableUnits = units.filter((unit) =>
    unit.customerId === request.customerId &&
    (!unit.serviceSiteId || availableSites.some((site) => site.id === unit.serviceSiteId)),
  );
  const currentSiteIsAvailable = availableSites.some((site) => site.id === request.serviceSiteId);
  const currentUnitIsAvailable = availableUnits.some((unit) => unit.id === request.unitId);

  useEffect(() => {
    setStatus(request.status);
    setInternalNotes(request.internalNotes ?? "");
    setServiceSiteId(request.serviceSiteId ?? "");
    setUnitId(request.unitId ?? "");
    setApprovalMethod("PHONE");
    setApprovalContact("");
    setApprovalNote("");
    setDecisionNote("");
  }, [isOpen, request.id, request.status, request.internalNotes, request.serviceSiteId, request.unitId]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values: { status: ServiceRequestStatus; internalNotes: string; serviceSiteId?: string | null; unitId?: string | null } = { status, internalNotes };
    if (serviceSiteId !== (request.serviceSiteId ?? "") || unitId !== (request.unitId ?? "")) {
      values.serviceSiteId = serviceSiteId || null;
      values.unitId = unitId || null;
    }
    onSave(values);
  };

  const changeSite = (nextSiteId: string) => {
    const selectedUnit = availableUnits.find((unit) => unit.id === unitId);
    if (!selectedUnit || (selectedUnit.serviceSiteId && selectedUnit.serviceSiteId !== nextSiteId)) {
      setUnitId("");
    }
    setServiceSiteId(nextSiteId);
  };

  const changeUnit = (nextUnitId: string) => {
    const selectedUnit = availableUnits.find((unit) => unit.id === nextUnitId);
    if (selectedUnit?.serviceSiteId && availableSites.some((site) => site.id === selectedUnit.serviceSiteId)) {
      setServiceSiteId(selectedUnit.serviceSiteId);
    } else if (serviceSiteId && !availableSites.some((site) => site.id === serviceSiteId)) {
      setServiceSiteId("");
    }
    setUnitId(nextUnitId);
  };

  const recordApproval = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!latest || !approvalContact.trim()) return;
    onApprove({ revisionId: latest.id, method: approvalMethod, contact: approvalContact, note: approvalNote });
  };

  const recordDecline = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!latest) return;
    onDecline({ revisionId: latest.id, note: decisionNote });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={shortRequestNumber(request.id)} subtitle={`${request.serviceType} · received ${formatDate(request.createdAt, true)}`} maxWidth="lg">
      <div className="modal-body form-stack">
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <div className="workorder-heading">
          <ClipboardList size={24} aria-hidden="true" />
          <div>
            <h3>{request.customer?.name ?? "Client record unavailable"}</h3>
            <p>{request.customer?.phone ?? "No phone on file"} · {request.branch?.name ?? "Branch unavailable"}</p>
          </div>
          <RequestStatus status={request.status} />
        </div>
        <dl className="detail-grid">
          <div><dt>Service address</dt><dd>{request.serviceAddress}</dd></div>
          <div><dt>Service site</dt><dd>{request.serviceSite?.name ?? "No saved service site"}</dd></div>
          <div><dt>Equipment</dt><dd>{request.unit?.name ?? "No unit selected"}</dd></div>
          <div><dt>Priority</dt><dd>{request.priority}</dd></div>
          <div className="full-span"><dt>Reported issue</dt><dd>{request.reportedIssue}</dd></div>
          <div className="full-span"><dt>Site access notes</dt><dd>{request.accessNotes || "No access notes"}</dd></div>
          {request.preferredWindowStart && request.preferredWindowEnd && (
            <div><dt>Preferred arrival</dt><dd>{formatDate(request.preferredWindowStart, true)} to {formatDate(request.preferredWindowEnd, true)}</dd></div>
          )}
          {request.booking && (
            <div><dt>Created work order</dt><dd>{jobNumber(request.booking.id)} · {request.booking.status}</dd></div>
          )}
        </dl>

        {editable ? (
          <form className="form-stack" onSubmit={save}>
            <section className="form-stack" aria-label="Service location and equipment">
              <div>
                <h4>Location and equipment</h4>
                <p className="muted">Use this repair path when a site or unit changed after intake. The selected unit and site must belong to this client and branch.</p>
              </div>
              {linkageError && <p className="notice notice-error" role="alert">Could not load site and unit choices: {linkageError}</p>}
              <div className="form-grid">
                <Field label="Service site">
                  <select className={inputClass} value={serviceSiteId} onChange={(event) => changeSite(event.target.value)} disabled={linkageLoading || Boolean(linkageError)}>
                    <option value="">No saved service site</option>
                    {request.serviceSiteId && !currentSiteIsAvailable && (
                      <option value={request.serviceSiteId} disabled>{request.serviceSite?.name ?? "Current site"} · unavailable in this branch</option>
                    )}
                    {availableSites.map((site) => <option key={site.id} value={site.id}>{site.name} · {site.address}</option>)}
                  </select>
                </Field>
                <Field label="Aircon unit">
                  <select className={inputClass} value={unitId} onChange={(event) => changeUnit(event.target.value)} disabled={linkageLoading || Boolean(linkageError)}>
                    <option value="">No unit selected</option>
                    {request.unitId && !currentUnitIsAvailable && (
                      <option value={request.unitId} disabled>{request.unit?.name ?? "Current unit"} · unavailable in this branch</option>
                    )}
                    {availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.serviceSite?.name ? ` · ${unit.serviceSite.name}` : " · no linked site"}</option>)}
                  </select>
                </Field>
              </div>
            </section>
            <div className="form-grid">
              <Field label="Request status">
                <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as ServiceRequestStatus)}>
                  <option value={request.status}>{SERVICE_REQUEST_STATUS_LABELS[request.status]} (current)</option>
                  {ALLOWED_SERVICE_REQUEST_TRANSITIONS[request.status].map((next) => <option value={next} key={next}>{SERVICE_REQUEST_STATUS_LABELS[next]}</option>)}
                </select>
              </Field>
              <Field label="Internal notes" hint="Only staff can view these notes. They carry into the work order.">
                <textarea className={inputClass} maxLength={2000} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />
              </Field>
            </div>
            <div className="form-actions">
              <Button type="submit" loading={saving}>Save request</Button>
            </div>
          </form>
        ) : request.internalNotes ? (
          <div className="notice"><strong>Internal notes:</strong> {request.internalNotes}</div>
        ) : null}

        <section className="form-stack" aria-labelledby="estimate-history-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 id="estimate-history-title">Estimate revisions</h3>
              <p className="muted">Customer-approved scope is copied into the invoice when one is created.</p>
            </div>
            {editable && <Button variant="secondary" onClick={onEditEstimate}><Plus size={15} /> {latest ? "New revision" : "Create estimate"}</Button>}
          </div>
          {request.estimate?.revisions.length ? (
            <div className="form-stack">
              {request.estimate.revisions.map((revision) => (
                <div className="invoice-total" key={revision.id}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><strong>Revision {revision.revisionNumber}</strong><EstimateStatus status={revision.status} /></div>
                    <small>{revision.notes || "No estimate notes"}</small>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead>
                        <tbody>{revision.lineItems.map((line) => (
                          <tr key={line.id}>
                            <td>{line.description}</td><td>{line.quantity}</td><td>{formatCurrency(line.unitPrice)}</td><td>{formatCurrency(line.lineTotal)}</td>
                          </tr>
                        ))}</tbody>
                        <tfoot><tr><th colSpan={3}>Estimate total</th><th>{formatCurrency(revision.total)}</th></tr></tfoot>
                      </table>
                    </div>
                    {revision.approvalContact && <small>Approval recorded for {revision.approvalContact} via {revision.approvalMethod?.toLowerCase().replace("_", " ")}</small>}
                    {revision.decisionNote && <small>Decision note: {revision.decisionNote}</small>}
                  </div>
                  {revision.id === latest?.id && editable && revision.status === "DRAFT" && (
                    <Button variant="secondary" loading={sending} onClick={() => onSend(revision.id)}><Send size={15} /> Mark sent</Button>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="notice">No estimate is attached. This request can follow the direct scheduling path.</p>}

          {latest?.status === "SENT" && editable && (
            <div className="form-grid">
              <form className="form-stack" onSubmit={recordApproval}>
                <h4>Record customer approval</h4>
                <Field label="Approval method">
                  <select className={inputClass} value={approvalMethod} onChange={(event) => setApprovalMethod(event.target.value as EstimateApprovalMethod)}>
                    <option value="PHONE">Phone</option><option value="IN_PERSON">In person</option><option value="EMAIL">Email</option><option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Customer contact">
                  <input className={inputClass} required maxLength={120} value={approvalContact} onChange={(event) => setApprovalContact(event.target.value)} placeholder="Name of person who approved" />
                </Field>
                <Field label="Approval note">
                  <textarea className={inputClass} maxLength={1000} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Optional confirmation context" />
                </Field>
                <Button type="submit" loading={approving}><Check size={15} /> Record approval</Button>
              </form>
              <form className="form-stack" onSubmit={recordDecline}>
                <h4>Record decline</h4>
                <Field label="Decision note">
                  <textarea className={inputClass} maxLength={1000} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Optional reason or follow-up context" />
                </Field>
                <Button type="submit" variant="secondary" loading={declining}>Record decline</Button>
              </form>
            </div>
          )}
        </section>

        {request.status === "READY_TO_SCHEDULE" && !canConvert && latest && latest.status !== "APPROVED" && (
          <p className="notice">The current estimate must be approved before this request can become a service job.</p>
        )}
        {request.status === "READY_TO_SCHEDULE" && !request.booking && (
          <div className="form-actions">
            <Button disabled={!canConvert} onClick={onConvert}><CalendarClock size={16} /> Schedule service job</Button>
          </div>
        )}
        {request.booking && (
          <div className="form-actions">
            <Button variant="secondary" onClick={onOpenBooking}><Wrench size={16} /> Open service jobs</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EstimateDialog({
  isOpen,
  request,
  error,
  loading,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  request: ServiceRequest;
  error: string;
  loading: boolean;
  onClose: () => void;
  onSave: (values: { notes: string; lineItems: EstimateLineDraft[] }) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EstimateLineDraft[]>([blankLine()]);
  const [localError, setLocalError] = useState("");
  const saving = false;

  useEffect(() => {
    if (!isOpen) return;
    const latest = currentRevision(request);
    setNotes(latest?.status === "DRAFT" ? latest.notes ?? "" : "");
    setLines(
      latest?.status === "DRAFT" && latest.lineItems.length
        ? latest.lineItems.map((line) => ({ description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice) }))
        : [blankLine()],
    );
    setLocalError("");
  }, [isOpen, request.id, request.estimate?.revisions[0]?.id]);

  const updateLine = (index: number, update: Partial<EstimateLineDraft>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...update } : line));
  };

  const lineTotal = (line: EstimateLineDraft) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    return Number.isFinite(quantity * unitPrice) ? quantity * unitPrice : 0;
  };

  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");
    const cleanLines = lines.map((line) => ({
      description: line.description.trim(),
      quantity: line.quantity.trim(),
      unitPrice: line.unitPrice.trim(),
    }));
    if (!cleanLines.length || cleanLines.some((line) => !line.description || !line.quantity || !line.unitPrice)) {
      setLocalError("Complete each estimate line or remove the empty row.");
      return;
    }
    if (cleanLines.some((line) => !/^\d{1,7}(?:\.\d{1,3})?$/.test(line.quantity) || Number(line.quantity) <= 0)) {
      setLocalError("Quantities must be positive and use at most three decimal places.");
      return;
    }
    if (cleanLines.some((line) => !/^\d{1,10}(?:\.\d{1,2})?$/.test(line.unitPrice) || Number(line.unitPrice) < 0)) {
      setLocalError("Unit prices must be zero or greater and use at most two decimal places.");
      return;
    }
    await onSave({ notes: notes.trim(), lineItems: cleanLines });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Estimate revision" subtitle={`${request.customer?.name ?? "Client"} · ${request.serviceType}`} maxWidth="lg">
      <form className="form-stack panel-body" onSubmit={submit}>
        {(error || localError) && <p className="notice notice-error" role="alert">{error || localError}</p>}
        <p className="notice">Enter the proposed work and customer price. The server recalculates line totals and stores each sent or approved revision.</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Line total</th><th>Action</th></tr></thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td><input className={inputClass} aria-label={`Estimate item ${index + 1}`} maxLength={160} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} placeholder="Service or material" /></td>
                  <td><input className={inputClass} aria-label={`Quantity for item ${index + 1}`} inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></td>
                  <td><input className={inputClass} aria-label={`Unit price for item ${index + 1}`} inputMode="decimal" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} placeholder="0.00" /></td>
                  <td className="money">{formatCurrency(lineTotal(line))}</td>
                  <td><Button type="button" variant="secondary" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_row, rowIndex) => rowIndex !== index))}>Remove</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="secondary" onClick={() => setLines((current) => [...current, blankLine()])}><Plus size={15} /> Add line</Button>
        <Field label="Estimate notes">
          <textarea className={inputClass} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Scope notes or customer-facing terms" />
        </Field>
        <div className="invoice-total"><span>Estimated total</span><strong>{formatCurrency(total)}</strong></div>
        <p className="muted">This total is a preview. The server stores the authoritative decimal line totals.</p>
        <div className="form-actions">
          <Button variant="secondary" type="button" onClick={onClose}>Back to request</Button>
          <Button type="submit" loading={loading || saving}>Save draft</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConvertDialog({
  isOpen,
  request,
  technicians,
  templates,
  loading,
  error,
  templateError,
  onRetryTemplates,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  request: ServiceRequest;
  technicians: Technician[];
  templates: InspectionTemplate[];
  loading: boolean;
  error: string;
  templateError: string;
  onRetryTemplates: () => void;
  onClose: () => void;
  onSubmit: (values: { scheduledAt: string; technicianId: string; durationMinutes: number; inspectionTemplateId: string }) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("120");
  const [templateId, setTemplateId] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setScheduledAt(manilaInput(new Date(Date.now() + 60 * 60 * 1000)));
    setTechnicianId("");
    setDurationMinutes("120");
    setTemplateId("");
    setLocalError("");
  }, [isOpen, request.id]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");
    const duration = Number(durationMinutes);
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) { setLocalError("Choose a valid appointment date and time."); return; }
    if (!Number.isInteger(duration) || duration < 30 || duration > 480) { setLocalError("Visit duration must be between 30 and 480 minutes."); return; }
    onSubmit({ scheduledAt, technicianId, durationMinutes: duration, inspectionTemplateId: templateId });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule service job" subtitle={`${shortRequestNumber(request.id)} · ${request.customer?.name ?? "Client"}`} maxWidth="md">
      <form className="form-stack panel-body" onSubmit={submit}>
        {(error || templateError || localError) && <p className="notice notice-error" role="alert">{error || templateError || localError}</p>}
        <div className="notice">
          <strong>{request.serviceType}</strong> at {request.serviceAddress}
          {request.preferredWindowStart && request.preferredWindowEnd && <div>Preferred: {formatDate(request.preferredWindowStart, true)} to {formatDate(request.preferredWindowEnd, true)}</div>}
        </div>
        <Field label="Appointment date and time">
          <input type="datetime-local" className={inputClass} required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
        </Field>
        <div className="form-grid">
          <Field label="Technician" hint="Optional. Only active technicians in this branch are shown.">
            <select className={inputClass} value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
              <option value="">Assign later</option>
              {technicians.map((technician) => <option value={technician.id} key={technician.id}>{technician.name}</option>)}
            </select>
          </Field>
          <Field label="Visit duration">
            <select className={inputClass} value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)}>
              <option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option><option value="480">8 hours</option>
            </select>
          </Field>
        </div>
        <Field label="Inspection template" hint="Optional. The selected template is copied into this job when scheduled.">
          <select className={inputClass} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">No template</option>
            {templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}
          </select>
        </Field>
        {templates.length === 0 && !templateError && <p className="muted">No active template is available for {request.serviceType}.</p>}
        <div className="form-actions">
          <Button variant="secondary" type="button" onClick={onClose}>Back to request</Button>
          {templateError && <Button variant="secondary" type="button" onClick={onRetryTemplates}>Retry templates</Button>}
          <Button type="submit" loading={loading}><CalendarClock size={15} /> Create work order</Button>
        </div>
      </form>
    </Modal>
  );
}

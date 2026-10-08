import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/api";
import {
  getAll,
  invalidateOperations,
  manilaInput,
  scheduleIso,
} from "../api/operational";
import {
  Booking,
  Branch,
  Customer,
  InspectionTemplate,
  ServiceSite,
  SERVICE_TYPES,
  Technician,
  Unit,
} from "../types";
import { useAuth } from "../auth/AuthContext";
import { Button, ErrorState, Field, inputClass } from "./ui";
import Modal from "./Modal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  booking?: Booking | null;
  initialSchedule?: string;
  initialCustomerId?: string;
}

export default function BookingModal({
  isOpen,
  onClose,
  booking,
  initialSchedule,
  initialCustomerId,
}: Props) {
  const client = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [customerId, setCustomerId] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [serviceSiteId, setServiceSiteId] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [inspectionTemplateId, setInspectionTemplateId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDuration] = useState("120");
  const [priority, setPriority] = useState("NORMAL");
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [optionalDetailsOpen, setOptionalDetailsOpen] = useState(false);
  const [error, setError] = useState("");
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => getAll<Customer>("/customers"),
    enabled: isOpen,
  });
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => getAll<Branch>("/branches"),
    enabled: isOpen,
  });
  const technicians = useQuery({
    queryKey: ["technicians"],
    queryFn: () => getAll<Technician>("/technicians"),
    enabled: isOpen,
  });
  const units = useQuery({
    queryKey: ["units"],
    queryFn: () => getAll<Unit>("/units"),
    enabled: isOpen,
  });
  const sites = useQuery({
    queryKey: ["service-sites", customerId],
    queryFn: () => getAll<ServiceSite>("/service-sites", { customerId }),
    enabled: isOpen && mode === "existing" && Boolean(customerId),
  });
  const templates = useQuery({
    queryKey: ["inspection-templates"],
    queryFn: () => getAll<InspectionTemplate>("/inspection-templates"),
    enabled: isOpen && !booking,
  });
  useEffect(() => {
    if (!isOpen) return;
    setCustomerId(booking?.customerId ?? initialCustomerId ?? "");
    setMode("existing");
    setName("");
    setPhone("");
    setAddress("");
    setServiceSiteId(booking?.serviceSiteId ?? "");
    setServiceAddress(booking?.serviceAddress ?? "");
    setAccessNotes(booking?.accessNotes ?? "");
    setInspectionTemplateId("");
    setUnitId(booking?.unitId ?? "");
    setTechnicianId(booking?.technicianId ?? "");
    setServiceType(booking?.serviceType ?? SERVICE_TYPES[0]);
    setScheduledAt(
      booking
        ? manilaInput(booking.scheduledAt)
        : (initialSchedule ?? manilaInput(new Date(Date.now() + 3600000))),
    );
    setDuration(String(booking?.durationMinutes ?? 120));
    setPriority(booking?.priority ?? "NORMAL");
    setNotes(booking?.notes ?? "");
    setOptionalDetailsOpen(Boolean(booking?.accessNotes || booking?.notes));
    setDirty(false);
    setError("");
    setBranchId(booking?.branchId ?? (!isAdmin ? (user?.branchId ?? "") : ""));
  }, [
    isOpen,
    booking,
    initialSchedule,
    initialCustomerId,
    isAdmin,
    user?.branchId,
  ]);
  useEffect(() => {
    if (isOpen && !branchId && branches.data?.length === 1)
      setBranchId(branches.data[0].id);
  }, [isOpen, branchId, branches.data]);
  const availableTechs = (technicians.data ?? []).filter(
    (t) => t.branchId === branchId && t.isActive,
  );
  const assignedTechnician = booking?.technician ?? null;
  const assignedTechnicianMissingFromChoices = Boolean(
    assignedTechnician &&
      assignedTechnician.id === technicianId &&
      !availableTechs.some((technician) => technician.id === technicianId),
  );
  const assignedTechnicianBranch = assignedTechnician
    ? branches.data?.find((branch) => branch.id === assignedTechnician.branchId)
    : undefined;
  const selectedBranch = branches.data?.find((branch) => branch.id === branchId);
  const crossBranchTechnician = Boolean(
    assignedTechnician &&
      assignedTechnician.id === technicianId &&
      assignedTechnician.branchId !== branchId,
  );
  const technicianHint = crossBranchTechnician
    ? `${assignedTechnician?.name} belongs to ${assignedTechnicianBranch?.name ?? "another branch"}, not ${selectedBranch?.name ?? "this branch"}. Choose “Assign later” or a technician from ${selectedBranch?.name ?? "this branch"} before saving.`
    : "Overlapping visits are checked before saving.";
  const customerUnits = (units.data ?? []).filter(
    (u) => u.customerId === customerId,
  );
  const customerSites = sites.data ?? [];
  const selectedUnit = customerUnits.find((unit) => unit.id === unitId);
  const linkedSiteId = selectedUnit?.serviceSiteId ?? "";
  const serviceTemplates = (templates.data ?? []).filter(
    (template) => template.serviceType === serviceType,
  );
  const requestClose = () => {
    if (dirty && !window.confirm("Discard your unsaved booking changes?"))
      return;
    setDirty(false);
    onClose();
  };
  const mutation = useMutation({
    mutationFn: async () => {
      let resolved = customerId;
      if (!booking && mode === "new") {
        const { data } = await api.post<Customer>("/customers", {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || undefined,
        });
        resolved = data.id;
        setCustomerId(data.id);
        setMode("existing");
        void client.invalidateQueries({ queryKey: ["customers"] });
      }
      if (!resolved || !branchId)
        throw new Error("Select a client and branch.");
      const body = {
        scheduledAt: scheduleIso(scheduledAt),
        durationMinutes: Number(durationMinutes),
        priority,
        technicianId: technicianId || null,
        unitId: unitId || null,
        notes: notes.trim(),
        serviceType,
      };
      const location = {
        serviceSiteId: serviceSiteId || null,
        serviceAddress: serviceAddress.trim() || null,
        accessNotes: accessNotes.trim() || null,
      };
      if (booking)
        return api.patch("/bookings/" + booking.id, { ...body, ...location });
      return api.post("/bookings", {
        ...body,
        ...location,
        customerId: resolved,
        branchId,
        inspectionTemplateId: inspectionTemplateId || null,
      });
    },
    onSuccess: () => {
      invalidateOperations(client);
      setDirty(false);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });
  const blockingLoadError =
    (mode === "existing" && customers.isError && !customers.data
      ? customers.error
      : null) ??
    (isAdmin && !booking && !branchId && branches.isError
      ? branches.error
      : null);
  const optionalLoadError =
    technicians.isError ||
    units.isError ||
    (mode === "existing" && Boolean(customerId) && sites.isError) ||
    (!booking && templates.isError) ||
    (mode === "existing" && customers.isError && !blockingLoadError) ||
    (isAdmin && !booking && branches.isError && Boolean(branchId));
  const retryLoadErrors = () => {
    if (mode === "existing" && customers.isError) void customers.refetch();
    if (isAdmin && !booking && branches.isError) void branches.refetch();
    if (technicians.isError) void technicians.refetch();
    if (units.isError) void units.refetch();
    if (mode === "existing" && customerId && sites.isError)
      void sites.refetch();
    if (!booking && templates.isError) void templates.refetch();
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title={booking ? "Edit booking" : "New booking"}
      subtitle="Plan the visit, equipment and technician in one place."
      footer={
        <div className="booking-modal-actions">
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="booking-modal-form"
            loading={mutation.isPending}
            disabled={Boolean(blockingLoadError || crossBranchTechnician)}
          >
            Save booking
          </Button>
        </div>
      }
    >
      <form
        id="booking-modal-form"
        className="form-stack panel-body"
        onChange={() => setDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          mutation.mutate();
        }}
      >
        {blockingLoadError && (
          <ErrorState
            error={blockingLoadError}
            onRetry={retryLoadErrors}
          />
        )}
        {!blockingLoadError && optionalLoadError && (
          <div className="notice notice-warning form-load-warning" role="status">
            <p>
              Some saved choices could not load. You can still save with a visit
              address, leave the unit or checklist unselected, and assign a
              technician later.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="btn-small"
              onClick={retryLoadErrors}
            >
              Retry choices
            </Button>
          </div>
        )}
        <section
          className="booking-section"
          aria-labelledby="booking-client-heading"
        >
          <h3 id="booking-client-heading" className="booking-section-heading">
            Client and service site
          </h3>
        {!booking && (
          <div className="tab-bar" role="group" aria-label="Client type">
            <button
              type="button"
              className={mode === "existing" ? "active" : ""}
              aria-pressed={mode === "existing"}
              onClick={() => setMode("existing")}
            >
              Existing client
            </button>
            <button
              type="button"
              className={mode === "new" ? "active" : ""}
              aria-pressed={mode === "new"}
              onClick={() => {
                setMode("new");
                setUnitId("");
              }}
            >
              New client
            </button>
          </div>
        )}
        {mode === "new" ? (
          <div className="form-grid">
            <Field label="Client name" htmlFor="booking-client-name">
              <input
                id="booking-client-name"
                required
                minLength={2}
                maxLength={100}
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="booking-client-phone">
              <input
                id="booking-client-phone"
                type="tel"
                required
                minLength={7}
                maxLength={20}
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label="Client address" htmlFor="booking-client-address">
              <input
                id="booking-client-address"
                maxLength={300}
                className={inputClass}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <Field label="Client" htmlFor="booking-customer">
            <select
              id="booking-customer"
              required
              disabled={Boolean(booking)}
              className={inputClass}
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setUnitId("");
                setServiceSiteId("");
                setServiceAddress("");
                setAccessNotes("");
              }}
            >
              <option value="">Select a client</option>
              {customers.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="form-grid">
          {mode === "existing" && customerId && (
            <Field
              label="Service site"
              htmlFor="booking-service-site"
              hint={
                sites.isError
                  ? "Saved sites could not load. Enter the visit address below."
                  : linkedSiteId
                  ? "This equipment is linked to the selected service site."
                  : "Optional. Sites are limited to the selected client."
              }
            >
              <select
                id="booking-service-site"
                className={inputClass}
                value={serviceSiteId}
                disabled={sites.isLoading || Boolean(linkedSiteId)}
                onChange={(event) => {
                  const nextSiteId = event.target.value;
                  const site = customerSites.find(
                    (candidate) => candidate.id === nextSiteId,
                  );
                  setServiceSiteId(nextSiteId);
                  setServiceAddress(site?.address ?? "");
                  setAccessNotes(site?.accessNotes ?? "");
                  if (site?.accessNotes) setOptionalDetailsOpen(true);
                }}
              >
                <option value="">Use a visit address</option>
                {serviceSiteId &&
                  !customerSites.some((site) => site.id === serviceSiteId) && (
                    <option value={serviceSiteId}>
                      {selectedUnit?.serviceSite?.name ??
                        booking?.serviceSite?.name ??
                        "Saved service site"}
                    </option>
                  )}
                {customerSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} · {site.address}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label="Equipment"
            htmlFor="booking-unit"
            hint="Optional. Register units from Aircon units."
          >
            <select
              id="booking-unit"
              className={inputClass}
              value={unitId}
              disabled={mode === "new" || !customerId}
              onChange={(event) => {
                const nextUnitId = event.target.value;
                const nextUnit = customerUnits.find(
                  (unit) => unit.id === nextUnitId,
                );
                const nextSite =
                  nextUnit?.serviceSite ??
                  customerSites.find(
                    (site) => site.id === nextUnit?.serviceSiteId,
                  );
                setUnitId(nextUnitId);
                setServiceSiteId(nextUnit?.serviceSiteId ?? "");
                if (nextSite) {
                  setServiceAddress(nextSite.address);
                  setAccessNotes(nextSite.accessNotes ?? "");
                  if (nextSite.accessNotes) setOptionalDetailsOpen(true);
                } else if (serviceSiteId) {
                  setServiceAddress("");
                  setAccessNotes("");
                }
              }}
            >
              <option value="">No unit selected</option>
              {customerUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.brand}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Service address"
          htmlFor="booking-service-address"
          hint={
            serviceSiteId
              ? "Using the saved service site address."
              : "Enter where the technician will perform the visit."
          }
        >
          <input
            id="booking-service-address"
            maxLength={500}
            className={inputClass}
            value={serviceAddress}
            readOnly={Boolean(serviceSiteId)}
            onChange={(event) => setServiceAddress(event.target.value)}
          />
        </Field>
        </section>
        <section
          className="booking-section"
          aria-labelledby="booking-schedule-heading"
        >
          <h3 id="booking-schedule-heading" className="booking-section-heading">
            Schedule and dispatch
          </h3>
          <div className="form-grid">
          <Field label="Service type" htmlFor="booking-service">
            <select
              id="booking-service"
              className={inputClass}
              value={serviceType}
              onChange={(event) => {
                setServiceType(event.target.value);
                setInspectionTemplateId("");
              }}
            >
              {SERVICE_TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Schedule (Manila)" htmlFor="booking-time">
            <input
              id="booking-time"
              type="datetime-local"
              required
              className={inputClass}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </Field>
          <Field label="Duration" htmlFor="booking-duration">
            <select
              id="booking-duration"
              className={inputClass}
              value={durationMinutes}
              onChange={(e) => setDuration(e.target.value)}
            >
              {[30, 60, 90, 120, 180, 240, 360, 480].map((d) => (
                <option key={d} value={d}>
                  {d < 60
                    ? d + " minutes"
                    : d === 60
                      ? "1 hour"
                      : d / 60 + " hours"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch" htmlFor="booking-branch">
            <select
              id="booking-branch"
              required
              disabled={!isAdmin || Boolean(booking)}
              className={inputClass}
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setTechnicianId("");
              }}
            >
              <option value="">Select a branch</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Technician"
            htmlFor="booking-technician"
            hint={technicianHint}
          >
            <select
              id="booking-technician"
              disabled={!branchId}
              className={inputClass}
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
            >
              <option value="">Assign later</option>
              {assignedTechnicianMissingFromChoices && assignedTechnician && (
                <option value={assignedTechnician.id} disabled>
                  {assignedTechnician.name} ·{" "}
                  {crossBranchTechnician
                    ? `outside ${assignedTechnicianBranch?.name ?? "this branch"}`
                    : !assignedTechnician.isActive
                      ? "inactive"
                      : "unavailable"}
                </option>
              )}
              {availableTechs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="booking-priority">
            <select
              id="booking-priority"
              className={inputClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </Field>
          </div>
        </section>
        <details
          className="booking-optional"
          open={optionalDetailsOpen}
          onToggle={(event) => setOptionalDetailsOpen(event.currentTarget.open)}
        >
          <summary>
            <strong>Optional service details</strong>
            <small>Access notes, inspection checklist and visit notes</small>
          </summary>
          <div className="form-stack booking-optional-fields">
            <Field
              label="Access notes"
              htmlFor="booking-access-notes"
              hint="Gate, parking or entry instructions for the technician."
            >
              <textarea
                id="booking-access-notes"
                rows={2}
                maxLength={1000}
                className={inputClass}
                value={accessNotes}
                onChange={(event) => setAccessNotes(event.target.value)}
              />
            </Field>
            {!booking && (
              <Field
                label="Inspection checklist"
                htmlFor="booking-template"
                hint="Optional. Choose a template explicitly; none is selected automatically."
              >
                <select
                  id="booking-template"
                  className={inputClass}
                  value={inspectionTemplateId}
                  onChange={(event) =>
                    setInspectionTemplateId(event.target.value)
                  }
                >
                  <option value="">No checklist template</option>
                  {serviceTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Visit notes" htmlFor="booking-notes">
              <textarea
                id="booking-notes"
                rows={3}
                maxLength={2000}
                className={inputClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Symptoms or client requests"
              />
            </Field>
          </div>
        </details>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

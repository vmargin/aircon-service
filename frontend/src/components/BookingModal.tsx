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
  const [branchId, setBranchId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDuration] = useState("120");
  const [priority, setPriority] = useState("NORMAL");
  const [notes, setNotes] = useState("");
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
  useEffect(() => {
    if (!isOpen) return;
    setCustomerId(booking?.customerId ?? initialCustomerId ?? "");
    setMode("existing");
    setName("");
    setPhone("");
    setAddress("");
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
  const customerUnits = (units.data ?? []).filter(
    (u) => u.customerId === customerId,
  );
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
      if (booking) return api.patch("/bookings/" + booking.id, body);
      return api.post("/bookings", { ...body, customerId: resolved, branchId });
    },
    onSuccess: () => {
      invalidateOperations(client);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });
  const loadError =
    customers.error || branches.error || technicians.error || units.error;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={booking ? "Edit booking" : "New booking"}
      subtitle="Plan the visit, equipment and technician in one place."
    >
      <form
        className="form-stack panel-body"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          mutation.mutate();
        }}
      >
        {loadError && (
          <ErrorState
            error={loadError}
            onRetry={() => {
              void customers.refetch();
              void branches.refetch();
              void technicians.refetch();
              void units.refetch();
            }}
          />
        )}
        {!booking && (
          <div className="tab-bar">
            <button
              type="button"
              className={mode === "existing" ? "active" : ""}
              onClick={() => setMode("existing")}
            >
              Existing client
            </button>
            <button
              type="button"
              className={mode === "new" ? "active" : ""}
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
            <Field label="Service address" htmlFor="booking-client-address">
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
          <Field
            label="Equipment"
            htmlFor="booking-unit"
            hint="Optional. Register units from the Equipment page."
          >
            <select
              id="booking-unit"
              className={inputClass}
              value={unitId}
              disabled={mode === "new" || !customerId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">No unit selected</option>
              {customerUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.brand}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Service type" htmlFor="booking-service">
            <select
              id="booking-service"
              className={inputClass}
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
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
                  {d < 60 ? d + " minutes" : d / 60 + " hours"}
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
            hint="Overlapping visits are checked before saving."
          >
            <select
              id="booking-technician"
              disabled={!branchId}
              className={inputClass}
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
            >
              <option value="">Assign later</option>
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
        <Field label="Visit notes" htmlFor="booking-notes">
          <textarea
            id="booking-notes"
            rows={3}
            maxLength={2000}
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Symptoms, access instructions or client requests"
          />
        </Field>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            disabled={Boolean(loadError)}
          >
            Save booking
          </Button>
        </div>
      </form>
    </Modal>
  );
}

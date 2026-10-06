import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import api, { formatCurrency } from "../api/api";
import { clearIdempotencyKey, getIdempotencyKey } from "../api/idempotency";
import { getAll, invalidateOperations, manilaDate } from "../api/operational";
import { useAuth } from "../auth/AuthContext";
import { Branch, InventoryItem } from "../types";
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

interface StockItem extends InventoryItem {
  movements?: {
    id: string;
    quantity: number;
    reason: string;
    createdAt: string;
  }[];
}
interface RestockRequest {
  itemId: string;
  quantity: number;
  note?: string;
  idempotencyKey: string;
  scope: string;
  keyPayload: { inventoryItemId: string; quantity: number; note: string | null };
}
interface AdjustmentRequest {
  itemId: string;
  delta: number;
  reason: string;
  idempotencyKey: string;
  scope: string;
  keyPayload: { inventoryItemId: string; delta: number; reason: string };
}
const emptyForm = {
  branchId: "",
  name: "",
  sku: "",
  unit: "pcs",
  quantityOnHand: "0",
  reorderLevel: "5",
  unitCost: "0",
};
export default function Inventory() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [branch, setBranch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [restocking, setRestocking] = useState<StockItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  const [adjustment, setAdjustment] = useState("1");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [error, setError] = useState("");
  const [movementItem, setMovementItem] = useState<StockItem | null>(null);
  const items = useQuery({
    queryKey: ["inventory"],
    queryFn: () => getAll<StockItem>("/inventory"),
  });
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => getAll<Branch>("/branches"),
  });
  const save = useMutation({
    mutationFn: () =>
      api.post("/inventory", {
        ...form,
        quantityOnHand: Number(form.quantityOnHand),
        reorderLevel: Number(form.reorderLevel),
        unitCost: form.unitCost,
      }),
    onSuccess: () => {
      setIsOpen(false);
      setError("");
      invalidateOperations(client);
    },
    onError: (err: Error) => setError(err.message),
  });
  const restock = useMutation({
    mutationFn: ({ itemId, quantity, note, idempotencyKey }: RestockRequest) =>
      api.patch("/inventory/" + itemId + "/restock", {
        quantity,
        note,
        idempotencyKey,
      }),
    onSuccess: (_result, request) => {
      clearIdempotencyKey(
        request.scope,
        request.keyPayload,
        request.idempotencyKey,
      );
      setRestocking(null);
      setError("");
      invalidateOperations(client);
    },
    onError: (err: Error) => setError(err.message),
  });
  const adjust = useMutation({
    mutationFn: ({ itemId, delta, reason, idempotencyKey }: AdjustmentRequest) =>
      api.post("/inventory/" + itemId + "/adjustments", {
        delta,
        reason,
        idempotencyKey,
      }),
    onSuccess: (_result, request) => {
      clearIdempotencyKey(
        request.scope,
        request.keyPayload,
        request.idempotencyKey,
      );
      setAdjusting(null);
      setError("");
      invalidateOperations(client);
    },
    onError: (err: Error) => setError(err.message),
  });
  const open = () => {
    setForm({
      ...emptyForm,
      branchId:
        user?.branchId ??
        (branches.data?.length === 1 ? branches.data[0].id : ""),
    });
    setError("");
    setIsOpen(true);
  };
  const update = (key: keyof typeof emptyForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    save.mutate();
  };
  const submitRestock = () => {
    if (!restocking) return;
    const quantityValue = Number(quantity);
    const noteValue = note.trim();
    const keyPayload = {
      inventoryItemId: restocking.id,
      quantity: quantityValue,
      note: noteValue || null,
    };
    const scope = `restock:${user?.orgId ?? "unknown"}:${user?.email ?? "unknown"}`;
    restock.mutate({
      itemId: restocking.id,
      quantity: quantityValue,
      note: noteValue || undefined,
      idempotencyKey: getIdempotencyKey(scope, keyPayload),
      scope,
      keyPayload,
    });
  };
  const submitAdjustment = () => {
    if (!adjusting) return;
    const delta = Number(adjustment);
    const reason = adjustmentReason.trim();
    const keyPayload = { inventoryItemId: adjusting.id, delta, reason };
    const scope = `adjustment:${user?.orgId ?? "unknown"}:${user?.email ?? "unknown"}`;
    adjust.mutate({
      itemId: adjusting.id,
      delta,
      reason,
      idempotencyKey: getIdempotencyKey(scope, keyPayload),
      scope,
      keyPayload,
    });
  };
  const all = items.data ?? [];
  const scoped = all.filter((item) => !branch || item.branchId === branch);
  const low = scoped.filter(
    (item) => item.quantityOnHand <= item.reorderLevel,
  ).length;
  const rows = scoped.filter(
    (item) =>
      (!lowOnly || item.quantityOnHand <= item.reorderLevel) &&
      [item.name, item.sku].some((value) =>
        value.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  if (items.isLoading) return <Spinner label="Loading parts inventory…" />;
  if (items.isError)
    return <ErrorState error={items.error} onRetry={() => items.refetch()} />;
  return (
    <div className="page-stack">
      <PageHeader
        title="The right part, ready"
        subtitle="Branch stock, reorder alerts, and a record of every movement."
        action={
          <Button onClick={open}>
            <Plus size={16} /> Add inventory item
          </Button>
        }
      />
      {low > 0 && (
        <div className="notice notice-warning inventory-alert" role="status">
          <AlertTriangle size={18} />
          <span>
            <strong>
              {low} {low === 1 ? "item needs" : "items need"} replenishment.
            </strong>{" "}
            Stock is at or below its reorder level.
          </span>
          <Button variant="secondary" onClick={() => setLowOnly(true)}>
            View low stock
          </Button>
        </div>
      )}
      <Card>
        <div className="page-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              className={inputClass}
              placeholder="Search parts or SKU…"
              aria-label="Search inventory"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="tab-bar">
            <button
              className={!lowOnly ? "active" : ""}
              onClick={() => setLowOnly(false)}
            >
              All stock · {scoped.length}
            </button>
            <button
              className={lowOnly ? "active" : ""}
              onClick={() => setLowOnly(true)}
            >
              Low stock · {low}
            </button>
          </div>
          {user?.role === "ADMIN" && (
            <select
              aria-label="Filter inventory by branch"
              className={inputClass}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">All branches</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {!rows.length ? (
          <EmptyState
            title={
              lowOnly
                ? "Stock levels are healthy"
                : search
                  ? "No matching parts"
                  : "Build your parts catalog"
            }
            message={
              lowOnly
                ? "No matching items are at or below their reorder level."
                : search
                  ? "Try another part name or SKU."
                  : "Add stock to record parts used on work orders."
            }
            action={
              !search && !lowOnly ? (
                <Button onClick={open}>Add inventory item</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Part / SKU</th>
                  <th>Branch</th>
                  <th>On hand</th>
                  <th>Reorder at</th>
                  <th>Unit cost</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.sku}</small>
                    </td>
                    <td>{item.branch?.name ?? "Branch"}</td>
                    <td>
                      <strong>{item.quantityOnHand}</strong> {item.unit}
                    </td>
                    <td>
                      {item.reorderLevel} {item.unit}
                    </td>
                    <td className="money">{formatCurrency(item.unitCost)}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (item.quantityOnHand <= item.reorderLevel
                            ? "payment-partial"
                            : "payment-paid")
                        }
                      >
                        <i />
                        {item.quantityOnHand === 0
                          ? "Out of stock"
                          : item.quantityOnHand <= item.reorderLevel
                            ? "Low stock"
                            : "In stock"}
                      </span>
                    </td>
                    <td>
                      <div className="workorder-actions">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setRestocking(item);
                            setQuantity("1");
                            setNote("");
                            setError("");
                          }}
                        >
                          <PackagePlus size={14} /> Restock
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setAdjusting(item);
                            setAdjustment("1");
                            setAdjustmentReason("");
                            setError("");
                          }}
                        >
                          <SlidersHorizontal size={14} /> Adjust
                        </Button>
                        <button
                          className="icon-button"
                          aria-label={"View stock movements for " + item.name}
                          onClick={() => setMovementItem(item)}
                        >
                          <Boxes size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal
        isOpen={isOpen}
        onClose={() => !save.isPending && setIsOpen(false)}
        title="Add an inventory item"
        subtitle="Opening stock and replenishments are recorded in the stock ledger."
      >
        <form className="form-stack" onSubmit={submit}>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          {branches.isError && (
            <p className="notice notice-error" role="alert">
              {branches.error.message}
            </p>
          )}
          <div className="form-grid">
            <Field label="Branch">
              <select
                className={inputClass}
                value={form.branchId}
                onChange={(e) => update("branchId", e.target.value)}
                required
                disabled={user?.role !== "ADMIN" || branches.isLoading}
              >
                <option value="">Choose branch</option>
                {branches.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Part name">
              <input
                className={inputClass}
                required
                minLength={2}
                maxLength={120}
                placeholder="Capacitor 35 µF"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="SKU">
              <input
                className={inputClass}
                required
                minLength={2}
                maxLength={80}
                placeholder="CAP-035"
                value={form.sku}
                onChange={(e) => update("sku", e.target.value)}
              />
            </Field>
            <Field label="Stock unit">
              <input
                className={inputClass}
                required
                maxLength={40}
                placeholder="pcs, bottles, metres"
                value={form.unit}
                onChange={(e) => update("unit", e.target.value)}
              />
            </Field>
            <Field label="Opening quantity">
              <input
                className={inputClass}
                type="number"
                required
                min={0}
                max={1000000}
                step={1}
                value={form.quantityOnHand}
                onChange={(e) => update("quantityOnHand", e.target.value)}
              />
            </Field>
            <Field label="Reorder level">
              <input
                className={inputClass}
                type="number"
                required
                min={0}
                max={100000}
                step={1}
                value={form.reorderLevel}
                onChange={(e) => update("reorderLevel", e.target.value)}
              />
            </Field>
            <Field label="Unit cost (PHP)">
              <input
                className={inputClass}
                type="number"
                required
                min={0}
                max={99999999}
                step="0.01"
                value={form.unitCost}
                onChange={(e) => update("unitCost", e.target.value)}
              />
            </Field>
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={save.isPending}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={!form.branchId}
            >
              Add item
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(restocking)}
        onClose={() => !restock.isPending && setRestocking(null)}
        title="Replenish stock"
        subtitle={
          restocking
            ? restocking.name + " · " + (restocking.branch?.name ?? "Branch")
            : ""
        }
        maxWidth="sm"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            submitRestock();
          }}
        >
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <p className="muted">
            Currently {restocking?.quantityOnHand} {restocking?.unit} on hand.
          </p>
          <Field
            label={"Quantity to add (" + (restocking?.unit ?? "pcs") + ")"}
          >
            <input
              className={inputClass}
              type="number"
              min={1}
              max={1000000}
              step={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <Field
            label="Restock note"
            hint="Supplier, delivery, or purchase reference."
          >
            <input
              className={inputClass}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={restock.isPending}
              onClick={() => setRestocking(null)}
            >
              Cancel
            </Button>
            <Button loading={restock.isPending} type="submit">
              Add stock
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(adjusting)}
        onClose={() => !adjust.isPending && setAdjusting(null)}
        title="Adjust stock count"
        subtitle={
          adjusting
            ? adjusting.name + " · " + (adjusting.branch?.name ?? "Branch")
            : ""
        }
        maxWidth="sm"
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            submitAdjustment();
          }}
        >
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <p className="muted">
            Currently {adjusting?.quantityOnHand} {adjusting?.unit} on hand.
            Use a positive number to add stock or a negative number to remove it.
          </p>
          <Field
            label={`Signed quantity (${adjusting?.unit ?? "pcs"})`}
            hint="Use a negative quantity for damaged, missing, or corrected stock."
          >
            <input
              className={inputClass}
              type="number"
              min={-1_000_000}
              max={1_000_000}
              step={1}
              required
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
            />
          </Field>
          <Field label="Reason">
            <input
              className={inputClass}
              required
              minLength={1}
              maxLength={300}
              placeholder="Cycle count correction"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
            />
          </Field>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={adjust.isPending}
              onClick={() => setAdjusting(null)}
            >
              Cancel
            </Button>
            <Button
              loading={adjust.isPending}
              type="submit"
              disabled={!adjustmentReason.trim() || Number(adjustment) === 0}
            >
              Save adjustment
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(movementItem)}
        onClose={() => setMovementItem(null)}
        title="Recent stock movements"
        subtitle={movementItem?.name}
        maxWidth="sm"
      >
        <div className="modal-body">
          {!movementItem?.movements?.length ? (
            <EmptyState
              title="No recorded movements yet"
              message="Opening stock, restocks, adjustments, and work order use will appear here."
            />
          ) : (
            <div className="history-list">
              {movementItem.movements.map((movement) => (
                <div className="history-entry" key={movement.id}>
                  <strong
                    className={
                      movement.quantity > 0 ? "text-green" : "text-amber"
                    }
                  >
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity} {movementItem.unit}
                  </strong>{" "}
                  · {movement.reason}
                  <small>{manilaDate(movement.createdAt, true)}</small>
                </div>
              ))}
              <p className="muted">
                Showing the 10 most recent stock movements.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

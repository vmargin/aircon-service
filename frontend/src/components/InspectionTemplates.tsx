import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ClipboardCheck, Pencil, Plus } from "lucide-react";
import api from "../api/api";
import { getAll } from "../api/operational";
import { useAuth } from "../auth/AuthContext";
import { InspectionTemplate, SERVICE_TYPES } from "../types";
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

type DraftItem = {
  label: string;
  type: "CHECK" | "MEASUREMENT";
  unitLabel: string;
};

const blankItem = (): DraftItem => ({
  label: "",
  type: "CHECK",
  unitLabel: "",
});

function invalidateTemplates(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ["inspection-templates"] });
  void client.invalidateQueries({ queryKey: ["bookings"] });
  void client.invalidateQueries({ queryKey: ["service-requests"] });
}

export default function InspectionTemplates() {
  const client = useQueryClient();
  const { isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<InspectionTemplate | null>(null);
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");

  const templates = useQuery({
    queryKey: ["inspection-templates", isAdmin ? "all" : "active"],
    queryFn: () =>
      getAll<InspectionTemplate>(
        "/inspection-templates",
        isAdmin ? { includeInactive: "true" } : undefined,
      ),
  });

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name ?? "");
    setServiceType(editing?.serviceType ?? SERVICE_TYPES[0]);
    setItems(
      editing?.items.length
        ? editing.items.map((item) => ({
            label: item.label,
            type: item.type,
            unitLabel: item.unitLabel ?? "",
          }))
        : [blankItem()],
    );
    setIsActive(editing?.isActive ?? true);
    setError("");
  }, [isOpen, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();
      const cleanItems = items.map((item) => ({
        label: item.label.trim(),
        type: item.type,
        ...(item.type === "MEASUREMENT"
          ? { unitLabel: item.unitLabel.trim() }
          : {}),
      }));
      if (!cleanName) throw new Error("Enter a template name.");
      if (!cleanItems.length || cleanItems.some((item) => !item.label))
        throw new Error("Give each checklist item a label.");
      if (
        cleanItems.some(
          (item) =>
            item.type === "MEASUREMENT" &&
            (!("unitLabel" in item) || !item.unitLabel),
        )
      )
        throw new Error("Add a unit label to every measurement item.");
      const body = {
        name: cleanName,
        serviceType,
        items: cleanItems,
        isActive,
      };
      if (editing)
        return api.patch("/inspection-templates/" + editing.id, body);
      return api.post("/inspection-templates", body);
    },
    onSuccess: () => {
      invalidateTemplates(client);
      setIsOpen(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: (template: InspectionTemplate) =>
      api.patch("/inspection-templates/" + template.id, {
        isActive: !template.isActive,
      }),
    onSuccess: () => invalidateTemplates(client),
  });

  const openCreate = () => {
    setEditing(null);
    setIsOpen(true);
  };
  const openEdit = (template: InspectionTemplate) => {
    setEditing(template);
    setIsOpen(true);
  };
  const patchItem = (index: number, update: Partial<DraftItem>) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...update } : item,
      ),
    );
  };

  if (templates.isLoading)
    return <Spinner label="Loading inspection templates…" />;
  if (templates.isError)
    return (
      <ErrorState
        error={templates.error}
        onRetry={() => void templates.refetch()}
      />
    );

  const rows = templates.data ?? [];
  return (
    <div className="page-stack">
      <PageHeader
        title="Inspection templates"
        subtitle="Reusable checks and measurements copied into each new job."
        action={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus size={16} /> New template
            </Button>
          ) : undefined
        }
      />
      {!isAdmin && (
        <p className="notice">
          Templates are managed by an organization admin. Active templates are
          available when booking a service visit.
        </p>
      )}
      {toggleActive.isError && (
        <p className="notice notice-error" role="alert">
          {toggleActive.error.message}
        </p>
      )}
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No inspection templates yet"
            message={
              isAdmin
                ? "Create a template to make a consistent checklist available for new bookings."
                : "An organization admin can add reusable inspection checklists."
            }
            action={
              isAdmin ? (
                <Button onClick={openCreate}>
                  <Plus size={16} /> Create template
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="report-grid">
          {rows.map((template) => (
            <Card key={template.id}>
              <div className="panel-header">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2>{template.name}</h2>
                    <span
                      className={
                        "badge " +
                        (template.isActive
                          ? "status-completed"
                          : "status-cancelled")
                      }
                    >
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p>{template.serviceType}</p>
                </div>
                <ClipboardCheck size={19} aria-hidden="true" />
              </div>
              <div className="panel-body">
                <p className="muted">
                  {template.items.length} checklist{" "}
                  {template.items.length === 1 ? "item" : "items"}
                </p>
                <ol className="list-disc space-y-2 pl-5">
                  {template.items.map((item) => (
                    <li key={item.id}>
                      <span>{item.label}</span>
                      <small>
                        {item.type === "MEASUREMENT"
                          ? "Measurement · " + (item.unitLabel || "Unit not set")
                          : "Check"}
                      </small>
                    </li>
                  ))}
                </ol>
                {isAdmin && (
                  <div className="form-actions">
                    <Button
                      variant="secondary"
                      onClick={() => openEdit(template)}
                    >
                      <Pencil size={15} /> Edit
                    </Button>
                    <Button
                      variant="secondary"
                      loading={
                        toggleActive.isPending &&
                        toggleActive.variables?.id === template.id
                      }
                      onClick={() => toggleActive.mutate(template)}
                    >
                      {template.isActive ? (
                        <Archive size={15} />
                      ) : (
                        <ArchiveRestore size={15} />
                      )}
                      {template.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={editing ? "Edit inspection template" : "New inspection template"}
        subtitle="Template changes apply to future jobs. Existing job checklists remain saved as created."
        maxWidth="lg"
      >
        <form
          className="form-stack panel-body"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            save.mutate();
          }}
        >
          <div className="form-grid">
            <Field label="Template name" htmlFor="template-name">
              <input
                id="template-name"
                required
                maxLength={120}
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seasonal maintenance"
              />
            </Field>
            <Field label="Service type" htmlFor="template-service-type">
              <select
                id="template-service-type"
                className={inputClass}
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value)}
              >
                {SERVICE_TYPES.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3>Checklist items</h3>
              <p className="muted">
                Measurement items need a unit, such as °C or psi.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setItems((current) => [...current, blankItem()])}
            >
              <Plus size={15} /> Add item
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div className="form-grid" key={index}>
                <Field
                  label={"Item " + (index + 1)}
                  htmlFor={"template-item-" + index}
                >
                  <input
                    id={"template-item-" + index}
                    required
                    maxLength={250}
                    className={inputClass}
                    value={item.label}
                    onChange={(event) =>
                      patchItem(index, { label: event.target.value })
                    }
                    placeholder="Check drain line and condensate flow"
                  />
                </Field>
                <Field
                  label="Item type"
                  htmlFor={"template-type-" + index}
                >
                  <select
                    id={"template-type-" + index}
                    className={inputClass}
                    value={item.type}
                    onChange={(event) => {
                      const type = event.target.value as DraftItem["type"];
                      patchItem(index, {
                        type,
                        unitLabel: type === "CHECK" ? "" : item.unitLabel,
                      });
                    }}
                  >
                    <option value="CHECK">Check</option>
                    <option value="MEASUREMENT">Measurement</option>
                  </select>
                </Field>
                {item.type === "MEASUREMENT" && (
                  <Field
                    label="Unit"
                    htmlFor={"template-unit-" + index}
                  >
                    <input
                      id={"template-unit-" + index}
                      required
                      maxLength={32}
                      className={inputClass}
                      value={item.unitLabel}
                      onChange={(event) =>
                        patchItem(index, { unitLabel: event.target.value })
                      }
                      placeholder="°C, psi, A"
                    />
                  </Field>
                )}
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    aria-label={"Remove checklist item " + (index + 1)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>Template is active</span>
            </label>
          )}
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? "Save changes" : "Create template"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

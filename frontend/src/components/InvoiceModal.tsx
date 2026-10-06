import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatCurrency } from "../api/api";
import { invalidateOperations, jobNumber } from "../api/operational";
import { Booking } from "../types";
import { Button, Field, inputClass } from "./ui";
import Modal from "./Modal";

export default function InvoiceModal({
  booking,
  onClose,
}: {
  booking: Booking | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const partsTotal =
    booking?.parts?.reduce(
      (sum, part) => sum + part.quantity * Number(part.unitPrice),
      0,
    ) ?? 0;
  const hasEstimateLink = Boolean(booking?.estimateRevisionId);
  const estimate = booking?.estimateRevision;
  const estimateReady =
    estimate?.status === "APPROVED" && estimate.lineItems.length > 0;

  useEffect(() => {
    setAmount("");
    setError("");
  }, [booking?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error("Select a job.");
      if (hasEstimateLink) {
        if (!estimateReady || !estimate)
          throw new Error(
            "The approved estimate lines could not be loaded. Refresh the job before issuing this invoice.",
          );
        await api.post("/invoices", { bookingId: booking.id });
        return;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
        throw new Error(
          "Enter a positive amount with at most two decimal places.",
        );
      await api.post("/invoices", {
        bookingId: booking.id,
        amount: Number(amount),
      });
    },
    onSuccess: () => {
      invalidateOperations(client);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal
      isOpen={Boolean(booking)}
      onClose={onClose}
      title="Create invoice"
      subtitle={
        booking ? jobNumber(booking.id) + " · " + booking.customer?.name : ""
      }
    >
      <form
        className="form-stack panel-body"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate();
        }}
      >
        {hasEstimateLink ? (
          <section aria-labelledby="accepted-estimate-heading">
            <div className="notice">
              <strong id="accepted-estimate-heading">
                Approved estimate · Revision {estimate?.revisionNumber ?? "—"}
              </strong>
              <p>
                The invoice will copy these approved lines and calculate its
                total from the saved amounts.
              </p>
            </div>
            {estimateReady && estimate ? (
              <>
                <div className="table-wrap">
                  <table className="data-table">
                    <caption className="sr-only">
                      Approved estimate lines copied to this invoice
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Description</th>
                        <th scope="col">Qty</th>
                        <th scope="col">Unit price</th>
                        <th scope="col">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.lineItems.map((line) => (
                        <tr key={line.id}>
                          <td>{line.description}</td>
                          <td>{line.quantity}</td>
                          <td>{formatCurrency(line.unitPrice)}</td>
                          <td>{formatCurrency(line.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="invoice-total">
                  <span>Approved total</span>
                  <strong>{formatCurrency(estimate.total)}</strong>
                </div>
              </>
            ) : (
              <p className="notice notice-error" role="alert">
                The saved estimate snapshot is unavailable or is not approved.
                Refresh this job before issuing the invoice.
              </p>
            )}
          </section>
        ) : (
          <>
            <div className="notice">
              <strong>{booking?.serviceType}</strong>
              <p>
                Enter the agreed total for this direct booking. Payments are
                recorded separately as receipts from Billing.
              </p>
            </div>
            {partsTotal > 0 && (
              <p className="muted">
                Recorded parts cost: {formatCurrency(partsTotal)}. Include the
                applicable parts charge in the invoice total.
              </p>
            )}
            <Field
              label="Invoice total (PHP)"
              htmlFor="invoice-amount"
              hint="The total includes service, labor and applicable parts."
            >
              <input
                id="invoice-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                className={inputClass}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </Field>
            {Number(amount) > 0 && (
              <div className="invoice-total">
                <span>Total due</span>
                <strong>{formatCurrency(amount)}</strong>
              </div>
            )}
          </>
        )}
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
            disabled={hasEstimateLink && !estimateReady}
          >
            Issue invoice
          </Button>
        </div>
      </form>
    </Modal>
  );
}

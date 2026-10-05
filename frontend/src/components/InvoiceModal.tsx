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
      (sum, p) => sum + p.quantity * Number(p.unitPrice),
      0,
    ) ?? 0;
  useEffect(() => {
    setAmount("");
    setError("");
  }, [booking?.id]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error("Select a job.");
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
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="notice">
          <strong>{booking?.serviceType}</strong>
          <p>
            Issue the agreed service charge. Payments are recorded separately as
            receipts from Billing.
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
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        {Number(amount) > 0 && (
          <div className="invoice-total">
            <span>Total due</span>
            <strong>{formatCurrency(amount)}</strong>
          </div>
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
          <Button type="submit" loading={mutation.isPending}>
            Issue invoice
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';

import api, { getList } from '../api/api';
import { Branch, Customer, SERVICE_TYPES, Technician } from '../types';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, inputClass } from './ui';
import Modal from './Modal';

/**
 * NEW BOOKING
 *
 * The old version posted `customerName`/`phone` strings and relied on the
 * backend to find-or-create a customer, which could race and produce
 * duplicates. It now always resolves to a real `customerId`: either an
 * existing customer is picked, or one is created here first.
 *
 * `scheduledAt` is converted to a full ISO string because the API validates
 * with `z.string().datetime()`, which rejects the `datetime-local` format.
 */

/** Default the picker to the next whole hour. */
function defaultSchedule(): string {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    // datetime-local wants a local-time string with no timezone suffix.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const BookingModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const { user, isAdmin } = useAuth();

    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [customerId, setCustomerId] = useState('');
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
    const [scheduledAt, setScheduledAt] = useState(defaultSchedule);
    const [branchId, setBranchId] = useState('');
    const [technicianId, setTechnicianId] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const customersQuery = useQuery({
        queryKey: ['customers'],
        queryFn: () => getList<Customer>('/customers', { limit: 200 }),
        enabled: isOpen,
    });

    const branchesQuery = useQuery({
        queryKey: ['branches'],
        queryFn: () => getList<Branch>('/branches'),
        enabled: isOpen,
    });

    const techniciansQuery = useQuery({
        queryKey: ['technicians'],
        queryFn: () => getList<Technician>('/technicians'),
        enabled: isOpen,
    });

    const branches = branchesQuery.data ?? [];
    const customers = customersQuery.data ?? [];

    // Reset the form each time the modal opens.
    useEffect(() => {
        if (!isOpen) return;
        setMode('existing');
        setCustomerId('');
        setNewName('');
        setNewPhone('');
        setNewAddress('');
        setServiceType(SERVICE_TYPES[0]);
        setScheduledAt(defaultSchedule());
        setTechnicianId('');
        setNotes('');
        setError('');
    }, [isOpen]);

    // A branch leader can only ever book for their own branch, so pin it.
    useEffect(() => {
        if (!isOpen) return;
        if (!isAdmin && user?.branchId) {
            setBranchId(user.branchId);
        } else if (branches.length === 1) {
            setBranchId(branches[0].id);
        }
    }, [isOpen, isAdmin, user?.branchId, branches]);

    // Only technicians at the chosen branch are assignable — the API rejects
    // anything else with a 403.
    const assignableTechs = useMemo(
        () => (techniciansQuery.data ?? []).filter((t) => t.branchId === branchId && t.isActive),
        [techniciansQuery.data, branchId]
    );

    // Clear a stale technician if the branch changes under it.
    useEffect(() => {
        if (technicianId && !assignableTechs.some((t) => t.id === technicianId)) {
            setTechnicianId('');
        }
    }, [assignableTechs, technicianId]);

    const mutation = useMutation({
        mutationFn: async () => {
            let resolvedCustomerId = customerId;

            if (mode === 'new') {
                const { data: created } = await api.post<Customer>('/customers', {
                    name: newName.trim(),
                    phone: newPhone.trim(),
                    ...(newAddress.trim() ? { address: newAddress.trim() } : {}),
                });
                resolvedCustomerId = created.id;
            }

            if (!resolvedCustomerId) throw new Error('Select or add a customer first.');
            if (!branchId) throw new Error('Select a branch.');

            await api.post('/bookings', {
                customerId: resolvedCustomerId,
                branchId,
                serviceType,
                // The API validates ISO-8601 with an offset.
                scheduledAt: new Date(scheduledAt).toISOString(),
                ...(technicianId ? { technicianId } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            onClose();
        },
        onError: (err: Error) => setError(err.message),
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New booking">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setError('');
                    mutation.mutate();
                }}
                className="p-5 space-y-4 max-h-[70vh] overflow-y-auto"
            >
                {/* Customer: pick or create */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Customer
                        </span>
                        <button
                            type="button"
                            onClick={() => setMode(mode === 'existing' ? 'new' : 'existing')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            {mode === 'existing' ? 'Add new' : 'Pick existing'}
                        </button>
                    </div>

                    {mode === 'existing' ? (
                        <select
                            required
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">
                                {customersQuery.isLoading ? 'Loading…' : 'Select a customer'}
                            </option>
                            {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} — {c.phone}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="space-y-2">
                            <input
                                required
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Full name"
                                className={inputClass}
                            />
                            <input
                                required
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                placeholder="Phone (e.g. 09171234567)"
                                className={inputClass}
                            />
                            <input
                                value={newAddress}
                                onChange={(e) => setNewAddress(e.target.value)}
                                placeholder="Address (optional)"
                                className={inputClass}
                            />
                        </div>
                    )}
                </div>

                <Field label="Service" htmlFor="serviceType">
                    <select
                        id="serviceType"
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        className={inputClass}
                    >
                        {SERVICE_TYPES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="Schedule" htmlFor="scheduledAt">
                    <input
                        id="scheduledAt"
                        type="datetime-local"
                        required
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className={inputClass}
                    />
                </Field>

                <Field
                    label="Branch"
                    htmlFor="branchId"
                    hint={!isAdmin ? 'Branch leaders can only book for their own branch.' : undefined}
                >
                    <select
                        id="branchId"
                        required
                        disabled={!isAdmin}
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">Select a branch</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field
                    label="Technician"
                    htmlFor="technicianId"
                    hint={
                        branchId && assignableTechs.length === 0
                            ? 'No active technicians at this branch yet.'
                            : 'Optional — you can assign later.'
                    }
                >
                    <select
                        id="technicianId"
                        value={technicianId}
                        onChange={(e) => setTechnicianId(e.target.value)}
                        disabled={!branchId || assignableTechs.length === 0}
                        className={inputClass}
                    >
                        <option value="">Unassigned</option>
                        {assignableTechs.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="Notes" htmlFor="notes">
                    <textarea
                        id="notes"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Unit details, access instructions…"
                        className={inputClass}
                    />
                </Field>

                {error && (
                    <p role="alert" className="text-xs text-rose-600 font-medium">
                        {error}
                    </p>
                )}

                <div className="flex gap-2 pt-1">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button type="submit" loading={mutation.isPending} className="flex-1">
                        Create booking
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default BookingModal;

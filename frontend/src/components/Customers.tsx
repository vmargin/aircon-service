import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil } from 'lucide-react';

import api, { getList } from '../api/api';
import { Customer } from '../types';
import {
    Button,
    Card,
    EmptyState,
    ErrorState,
    Field,
    PageHeader,
    Spinner,
    inputClass,
} from './ui';
import Modal from './Modal';

/**
 * CUSTOMERS
 *
 * The "Add Customer" button on the old page was decorative — it had no click
 * handler and no modal behind it. Create and edit both work here.
 */

const CustomerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
}> = ({ isOpen, onClose, customer }) => {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setName(customer?.name ?? '');
        setPhone(customer?.phone ?? '');
        setAddress(customer?.address ?? '');
        setError('');
    }, [isOpen, customer]);

    const mutation = useMutation({
        mutationFn: () => {
            const body = {
                name: name.trim(),
                phone: phone.trim(),
                address: address.trim(),
            };
            return customer
                ? api.patch(`/customers/${customer.id}`, body)
                : api.post('/customers', body);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            onClose();
        },
        onError: (err: Error) => setError(err.message),
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={customer ? 'Edit customer' : 'Add customer'}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setError('');
                    mutation.mutate();
                }}
                className="p-5 space-y-4"
            >
                <Field label="Full name" htmlFor="name">
                    <input
                        id="name"
                        required
                        minLength={2}
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Juan Dela Cruz"
                        className={inputClass}
                    />
                </Field>

                <Field label="Phone" htmlFor="phone" hint="Must be unique across your organization.">
                    <input
                        id="phone"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09171234567"
                        className={inputClass}
                    />
                </Field>

                <Field label="Address" htmlFor="address">
                    <input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Optional"
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
                        {customer ? 'Save changes' : 'Add customer'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

const Customers: React.FC = () => {
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);

    const query = useQuery({
        queryKey: ['customers'],
        queryFn: () => getList<Customer>('/customers', { limit: 200 }),
    });

    const openCreate = () => {
        setEditing(null);
        setModalOpen(true);
    };

    const openEdit = (c: Customer) => {
        setEditing(c);
        setModalOpen(true);
    };

    if (query.isLoading) return <Spinner label="Loading customers…" />;
    if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

    const customers = query.data ?? [];
    const term = search.trim().toLowerCase();
    const filtered = customers.filter(
        (c) => !term || c.name.toLowerCase().includes(term) || c.phone.includes(term)
    );

    return (
        <div>
            <PageHeader
                title="Customers"
                subtitle={`${customers.length} total`}
                action={
                    <Button onClick={openCreate}>
                        <Plus className="w-4 h-4" /> Add customer
                    </Button>
                }
            />

            <Card className="mb-4 p-3">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or phone…"
                        className={`${inputClass} pl-9`}
                    />
                </div>
            </Card>

            <Card>
                {filtered.length === 0 ? (
                    <EmptyState
                        title="No customers found"
                        message={
                            customers.length === 0
                                ? 'Add your first customer, or create one while booking a job.'
                                : 'Try a different search.'
                        }
                        action={
                            customers.length === 0 ? (
                                <Button onClick={openCreate}>
                                    <Plus className="w-4 h-4" /> Add customer
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Name
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Phone
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Address
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Jobs
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                            {c.name}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {c.phone}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                                            {c.address || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {c._count?.bookings ?? 0}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => openEdit(c)}
                                                title="Edit customer"
                                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <CustomerModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                customer={editing}
            />
        </div>
    );
};

export default Customers;

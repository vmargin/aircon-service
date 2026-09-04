import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserX, UserCheck } from 'lucide-react';

import api, { getList } from '../api/api';
import { Branch, Technician } from '../types';
import { useAuth } from '../auth/AuthContext';
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
 * TECHNICIANS
 *
 * Deactivation is a soft delete: the API flips `isActive` so historical
 * bookings keep their technician. Inactive staff are hidden by default and
 * revealed with the toggle.
 */

const TechnicianModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    technician: Technician | null;
    branches: Branch[];
}> = ({ isOpen, onClose, technician, branches }) => {
    const queryClient = useQueryClient();
    const { user, isAdmin } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [branchId, setBranchId] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setName(technician?.name ?? '');
        setPhone(technician?.phone ?? '');
        // Branch leaders can only create staff in their own branch.
        setBranchId(technician?.branchId ?? (!isAdmin ? (user?.branchId ?? '') : ''));
        setError('');
    }, [isOpen, technician, isAdmin, user?.branchId]);

    const mutation = useMutation({
        mutationFn: () => {
            const body = {
                name: name.trim(),
                ...(phone.trim() ? { phone: phone.trim() } : {}),
                ...(technician ? {} : { branchId }),
            };
            return technician
                ? api.patch(`/technicians/${technician.id}`, body)
                : api.post('/technicians', body);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
            onClose();
        },
        onError: (err: Error) => setError(err.message),
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={technician ? 'Edit technician' : 'Add technician'}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setError('');
                    mutation.mutate();
                }}
                className="p-5 space-y-4"
            >
                <Field label="Full name" htmlFor="techName">
                    <input
                        id="techName"
                        required
                        minLength={2}
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Pedro Santos"
                        className={inputClass}
                    />
                </Field>

                <Field label="Phone" htmlFor="techPhone">
                    <input
                        id="techPhone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Optional"
                        className={inputClass}
                    />
                </Field>

                {/* Branch is fixed after creation — moving staff between
                    branches would orphan their booking history. */}
                {!technician && (
                    <Field
                        label="Branch"
                        htmlFor="techBranch"
                        hint={!isAdmin ? 'Locked to your branch.' : 'Cannot be changed later.'}
                    >
                        <select
                            id="techBranch"
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
                )}

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
                        {technician ? 'Save changes' : 'Add technician'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

const Technicians: React.FC = () => {
    const queryClient = useQueryClient();
    const [showInactive, setShowInactive] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Technician | null>(null);
    const [actionError, setActionError] = useState('');

    const query = useQuery({
        queryKey: ['technicians', { showInactive }],
        queryFn: () =>
            getList<Technician>('/technicians', showInactive ? { includeInactive: 'true' } : {}),
    });

    const branchesQuery = useQuery({
        queryKey: ['branches'],
        queryFn: () => getList<Branch>('/branches'),
    });

    const toggleActive = useMutation({
        mutationFn: (t: Technician) =>
            t.isActive
                ? api.delete(`/technicians/${t.id}`)
                : api.patch(`/technicians/${t.id}`, { isActive: true }),
        onSuccess: () => {
            setActionError('');
            queryClient.invalidateQueries({ queryKey: ['technicians'] });
        },
        onError: (err: Error) => setActionError(err.message),
    });

    if (query.isLoading) return <Spinner label="Loading technicians…" />;
    if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

    const technicians = query.data ?? [];

    return (
        <div>
            <PageHeader
                title="Technicians"
                subtitle={`${technicians.filter((t) => t.isActive).length} active`}
                action={
                    <Button
                        onClick={() => {
                            setEditing(null);
                            setModalOpen(true);
                        }}
                    >
                        <Plus className="w-4 h-4" /> Add technician
                    </Button>
                }
            />

            {actionError && (
                <div className="mb-4">
                    <ErrorState error={new Error(actionError)} />
                </div>
            )}

            <label className="inline-flex items-center gap-2 mb-4 cursor-pointer">
                <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">Show inactive</span>
            </label>

            <Card>
                {technicians.length === 0 ? (
                    <EmptyState
                        title="No technicians yet"
                        message="Add your field staff so you can assign them to jobs."
                        action={
                            <Button
                                onClick={() => {
                                    setEditing(null);
                                    setModalOpen(true);
                                }}
                            >
                                <Plus className="w-4 h-4" /> Add technician
                            </Button>
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
                                        Branch
                                    </th>
                                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Status
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {technicians.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                            {t.name}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {t.phone || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {t.branch?.name ?? '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                                                    t.isActive
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                                }`}
                                            >
                                                {t.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => {
                                                        setEditing(t);
                                                        setModalOpen(true);
                                                    }}
                                                    title="Edit"
                                                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleActive.mutate(t)}
                                                    title={t.isActive ? 'Deactivate' : 'Reactivate'}
                                                    className={`p-2 rounded-lg transition ${
                                                        t.isActive
                                                            ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                    }`}
                                                >
                                                    {t.isActive ? (
                                                        <UserX className="w-4 h-4" />
                                                    ) : (
                                                        <UserCheck className="w-4 h-4" />
                                                    )}
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

            <TechnicianModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                technician={editing}
                branches={branchesQuery.data ?? []}
            />
        </div>
    );
};

export default Technicians;

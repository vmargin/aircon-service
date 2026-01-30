import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Package2,
    Plus,
    TrendingUp,
    AlertTriangle,
    ClipboardList,
} from 'lucide-react';
import api from '../api/api';
import type { InventoryItem, InventoryTransaction } from '../types';

const Inventory = () => {
    const queryClient = useQueryClient();
    const [newItem, setNewItem] = useState({
        name: '',
        sku: '',
        branchId: '',
        quantity: 0,
        unitCost: '',
    });
    const [adjustment, setAdjustment] = useState({
        itemId: '',
        change: 0,
        description: '',
    });

    const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
        queryKey: ['inventory'],
        queryFn: async () => {
            const { data } = await api.get('/inventory');
            return data;
        },
    });

    const { data: transactions = [] } = useQuery<InventoryTransaction[]>({
        queryKey: ['inventory-transactions'],
        queryFn: async () => {
            const { data } = await api.get('/inventory/transactions');
            return data;
        },
    });

    const createItemMutation = useMutation({
        mutationFn: () =>
            api.post('/inventory', {
                name: newItem.name,
                sku: newItem.sku || undefined,
                branchId: newItem.branchId,
                quantity: Number(newItem.quantity) || 0,
                unitCost: newItem.unitCost ? Number(newItem.unitCost) : undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            setNewItem({
                name: '',
                sku: '',
                branchId: '',
                quantity: 0,
                unitCost: '',
            });
        },
    });

    const adjustmentMutation = useMutation({
        mutationFn: () =>
            api.post('/inventory/transactions', {
                itemId: adjustment.itemId,
                change: Number(adjustment.change),
                description: adjustment.description || undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
            setAdjustment({
                itemId: '',
                change: 0,
                description: '',
            });
        },
    });

    const totalSkus = items.length;
    const totalOnHand = items.reduce((acc, item) => acc + item.quantity, 0);
    const totalStockValue = items.reduce(
        (acc, item) => acc + (item.unitCost ? item.unitCost * item.quantity : 0),
        0,
    );

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <Package2 className="w-7 h-7 text-blue-600" />
                        Inventory
                    </h2>
                    <p className="text-slate-500 mt-1">
                        Track aircon parts, consumables, and usage across branches.
                    </p>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <ClipboardList className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Active SKUs</p>
                        <h4 className="text-2xl font-bold text-slate-900 font-mono">
                            {totalSkus}
                        </h4>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total On-hand Units</p>
                        <h4 className="text-2xl font-bold text-slate-900 font-mono">
                            {totalOnHand}
                        </h4>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Stock Value (est.)</p>
                        <h4 className="text-2xl font-bold text-slate-900 font-mono">
                            ₱{totalStockValue.toLocaleString()}
                        </h4>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Items list */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Package2 className="w-5 h-5 text-blue-500" />
                            Inventory Items
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        {isLoading ? (
                            <div className="p-10 text-center text-slate-400 animate-pulse">
                                Loading inventory...
                            </div>
                        ) : items.length === 0 ? (
                            <div className="p-10 text-center text-slate-300 italic">
                                No inventory items yet.
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            Item
                                        </th>
                                        <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            Branch
                                        </th>
                                        <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            On Hand
                                        </th>
                                        <th className="px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            Unit Cost
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {item.name}
                                                    </span>
                                                    {item.sku && (
                                                        <span className="text-xs text-slate-400 font-mono">
                                                            {item.sku}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {item.branch?.name || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-800">
                                                {item.quantity}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-800">
                                                {item.unitCost
                                                    ? `₱${item.unitCost.toFixed(2)}`
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Forms & recent transactions */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                            <Plus className="w-4 h-4 text-blue-500" />
                            New Item
                        </h3>
                        <div className="space-y-2">
                            <input
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="Item name"
                                value={newItem.name}
                                onChange={(e) => setNewItem((v) => ({ ...v, name: e.target.value }))}
                            />
                            <input
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="SKU (optional)"
                                value={newItem.sku}
                                onChange={(e) => setNewItem((v) => ({ ...v, sku: e.target.value }))}
                            />
                            <input
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="Branch ID"
                                value={newItem.branchId}
                                onChange={(e) =>
                                    setNewItem((v) => ({ ...v, branchId: e.target.value }))
                                }
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    placeholder="Starting qty"
                                    value={newItem.quantity}
                                    onChange={(e) =>
                                        setNewItem((v) => ({
                                            ...v,
                                            quantity: Number(e.target.value),
                                        }))
                                    }
                                />
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    placeholder="Unit cost (₱)"
                                    value={newItem.unitCost}
                                    onChange={(e) =>
                                        setNewItem((v) => ({ ...v, unitCost: e.target.value }))
                                    }
                                />
                            </div>
                            <button
                                onClick={() => createItemMutation.mutate()}
                                disabled={!newItem.name || !newItem.branchId}
                                className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Save Item
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            Stock Adjustment
                        </h3>
                        <div className="space-y-2">
                            <select
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                value={adjustment.itemId}
                                onChange={(e) =>
                                    setAdjustment((v) => ({ ...v, itemId: e.target.value }))
                                }
                            >
                                <option value="">Select item</option>
                                {items.map((i) => (
                                    <option key={i.id} value={i.id}>
                                        {i.name} ({i.branch?.name})
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="Change (e.g. -1 for usage, +5 restock)"
                                value={adjustment.change}
                                onChange={(e) =>
                                    setAdjustment((v) => ({ ...v, change: Number(e.target.value) }))
                                }
                            />
                            <input
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                placeholder="Note (optional)"
                                value={adjustment.description}
                                onChange={(e) =>
                                    setAdjustment((v) => ({ ...v, description: e.target.value }))
                                }
                            />
                            <button
                                onClick={() => adjustmentMutation.mutate()}
                                disabled={!adjustment.itemId || !adjustment.change}
                                className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Record Movement
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                            <ClipboardList className="w-4 h-4 text-slate-500" />
                            Recent Movements
                        </h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                            {transactions.length === 0 ? (
                                <p className="text-slate-400">No recent movements.</p>
                            ) : (
                                transactions.map((t) => (
                                    <div
                                        key={t.id}
                                        className="flex items-start justify-between py-1.5 border-b border-slate-100 last:border-b-0"
                                    >
                                        <div className="pr-2">
                                            <p className="font-semibold text-slate-700">
                                                {t.item?.name}
                                            </p>
                                            <p className="text-slate-400">
                                                {t.description || 'No note'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p
                                                className={`font-mono ${
                                                    t.change < 0 ? 'text-red-600' : 'text-emerald-600'
                                                }`}
                                            >
                                                {t.change > 0 ? '+' : ''}
                                                {t.change}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {new Date(t.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Inventory;


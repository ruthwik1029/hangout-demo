import React, { useState, useEffect } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchDiscounts, saveDiscount, deleteDiscount } from '../../lib/supabase';
import { Discount } from '../../types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Tag,
  Plus,
  Percent,
  Calendar,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  ShieldCheck,
} from 'lucide-react';

export const AdminPromotionsPage: React.FC = () => {
  const { showToast } = useToast();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Partial<Discount> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchDiscounts();
      setDiscounts(data);
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to load promotions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingDiscount({
      id: `disc-${Date.now()}`,
      code: '',
      description: '',
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      min_order_amount: 300,
      max_discount_amount: 100,
      is_active: true,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Discount) => {
    setEditingDiscount({
      ...item,
      valid_until: item.valid_until ? item.valid_until.split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (item: Discount) => {
    try {
      const updated: Discount = { ...item, is_active: !item.is_active };
      await saveDiscount(updated);
      setDiscounts((prev) => prev.map((d) => (d.id === item.id ? updated : d)));
      showToast({
        type: 'success',
        title: 'Promotion Updated',
        message: `${item.code} is now ${updated.is_active ? 'Active' : 'Disabled'}.`,
      });
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to update promotion status' });
    }
  };

  const handleDelete = async (discountId: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete promotion code ${code}?`)) return;
    try {
      await deleteDiscount(discountId);
      setDiscounts((prev) => prev.filter((d) => d.id !== discountId));
      showToast({
        type: 'success',
        title: 'Promotion Removed',
        message: `Promotion ${code} has been deleted.`,
      });
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to delete promotion' });
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiscount || !editingDiscount.code?.trim()) {
      showToast({ type: 'error', title: 'Validation', message: 'Promo code is required.' });
      return;
    }

    setIsSaving(true);
    try {
      const discountToSave: Discount = {
        id: editingDiscount.id || `disc-${Date.now()}`,
        code: editingDiscount.code.trim().toUpperCase(),
        description: editingDiscount.description || '',
        discount_type: (editingDiscount.discount_type as 'PERCENTAGE' | 'FLAT') || 'PERCENTAGE',
        discount_value: Number(editingDiscount.discount_value) || 0,
        min_order_amount: Number(editingDiscount.min_order_amount) || 0,
        max_discount_amount: editingDiscount.max_discount_amount ? Number(editingDiscount.max_discount_amount) : undefined,
        is_active: editingDiscount.is_active ?? true,
        valid_until: editingDiscount.valid_until ? new Date(editingDiscount.valid_until).toISOString() : new Date().toISOString(),
      };

      await saveDiscount(discountToSave);
      await loadData();
      setIsModalOpen(false);
      setEditingDiscount(null);
      showToast({
        type: 'success',
        title: 'Promotion Saved',
        message: `Promotion ${discountToSave.code} configured successfully.`,
      });
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to save promotion.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Navigation Header */}
      <AdminNav
        title="Promotions & Offer Codes"
        subtitle="Manage customer coupon codes, percentage discounts, minimum cart values, and expiration dates."
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-brand-border shadow-card-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-yellow/20 flex items-center justify-center text-brand-black">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-black text-lg text-brand-black">
              Active Promo Campaigns ({discounts.filter((d) => d.is_active).length})
            </h2>
            <p className="text-xs text-brand-muted">
              Server-authoritative discount validation on checkout totals.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Create Offer Code
        </Button>
      </div>

      {/* Security Note */}
      <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
        <span>
          <strong>Cryptographic Order Integrity:</strong> Coupon codes are strictly validated against total order subtotal on the backend during checkout. Customers cannot manipulate client state to bypass discounts.
        </span>
      </div>

      {/* Discounts Table */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-brand-muted">Loading promotions...</p>
        </div>
      ) : discounts.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-brand-border space-y-3">
          <Tag className="w-12 h-12 text-brand-muted mx-auto" />
          <h3 className="font-heading font-bold text-lg text-brand-black">No Active Campaigns</h3>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            Create your first promotional discount coupon code to reward loyal shawarma customers.
          </p>
          <Button variant="outline" size="sm" onClick={handleOpenCreate} leftIcon={<Plus className="w-4 h-4" />}>
            Create Offer
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-brand-border shadow-card-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-brand-border bg-brand-warm-white text-[10px] font-heading font-extrabold uppercase tracking-wider text-brand-muted">
                  <th className="py-3.5 px-6">Coupon Code</th>
                  <th className="py-3.5 px-6">Discount Type & Value</th>
                  <th className="py-3.5 px-6">Min Order Subtotal</th>
                  <th className="py-3.5 px-6">Valid Until</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60 font-sans">
                {discounts.map((item) => {
                  const isExpired = item.valid_until && new Date(item.valid_until) < new Date();
                  return (
                    <tr key={item.id} className="hover:bg-brand-warm-white/40 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-sm text-brand-black">
                        <span className="px-2.5 py-1 rounded-xl bg-brand-yellow/20 text-brand-black border border-brand-yellow/40">
                          {item.code}
                        </span>
                        {item.description && (
                          <span className="block text-[11px] font-normal text-brand-muted mt-1">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-bold text-brand-black">
                        {item.discount_type === 'PERCENTAGE' ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-extrabold text-sm">
                            <Percent className="w-3.5 h-3.5" /> {item.discount_value}% OFF
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-extrabold text-sm">
                            ₹{item.discount_value} FLAT OFF
                          </span>
                        )}
                        {item.max_discount_amount && (
                          <span className="block text-[10px] text-brand-muted font-normal">
                            Capped at ₹{item.max_discount_amount}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-brand-charcoal font-medium">
                        ₹{item.min_order_amount ? item.min_order_amount.toFixed(0) : '0'}
                      </td>
                      <td className="py-4 px-6 text-brand-muted">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{item.valid_until ? new Date(item.valid_until).toLocaleDateString() : 'No expiry'}</span>
                        </div>
                        {isExpired && (
                          <span className="text-[10px] text-red-600 font-bold uppercase mt-0.5 block">
                            Expired
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            item.is_active && !isExpired
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {item.is_active && !isExpired ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-gray-500" /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-brand-muted hover:text-brand-black hover:bg-brand-warm-white transition-colors"
                            title="Edit Promotion"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.code)}
                            className="p-1.5 rounded-lg text-brand-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Promotion"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && editingDiscount && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingDiscount.id?.startsWith('disc-') ? 'Create Promotion Code' : 'Edit Promotion'}
          size="md"
        >
          <form onSubmit={handleSaveForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                  Coupon Code
                </label>
                <input
                  type="text"
                  required
                  value={editingDiscount.code || ''}
                  onChange={(e) => setEditingDiscount({ ...editingDiscount, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SHAWARMA10"
                  className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs font-mono font-bold text-brand-black uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                  Discount Type
                </label>
                <select
                  value={editingDiscount.discount_type || 'PERCENTAGE'}
                  onChange={(e) =>
                    setEditingDiscount({
                      ...editingDiscount,
                      discount_type: e.target.value as 'PERCENTAGE' | 'FLAT',
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs font-bold text-brand-black"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FLAT">Flat Amount (₹)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                  Value ({editingDiscount.discount_type === 'PERCENTAGE' ? '%' : '₹'})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={editingDiscount.discount_type === 'PERCENTAGE' ? '100' : '10000'}
                  value={editingDiscount.discount_value || 10}
                  onChange={(e) =>
                    setEditingDiscount({ ...editingDiscount, discount_value: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs font-bold text-brand-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                  Min Order (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingDiscount.min_order_amount || 0}
                  onChange={(e) =>
                    setEditingDiscount({ ...editingDiscount, min_order_amount: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs font-bold text-brand-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                  Max Cap (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingDiscount.max_discount_amount || ''}
                  onChange={(e) =>
                    setEditingDiscount({
                      ...editingDiscount,
                      max_discount_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs font-bold text-brand-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                Description
              </label>
              <input
                type="text"
                value={editingDiscount.description || ''}
                onChange={(e) => setEditingDiscount({ ...editingDiscount, description: e.target.value })}
                placeholder="e.g. 10% off on all shawarma orders above ₹300"
                className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs text-brand-black"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={editingDiscount.valid_until || ''}
                  onChange={(e) => setEditingDiscount({ ...editingDiscount, valid_until: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs text-brand-black"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-bold text-brand-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingDiscount.is_active ?? true}
                    onChange={(e) => setEditingDiscount({ ...editingDiscount, is_active: e.target.checked })}
                    className="rounded text-brand-yellow focus:ring-brand-yellow w-4 h-4"
                  />
                  <span>Active Campaign</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-brand-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Promotion'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchStaffProfiles, saveStaffProfile, deleteStaffProfile } from '../../lib/supabase';
import { UserProfile, UserRole } from '../../types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Shield,
  UserPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  Layers,
  Receipt,
  UtensilsCrossed,
} from 'lucide-react';

export const AdminStaffPage: React.FC = () => {
  const { showToast } = useToast();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<UserProfile> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchStaffProfiles();
      setStaff(data);
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to load staff accounts' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingStaff({
      id: `u-staff-${Date.now()}`,
      full_name: '',
      email: '',
      role_id: 'waiter',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingStaff({ ...user });
    setIsModalOpen(true);
  };

  const handleToggleActive = async (user: UserProfile) => {
    // Protect last active administrator
    if (user.role_id === 'admin' && user.is_active) {
      const activeAdminCount = staff.filter((s) => s.role_id === 'admin' && s.is_active).length;
      if (activeAdminCount <= 1) {
        showToast({
          type: 'error',
          title: 'Action Blocked',
          message: 'Cannot deactivate the last active Administrator account.',
        });
        return;
      }
    }

    try {
      const updated: UserProfile = { ...user, is_active: !user.is_active };
      await saveStaffProfile(updated);
      setStaff((prev) => prev.map((s) => (s.id === user.id ? updated : s)));
      showToast({
        type: 'success',
        title: 'Status Updated',
        message: `${user.full_name} is now ${updated.is_active ? 'Active' : 'Deactivated'}.`,
      });
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to update account status.' });
    }
  };

  const handleDelete = async (user: UserProfile) => {
    if (user.role_id === 'admin') {
      const activeAdminCount = staff.filter((s) => s.role_id === 'admin' && s.is_active).length;
      if (activeAdminCount <= 1) {
        showToast({
          type: 'error',
          title: 'Action Blocked',
          message: 'Cannot remove the last active Administrator account.',
        });
        return;
      }
    }

    if (!window.confirm(`Are you sure you want to remove account ${user.full_name}?`)) return;

    try {
      await deleteStaffProfile(user.id);
      setStaff((prev) => prev.filter((s) => s.id !== user.id));
      showToast({
        type: 'success',
        title: 'Account Removed',
        message: `${user.full_name} has been removed from staff roster.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete staff account';
      showToast({ type: 'error', title: 'Error', message: msg });
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !editingStaff.full_name?.trim() || !editingStaff.email?.trim()) {
      showToast({ type: 'error', title: 'Validation', message: 'Full name and email are required.' });
      return;
    }

    setIsSaving(true);
    try {
      const profileToSave: UserProfile = {
        id: editingStaff.id || `u-staff-${Date.now()}`,
        full_name: editingStaff.full_name.trim(),
        email: editingStaff.email.trim().toLowerCase(),
        role_id: editingStaff.role_id || 'waiter',
        is_active: editingStaff.is_active ?? true,
      };

      await saveStaffProfile(profileToSave);
      await loadData();
      setIsModalOpen(false);
      setEditingStaff(null);
      showToast({
        type: 'success',
        title: 'Staff Saved',
        message: `Account for ${profileToSave.full_name} configured successfully.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save staff profile';
      showToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // Role display helper
  const getRoleBadge = (roleId: string) => {
    switch (roleId) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-yellow/30 text-brand-black border border-brand-yellow">
            <Shield className="w-3 h-3 text-brand-black" /> Administrator
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-200">
            <Layers className="w-3 h-3 text-blue-700" /> Duty Manager
          </span>
        );
      case 'cashier':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
            <Receipt className="w-3 h-3 text-emerald-700" /> Cashier
          </span>
        );
      case 'waiter':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-200">
            <UtensilsCrossed className="w-3 h-3 text-gray-600" /> Staff (Floor / KDS)
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Navigation Header */}
      <AdminNav
        title="Staff & Role Management"
        subtitle="Manage authorized restaurant staff accounts across the 4 verified operational roles: Admin, Manager, Cashier, and Staff."
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-brand-border shadow-card-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-yellow/20 flex items-center justify-center text-brand-black">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-black text-lg text-brand-black">
              Authorized Restaurant Roster ({staff.length})
            </h2>
            <p className="text-xs text-brand-muted">
              Strict RBAC enforcement with protected administrator accounts.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          leftIcon={<UserPlus className="w-4 h-4" />}
        >
          Add Staff Account
        </Button>
      </div>

      {/* Staff Roster Table */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-brand-muted">Loading staff accounts...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-brand-border shadow-card-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-brand-border bg-brand-warm-white text-[10px] font-heading font-extrabold uppercase tracking-wider text-brand-muted">
                  <th className="py-3.5 px-6">Staff Member</th>
                  <th className="py-3.5 px-6">Email / Login ID</th>
                  <th className="py-3.5 px-6">Assigned Role</th>
                  <th className="py-3.5 px-6">Account Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60 font-sans">
                {staff.map((user) => (
                  <tr key={user.id} className="hover:bg-brand-warm-white/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-sm text-brand-black">
                      {user.full_name}
                    </td>
                    <td className="py-4 px-6 font-mono text-brand-muted">
                      {user.email}
                    </td>
                    <td className="py-4 px-6">
                      {getRoleBadge(user.role_id)}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(user)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                          user.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {user.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-gray-500" /> Deactivated
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 rounded-lg text-brand-muted hover:text-brand-black hover:bg-brand-warm-white transition-colors"
                          title="Edit Account"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          className="p-1.5 rounded-lg text-brand-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Permissions Matrix */}
      <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-yellow" />
          <h3 className="font-heading font-bold text-base text-brand-black">Role Authorization Matrix</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-brand-border text-[10px] font-heading font-extrabold uppercase text-brand-muted">
                <th className="py-2.5 px-4">Feature / Permission</th>
                <th className="py-2.5 px-4 text-center">Admin</th>
                <th className="py-2.5 px-4 text-center">Manager</th>
                <th className="py-2.5 px-4 text-center">Cashier</th>
                <th className="py-2.5 px-4 text-center">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/40 text-brand-charcoal">
              <tr>
                <td className="py-2.5 px-4 font-bold">Admin Command Centre & Analytics</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓ Full</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold">Menu, Pricing & GST Configuration</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓ Full</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold">Cashier Digital Billing & Payment Settlement</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓ Full</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold">Kitchen Display System (KDS) Stations</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓ Full</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-bold">Staff Floor Table Orders & Service</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓</td>
                <td className="py-2.5 px-4 text-center text-gray-400">—</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-bold">✓ Full</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && editingStaff && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingStaff.id?.startsWith('u-staff-') ? 'Add Staff Member' : 'Edit Staff Account'}
          size="md"
        >
          <form onSubmit={handleSaveForm} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={editingStaff.full_name || ''}
                onChange={(e) => setEditingStaff({ ...editingStaff, full_name: e.target.value })}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs font-bold text-brand-black"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                Email Address / Login ID
              </label>
              <input
                type="email"
                required
                value={editingStaff.email || ''}
                onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                placeholder="e.g. rahul@hangout.in"
                className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs font-mono text-brand-black"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                Operational Role
              </label>
              <select
                value={editingStaff.role_id || 'waiter'}
                onChange={(e) => setEditingStaff({ ...editingStaff, role_id: e.target.value as UserRole })}
                className="w-full px-3 py-2 rounded-xl border border-brand-border bg-brand-warm-white text-xs font-bold text-brand-black"
              >
                <option value="admin">Administrator (Full Access)</option>
                <option value="manager">Duty Manager (Floor & Staff Oversight)</option>
                <option value="cashier">Cashier (Billing & Payment Settlement)</option>
                <option value="waiter">Staff (Floor Operations & KDS Stations)</option>
              </select>
            </div>

            <div className="flex items-center pt-2">
              <label className="flex items-center gap-2 text-xs font-bold text-brand-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingStaff.is_active ?? true}
                  onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })}
                  className="rounded text-brand-yellow focus:ring-brand-yellow w-4 h-4"
                />
                <span>Active Account Access</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-brand-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Account'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

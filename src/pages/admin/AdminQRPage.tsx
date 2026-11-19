import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { AdminNav } from '../../components/admin/AdminNav';
import {
  fetchCafeTables,
  fetchCafeSettings,
  saveCafeTable,
  deleteCafeTable,
  recordAdminAction,
} from '../../lib/supabase';
import { CafeTable, CafeSettings } from '../../types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  QrCode,
  Printer,
  Download,
  Copy,
  Check,
  Layers,
  UtensilsCrossed,
  Users,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

const SECTIONS = [
  'Main Dining Hall',
  'Window Seating',
  'Ground Floor',
  'First Floor',
  'Terrace',
  'Balcony',
];

export const AdminQRPage: React.FC = () => {
  const { showToast } = useToast();
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [cafeSettings, setCafeSettings] = useState<CafeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrMap, setQrMap] = useState<Record<string, { png: string; svg: string }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Print Sheet Modal State
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [standeePreviewTable, setStandeePreviewTable] = useState<CafeTable | null>(null);

  // Add / Edit Table Modal State
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<CafeTable | null>(null);
  const [formTableNumber, setFormTableNumber] = useState('');
  const [formSection, setFormSection] = useState('Main Dining Hall');
  const [formCapacity, setFormCapacity] = useState(4);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingTable, setIsSavingTable] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hangout.restaurant';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allTables, settings] = await Promise.all([
        fetchCafeTables(),
        fetchCafeSettings(),
      ]);
      setTables(allTables);
      setCafeSettings(settings);

      // Generate QR codes for all tables
      const newMap: Record<string, { png: string; svg: string }> = {};
      for (const t of allTables) {
        const url = `${origin}/table/${t.table_number}`;
        const png = await QRCode.toDataURL(url, {
          width: 300,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        const svg = await QRCode.toString(url, {
          type: 'svg',
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        newMap[t.id] = { png, svg };
      }
      setQrMap(newMap);
    } catch (err) {
      console.error('Failed to load tables for QR codes:', err);
    } finally {
      setLoading(false);
    }
  }, [origin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyUrl = (tableNumber: string, tableId: string) => {
    const url = `${origin}/table/${tableNumber}`;
    navigator.clipboard.writeText(url);
    setCopiedId(tableId);
    showToast({
      type: 'success',
      title: 'URL Copied',
      message: `Table ${tableNumber} ordering link copied to clipboard.`,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPNG = (tableNumber: string, tableId: string) => {
    const data = qrMap[tableId]?.png;
    if (!data) return;
    const a = document.createElement('a');
    a.href = data;
    a.download = `hangout-qr-table-${tableNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSVG = (tableNumber: string, tableId: string) => {
    const svgData = qrMap[tableId]?.svg;
    if (!svgData) return;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hangout-qr-table-${tableNumber}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Open modal for new table
  const handleOpenAddModal = () => {
    setEditingTable(null);
    setFormTableNumber(`T-0${tables.length + 1}`);
    setFormSection('Main Dining Hall');
    setFormCapacity(4);
    setFormIsActive(true);
    setFormError(null);
    setIsTableModalOpen(true);
  };

  // Open modal to edit existing table
  const handleOpenEditModal = (table: CafeTable) => {
    setEditingTable(table);
    setFormTableNumber(table.table_number);
    setFormSection(table.section || 'Main Dining Hall');
    setFormCapacity(table.seating_capacity || 4);
    setFormIsActive(table.is_active);
    setFormError(null);
    setIsTableModalOpen(true);
  };

  // Save (Create or Update) Table
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNum = formTableNumber.trim().toUpperCase();
    if (!cleanNum) {
      setFormError('Table number is required.');
      return;
    }

    // Check duplicate table number
    const isDuplicate = tables.some(
      (t) => (!editingTable || t.id !== editingTable.id) && t.table_number.trim().toUpperCase() === cleanNum
    );
    if (isDuplicate) {
      setFormError(`Table number ${cleanNum} already exists.`);
      return;
    }

    setIsSavingTable(true);
    try {
      const tableToSave: CafeTable = {
        id: editingTable?.id || `b0000000-0000-0000-0000-00000000000${tables.length + 1}`,
        table_number: cleanNum,
        qr_code_identifier: `hangout-qr-table-${cleanNum.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        seating_capacity: formCapacity,
        capacity: formCapacity,
        section: formSection,
        status: editingTable?.status || 'available',
        is_active: formIsActive,
      };

      await saveCafeTable(tableToSave);
      await recordAdminAction({
        actor: 'Administrator',
        action: editingTable ? `Updated table ${cleanNum}` : `Created table ${cleanNum}`,
        category: 'TABLES',
        details: `Table ${cleanNum} (${formSection}, ${formCapacity} seats, ${formIsActive ? 'Active' : 'Inactive'}).`,
      });

      showToast({
        type: 'success',
        title: editingTable ? 'Table Updated' : 'Table Created',
        message: `Table ${cleanNum} saved with active QR routing.`,
      });
      setIsTableModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save table.');
    } finally {
      setIsSavingTable(false);
    }
  };

  // Quick toggle active
  const handleToggleTableActive = async (table: CafeTable) => {
    try {
      const updated: CafeTable = {
        ...table,
        is_active: !table.is_active,
      };
      await saveCafeTable(updated);
      await recordAdminAction({
        actor: 'Administrator',
        action: updated.is_active ? `Enabled table ${table.table_number}` : `Disabled table ${table.table_number}`,
        category: 'TABLES',
        details: `Table ${table.table_number} toggled to ${updated.is_active ? 'Active' : 'Inactive'}.`,
      });
      showToast({
        type: 'success',
        title: 'Status Updated',
        message: `Table ${table.table_number} is now ${updated.is_active ? 'Active' : 'Inactive'}.`,
      });
      await loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Could not toggle table status.',
      });
    }
  };

  // Delete table
  const handleDeleteTable = async (table: CafeTable) => {
    if (!window.confirm(`Are you sure you want to delete table ${table.table_number}?`)) return;
    try {
      await deleteCafeTable(table.id);
      await recordAdminAction({
        actor: 'Administrator',
        action: `Deleted table ${table.table_number}`,
        category: 'TABLES',
        details: `Table ${table.table_number} permanently removed.`,
      });
      showToast({
        type: 'success',
        title: 'Table Deleted',
        message: `Table ${table.table_number} removed.`,
      });
      await loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error',
        message: err.message || 'Could not delete table.',
      });
    }
  };

  const activeTables = tables.filter((t) => t.is_active);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Navigation */}
      <AdminNav
        title="Table QR Code Management"
        subtitle="Generate, preview, and print high-resolution scannable table QR standees and multi-table sheets."
      />

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-brand-border shadow-card-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-yellow/20 flex items-center justify-center text-brand-black">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-black text-lg text-brand-black">
              Dining Tables ({tables.length} Total • {activeTables.length} Active)
            </h2>
            <p className="text-xs text-brand-muted">
              Each QR code directly activates digital ordering for that specific dining table.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4 h-4 text-brand-black" />}
          >
            Add Table
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsSheetModalOpen(true)}
            disabled={activeTables.length === 0}
            leftIcon={<Layers className="w-4 h-4" />}
          >
            Print Sheet (A4)
          </Button>
        </div>
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            Generating Table QR Codes...
          </p>
        </div>
      ) : tables.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-brand-border space-y-3">
          <QrCode className="w-12 h-12 text-brand-muted mx-auto" />
          <h3 className="font-heading font-bold text-lg text-brand-black">No Tables Configured</h3>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            Click "Add Table" above to register dining tables and generate table ordering QR codes.
          </p>
          <Button type="button" variant="primary" size="sm" onClick={handleOpenAddModal}>
            Add First Table
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tables.map((table) => {
            const qr = qrMap[table.id];
            return (
              <div
                key={table.id}
                className={`bg-white rounded-3xl border shadow-card-subtle p-5 flex flex-col justify-between space-y-4 transition-all ${
                  table.is_active ? 'border-brand-border hover:border-brand-yellow' : 'border-dashed border-gray-300 opacity-75'
                }`}
              >
                {/* Standee Preview Card Header */}
                <div className="text-center space-y-1 pb-3 border-b border-brand-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted block">
                      {cafeSettings?.cafe_name || 'HANGOUT'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleTableActive(table)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        table.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      }`}
                      title="Click to toggle active status"
                    >
                      {table.is_active ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> Active
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 text-gray-400" /> Inactive
                        </>
                      )}
                    </button>
                  </div>
                  <h3 className="font-heading font-black text-2xl text-brand-black">
                    TABLE {table.table_number}
                  </h3>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-brand-muted">
                    <span className="px-2 py-0.5 rounded-full bg-brand-warm-white border border-brand-border font-medium">
                      {table.section}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {table.seating_capacity || 4} Seats
                    </span>
                  </div>
                </div>

                {/* QR Code Display */}
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="p-3 bg-brand-warm-white border-2 border-brand-border rounded-2xl shadow-inner">
                    {qr ? (
                      <img
                        src={qr.png}
                        alt={`QR Code for Table ${table.table_number}`}
                        className="w-40 h-40 bg-white p-1 rounded-xl shadow-xs"
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-gray-400">
                        <QrCode className="w-10 h-10 animate-pulse" />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-brand-charcoal uppercase tracking-wider mt-3">
                    Scan to View Menu & Order
                  </span>
                  <span className="text-[9px] text-brand-muted font-mono mt-0.5 break-all text-center px-2">
                    /table/{table.table_number}
                  </span>
                </div>

                {/* Card Action Controls */}
                <div className="space-y-2 pt-2 border-t border-brand-border">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyUrl(table.table_number, table.id)}
                      leftIcon={
                        copiedId === table.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {copiedId === table.id ? 'Copied' : 'Copy URL'}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setStandeePreviewTable(table)}
                      leftIcon={<Printer className="w-3.5 h-3.5" />}
                    >
                      Standee
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 px-1 text-brand-muted">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(table)}
                        className="text-[11px] font-bold text-brand-black hover:underline flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTable(table)}
                        className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadPNG(table.table_number, table.id)}
                        className="font-bold text-[10px] text-brand-black hover:underline flex items-center gap-0.5"
                      >
                        <Download className="w-3 h-3" /> PNG
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => handleDownloadSVG(table.table_number, table.id)}
                        className="font-bold text-[10px] text-brand-black hover:underline flex items-center gap-0.5"
                      >
                        <Download className="w-3 h-3" /> SVG
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD / EDIT TABLE
         ========================================================================= */}
      {isTableModalOpen && (
        <Modal
          isOpen={isTableModalOpen}
          onClose={() => setIsTableModalOpen(false)}
          title={editingTable ? `Edit Table ${editingTable.table_number}` : 'Add New Dining Table'}
          subtitle="Configure table identity, dining section, and seating capacity."
          maxWidth="md"
        >
          <form onSubmit={handleSaveTable} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                Table Number / Code
              </label>
              <input
                type="text"
                required
                value={formTableNumber}
                onChange={(e) => setFormTableNumber(e.target.value)}
                placeholder="e.g. T-09, T-10, VIP-1"
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-sm font-mono uppercase font-bold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
              <p className="text-[11px] text-brand-muted mt-1">Must be unique across all tables.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                  Floor Section
                </label>
                <select
                  value={formSection}
                  onChange={(e) => setFormSection(e.target.value)}
                  className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                >
                  {SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                  Seating Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(parseInt(e.target.value) || 2)}
                  className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-brand-black block">Active Status</span>
                <span className="text-[11px] text-brand-muted">
                  When active, customers can scan the QR code to open a session.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-black"></div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-border">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsTableModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSavingTable}>
                {editingTable ? 'Save Changes' : 'Create Table'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 1: SINGLE TABLE STANDEE PREVIEW & PRINT
         ========================================================================= */}
      {standeePreviewTable && (
        <Modal
          isOpen={Boolean(standeePreviewTable)}
          onClose={() => setStandeePreviewTable(null)}
          title={`Table ${standeePreviewTable.table_number} QR Standee`}
          subtitle="Ready to print on acrylic standee or adhesive table label."
          maxWidth="md"
        >
          <div className="space-y-5">
            <div className="flex justify-center p-6 bg-brand-warm-white rounded-3xl border border-brand-border">
              {/* Standee Physical Preview Card */}
              <div
                id="printable-standee"
                className="w-[280px] bg-white border-2 border-brand-charcoal p-6 rounded-3xl shadow-xl text-center flex flex-col items-center space-y-3 font-sans"
              >
                <div className="w-10 h-10 rounded-2xl bg-brand-yellow flex items-center justify-center text-brand-black shadow-md">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-black text-xl text-brand-black uppercase tracking-wider">
                    {cafeSettings?.cafe_name || 'HANGOUT'}
                  </h4>
                  <p className="text-[10px] uppercase tracking-widest text-brand-muted font-bold">
                    Shawarma • Murtabak • Starters
                  </p>
                </div>

                <div className="w-full py-1.5 px-3 bg-brand-charcoal text-white rounded-xl">
                  <span className="font-heading font-black text-2xl tracking-wider block">
                    TABLE {standeePreviewTable.table_number}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-brand-yellow font-bold">
                    {standeePreviewTable.section}
                  </span>
                </div>

                {qrMap[standeePreviewTable.id] && (
                  <img
                    src={qrMap[standeePreviewTable.id].png}
                    alt={`Table ${standeePreviewTable.table_number}`}
                    className="w-44 h-44 bg-white p-2 border border-brand-border rounded-2xl shadow-sm"
                  />
                )}

                <div className="space-y-0.5">
                  <p className="font-heading font-extrabold text-xs text-brand-black uppercase tracking-wide">
                    Scan with Phone Camera
                  </p>
                  <p className="text-[9px] text-brand-muted leading-tight">
                    Browse menu, customize shawarma, and place orders directly to kitchen.
                  </p>
                </div>

                <div className="text-[8px] font-mono text-gray-400 pt-1 border-t border-gray-200 w-full">
                  HANGOUT Digital Ordering • Dine-In Service
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-brand-border">
              <Button variant="ghost" size="md" onClick={() => setStandeePreviewTable(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print Standee Now
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL 2: BATCH PRINT ALL QR CODES (SHEET PREVIEW)
         ========================================================================= */}
      {isSheetModalOpen && (
        <Modal
          isOpen={isSheetModalOpen}
          onClose={() => setIsSheetModalOpen(false)}
          title="Print All Table QR Codes (Sheet Layout)"
          subtitle={`Arranged for standard A4 printing (${activeTables.length} tables total)`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Sheet Preview Box */}
            <div className="max-h-[65vh] overflow-y-auto p-6 bg-gray-100 rounded-3xl border border-brand-border">
              <div
                id="printable-sheet"
                className="w-full bg-white p-6 rounded-2xl shadow-md border border-gray-200 grid grid-cols-2 sm:grid-cols-3 gap-4"
              >
                {activeTables.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 border-2 border-dashed border-gray-300 rounded-2xl text-center flex flex-col items-center space-y-1.5 bg-brand-warm-white/40"
                  >
                    <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500">
                      {cafeSettings?.cafe_name || 'HANGOUT'}
                    </span>
                    <span className="font-heading font-black text-sm text-brand-black bg-brand-yellow/30 px-2 py-0.5 rounded-md">
                      TABLE {t.table_number}
                    </span>
                    <span className="text-[8px] text-gray-500 font-medium">{t.section}</span>

                    {qrMap[t.id] && (
                      <img
                        src={qrMap[t.id].png}
                        alt={`Table ${t.table_number}`}
                        className="w-24 h-24 bg-white p-1 border border-gray-200 rounded-lg"
                      />
                    )}

                    <span className="text-[8px] font-bold text-gray-700 uppercase">
                      Scan to Order
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-brand-border">
              <span className="text-xs text-brand-muted">
                Tip: Choose "A4 Paper" and set Margins to "Minimum" in the browser print window.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="md" onClick={() => setIsSheetModalOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => window.print()}
                  leftIcon={<Printer className="w-4 h-4" />}
                >
                  Print Full Sheet
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Embedded Print CSS for Sheet & Standee */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-standee, #printable-standee * {
            visibility: visible;
          }
          #printable-sheet, #printable-sheet * {
            visibility: visible;
          }
          #printable-standee {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 100mm;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }
          #printable-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 8mm;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

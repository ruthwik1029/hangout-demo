import React, { useState, useEffect, useMemo } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import {
  fetchMenuCategories,
  fetchMenuItems,
  saveCategory,
  saveMenuItem,
  archiveMenuItem,
  uploadMenuImage,
} from '../../lib/supabase';
import { MenuCategory, MenuItem } from '../../types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { VegIndicator, NonVegIndicator } from '../../components/common/Badge';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  Star,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';

export const AdminMenuPage: React.FC = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [itemImagePreview, setItemImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<MenuCategory> | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [cats, items] = await Promise.all([fetchMenuCategories(), fetchMenuItems()]);
    setCategories(cats);
    setMenuItems(items);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Don't show archived items in active list
      if (item.is_archived) return false;
      const matchCat = selectedCategoryId === 'all' || item.category_id === selectedCategoryId;
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCategoryId, searchQuery]);

  // Open item modal for add/edit
  const handleOpenItemModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem({ ...item });
      setItemImagePreview(item.image_url);
    } else {
      setEditingItem({
        id: undefined,
        name: '',
        description: '',
        price: 150,
        category_id: categories[0]?.id || '',
        is_veg: true,
        prep_time_minutes: 15,
        is_available: true,
        is_featured: false,
        is_today_special: false,
        image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600',
      });
      setItemImagePreview('https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600');
    }
    setIsItemModalOpen(true);
  };

  // Image Upload Handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const res = await uploadMenuImage(file);
      const publicUrl = res.url;
      setItemImagePreview(publicUrl);
      setEditingItem((prev) => (prev ? { ...prev, image_url: publicUrl } : null));
      showToast({
        type: 'success',
        title: 'Image Uploaded',
        message: 'Menu image processed successfully.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload image. Please try again.',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name?.trim() || !editingItem.category_id) {
      showToast({ type: 'error', title: 'Error', message: 'Item name and category are required.' });
      return;
    }

    setIsSavingItem(true);
    try {
      const itemToSave = {
        ...editingItem,
        name: editingItem.name.trim(),
        category_id: editingItem.category_id,
        image_url: itemImagePreview || editingItem.image_url || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600',
      };
      await saveMenuItem(itemToSave);
      showToast({
        type: 'success',
        title: 'Item Saved',
        message: `"${itemToSave.name}" has been updated in the menu.`,
      });
      setIsItemModalOpen(false);
      await loadData();
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to save menu item.' });
    } finally {
      setIsSavingItem(false);
    }
  };

  // Archive Item (Safe archive pattern required by prompt)
  const handleArchiveItem = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Are you sure you want to archive "${itemName}"? It will be removed from customer view while preserving order history.`)) {
      return;
    }

    try {
      await archiveMenuItem(itemId);
      showToast({
        type: 'info',
        title: 'Item Archived',
        message: `"${itemName}" was safely archived.`,
      });
      await loadData();
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to archive item.' });
    }
  };

  // Toggle Item Availability Quick Switch
  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const updated = { ...item, is_available: !item.is_available };
      await saveMenuItem(updated);
      showToast({
        type: 'info',
        title: updated.is_available ? 'Item Back in Stock' : 'Item Marked Sold Out',
        message: `"${item.name}" availability updated.`,
      });
      await loadData();
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to update availability.' });
    }
  };

  // Open Category Modal
  const handleOpenCatModal = (cat?: MenuCategory) => {
    if (cat) {
      setEditingCategory({ ...cat });
    } else {
      setEditingCategory({
        id: undefined,
        name: '',
        slug: '',
        description: '',
        display_order: categories.length + 1,
        is_active: true,
      });
    }
    setIsCatModalOpen(true);
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name?.trim()) {
      showToast({ type: 'error', title: 'Error', message: 'Category name is required.' });
      return;
    }

    setIsSavingCategory(true);
    try {
      const catName = editingCategory.name.trim();
      const catToSave = {
        ...editingCategory,
        name: catName,
        slug: editingCategory.slug?.trim() || catName.toLowerCase().replace(/\s+/g, '-'),
      };
      await saveCategory(catToSave);
      showToast({
        type: 'success',
        title: 'Category Saved',
        message: `Category "${catToSave.name}" updated.`,
      });
      setIsCatModalOpen(false);
      await loadData();
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to save category.' });
    } finally {
      setIsSavingCategory(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      <AdminNav
        title="Menu & Catalog Management"
        subtitle="Manage food items, categories, pricing, veg indicators, food imagery, and availability."
      />

      {/* Categories Toolbar */}
      <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-base text-brand-black flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-black" />
            <span>Categories ({categories.length})</span>
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenCatModal()}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Category
          </Button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              selectedCategoryId === 'all'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'bg-brand-warm-white text-brand-muted hover:text-brand-black'
            }`}
          >
            All Items ({menuItems.filter((i) => !i.is_archived).length})
          </button>

          {categories.map((cat) => {
            const count = menuItems.filter((i) => i.category_id === cat.id && !i.is_archived).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <div key={cat.id} className="flex items-center group">
                <button
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-1.5 rounded-l-xl text-xs font-heading font-bold transition-all ${
                    isSelected
                      ? 'bg-brand-black text-brand-yellow shadow-sm'
                      : 'bg-brand-warm-white text-brand-muted hover:text-brand-black'
                  }`}
                >
                  {cat.name} ({count})
                </button>
                <button
                  onClick={() => handleOpenCatModal(cat)}
                  className={`p-1.5 rounded-r-xl border-l border-brand-border/30 text-xs transition-colors ${
                    isSelected
                      ? 'bg-brand-black text-brand-yellow'
                      : 'bg-brand-warm-white text-brand-muted hover:text-brand-black'
                  }`}
                  title="Edit Category"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Menu Items Section */}
      <div className="space-y-4">
        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-brand-muted absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search dishes by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-brand-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleOpenItemModal()}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add New Dish
            </Button>
          </div>
        </div>

        {/* Menu Items Table / Grid */}
        {loading ? (
          <div className="p-16 text-center text-xs text-brand-muted">Loading menu items...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-brand-border text-center space-y-3">
            <p className="text-xs text-brand-muted">No items match your selected filter or search.</p>
            <Button variant="outline" size="sm" onClick={() => { setSelectedCategoryId('all'); setSearchQuery(''); }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-white rounded-3xl border border-brand-border shadow-card-subtle flex flex-col justify-between space-y-3 hover:border-brand-black/30 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-brand-warm-white shrink-0 relative">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1">
                      {item.is_veg ? <VegIndicator size="sm" /> : <NonVegIndicator size="sm" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-heading font-bold text-sm text-brand-black truncate">
                        {item.name}
                      </h3>
                      <span className="font-heading font-extrabold text-sm text-brand-black shrink-0">
                        ₹{(item.price ?? item.base_price ?? 0).toFixed(2)}
                      </span>
                    </div>

                    <p className="text-[11px] text-brand-muted line-clamp-2 mt-0.5 font-sans">
                      {item.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-brand-muted flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" /> {item.prep_time_minutes}m
                      </span>

                      {item.is_featured && (
                        <span className="text-[10px] bg-brand-soft-yellow font-bold text-brand-black px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> Featured
                        </span>
                      )}

                      {item.is_today_special && (
                        <span className="text-[10px] bg-amber-100 font-bold text-amber-900 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> Special
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Controls */}
                <div className="pt-2 border-t border-brand-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(item)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                        item.is_available
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      {item.is_available ? 'In Stock' : 'Sold Out'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenItemModal(item)}
                      className="p-1.5 rounded-xl border border-brand-border hover:bg-brand-warm-white text-brand-black transition-colors"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleArchiveItem(item.id, item.name)}
                      className="p-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 transition-colors"
                      title="Archive Item (Safe FK Protection)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Dish Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem?.id ? 'Edit Menu Item' : 'Add New Menu Item'}
        subtitle="Manage dish details, image, pricing, and tags."
        maxWidth="lg"
      >
        {editingItem && (
          <form onSubmit={handleSaveItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                  placeholder="e.g. Pistachio Milk Cake"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={editingItem.category_id || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, category_id: e.target.value })}
                  className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={editingItem.price || 0}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Dietary Classification
                </label>
                <div className="flex items-center gap-2 pt-1.5">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="dietary"
                      checked={editingItem.is_veg === true}
                      onChange={() => setEditingItem({ ...editingItem, is_veg: true })}
                      className="text-brand-black focus:ring-brand-yellow"
                    />
                    <VegIndicator size="sm" />
                    <span>Vegetarian</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-3">
                    <input
                      type="radio"
                      name="dietary"
                      checked={editingItem.is_veg === false}
                      onChange={() => setEditingItem({ ...editingItem, is_veg: false })}
                      className="text-brand-black focus:ring-brand-yellow"
                    />
                    <NonVegIndicator size="sm" />
                    <span>Non-Veg</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Prep Time (Mins)
                </label>
                <input
                  type="number"
                  min="1"
                  value={editingItem.prep_time_minutes || 10}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      prep_time_minutes: parseInt(e.target.value, 10) || 10,
                    })
                  }
                  className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                value={editingItem.description || ''}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                placeholder="Delicious flavor notes, ingredients, and presentation..."
              />
            </div>

            {/* Image Upload and Preview */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black">
                Food Image & Media
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-brand-warm-white border border-brand-border">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white border border-brand-border shrink-0">
                  <img
                    src={itemImagePreview || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600'}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-brand-border text-xs font-bold text-brand-black hover:bg-brand-warm-white">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingImage ? 'Uploading...' : 'Upload Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                        disabled={isUploadingImage}
                      />
                    </label>

                    {itemImagePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setItemImagePreview('https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600');
                          setEditingItem({ ...editingItem, image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=600' });
                        }}
                        className="text-xs text-brand-muted hover:text-red-600 underline"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>

                  <div>
                    <input
                      type="url"
                      placeholder="Or enter direct image URL"
                      value={itemImagePreview}
                      onChange={(e) => {
                        setItemImagePreview(e.target.value);
                        setEditingItem({ ...editingItem, image_url: e.target.value });
                      }}
                      className="w-full p-2 bg-white border border-brand-border rounded-xl text-xs font-mono focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Checkbox Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2 p-3 rounded-xl border border-brand-border bg-brand-warm-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={editingItem.is_available ?? true}
                  onChange={(e) => setEditingItem({ ...editingItem, is_available: e.target.checked })}
                  className="rounded text-brand-black focus:ring-brand-yellow"
                />
                <span className="font-bold text-brand-black">Available in Stock</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-brand-border bg-brand-warm-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={editingItem.is_featured ?? false}
                  onChange={(e) => setEditingItem({ ...editingItem, is_featured: e.target.checked })}
                  className="rounded text-brand-black focus:ring-brand-yellow"
                />
                <span className="font-bold text-brand-black">Featured on Home</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-brand-border bg-brand-warm-white cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={editingItem.is_today_special ?? false}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, is_today_special: e.target.checked })
                  }
                  className="rounded text-brand-black focus:ring-brand-yellow"
                />
                <span className="font-bold text-brand-black">Today&apos;s Special</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-brand-border">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsItemModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSavingItem}
              >
                Save Menu Item
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCategory?.id ? 'Edit Category' : 'Create Category'}
        subtitle="Manage menu category name, slug and display order."
        maxWidth="md"
      >
        {editingCategory && (
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingCategory.name || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                placeholder="e.g. Artisanal Brews"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                URL Slug <span className="text-brand-muted text-[10px] lowercase">(optional, auto-generated)</span>
              </label>
              <input
                type="text"
                value={editingCategory.slug || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                placeholder="artisanal-brews"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Display Order
                </label>
                <input
                  type="number"
                  min="1"
                  value={editingCategory.display_order || 1}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      display_order: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Status
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-brand-border bg-brand-warm-white cursor-pointer text-xs mt-0.5">
                  <input
                    type="checkbox"
                    checked={editingCategory.is_active ?? true}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, is_active: e.target.checked })
                    }
                    className="rounded text-brand-black focus:ring-brand-yellow"
                  />
                  <span className="font-bold text-brand-black">Active Category</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                value={editingCategory.description || ''}
                onChange={(e) =>
                  setEditingCategory({ ...editingCategory, description: e.target.value })
                }
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                placeholder="Category summary shown to guests..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-brand-border">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsCatModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSavingCategory}
              >
                Save Category
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

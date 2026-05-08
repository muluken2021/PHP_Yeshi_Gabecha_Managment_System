// src/admin/components/ServiceModal.jsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getAssetUrl } from '../../utils/api.js';

const ServiceModal = ({ service, categories, onSave, onClose }) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    status: 'active',
    featured: false,
  });
  const [errors, setErrors] = useState({});

  // existingImages: string paths already saved on the server
  const [existingImages, setExistingImages] = useState([]);
  // newFiles: File objects the user just picked
  const [newFiles, setNewFiles] = useState([]);
  // newPreviews: object URLs for newFiles
  const [newPreviews, setNewPreviews] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (service) {
      setFormData({
        name:        service.name        || '',
        description: service.description || '',
        price:       service.price       || '',
        category:    service.category    || '',
        status:      service.status      || 'active',
        featured:    !!service.featured,
      });
      setExistingImages(Array.isArray(service.images) ? service.images : []);
    } else {
      setFormData({ name: '', description: '', price: '', category: '', status: 'active', featured: false });
      setExistingImages([]);
    }
    setNewFiles([]);
    setNewPreviews([]);
    setErrors({});
  }, [service]);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => newPreviews.forEach(url => URL.revokeObjectURL(url));
  }, [newPreviews]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (!picked.length) return;
    const previews = picked.map(f => URL.createObjectURL(f));
    setNewFiles(prev => [...prev, ...picked]);
    setNewPreviews(prev => [...prev, ...previews]);
    e.target.value = '';
  };

  const removeExisting = (idx) => {
    setExistingImages(prev => prev.filter((_, i) => i !== idx));
  };

  const removeNew = (idx) => {
    URL.revokeObjectURL(newPreviews[idx]);
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
    setNewPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const validate = () => {
    const e = {};
    if (!formData.name.trim())        e.name        = t('name_required')         || 'Name is required';
    if (!formData.description.trim()) e.description = t('description_required')  || 'Description is required';
    if (!formData.price || isNaN(formData.price) || Number(formData.price) <= 0)
                                      e.price       = t('valid_price_required')  || 'Enter a valid price';
    if (!formData.category)           e.category    = t('category_required')     || 'Category is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      ...formData,
      id:     service?.id || null,
      price:  Number(formData.price),
      // Pass existing image paths + new File objects together
      images: [...existingImages, ...newFiles],
    });
  };

  const inputCls = (field) =>
    `w-full px-4 py-3 text-sm text-gray-900 bg-white/70 border rounded-xl dark:bg-white/5 dark:text-gray-100 focus:outline-none focus:ring ${
      errors[field]
        ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-200 dark:border-gray-700 focus:border-purple-400 focus:ring-purple-300'
    }`

  const totalImages = existingImages.length + newFiles.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh]">
        <div className="relative flex flex-col w-full max-h-[90vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {service ? (t('edit_service') || 'Edit Service') : (t('add_service') || 'Add Service')}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {service ? 'Update service details.' : 'Create a new service.'}
              </p>
            </div>
            <button type="button" onClick={onClose}
              className="ml-4 w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-gray-700 transition-colors">
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <form id="service-form" onSubmit={handleSubmit} className="space-y-5">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('service name') || 'Service Name'} *
                </label>
                <input type="text" name="name" value={formData.name} onChange={handleChange}
                  className={inputCls('name')} placeholder="e.g. Wedding Photography" />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('description') || 'Description'} *
                </label>
                <textarea name="description" value={formData.description} onChange={handleChange}
                  rows={3} className={inputCls('description')}
                  placeholder="Describe the service..." />
                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('price') || 'Price (ETB)'} *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">ETB</span>
                    <input type="number" name="price" value={formData.price} onChange={handleChange}
                      min="0" step="1"
                      className={`${inputCls('price')} pl-12`} placeholder="0" />
                  </div>
                  {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('category') || 'Category'} *
                  </label>
                  <select name="category" value={formData.category} onChange={handleChange}
                    className={inputCls('category')}>
                    <option value="">{t('select_category') || 'Select category'}</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
                </div>
              </div>

              {/* Status + Featured */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('status') || 'Status'}
                  </label>
                  <select name="status" value={formData.status} onChange={handleChange}
                    className={inputCls('status')}>
                    <option value="active">{t('active') || 'Active'}</option>
                    <option value="inactive">{t('inactive') || 'Inactive'}</option>
                  </select>
                </div>

                <div className="flex items-center mt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="featured" checked={formData.featured} onChange={handleChange}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-300" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('featured service') || 'Featured service'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('images') || 'Images'}
                  {totalImages > 0 && (
                    <span className="ml-2 text-xs text-gray-400">({totalImages} {totalImages === 1 ? 'image' : 'images'})</span>
                  )}
                </label>

                <input type="file" ref={fileInputRef} onChange={handleFileChange}
                  accept="image/*" multiple className="hidden" />

                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:border-purple-500 dark:hover:text-purple-400 transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('upload_images') || 'Upload images'}
                </button>

                {totalImages > 0 && (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {/* Existing images from server */}
                    {existingImages.map((url, idx) => (
                      <div key={`existing-${idx}`} className="relative group aspect-square">
                        <img src={getAssetUrl(url)} alt={`Image ${idx + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-colors" />
                        <button type="button" onClick={() => removeExisting(idx)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
                          ×
                        </button>
                        <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">saved</span>
                      </div>
                    ))}
                    {/* New files not yet uploaded */}
                    {newPreviews.map((url, idx) => (
                      <div key={`new-${idx}`} className="relative group aspect-square">
                        <img src={url} alt={`New ${idx + 1}`}
                          className="w-full h-full object-cover rounded-lg border-2 border-purple-400" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-colors" />
                        <button type="button" onClick={() => removeNew(idx)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
                          ×
                        </button>
                        <span className="absolute bottom-1 left-1 text-[10px] bg-purple-600/80 text-white px-1 rounded">new</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {t('cancel') || 'Cancel'}
            </button>
            <button type="submit" form="service-form"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow transition-colors">
              {service ? (t('update_service') || 'Update Service') : (t('create service') || 'Create Service')}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ServiceModal;

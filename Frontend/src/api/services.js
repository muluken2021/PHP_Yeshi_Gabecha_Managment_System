import api from '../utils/api.js'

export const getServices = (params = {}) => {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    qs.append(k, String(v))
  })
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api.get(`/services${suffix}`)
}

export const getServiceById = (id) => api.get(`/services/${id}`)

export const createService = async (payload) => {
  const fd = new FormData()
  fd.append('name', payload.name)
  if (payload.description) fd.append('description', payload.description)
  fd.append('price', String(payload.price))
  fd.append('category', payload.category)
  if (payload.status) fd.append('status', payload.status)
  fd.append('featured', String(!!payload.featured))

  const images = Array.isArray(payload.images) ? payload.images : []
  images.forEach((file) => {
    if (file instanceof File) fd.append('images', file)
  })

  return api.post('/services', fd)
}

export const updateService = async (id, payload) => {
  const allImages  = Array.isArray(payload.images) ? payload.images : []
  const newFiles   = allImages.filter(f => f instanceof File)
  const keepPaths  = allImages.filter(f => typeof f === 'string')

  if (newFiles.length > 0) {
    // Has new image files — use multipart POST with _method=PUT override
    const fd = new FormData()
    fd.append('_method', 'PUT')
    Object.entries(payload).forEach(([k, v]) => {
      if (k === 'images' || k === 'id' || v === undefined || v === null) return
      fd.append(k, String(v))
    })
    // Tell backend which existing images to keep
    keepPaths.forEach(p => fd.append('keepImages[]', p))
    newFiles.forEach(f => fd.append('images', f))
    return api.post(`/services/${id}`, fd)
  }

  // No new files — send as JSON PUT
  // eslint-disable-next-line no-unused-vars
  const { images, id: _id, ...rest } = payload
  return api.put(`/services/${id}`, { ...rest, keepImages: keepPaths })
}

export const deleteService = (id) => api.delete(`/services/${id}`)

export const deleteServiceImage = (id, imageIndex) =>
  api.delete(`/services/${id}/images/${imageIndex}`)

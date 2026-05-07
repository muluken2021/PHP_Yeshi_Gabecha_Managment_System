import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle, XCircle, Eye, RefreshCw, Clock,
  CreditCard, Image as ImageIcon, X, ChevronLeft, ChevronRight,
  AlertTriangle, Search, Filter
} from 'lucide-react'
import { approvePayment, getAdminPayments, rejectPayment } from '../../api/payments'
import { getAssetUrl } from '../../utils/api'

// ── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    completed: 'bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300',
    failed:    'bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {status === 'pending'   && <Clock size={11} />}
      {status === 'completed' && <CheckCircle size={11} />}
      {status === 'failed'    && <XCircle size={11} />}
      {status}
    </span>
  )
}

// ── Proof image modal ─────────────────────────────────────────────────────────
const ProofModal = ({ url, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    onClick={onClose}
  >
    <div
      className="relative max-w-3xl w-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
        <span className="font-semibold text-gray-800 dark:text-gray-200">Payment Proof</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          <X size={20} />
        </button>
      </div>
      <div className="p-4 flex items-center justify-center bg-gray-50 dark:bg-gray-900 min-h-[300px]">
        <img
          src={url}
          alt="Payment proof"
          className="max-h-[70vh] max-w-full object-contain rounded"
        />
      </div>
      <div className="px-4 py-3 border-t dark:border-gray-700 flex justify-end">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          Open in new tab ↗
        </a>
      </div>
    </div>
  </div>
)

// ── Confirm action modal ──────────────────────────────────────────────────────
const ConfirmModal = ({ action, payment, onConfirm, onCancel, loading }) => {
  const isApprove = action === 'approve'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isApprove ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
            {isApprove
              ? <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
              : <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
            }
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-200">
              {isApprove ? 'Approve Payment' : 'Reject Payment'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ID: {String(payment?.id || '').slice(0, 12)}...
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          {isApprove
            ? 'This will mark the payment as completed and confirm the associated booking or increment event ticket count.'
            : 'This will mark the payment as failed. The user will need to re-submit payment.'}
        </p>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-5 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Customer</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {payment?.firstName ? `${payment.firstName} ${payment.lastName}` : payment?.userEmail || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Amount</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              ETB {Number(payment?.amount || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Method</span>
            <span className="font-medium text-gray-800 dark:text-gray-200 capitalize">{payment?.paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Type</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {payment?.eventId ? 'Event Ticket' : 'Booking'}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
              isApprove
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading
              ? (isApprove ? 'Approving...' : 'Rejecting...')
              : (isApprove ? 'Yes, Approve' : 'Yes, Reject')
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Payment row ───────────────────────────────────────────────────────────────
const PaymentRow = ({ p, onApprove, onReject, onViewProof, processingId }) => {
  const proofUrl = p.proofUrl ? getAssetUrl(p.proofUrl) : null
  const customerName = p.firstName ? `${p.firstName} ${p.lastName}` : (p.userEmail || '—')
  const isProcessing = processingId === p.id

  return (
    <tr className="text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      {/* ID */}
      <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
        {String(p.id).slice(0, 8)}…
      </td>

      {/* Customer */}
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{customerName}</div>
        {p.userEmail && p.firstName && (
          <div className="text-xs text-gray-500 dark:text-gray-400">{p.userEmail}</div>
        )}
      </td>

      {/* Type / Reference */}
      <td className="px-4 py-3">
        {p.eventId ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            🎟 Event
          </span>
        ) : p.bookingId ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            📋 Booking
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
          {(p.eventId || p.bookingId || '').slice(0, 8)}…
        </div>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
        ETB {Number(p.amount || 0).toLocaleString()}
      </td>

      {/* Method */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 capitalize">
          <CreditCard size={11} />
          {p.paymentMethod}
        </span>
        {p.phoneNumber && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.phoneNumber}</div>
        )}
      </td>

      {/* Proof */}
      <td className="px-4 py-3">
        {proofUrl ? (
          <button
            onClick={() => onViewProof(proofUrl)}
            className="group relative w-14 h-14 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
          >
            <img src={proofUrl} alt="proof" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye size={16} className="text-white" />
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <ImageIcon size={14} />
            No proof
          </div>
        )}
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        }) : '—'}
        <div className="text-gray-400 dark:text-gray-500">
          {p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit'
          }) : ''}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={p.status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {p.status === 'pending' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApprove(p)}
              disabled={isProcessing || !proofUrl}
              title={!proofUrl ? 'Proof required before approving' : 'Approve payment'}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle size={13} />
              {isProcessing ? '…' : 'Approve'}
            </button>
            <button
              onClick={() => onReject(p)}
              disabled={isProcessing}
              title="Reject payment"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle size={13} />
              {isProcessing ? '…' : 'Reject'}
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
            {p.status === 'completed' ? 'Approved' : 'Rejected'}
          </span>
        )}
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const TABS = ['all', 'pending', 'completed', 'failed']
const PAGE_SIZE = 20

const Payments = () => {
  const { t } = useTranslation()

  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [payments, setPayments]       = useState([])
  const [total, setTotal]             = useState(0)
  const [tab, setTab]                 = useState('pending')
  const [page, setPage]               = useState(0)
  const [search, setSearch]           = useState('')
  const [proofUrl, setProofUrl]       = useState(null)
  const [confirm, setConfirm]         = useState(null)   // { action, payment }
  const [processingId, setProcessingId] = useState(null)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async (currentTab = tab, currentPage = page) => {
    setLoading(true)
    setError('')
    try {
      const params = {
        limit:  PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
      }
      if (currentTab !== 'all') params.status = currentTab

      const data = await getAdminPayments(params)
      setPayments(data?.payments || [])
      setTotal(data?.total || 0)
    } catch (e) {
      setError(e?.message || 'Failed to load payments')
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => { load(tab, page) }, [tab, page])

  const handleTabChange = (newTab) => {
    setTab(newTab)
    setPage(0)
    setSearch('')
  }

  const handleApprove = (payment) => {
    setActionError('')
    setConfirm({ action: 'approve', payment })
  }

  const handleReject = (payment) => {
    setActionError('')
    setConfirm({ action: 'reject', payment })
  }

  const handleConfirm = async () => {
    if (!confirm) return
    const { action, payment } = confirm
    setProcessingId(payment.id)
    setActionError('')
    try {
      if (action === 'approve') {
        await approvePayment(payment.id)
      } else {
        await rejectPayment(payment.id)
      }
      setConfirm(null)
      await load(tab, page)
    } catch (e) {
      setActionError(e?.message || `Failed to ${action} payment`)
    } finally {
      setProcessingId(null)
    }
  }

  // Client-side search filter (by customer name, email, id, method)
  const filtered = useMemo(() => {
    if (!search.trim()) return payments
    const q = search.toLowerCase()
    return payments.filter((p) =>
      String(p.id).toLowerCase().includes(q) ||
      String(p.firstName || '').toLowerCase().includes(q) ||
      String(p.lastName  || '').toLowerCase().includes(q) ||
      String(p.userEmail || '').toLowerCase().includes(q) ||
      String(p.paymentMethod || '').toLowerCase().includes(q)
    )
  }, [payments, search])

  // Tab counts from current loaded data
  const tabCounts = useMemo(() => ({
    pending:   payments.filter(p => p.status === 'pending').length,
    completed: payments.filter(p => p.status === 'completed').length,
    failed:    payments.filter(p => p.status === 'failed').length,
  }), [payments])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="container px-6 mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 my-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">
            {t('payments') || 'Payments'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Review and approve customer payment submissions
          </p>
        </div>
        <button
          onClick={() => load(tab, page)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
        {TABS.map((t_) => (
          <button
            key={t_}
            onClick={() => handleTabChange(t_)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              tab === t_
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t_}
            {t_ !== 'all' && tabCounts[t_] > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                t_ === 'pending'   ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                t_ === 'completed' ? 'bg-green-100  text-green-700  dark:bg-green-900/50  dark:text-green-300'  :
                                     'bg-red-100    text-red-700    dark:bg-red-900/50    dark:text-red-300'
              }`}>
                {tabCounts[t_]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, method…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {/* Table */}
      <div className="w-full overflow-hidden rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="w-full overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Proof</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y dark:divide-gray-700 dark:bg-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      Loading payments…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <CreditCard size={32} className="text-gray-300 dark:text-gray-600" />
                      <span>
                        {search ? 'No payments match your search' : `No ${tab === 'all' ? '' : tab} payments found`}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <PaymentRow
                    key={p.id}
                    p={p}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onViewProof={setProofUrl}
                    processingId={processingId}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Page {page + 1} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Proof image modal */}
      {proofUrl && <ProofModal url={proofUrl} onClose={() => setProofUrl(null)} />}

      {/* Confirm action modal */}
      {confirm && (
        <ConfirmModal
          action={confirm.action}
          payment={confirm.payment}
          onConfirm={handleConfirm}
          onCancel={() => { setConfirm(null); setActionError('') }}
          loading={processingId === confirm.payment?.id}
        />
      )}

      {/* Action error toast */}
      {actionError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg text-sm">
          <AlertTriangle size={16} />
          {actionError}
          <button onClick={() => setActionError('')} className="ml-2 hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default Payments

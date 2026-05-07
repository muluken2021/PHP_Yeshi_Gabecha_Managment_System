import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Phone, 
  Github, 
  Mail as GoogleIcon, 
  AlertCircle, 
  ArrowLeft,
  Key,
  CheckCircle,
  RefreshCw,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

// Validation schemas using Zod
const loginSchema = (isAmharic) => z.object({
  identifier: z.string()
    .min(1, { message: isAmharic ? 'ኢሜይል ወይም ስልክ ቁጥር ያስፈልጋል' : 'Email or phone number is required' })
    .refine((value) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isPhone = /^\d{8,15}$/.test(value.replace(/\D/g, ''));
      return isEmail || isPhone;
    }, { message: isAmharic ? 'ትክክለኛ ኢሜይል ወይም ስልክ ቁጥር ያስገቡ' : 'Please enter a valid email or phone number' }),
  
  password: z.string()
    .min(1, { message: isAmharic ? 'የይለፍ ቃል ያስፈልጋል' : 'Password is required' })
    .min(6, { message: isAmharic ? 'የይለፍ ቃል ቢያንስ 6 ቁምፊ ሊኖረው ይገባል' : 'Password must be at least 6 characters' })
});

const forgotPasswordSchema = (isAmharic) => z.object({
  email: z.string()
    .min(1, { message: isAmharic ? 'ኢሜይል ያስፈልጋል' : 'Email is required' })
    .email({ message: isAmharic ? 'ትክክለኛ ኢሜይል ያስገቡ' : 'Please enter a valid email address' })
});

const otpSchema = (isAmharic) => z.object({
  otp: z.string()
    .min(1, { message: isAmharic ? 'OTP ያስፈልጋል' : 'OTP is required' })
    .length(6, { message: isAmharic ? 'OTP 6 ቁጥሮች መሆን አለበት' : 'OTP must be 6 digits' })
    .regex(/^\d+$/, { message: isAmharic ? 'OTP ቁጥሮች ብቻ መሆን አለበት' : 'OTP must contain only numbers' })
});

const resetPasswordSchema = (isAmharic) => z.object({
  newPassword: z.string()
    .min(1, { message: isAmharic ? 'አዲስ የይለፍ ቃል ያስፈልጋል' : 'New password is required' })
    .min(8, { message: isAmharic ? 'የይለፍ ቃል ቢያንስ 8 ቁምፊ ሊኖረው ይገባል' : 'Password must be at least 8 characters' })
    .refine((value) => /[a-z]/.test(value), { 
      message: isAmharic ? 'ቢያንስ አንድ ትንሽ ፊደል ሊኖረው ይገባል' : 'At least one lowercase letter is required' 
    })
    .refine((value) => /[A-Z]/.test(value), { 
      message: isAmharic ? 'ቢያንስ አንድ ትልቅ ፊደል ሊኖረው ይገባል' : 'At least one uppercase letter is required' 
    })
    .refine((value) => /[0-9]/.test(value), { 
      message: isAmharic ? 'ቢያንስ አንድ ቁጥር ሊኖረው ይገባል' : 'At least one number is required' 
    })
    .refine((value) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value), { 
      message: isAmharic ? 'ቢያንስ አንድ ልዩ ቁምፊ ሊኖረው ይገባል' : 'At least one special character is required' 
    }),
  
  confirmPassword: z.string()
    .min(1, { message: isAmharic ? 'የይለፍ ቃል ማረጋገጫ ያስፈልጋል' : 'Password confirmation is required' })
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: isAmharic ? 'የይለፍ ቃሎች አይጣጣሙም' : 'Passwords do not match',
  path: ['confirmPassword']
});

// ── Forgot Password Modal ─────────────────────────────────────────────────────
const ForgetPassword = ({ isAmharic, onClose }) => {
  const { showToast } = useToast()

  const [step, setStep]               = useState('email')
  const [email, setEmail]             = useState('')
  const [emailError, setEmailError]   = useState('')
  const [otp, setOtp]                 = useState('')
  const [otpError, setOtpError]       = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [pwError, setPwError]         = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const sendOtp = async (emailVal) => {
    setLoading(true)
    try {
      const api = (await import('../utils/api.js')).default
      await api.post('/auth/forgot-password', { email: emailVal })
      showToast(isAmharic ? 'OTP ወደ ኢሜይልዎ ተልኳል' : 'OTP sent to your email', 'success')
      setStep('otp')
      setResendCooldown(60)
    } catch (e) {
      showToast(e?.message || (isAmharic ? 'ስህተት ተከስቷል' : 'Request failed'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setEmailError('')
    const trimmed = email.trim()
    if (!trimmed) { setEmailError(isAmharic ? 'ኢሜይል ያስፈልጋል' : 'Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(isAmharic ? 'ትክክለኛ ኢሜይል ያስገቡ' : 'Enter a valid email address')
      return
    }
    await sendOtp(trimmed)
  }

  const handleOtpSubmit = (e) => {
    e.preventDefault()
    setOtpError('')
    if (!/^\d{6}$/.test(otp)) {
      setOtpError(isAmharic ? '6 ቁጥር OTP ያስፈልጋል' : '6-digit OTP is required')
      return
    }
    setStep('reset')
  }

  const handleResetSubmit = async (e) => {
    e.preventDefault()
    setPwError('')
    if (newPassword.length < 8)              { setPwError(isAmharic ? 'ቢያንስ 8 ቁምፊ' : 'At least 8 characters'); return }
    if (!/[a-z]/.test(newPassword))          { setPwError(isAmharic ? 'አንድ ትንሽ ፊደል ያስፈልጋል' : 'One lowercase letter required'); return }
    if (!/[A-Z]/.test(newPassword))          { setPwError(isAmharic ? 'አንድ ትልቅ ፊደል ያስፈልጋል' : 'One uppercase letter required'); return }
    if (!/[0-9]/.test(newPassword))          { setPwError(isAmharic ? 'አንድ ቁጥር ያስፈልጋል' : 'One number required'); return }
    if (!/[!@#$%^&*()\-_=+[\]{};':",.<>/?]/.test(newPassword)) {
      setPwError(isAmharic ? 'አንድ ልዩ ቁምፊ ያስፈልጋል' : 'One special character required'); return
    }
    if (newPassword !== confirmPw)           { setPwError(isAmharic ? 'የይለፍ ቃሎች አይጣጣሙም' : 'Passwords do not match'); return }

    setLoading(true)
    try {
      const api = (await import('../utils/api.js')).default
      await api.post('/auth/reset-password', { email, otp, newPassword })
      setStep('done')
    } catch (e) {
      setPwError(e?.message || (isAmharic ? 'ማደስ አልተሳካም' : 'Reset failed'))
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { key: 'email', label: isAmharic ? 'ኢሜይል' : 'Email' },
    { key: 'otp',   label: 'OTP' },
    { key: 'reset', label: isAmharic ? 'ቀይር' : 'Reset' },
  ]
  const stepIndex = { email: 0, otp: 1, reset: 2, done: 3 }

  const inputCls = (hasErr) =>
    `w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 dark:bg-neutral-700 dark:text-neutral-100 transition-colors ${
      hasErr
        ? 'border-red-400 focus:ring-red-400 dark:border-red-500'
        : 'border-neutral-300 dark:border-neutral-600 focus:ring-yellow-500 dark:focus:ring-yellow-400'
    }`

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/75 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Key size={18} className="text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-base leading-tight">
                {isAmharic ? 'የይለፍ ቃል ዳግም ማስጀመር' : 'Reset Password'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {step === 'email' && (isAmharic ? 'ኢሜይልዎን ያስገቡ' : 'Enter your email to receive an OTP')}
                {step === 'otp'   && (isAmharic ? 'OTP ያስገቡ' : `OTP sent to ${email}`)}
                {step === 'reset' && (isAmharic ? 'አዲስ የይለፍ ቃል ያስገቡ' : 'Create your new password')}
                {step === 'done'  && (isAmharic ? 'ተሳክቷል!' : 'All done!')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex items-center px-6 pt-4 pb-1 gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  stepIndex[step] > i  ? 'bg-yellow-500 text-white' :
                  stepIndex[step] === i ? 'bg-yellow-500 text-white ring-2 ring-yellow-200 dark:ring-yellow-800' :
                                          'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                }`}>
                  {stepIndex[step] > i ? <CheckCircle size={13} /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${stepIndex[step] >= i ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400'}`}>
                  {s.label}
                </span>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded mx-1 ${stepIndex[step] > i ? 'bg-yellow-400' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="px-6 py-5">

          {/* Step 1 — Email */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {isAmharic ? 'ኢሜይል አድራሻ' : 'Email address'} *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError('') }}
                    className={`${inputCls(!!emailError)} pl-9`}
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>
                {emailError && (
                  <p className="flex items-center gap-1 mt-1 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle size={12} /> {emailError}
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
                  {isAmharic ? 'ዝጋ' : 'Cancel'}
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading
                    ? <><RefreshCw size={14} className="animate-spin" /> {isAmharic ? 'በመላክ...' : 'Sending...'}</>
                    : (isAmharic ? 'OTP ላክ' : 'Send OTP')}
                </button>
              </div>
            </form>
          )}

          {/* Step 2 — OTP */}
          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {isAmharic ? '6-ቁጥር OTP' : '6-digit OTP'} *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError('') }}
                  className={`${inputCls(!!otpError)} text-center text-2xl tracking-[0.5em] font-mono`}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
                {otpError && (
                  <p className="flex items-center gap-1 mt-1 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle size={12} /> {otpError}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {isAmharic ? 'OTP አልደረሰዎትም?' : "Didn't receive the OTP?"}
                  </span>
                  <button type="button" disabled={resendCooldown > 0 || loading} onClick={() => sendOtp(email)}
                    className="text-xs font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                    <RefreshCw size={11} />
                    {resendCooldown > 0
                      ? `${isAmharic ? 'እንደገና ላክ' : 'Resend'} (${resendCooldown}s)`
                      : (isAmharic ? 'እንደገና ላክ' : 'Resend')}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setStep('email'); setOtp(''); setOtpError('') }}
                  className="flex-1 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-1">
                  <ArrowLeft size={14} /> {isAmharic ? 'ተመለስ' : 'Back'}
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition-colors">
                  {isAmharic ? 'አረጋግጥ' : 'Verify OTP'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3 — New Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {isAmharic ? 'አዲስ የይለፍ ቃል' : 'New password'} *
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPwError('') }}
                    className={`${inputCls(!!pwError)} pr-10`}
                    placeholder={isAmharic ? 'አዲስ የይለፍ ቃል' : 'New password'}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2">
                  {[
                    [/[a-z]/,    isAmharic ? 'ትንሽ ፊደል'   : 'Lowercase'],
                    [/[A-Z]/,    isAmharic ? 'ትልቅ ፊደል'   : 'Uppercase'],
                    [/[0-9]/,    isAmharic ? 'ቁጥር'        : 'Number'],
                    [/[!@#$%^&*()\-_=+[\]{};':",.<>/?]/, isAmharic ? 'ልዩ ቁምፊ' : 'Special char'],
                    [/.{8,}/,    isAmharic ? 'ቢያንስ 8 ቁምፊ' : '8+ characters'],
                  ].map(([regex, label]) => (
                    <span key={label} className={`flex items-center gap-1 text-xs ${
                      regex.test(newPassword) ? 'text-green-600 dark:text-green-400' : 'text-neutral-400 dark:text-neutral-500'
                    }`}>
                      <CheckCircle size={10} /> {label}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {isAmharic ? 'የይለፍ ቃል አረጋግጥ' : 'Confirm password'} *
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setPwError('') }}
                    className={`${inputCls(!!pwError)} pr-10`}
                    placeholder={isAmharic ? 'ያረጋግጡ' : 'Confirm password'}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwError && (
                  <p className="flex items-center gap-1 mt-1 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle size={12} /> {pwError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setStep('otp'); setPwError('') }}
                  className="flex-1 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-1">
                  <ArrowLeft size={14} /> {isAmharic ? 'ተመለስ' : 'Back'}
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading
                    ? <><RefreshCw size={14} className="animate-spin" /> {isAmharic ? 'በመቀየር...' : 'Resetting...'}</>
                    : (isAmharic ? 'ቀይር' : 'Reset Password')}
                </button>
              </div>
            </form>
          )}

          {/* Step 4 — Done */}
          {step === 'done' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-bold text-neutral-800 dark:text-neutral-100 text-lg">
                  {isAmharic ? 'ተሳክቷል!' : 'Password Reset!'}
                </h4>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {isAmharic
                    ? 'የይለፍ ቃልዎ ተቀይሯል። አሁን ይግቡ።'
                    : 'Your password has been updated. You can now sign in.'}
                </p>
              </div>
              <button onClick={onClose}
                className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition-colors">
                {isAmharic ? 'ወደ መግቢያ ሂድ' : 'Back to Sign In'}
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  )
}

const Login = ({ isAdminLogin = false } = {}) => {
  const { t, i18n } = useTranslation();
  const isAmharic = i18n.language === 'am';
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyTwoFactorLogin } = useAuth();
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState({
    google: false,
    github: false
  });
  const [showForgetPassword, setShowForgetPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema(isAmharic)),
    defaultValues: {
      identifier: '',
      password: ''
    }
  });

  const formData = watch();
  const from = location.state?.from?.pathname || '/';

  // Handle OAuth Login
  const handleOAuthLogin = async (provider) => {
    setOauthLoading(prev => ({ ...prev, [provider]: true }));
    
    try {
      showToast(
        isAmharic ? 'OAuth መግቢያ አልተዘጋጀም' : 'OAuth login is not implemented yet',
        'info'
      )
    } finally {
      setOauthLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  // Handle form submission
  const onSubmit = async (data) => {
    setLoading(true);

    try {
      const loginResult = await login({
        identifier: data.identifier,
        password: data.password,
      });

      if (loginResult?.twoFactorRequired && loginResult?.twoFactorToken) {
        setTwoFactorToken(loginResult.twoFactorToken)
        showToast(
          isAmharic
            ? 'OTP ወደ ኢሜይልዎ ተልኳል። እባክዎ OTP ያስገቡ'
            : 'An OTP was sent to your email. Please enter it to continue.',
          'info'
        )
        return
      }
      
      if (!loginResult.success) {
        if (loginResult.status === 401) {
          showToast(
            isAmharic
              ? 'ኢሜይል/ስልክ ወይም የይለፍ ቃል ትክክል አይደለም'
              : 'Email/phone or password is incorrect',
            'error'
          )
          return
        }

        showToast(
          isAmharic ? 'መግባት አልተሳካም' : (loginResult.error || 'Login failed'),
          'error'
        )
        return
      }
      
      showToast(
        isAmharic
          ? `እንኳን ደህና መጡ! ${loginResult.user?.role === 'admin' ? 'ወደ አስተዳዳሪ ሳጥን ይዛወራሉ...' : 'ወደ መገልገያዎ ይዛወራሉ...'}`
          : `Welcome! ${loginResult.user?.role === 'admin' ? 'Redirecting to admin panel...' : 'Redirecting to your dashboard...'}`,
        'success'
      )
      
      navigate(loginResult.user?.role === 'admin' ? '/admin' : from, { replace: true });
      
    } catch (error) {
      showToast(
        isAmharic ? (error?.message || 'የመግቢያ ስህተት ተከስቷል') : (error?.message || 'Login error occurred'),
        'error'
      )
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault()

    const otp = String(otpValue || '').trim()
    if (!/^\d{6}$/.test(otp)) {
      showToast(
        isAmharic ? 'እባክዎ 6 ቁጥር OTP ያስገቡ' : 'Please enter a valid 6-digit OTP',
        'error'
      )
      return
    }

    if (!twoFactorToken) {
      showToast(isAmharic ? 'OTP ቶክን አልተገኘም' : 'Two-factor token missing. Please login again.', 'error')
      return
    }

    setOtpLoading(true)
    try {
      const result = await verifyTwoFactorLogin({ twoFactorToken, otp })

      if (!result?.success) {
        if (result?.status === 401) {
          showToast(isAmharic ? 'OTP ትክክል አይደለም' : 'Invalid OTP', 'error')
        } else if (result?.status === 400) {
          showToast(isAmharic ? (result?.error || 'OTP ጊዜው አልፎበታል፣ እንደገና ይግቡ') : (result?.error || 'OTP expired. Please login again.'), 'error')
          setTwoFactorToken('')
          setOtpValue('')
        } else {
          showToast(isAmharic ? (result?.error || 'OTP ማረጋገጥ አልተሳካም') : (result?.error || 'OTP verification failed'), 'error')
        }
        return
      }

      setTwoFactorToken('')
      setOtpValue('')

      showToast(
        isAmharic
          ? `በተሳካ ሁኔታ ገብተዋል! ${result.user?.role === 'admin' ? 'ወደ አስተዳዳሪ ሳጥን ይዛወራሉ...' : 'ወደ መገልገያዎ ይዛወራሉ...'}`
          : `Login successful! ${result.user?.role === 'admin' ? 'Redirecting to admin panel...' : 'Redirecting to your dashboard...'}`,
        'success'
      )

      navigate(result.user?.role === 'admin' ? '/admin' : from, { replace: true })
    } catch (error) {
      showToast(
        isAmharic ? (error?.message || 'OTP ማረጋገጥ ስህተት ተከስቷል') : (error?.message || 'OTP verification error occurred'),
        'error'
      )
    } finally {
      setOtpLoading(false)
    }
  }

  // Helper function for input classes
  const getInputClasses = (fieldName) => {
    const baseClasses = "w-full px-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 dark:bg-neutral-700 dark:text-neutral-100 transition-all duration-200";
    
    if (errors[fieldName]) {
      return `${baseClasses} border-red-500 focus:ring-red-500 dark:border-red-500 dark:focus:ring-red-400`;
    } else {
      return `${baseClasses} border-neutral-300 dark:border-neutral-600`;
    }
  };

  return (
    <>
      {/* Forget Password Modal */}
      <AnimatePresence>
        {showForgetPassword && (
          <ForgetPassword 
            isAmharic={isAmharic}
            onClose={() => setShowForgetPassword(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen py-8 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-800">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-4 font-display">
              {isAdminLogin ? (isAmharic ? 'የአስተዳዳሪ መግቢያ' : 'Admin Sign In') : (isAmharic ? 'ግባ' : 'Sign In')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-300">
              {isAdminLogin
                ? (isAmharic ? 'ወደ አስተዳዳሪ መለያ ይግቡ' : 'Sign in to your admin account')
                : (isAmharic ? 'ወደ መለያዎ ይግቡ' : 'Sign in to your account')}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg dark:shadow-neutral-900/50 p-6 border border-neutral-200 dark:border-neutral-700"
          >
            {twoFactorToken ? (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                  {isAmharic ? 'OTP ማረጋገጥ' : 'Verify OTP'}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  {isAmharic
                    ? '6 ቁጥር OTP ያስገቡ (ኢሜይል ላይ ተልኳል)'
                    : 'Enter the 6-digit OTP sent to your email.'}
                </p>

                <input
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-neutral-700 dark:text-neutral-100"
                  placeholder="000000"
                />

                <motion.button
                  type="submit"
                  disabled={otpLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {otpLoading ? (isAmharic ? 'በማረጋገጥ ላይ...' : 'Verifying...') : (isAmharic ? 'አረጋግጥ' : 'Verify')}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorToken('')
                    setOtpValue('')
                  }}
                  className="w-full text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-100"
                >
                  {isAmharic ? 'ተመለስ' : 'Back'}
                </button>
              </form>
            ) : (
            <>
            {/* OAuth Buttons - Top */}
            <div className="mb-6">
              <p className="text-center text-neutral-600 dark:text-neutral-300 text-sm mb-4">
                {isAmharic ? 'በሌላ መንገድ ይግቡ' : 'Or continue with'}
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Google Login */}
                <motion.button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={oauthLoading.google}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center space-x-2 py-3 px-4 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {oauthLoading.google ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  ) : (
                    <>
                      <GoogleIcon size={20} className="text-red-600 dark:text-red-500" />
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        Google
                      </span>
                    </>
                  )}
                </motion.button>

                {/* GitHub Login */}
                <motion.button
                  type="button"
                  onClick={() => handleOAuthLogin('github')}
                  disabled={oauthLoading.github}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center space-x-2 py-3 px-4 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {oauthLoading.github ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-800 dark:border-gray-300"></div>
                  ) : (
                    <>
                      <Github size={20} className="text-neutral-800 dark:text-neutral-300" />
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        GitHub
                      </span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-300 dark:border-neutral-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                    {isAmharic ? 'ወይም' : 'Or'}
                  </span>
                </div>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email/Phone Input */}
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 mb-2 text-sm font-medium">
                  {isAmharic ? 'ኢሜይል ወይም ስልክ ቁጥር' : 'Email or Phone Number'} *
                </label>
                <div className="relative">
                  {formData.identifier.includes('@') ? (
                    <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${errors.identifier ? 'text-red-500 dark:text-red-400' : 'text-neutral-400 dark:text-neutral-500'}`} size={18} />
                  ) : (
                    <Phone className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${errors.identifier ? 'text-red-500 dark:text-red-400' : 'text-neutral-400 dark:text-neutral-500'}`} size={18} />
                  )}
                  <input
                    type="text"
                    {...register('identifier')}
                    className={getInputClasses('identifier')}
                    placeholder={isAmharic ? 'ኢሜይል ወይም ስልክ ቁጥር' : 'Email or phone number'}
                  />
                </div>
                {errors.identifier && (
                  <div className="flex items-center mt-1">
                    <AlertCircle size={14} className="text-red-500 dark:text-red-400 mr-1" />
                    <p className="text-red-500 dark:text-red-400 text-xs">{errors.identifier.message}</p>
                  </div>
                )}
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 mb-2 text-sm font-medium">
                  {isAmharic ? 'የይለፍ ቃል' : 'Password'} *
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${errors.password ? 'text-red-500 dark:text-red-400' : 'text-neutral-400 dark:text-neutral-500'}`} size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    className={`${getInputClasses('password')} pr-10`}
                    placeholder={isAmharic ? 'የይለፍ ቃልዎን ያስገቡ' : 'Enter your password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <div className="flex items-center mt-1">
                    <AlertCircle size={14} className="text-red-500 dark:text-red-400 mr-1" />
                    <p className="text-red-500 dark:text-red-400 text-xs">{errors.password.message}</p>
                  </div>
                )}
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <button 
                  type="button"
                  onClick={() => setShowForgetPassword(true)}
                  className="text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 font-medium flex items-center justify-end space-x-1"
                >
                  <Key size={14} />
                  <span>{isAmharic ? 'የይለፍ ቃል ረሳኽው?' : 'Forgot your password?'}</span>
                </button>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={loading || Object.keys(errors).length > 0}
                whileHover={{ scale: Object.keys(errors).length === 0 ? 1.02 : 1 }}
                whileTap={{ scale: Object.keys(errors).length === 0 ? 0.98 : 1 }}
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 dark:from-yellow-700 dark:to-amber-700 dark:hover:from-yellow-600 dark:hover:to-amber-600 text-white py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg dark:shadow-neutral-900/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {isAmharic ? 'በመግባት ላይ...' : 'Signing in...'}
                  </div>
                ) : (
                  isAmharic ? 'ግባ' : 'Sign In'
                )}
              </motion.button>
            </form>
            {!isAdminLogin && (
              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <div className="text-center">
                  <p className="text-neutral-600 dark:text-neutral-300 text-sm">
                    {isAmharic ? 'አዲስ ተጠቃሚ?' : 'New user?'}{' '}
                    <Link to="/register" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold">
                      {isAmharic ? 'መለያ ይፍጠሩ' : 'Create account'}
                    </Link>
                  </p>
                </div>
              </div>
            )}
            </>
            )}
            
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Login;
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Mail, KeyRound, RefreshCw } from 'lucide-react';
import { usersAPI } from '../../utils/api';

export default function ChangePasswordCard({ user, embedded = false }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const maskUserEmail = (email) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  };

  const userEmail = user?.Email || user?.email || '';
  const emailDisplay = maskedEmail || maskUserEmail(userEmail);

  // Password strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 3) return { score: 3, label: 'Good', color: 'bg-blue-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword && newPassword !== confirmPassword;

  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);

  // Handle Send OTP
  const handleSendOtp = async () => {
    if (!currentPassword) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter your current password first before requesting an OTP code.'
      });
      return;
    }
    if (cooldown > 0 || isSendingOtp) return;
    setStatusMessage(null);
    setIsSendingOtp(true);

    try {
      const res = await usersAPI.sendChangePasswordOtp({ currentPassword });
      if (res?.success) {
        setOtpSent(true);
        setCurrentPasswordVerified(true);
        setMaskedEmail(res.maskedEmail || maskUserEmail(userEmail));
        setCooldown(res.cooldownSeconds || 45);
        setStatusMessage({
          type: 'success',
          text: res.message || `Verification code sent to ${res.maskedEmail || maskUserEmail(userEmail)}. Check your email.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res?.message || 'Failed to send verification code. Please check your current password.'
        });
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Unable to send OTP. Please check your current password.';
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Submit Change Password
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!currentPassword) {
      setStatusMessage({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setStatusMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (!otp || otp.length !== 6) {
      setStatusMessage({ type: 'error', text: 'Please enter the 6-digit verification code.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await usersAPI.verifyAndChangePassword({
        currentPassword,
        newPassword,
        otp: otp.trim()
      });

      if (res?.success) {
        setStatusMessage({
          type: 'success',
          text: res.message || 'Password successfully updated!'
        });
        // Clear sensitive fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtp('');
        setOtpSent(false);
      } else {
        setStatusMessage({
          type: 'error',
          text: res?.message || 'Failed to update password.'
        });
      }
    } catch (err) {
      console.error('Change password error:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to update password. Please verify the details.';
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    currentPassword &&
    newPassword.length >= 6 &&
    confirmPassword === newPassword &&
    otp.length === 6 &&
    !isSubmitting;

  return (
    <article className={embedded ? "bg-white transition-all duration-200" : "mt-6 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-200"}>
      {/* Header Banner */}
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between bg-white">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Change Password</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Protect your account by creating a strong password with email OTP verification.
            </p>
          </div>
        </div>

        {emailDisplay && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-600 shrink-0">
            <Mail className="h-3.5 w-3.5 text-blue-600" />
            <span>OTP sent to: <strong className="text-slate-800 font-mono">{emailDisplay}</strong></span>
          </div>
        )}
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="px-6 py-6">
        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`mb-5 flex items-start gap-3 rounded-xl border p-3.5 text-xs leading-relaxed transition-all duration-200 ${
              statusMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                : 'border-red-200 bg-red-50/80 text-red-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{statusMessage.text}</div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 ml-1 text-sm font-bold"
              aria-label="Dismiss message"
            >
              &times;
            </button>
          </div>
        )}

        <div className="space-y-4">
          {/* Current Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Current Password
              </label>
              {currentPasswordVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Password verified
                </span>
              )}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (currentPasswordVerified) setCurrentPasswordVerified(false);
                }}
                placeholder="Enter your current password"
                required
                className={`w-full rounded-lg border bg-white pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
                  currentPasswordVerified
                    ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20'
                    : 'border-slate-200 focus:border-blue-600 focus:ring-blue-500/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Your current password is validated before sending the email verification code.
            </p>
          </div>

          {/* New Password & Confirm Password Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                          step <= strength.score ? strength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className={`w-full rounded-lg border bg-white pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
                    passwordsMismatch
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                      : passwordsMatch
                      ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20'
                      : 'border-slate-200 focus:border-blue-600 focus:ring-blue-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Match Feedback */}
              {passwordsMismatch && (
                <p className="mt-1.5 text-[11px] font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Passwords do not match
                </p>
              )}
              {passwordsMatch && (
                <p className="mt-1.5 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>
          </div>

          {/* OTP Verification Section */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800">
                  Email Verification Code (OTP)
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Request a 6-digit security code sent to your registered email address.
                </p>
              </div>

              {/* Send / Resend OTP Button */}
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isSendingOtp || cooldown > 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white border border-blue-200 px-3.5 py-2 text-xs font-semibold text-blue-700 shadow-xs hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 transition shrink-0"
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                    <span>Sending code...</span>
                  </>
                ) : cooldown > 0 ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                    <span>Resend in {cooldown}s</span>
                  </>
                ) : otpSent ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                    <span>Resend Code</span>
                  </>
                ) : (
                  <>
                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                    <span>Send Verification Code</span>
                  </>
                )}
              </button>
            </div>

            {/* OTP Input Field */}
            <div className="flex items-center gap-3">
              <div className="relative max-w-[200px] flex-1">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center font-mono text-base font-bold tracking-[0.35em] text-slate-900 placeholder:text-slate-300 placeholder:tracking-[0.2em] focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <span className="text-xs text-slate-500">
                {otpSent ? 'Enter the 6-digit PIN from your inbox' : 'Click "Send Verification Code" first'}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setOtp('');
              setStatusMessage(null);
            }}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            Clear Fields
          </button>

          <button
            type="submit"
            disabled={!isFormValid}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Update Password</span>
              </>
            )}
          </button>
        </div>
      </form>
    </article>
  );
}

import React, { useEffect, useState } from 'react';
import { X, Loader2, Mail, UserCheck } from 'lucide-react';
import { API_BASE_URL } from '../../utils/apiBase';
import SmartUserAvatar from '../UI/SmartUserAvatar';

const EditOfficeHeadModal = ({ visible, onClose, head = {}, onSave }) => {
  const [position, setPosition] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (head) {
      setPosition(head.Position || '');
    }
  }, [head]);

  if (!visible) return null;

  const firstname = head.firstname || head.user?.firstname || '';
  const middleinitial = head.middleinitial || head.user?.middleinitial || '';
  const lastname = head.lastname || head.user?.lastname || '';
  const fullName = [firstname, middleinitial ? `${middleinitial}.` : '', lastname].filter(Boolean).join(' ') || 'Personnel';
  const email = head.Email || head.email || head.user?.Email || '';
  const profilepic = head.profilepic || head.user?.profilepic;

  const avatarUrl = profilepic
    ? (profilepic.startsWith('http') ? profilepic : `${API_BASE_URL}/uploads/profile-pics/${profilepic}`)
    : null;

  const initials = `${firstname.charAt(0) || ''}${lastname.charAt(0) || ''}`.toUpperCase() || 'P';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position.trim()) return;

    setIsSubmitting(true);

    const updated = {
      headid: head.headid,
      Position: position.trim(),
      officeid: head.officeid,
      // Preserve user personal details
      firstname: firstname,
      middleinitial: middleinitial,
      lastname: lastname,
      contactinfo: head.contactinfo || '',
    };

    try {
      const success = await onSave(updated);
      if (success !== false) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[50] p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <h2 className="text-base font-bold text-slate-900">Edit Office Personnel</h2>
            <p className="text-xs text-slate-500 mt-0.5">Update personnel role or position title</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Read-Only Personnel Summary Card */}
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <SmartUserAvatar
              user={head}
              fullName={fullName}
              size="w-11 h-11"
              textSize="text-sm font-bold"
              ring="border border-slate-200 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-900 truncate">{fullName}</p>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                  <UserCheck className="w-2.5 h-2.5" />
                  User
                </span>
              </div>
              {email && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Editable Position Field */}
          <div>
            <label htmlFor="position" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Position *
            </label>
            <input
              type="text"
              id="position"
              name="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              placeholder="e.g. Personnel, Coordinator, Dean"
              disabled={isSubmitting}
              required
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Only the position or office role can be updated here. Personal profile details are managed through the user account.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !position.trim()}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditOfficeHeadModal;

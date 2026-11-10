import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import axios from 'axios';
import { Search, GraduationCap, Building2, User, UserCheck, X, ChevronDown, ChevronUp, Send, Upload, Download, Eye, Trash2, CheckCircle2, AlertCircle, FileText, Loader2 } from 'lucide-react';
import StatusSlider from './StatusSlider';
import { officesAPI, requirementsAPI } from '../../utils/api';
import { API_BASE_URL } from '../../utils/apiBase';
import { useModal } from '../UI/ModalProvider';
import { useToast } from '../UI/Toast';
import CustomSelect from '../UI/CustomSelect';
import { isAcademicEntity } from '../../utils/entityHelpers';

function InspectionReqDescription({ code, description, isExpanded, onToggle }) {
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const checkOverflow = () => {
      if (!isExpanded && textRef.current) {
        setIsOverflowing(textRef.current.scrollHeight > textRef.current.clientHeight + 2);
      }
    };
    checkOverflow();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(checkOverflow);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [description, isExpanded]);

  const showToggle = isOverflowing || isExpanded;

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs font-extrabold text-slate-900">
          {code}
        </span>
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5 cursor-pointer leading-none"
          >
            <span>{isExpanded ? 'Show less' : 'Show more'}</span>
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      <p
        ref={textRef}
        className={`text-xs text-slate-600 mt-1 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}
      >
        {description}
      </p>
    </>
  );
}

export default function OfficeInspectionModal({
  office,
  onClose,
  onUpdateOffice,
  currentUser,
  isAdmin = false
}) {
  const { showAlert, showConfirm } = useModal();
  const { toast } = useToast();
  const officeid = office?.officeid || office?.id;

  const [loading, setLoading] = useState(true);
  const [hierarchy, setHierarchy] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedReqs, setExpandedReqs] = useState(new Set());
  const [commentsMap, setCommentsMap] = useState({});
  const [updatingReqId, setUpdatingReqId] = useState(null);
  const [removingReqId, setRemovingReqId] = useState(null);
  const [proofDocument, setProofDocument] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(office?.accreditationlevel || 'None');

  const handleRemoveRequirement = async (reqId, reqCode) => {
    const confirmMsg = reqCode
      ? `Remove standard "${reqCode}" from this office? This cannot be undone.`
      : 'Remove this requirement from the office? This cannot be undone.';
    const ok = await showConfirm(confirmMsg);
    if (!ok) return;
    try {
      setRemovingReqId(reqId);
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/offices/${officeid}/requirements/${reqId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      await fetchHierarchy();
      toast?.({
        title: 'Standard Removed',
        description: reqCode
          ? `Standard ${reqCode} was successfully removed from this office.`
          : 'Standard removed from office successfully.',
        variant: 'success',
        duration: 3000
      });
    } catch (err) {
      console.error('Failed to remove requirement from office', err);
      toast?.({
        title: 'Removal Failed',
        description: err?.response?.data?.message || 'Failed to remove requirement from office',
        variant: 'error',
        duration: 3000
      });
    } finally {
      setRemovingReqId(null);
    }
  };

  useEffect(() => {
    setCurrentLevel(office?.accreditationlevel || 'None');
  }, [office?.accreditationlevel]);

  // Fetch requirement compliance hierarchy for this office
  const fetchRequirements = async () => {
    if (!officeid) return;
    try {
      setLoading(true);
      const res = await officesAPI.getOfficeRequirements(officeid);
      const data = res?.data || res || [];

      setHierarchy(Array.isArray(data) ? data : []);

      // Build comments map
      const initialComments = {};
      (Array.isArray(data) ? data : []).forEach(area => {
        (area.criteria || area.Criteria || []).forEach(crit => {
          (crit.requirements || crit.Requirements || []).forEach(req => {
            const reqId = req.requirementid || req.id;
            initialComments[reqId] = req.comments || req.Comments || '';
          });
        });
      });
      setCommentsMap(initialComments);

      // Fetch proof document if any
      try {
        const proofRes = await officesAPI.getOfficeProofDocuments(officeid);
        if (proofRes?.data && proofRes.data.length > 0) {
          setProofDocument(proofRes.data[0]);
        }
      } catch (proofErr) {
        // Proof document API call best effort
      }
    } catch (err) {
      console.error('Failed to load office requirements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, [officeid]);

  // Compute overall compliance score
  const complianceStats = useMemo(() => {
    let total = 0;
    let complied = 0;
    let partial = 0;

    hierarchy.forEach(area => {
      (area.criteria || area.Criteria || []).forEach(crit => {
        (crit.requirements || crit.Requirements || []).forEach(req => {
          total += 1;
          const status = Number(req.Status || req.status || 3);
          if (status === 5) complied += 1;
          else if (status === 4) partial += 0.5;
        });
      });
    });

    const scorePct = total > 0 ? Math.round(((complied + partial) / total) * 100 * 10) / 10 : 0;
    return {
      total,
      scorePct,
      label: scorePct >= 100 ? 'Complied' : scorePct > 0 ? 'Partial' : 'Not Complied'
    };
  }, [hierarchy]);

  // Update compliance status for a requirement
  const handleStatusChange = async (reqId, nextStatusId) => {
    try {
      setUpdatingReqId(reqId);
      const currentComment = commentsMap[reqId] || '';

      const res = await officesAPI.updateRequirementStatus(officeid, reqId, {
        statusid: nextStatusId,
        comments: currentComment
      });

      if (res?.success) {
        if (showAlert) {
          showAlert({
            title: 'Compliance Status Updated',
            message: 'Requirement status updated successfully.',
            type: 'success'
          });
        }
        await fetchRequirements();
        if (onUpdateOffice) onUpdateOffice();
      } else {
        if (showAlert) {
          showAlert({
            title: 'Update Failed',
            message: res?.message || 'Failed to update compliance status.',
            type: 'error'
          });
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      if (showAlert) {
        showAlert({
          title: 'Update Error',
          message: err.response?.data?.message || err.message || 'Error updating status',
          type: 'error'
        });
      }
    } finally {
      setUpdatingReqId(null);
    }
  };

  // Submit private comment
  const handleSendComment = async (reqId) => {
    const commentText = commentsMap[reqId] || '';
    if (!commentText.trim()) return;

    try {
      setUpdatingReqId(reqId);
      // Fetch current status
      let currentStatus = 3;
      hierarchy.forEach(area => {
        (area.criteria || []).forEach(crit => {
          (crit.requirements || []).forEach(req => {
            if (Number(req.requirementid || req.id) === Number(reqId)) {
              currentStatus = Number(req.Status || req.status || 3);
            }
          });
        });
      });

      await officesAPI.updateRequirementStatus(officeid, reqId, {
        statusid: currentStatus,
        comments: commentText
      });

      if (showAlert) {
        showAlert({
          title: 'Comment Saved',
          message: 'Private comment updated successfully.',
          type: 'success'
        });
      }
      await fetchRequirements();
    } catch (err) {
      console.error('Failed to save comment:', err);
    } finally {
      setUpdatingReqId(null);
    }
  };

  const toggleExpand = (reqId) => {
    setExpandedReqs(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  };

  // Proof Document Upload Handler
  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingProof(true);
      const formData = new FormData();
      formData.append('document', file);
      formData.append('officeid', officeid);

      const res = await officesAPI.uploadProofDocument(formData);
      if (res?.success) {
        toast?.({
          title: 'Upload Successful',
          description: 'Proof document uploaded successfully.',
          variant: 'success',
          duration: 3000
        });
        await fetchRequirements();
      }
    } catch (err) {
      console.error('Failed to upload proof document:', err);
      toast?.({
        title: 'Upload Failed',
        description: err?.response?.data?.message || 'Failed to upload proof document.',
        variant: 'error',
        duration: 3000
      });
    } finally {
      setUploadingProof(false);
    }
  };

  const isAcademic = isAcademicEntity(office);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Bar (Photo 4 Top Bar) */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-4">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs ${
              isAcademic ? 'bg-cyan-50 text-cyan-600 border-cyan-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}>
              {isAcademic ? <GraduationCap className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {office?.officename || office?.officename || 'BSIT'}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                  isAcademic 
                    ? 'bg-blue-50 text-blue-700 border-blue-100' 
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                }`}>
                  {isAcademic ? 'Academic' : 'Non-Academic'}
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                  Event: {office?.eventname || office?.eventname || 'PAASCU-COPY'}
                </span>
                {isAcademic && (
                  isAdmin ? (
                    <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] font-semibold text-slate-500">Accreditation:</span>
                      <select
                        value={currentLevel}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setCurrentLevel(val);
                          try {
                            await officesAPI.updateLevel(officeid, val);
                            if (onUpdateOffice) onUpdateOffice({ ...office, accreditationlevel: val });
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md py-0.5 px-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                      >
                        {['None', 'Candidate', 'Level I', 'Level II', 'Level III', 'Level IV'].map((lvl) => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      {currentLevel || 'None'}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Personnel & External Auditor Badges */}
          {(() => {
            const currentUid = Number(currentUser?.userid ?? currentUser?.id ?? 0);
            const isAuditor = currentUser?.roleid === 4 || currentUser?.rolename?.toLowerCase()?.includes('auditor') || Boolean(currentUser?.isExternalAuditor);
            const resolvedIsAdmin = Boolean(isAdmin || ((currentUser?.roleid === 1 || currentUser?.rolename?.toLowerCase() === 'admin') && !isAuditor));

            let showPersonnel = false;
            let displayHeadName = '';
            if (resolvedIsAdmin) {
              showPersonnel = true;
              displayHeadName = office?.head_name || office?.HeadName || (Array.isArray(office?.heads) && office.heads.length > 0 ? office.heads.map(h => h.full_name || `${h.firstname || ''} ${h.lastname || ''}`.trim() || h.firstname).filter(Boolean).join(', ') : 'Unassigned');
            } else if (!isAuditor) {
              const isUserHead = (office?.heads && Array.isArray(office.heads) && office.heads.some(h => Number(h.headid || h.userid || h.id) === currentUid)) ||
                                 (Number(office?.headid) === currentUid);
              if (isUserHead) {
                showPersonnel = true;
                displayHeadName = currentUser?.firstname ? `${currentUser.firstname} ${currentUser.lastname || ''}`.trim() : 'Assigned to you';
              }
            }

            let showAuditor = false;
            let displayAuditorName = '';
            if (resolvedIsAdmin) {
              showAuditor = true;
              displayAuditorName = office?.auditor_name || 'Unassigned';
            } else if (isAuditor) {
              const isUserAuditor = (Number(office?.auditor_id || office?.auditorid) === currentUid) ||
                                    (office?.auditor_name && currentUser?.firstname && office.auditor_name.toLowerCase().includes(currentUser.firstname.toLowerCase()));
              if (isUserAuditor) {
                showAuditor = true;
                displayAuditorName = currentUser?.firstname ? `${currentUser.firstname} ${currentUser.lastname || ''}`.trim() : 'Assigned to you';
              }
            }

            if (!showPersonnel && !showAuditor) return null;

            return (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 text-xs border-r border-slate-200 pr-6">
                  {/* Personnel */}
                  {showPersonnel && (
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">PERSONNEL</span>
                        <span className="font-bold text-slate-800">
                          {displayHeadName}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* External Auditor */}
                  {showAuditor && (
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-[9px] font-extrabold uppercase tracking-wider text-blue-600">EXTERNAL AUDITOR</span>
                        <span className="font-bold text-slate-900">
                          {displayAuditorName}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

            {/* Score Pill */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">COMPLIANCE</span>
                <span className="text-lg font-black text-rose-600 font-mono">
                  {complianceStats.scorePct}%
                </span>
              </div>

              <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                complianceStats.scorePct >= 100 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : complianceStats.scorePct > 0 
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {complianceStats.label}
              </span>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Standards Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Standards</h2>
            <p className="text-xs text-slate-500">Browse areas, sub areas, and standards.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="w-48">
              <CustomSelect
                size="sm"
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'complied', label: 'Complied' },
                  { value: 'partial', label: 'Partially Complied' },
                  { value: 'not', label: 'Not Complied' }
                ]}
                placeholder="All statuses"
              />
            </div>

            {/* Search Box */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search standards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Requirement Tree Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50">
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2 text-xs font-semibold">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span>Loading requirement compliance hierarchy...</span>
            </div>
          ) : hierarchy.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              No requirement structure assigned to this office yet.
            </div>
          ) : (
            hierarchy.map((area) => {
              const areaid = area.areaid || area.id;
              const criteriaList = area.criteria || area.Criteria || [];

              return (
                <div key={areaid} className="space-y-4">
                  {/* Area Header Banner */}
                  <div className="bg-blue-600 text-white rounded-xl p-4 shadow-xs">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-200">
                      {area.areacode || area.code ? `AREA ${area.areacode || area.code}` : 'AREA'}
                    </h3>
                    <h2 className="text-base font-black text-white mt-0.5">
                      {area.areaname || area.name || 'Philosophy and Objectives'}
                    </h2>
                  </div>

                  {/* Criteria & Requirements Cards */}
                  {criteriaList.map((crit) => {
                    const critId = crit.criteriaid || crit.id;
                    const reqs = crit.requirements || crit.Requirements || [];

                    return (
                      <div key={critId} className="space-y-3 pl-1">
                        {/* Criteria Header */}
                        <div className="bg-slate-800 text-white rounded-xl p-3.5 shadow-2xs">
                          <h4 className="text-xs font-bold text-slate-200">
                            {crit.criteriacode || crit.code ? `${crit.criteriacode || crit.code}` : ''}
                          </h4>
                          <p className="text-xs font-semibold text-white mt-0.5">
                            {crit.criterianame || crit.name || ''}
                          </p>
                        </div>

                        {/* Requirements Items */}
                        <div className="space-y-3">
                          {reqs.map((req) => {
                            const reqId = req.requirementid || req.id;
                            const statusid = Number(req.Status || req.status || 3);
                            const isExpanded = expandedReqs.has(reqId);
                            const isUpdating = updatingReqId === reqId;

                            // Filter check
                            if (statusFilter === 'complied' && statusid !== 5) return null;
                            if (statusFilter === 'partial' && statusid !== 4) return null;
                            if (statusFilter === 'not' && statusid !== 3) return null;

                            const q = searchTerm.trim().toLowerCase();
                            if (q) {
                              const desc = String(req.Description || req.description || '').toLowerCase();
                              const code = String(req.requirementcode || req.code || '').toLowerCase();
                              if (!desc.includes(q) && !code.includes(q)) return null;
                            }

                            return (
                              <div
                                key={reqId}
                                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row gap-5 items-start justify-between"
                              >
                                {/* Left: Status Slider (Photo 4) */}
                                <div className="shrink-0 pt-0.5">
                                  <StatusSlider
                                    statusid={statusid}
                                    onChange={(nextVal) => handleStatusChange(reqId, nextVal)}
                                    updating={isUpdating}
                                  />
                                </div>

                                {/* Center: Description & Comments */}
                                <div className="flex-1 min-w-0">
                                  <InspectionReqDescription
                                    code={req.requirementcode || req.code || `Requirement #${reqId}`}
                                    description={req.Description || req.description || ''}
                                    isExpanded={isExpanded}
                                    onToggle={() => toggleExpand(reqId)}
                                  />

                                  {/* Private Comment Box */}
                                  <div className="mt-3 flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Add private comment..."
                                      value={commentsMap[reqId] || ''}
                                      onChange={(e) => setCommentsMap({ ...commentsMap, [reqId]: e.target.value })}
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendComment(reqId); }}
                                      className="flex-1 pl-3.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSendComment(reqId)}
                                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 transition-colors"
                                      title="Save private comment"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Right: Evidence Badge & Personnel */}
                                <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Uploaded {req.uploadedCount || '2/2'}
                                  </span>

                                  <div className="flex items-center -space-x-1.5">
                                    <div className="h-7 w-7 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-emerald-700 text-xs font-bold">
                                      <UserCheck className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="h-7 w-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-blue-700 text-xs font-bold">
                                      <User className="h-3.5 w-3.5" />
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={removingReqId === reqId}
                                    onClick={() => handleRemoveRequirement(reqId, req.requirementcode || req.code)}
                                    className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {removingReqId === reqId ? 'Removing...' : 'Remove'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Proof Document Toolbar (Photo 4 Footer) */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">PROOF DOCUMENT</span>
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
              proofDocument ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {proofDocument ? 'Uploaded' : 'No Document Attached'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
              <input type="file" onChange={handleProofUpload} className="hidden" />
            </label>

            {proofDocument && (
              <>
                <a
                  href={proofDocument.filepath}
                  download
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>

                <a
                  href={proofDocument.filepath}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </a>
              </>
            )}

            <button
              type="button"
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

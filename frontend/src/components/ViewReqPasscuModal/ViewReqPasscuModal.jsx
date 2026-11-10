import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { renderAsync } from 'docx-preview';
import api, { usersAPI, requirementsAPI, officesAPI, personnelAssignmentsAPI, eventsAPI } from '../../utils/api';
import { Lock, Unlock } from 'lucide-react';
import { API_BASE_URL } from '../../utils/apiBase';
import { dataCache, CacheKeys } from '../../utils/dataCache';
import { useLiveRefresh } from '../../utils/liveSync';

import { useModal } from "../UI/ModalProvider";
import { useToast } from '../UI/Toast';
import ModalHeader from './ModalHeader';
import OfficeInfoBar from './OfficeInfoBar';
import RequirementsToolbar from './RequirementsToolbar';
import ProofFooterBar from './ProofFooterBar';
import RequirementsTree from './RequirementsTree';
import ProofDocumentViewerModal from './ProofDocumentViewerModal';
import UserFileViewerModal from './UserFileViewerModal';
import AvatarPopupMenu from './AvatarPopupMenu';
import SendNotificationModal from './SendNotificationModal';
import SubmissionViewer from './SubmissionViewer';
import UserFilesGridModal from './UserFilesGridModal';

export default function ViewReqPASSCUModal({
    isOpen,
    onClose,
    office,
    deepLink = null,
    onDeepLinkHandled,
    onEditOffice,
    onAddRequirements,
    onDeleteOffice,
}) {
    const { toast } = useToast();
    const [showMenu, setShowMenu] = useState(false);
    const [requirements, setRequirements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [officeData, setOfficeData] = useState(office);

    useEffect(() => {
        setOfficeData(office);
    }, [office]);

    const handleUpdateOfficeLevel = async (newLevel) => {
        const officeid = officeData?.id || officeData?.officeid || office?.id;
        if (!officeid) return;
        try {
            await officesAPI.updateLevel(officeid, newLevel);
            setOfficeData(prev => ({
                ...prev,
                accreditationlevel: newLevel,
            }));
            showAlert(`Accreditation level updated to ${newLevel}`, 'success');
        } catch (err) {
            console.error('Failed to update accreditation level:', err);
            showAlert('Failed to update accreditation level', 'error');
        }
    };
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [commentInput, setCommentInput] = useState("");
    const [savingComment, setSavingComment] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [submissionFilter, setSubmissionFilter] = useState("all");
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedRequirement, setSelectedRequirement] = useState(null);
    const [assignedUsersMap, setAssignedUsersMap] = useState({});
    const [personnelAssignments, setPersonnelAssignments] = useState([]);
    const [proofFile, setProofFile] = useState(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [proofFileName, setProofFileName] = useState("");
    const [proofFileUrl, setProofFileUrl] = useState("");
    const [persistedProof, setPersistedProof] = useState(null);
    const [showDocViewer, setShowDocViewer] = useState(false);
    const fileInputRef = useRef();
    const [excelHtml, setExcelHtml] = useState(null);
    const [excelHtmlLoading, setExcelHtmlLoading] = useState(false);
    const [excelPreviewError, setExcelPreviewError] = useState(null);
    const [docxPreviewLoading, setDocxPreviewLoading] = useState(false);
    const [docxPreviewError, setDocxPreviewError] = useState(null);
    const [userDocxPreviewLoading, setUserDocxPreviewLoading] = useState(false);
    const [userDocxPreviewError, setUserDocxPreviewError] = useState(null);
    const docxPreviewRef = useRef(null);
    const userDocxPreviewRef = useRef(null);
    const [userUploadingReqId, setUserUploadingReqId] = useState(null);
    const userReqFileInputRef = useRef();
    const [selectedUserFile, setSelectedUserFile] = useState(null);
    const [showUserFileViewer, setShowUserFileViewer] = useState(false);
    const [avatarPopup, setAvatarPopup] = useState(null); // { user, requirementid, rect }
    const [sendingNotification, setSendingNotification] = useState(false);
    const [showNotifForm, setShowNotifForm] = useState(null); // { user, requirementid }
    const [notifTitle, setNotifTitle] = useState('');
    const [notifMessage, setNotifMessage] = useState('');
    const [showSubmissionViewer, setShowSubmissionViewer] = useState(false);
    const [selectedSubmissionRequirement, setSelectedSubmissionRequirement] = useState(null);
    const [uploadProgressMap, setUploadProgressMap] = useState({});
    const [unsubmittingReqId, setUnsubmittingReqId] = useState(null);
    const [unsubmittingProof, setUnsubmittingProof] = useState(false);
    const [removingReqId, setRemovingReqId] = useState(null);
    const [expandedReqs, setExpandedReqs] = useState([]);
    const [gridModalData, setGridModalData] = useState(null);
    const pendingStatusUpdatesRef = useRef(new Map());

    const currentRoleId = Number(currentUser?.roleid || 0);
    const isAdmin = currentRoleId === 1;
    const isOfficeHead = currentRoleId === 3;
    const isStandardUser = currentRoleId === 2;
    const isAuditor = currentRoleId === 4 || 
                      String(currentUser?.rolename || '').toLowerCase().includes('auditor') || 
                      currentUser?.isExternalAuditor;
    const isPersonnel = !isAdmin && !isAuditor;

    const handleOpenUserFilesGridModal = async (user, requirementid, initialFiles) => {
        const req = requirements.find((r) => Number(r.requirementid) === Number(requirementid)) || selectedSubmissionRequirement;
        const cacheKey = CacheKeys.userFiles(requirementid, user.userid, office?.id);
        const rawCachedFiles = (Array.isArray(initialFiles) && initialFiles.length > 0) 
            ? initialFiles 
            : dataCache.get(cacheKey);
        const cachedFiles = Array.isArray(rawCachedFiles)
            ? (isAuditor ? rawCachedFiles.filter(f => f && f.reviewstatus === 'approved') : rawCachedFiles)
            : [];

        if (cachedFiles.length > 0) {
            setGridModalData({ user, requirement: req, files: cachedFiles });
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/requirements/${requirementid}/user-file/${user.userid}${office?.id ? `?officeid=${office.id}` : ''}`, {
                headers: { Authorization: token ? `Bearer ${token}` : '' }
            });
            if (res.data && res.data.success) {
                const rawFreshFiles = res.data.files || (res.data.file ? [res.data.file] : []);
                const freshFiles = isAuditor
                    ? rawFreshFiles.filter(f => f && f.reviewstatus === 'approved')
                    : rawFreshFiles;
                dataCache.set(cacheKey, freshFiles);
                setGridModalData({ user, requirement: req, files: freshFiles });
            } else if (!cachedFiles || cachedFiles.length === 0) {
                await showAlert('No files found for this user.');
            }
        } catch (err) {
            console.error('Error fetching user files:', err);
            if (!cachedFiles || cachedFiles.length === 0) {
                await showAlert('Error fetching user files.');
            }
        }
    };

    // If the currently logged-in user is an auditor and is present in the provided users list,
    // open the files grid modal for them automatically after opening the submission viewer.
    const openOwnGridIfAuditor = (usersList, requirementid) => {
        try {
            if (!currentUser || !isAuditor || !Array.isArray(usersList)) return;
            const found = usersList.find((u) => Number(u?.userid) === Number(currentUser?.userid));
            if (found) {
                // open grid modal for current user
                handleOpenUserFilesGridModal(found, requirementid);
            }
        } catch (e) {
            // silent
        }
    };
    const [submissionViewerUsers, setSubmissionViewerUsers] = useState(null);
    const deepLinkAppliedRef = useRef(false);

    const { showAlert, showConfirm } = useModal();

    const toggleExpandReq = (requirementid) => {
        setExpandedReqs(prev => {
            if (prev.includes(requirementid)) return prev.filter(id => id !== requirementid);
            return [...prev, requirementid];
        });
    };

    const [officeAuditors, setOfficeAuditors] = useState([]);
    const [auditorAssignedAreaIds, setAuditorAssignedAreaIds] = useState(new Set());

    useEffect(() => {
        const officeid = office?.id || officeData?.id || officeData?.officeid;
        if (!isOpen || !officeid) return;
        let mounted = true;
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        fetch(`${API_BASE_URL}/api/areas/auditors/office/${officeid}`, { headers })
            .then(res => res.json())
            .then(data => {
                if (mounted && data.success) {
                    setOfficeAuditors(data.auditors || []);
                }
            })
            .catch(() => {});

        return () => { mounted = false; };
    }, [isOpen, office?.id, officeData?.id, officeData?.officeid]);

    useEffect(() => {
        if (!isOpen || !currentUser || !isAuditor) return;
        const targetUserId = currentUser.userid ?? currentUser.id ?? currentUser.userid;
        if (!targetUserId) return;
        let mounted = true;

        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        fetch(`${API_BASE_URL}/api/areas/assignments/${targetUserId}`, { headers })
            .then(res => res.json())
            .then(data => {
                if (mounted && data.success) {
                    const ids = new Set((data.assignments || []).map(a => Number(a.areaid ?? a.areaid)));
                    setAuditorAssignedAreaIds(ids);
                }
            })
            .catch(() => {});

        return () => { mounted = false; };
    }, [isOpen, currentUser, isAuditor]);

    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const response = await usersAPI.getLoggedInUser();
                if (response.success) {
                    setCurrentUser(response.user);
                }
            } catch (error) {
                console.error('Error fetching current user:', error);
            }
        };
        if (isOpen) {
            fetchCurrentUser();
        }
    }, [isOpen]);

    const [myAssignments, setMyAssignments] = useState(null);

    useEffect(() => {
        if (!isOpen || !currentUser) return;
        let cancelled = false;
        personnelAssignmentsAPI.getMyAssignments()
            .then((data) => {
                if (!cancelled && data && data.success) {
                    setMyAssignments(data);
                }
            })
            .catch((err) => {
                console.warn('Could not fetch personnel assignments:', err);
            });
        return () => { cancelled = true; };
    }, [isOpen, currentUser]);

    const myAssignedReqIds = useMemo(() => new Set((myAssignments?.assignedRequirementIds || []).map(Number)), [myAssignments]);
    const myAssignedCritIds = useMemo(() => new Set((myAssignments?.assignedCriteriaIds || []).map(Number)), [myAssignments]);
    const myAssignedAreaIds = useMemo(() => new Set((myAssignments?.assignedAreaIds || []).map(Number)), [myAssignments]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showStatusDropdown && !event.target.closest('.status-dropdown')) {
                setShowStatusDropdown(false);
            }
            if (avatarPopup && !event.target.closest('.avatar-popup-menu')) {
                setAvatarPopup(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showStatusDropdown, avatarPopup]);

    const handleProofFileChange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setProofFile(file);
            setUploadingProof(true);
            
            const formData = new FormData();
            formData.append('file', file);
            
            const token = localStorage.getItem('token');
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/officedocuments/${office.id}/proof`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                const data = await res.json();
                if (data.success && data.url) {
                    const fullUrl = data.url.startsWith('http') ? data.url : `${API_BASE_URL}${data.url}`;
                    setProofFileUrl(fullUrl);
                    setProofFileName(data.filename);
                    setPersistedProof({ filename: data.filename, url: fullUrl });
                    toast?.({
                        title: 'Upload Successful',
                        description: 'Proof document uploaded successfully.',
                        variant: 'success',
                        duration: 3000
                    });
                    try {
                        await fetchOfficeRequirements();
                    } catch (fetchErr) {
                        console.warn('Post-proof fetchOfficeRequirements warning:', fetchErr);
                    }
                } else {
                    toast?.({
                        title: 'Upload Failed',
                        description: data.message || 'Failed to upload proof document',
                        variant: 'error',
                        duration: 3000
                    });
                }
            } catch (err) {
                console.error('Upload error:', err);
                toast?.({
                    title: 'Upload Failed',
                    description: 'Failed to upload proof document',
                    variant: 'error',
                    duration: 3000
                });
            } finally {
                setUploadingProof(false);
                setProofFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        }
    };

    useEffect(() => {
        const fetchProof = async () => {
            if (isOpen && office) {
                try {
                    const res = await api.get(`/api/officedocuments/${office.id}/proof`);
                    if (res.data && res.data.success) {
                        setPersistedProof({
                            filename: res.data.filename,
                            url: `${API_BASE_URL}${res.data.url}`
                        });
                        setProofFileName(res.data.filename);
                        setProofFileUrl(`${API_BASE_URL}${res.data.url}`);
                    } else {
                        setPersistedProof(null);
                        setProofFileName("");
                        setProofFileUrl("");
                    }
                } catch (err) {
                    setPersistedProof(null);
                    setProofFileName("");
                    setProofFileUrl("");
                }
            }
        };
        if (isOpen && office) {
            setOfficeData(office);
            const cacheKey = CacheKeys.officeReqs(office.id);
            const cached = dataCache.get(cacheKey);
            
            if (cached && Array.isArray(cached.reqs) && cached.reqs.length > 0) {
                // Instant 0ms display from cache
                setRequirements(cached.reqs);
                if (cached.assignedMap) setAssignedUsersMap(cached.assignedMap);
                if (cached.officeData) setOfficeData(cached.officeData);
                if (cached.persistedProof) {
                    setPersistedProof(cached.persistedProof);
                    setProofFileName(cached.persistedProof.filename || "");
                    setProofFileUrl(cached.persistedProof.url || "");
                }
                setLoading(false);
                // Background revalidation silently
                fetchOfficeRequirements(true);
            } else {
                fetchOfficeRequirements(false);
            }
            fetchProof();
        }
    }, [isOpen, office]);

    const computeOfficeStatsFromReqs = (reqsList) => {
        const total = Array.isArray(reqsList) ? reqsList.length : 0;
        if (total === 0) {
            return {
                totalrequirements: 0,
                compliedcount: 0,
                partiallycompliedcount: 0,
                notcompliedcount: 0,
                compliancepercent: 0,
                overallstatus: 'No Standards'
            };
        }
        let complied = 0;
        let partially = 0;
        let notComplied = 0;
        reqsList.forEach(r => {
            const s = Number(r.ComplianceStatusID ?? r.compliancestatusid ?? 3);
            if (s === 5) complied++;
            else if (s === 4) partially++;
            else notComplied++;
        });
        const compliancepercent = Number((((complied * 100) + (partially * 50)) / total).toFixed(2));
        let overallstatus = 'Partially Complied';
        if (complied === total) overallstatus = 'Complied';
        else if (notComplied === total) overallstatus = 'Not Complied';
        return {
            totalrequirements: total,
            compliedcount: complied,
            partiallycompliedcount: partially,
            notcompliedcount: notComplied,
            compliancepercent,
            overallstatus
        };
    };

    const fetchOfficeRequirements = async (isBackground = null, options = {}) => {
        if (!office?.id) return;
        const shouldBeSilent = isBackground !== null 
            ? Boolean(isBackground) 
            : Boolean(requirements && requirements.length > 0);
        if (!shouldBeSilent) setLoading(true);
        try {
            const response = await api.get(`/api/offices/${office.id}/requirements`);
            const now = Date.now();
            const reqs = (response.data.data || []).map((req) => {
                const rId = Number(req.requirementid);
                const pending = pendingStatusUpdatesRef.current.get(rId);
                let statusid = Number(
                    req.ComplianceStatusID ??
                    req.complianceStatusId ??
                    req.compliancestatusid ??
                    req.Status ??
                    req.status ??
                    3
                );
                statusid = [3, 4, 5].includes(statusid) ? statusid : 3;

                if (pending) {
                    if (pending.inFlight || (now - pending.timestamp < 4000)) {
                        statusid = pending.statusId;
                    } else {
                        pendingStatusUpdatesRef.current.delete(rId);
                    }
                }

                const statusName = statusid === 5 ? 'Complied' : statusid === 4 ? 'Partially Complied' : 'Not Complied';

                return {
                    ...req,
                    requirementid: req.requirementid,
                    compliancestatusid: statusid,
                    ComplianceStatusID: statusid,
                    ComplianceStatus: pending ? statusName : (req.ComplianceStatus ?? req.complianceStatus ?? req.ComplianceStatusName ?? req.compliancestatusname ?? statusName),
                    comments: req.comments ?? req.Comments ?? '',
                };
            });
            setRequirements(reqs);

            let assignedMap = assignedUsersMap;
            if (!options.skipAssignedUsers || !assignedUsersMap || Object.keys(assignedUsersMap).length === 0) {
                assignedMap = {};
                await Promise.all(reqs.map(async (req) => {
                    try {
                        const assignedRes = await requirementsAPI.getAssignedUsers(req.requirementid, office.id);
                        assignedMap[req.requirementid] = assignedRes.users || assignedRes.data || [];
                    } catch (err) {
                        console.error(`Error fetching assigned users for req ${req.requirementid}:`, err);
                        assignedMap[req.requirementid] = [];
                    }
                }));
                setAssignedUsersMap(assignedMap);
            }
            
            let updatedOfficeData = null;
            try {
                const officeResponse = await api.get(`/api/offices/${office.id}`);
                if (officeResponse.data) {
                    const hasPending = pendingStatusUpdatesRef.current.size > 0;
                    const localStats = hasPending ? computeOfficeStatsFromReqs(reqs) : null;
                    updatedOfficeData = {
                        overallstatus: localStats ? localStats.overallstatus : officeResponse.data.overallstatus,
                        compliancepercent: localStats ? localStats.compliancepercent : officeResponse.data.compliancepercent,
                        totalrequirements: localStats ? localStats.totalrequirements : officeResponse.data.totalrequirements,
                        eventid: officeResponse.data.eventid || office.eventid || null,
                        eventname: officeResponse.data.eventname || office.eventname || null,
                        eventcode: officeResponse.data.eventcode || office.eventcode || null,
                        department_name: officeResponse.data.department_name || officeResponse.data.DepartmentName || office.department_name || null,
                        program_type_name: officeResponse.data.program_type_name || office.program_type_name || null,
                        heads: officeResponse.data.heads || office.heads || [],
                    };
                    setOfficeData(prev => ({ ...prev, ...updatedOfficeData }));
                }
            } catch (officeErr) {
                console.warn('Error fetching office details:', officeErr);
            }

            // Load personnel assignments for the event so Area and Sub-area personnel markers display
            const effectiveEventId = updatedOfficeData?.eventid || office.eventid || office.event_id || reqs?.[0]?.eventid;
            if (effectiveEventId && (!options.skipAssignedUsers || personnelAssignments.length === 0)) {
                try {
                    const paRes = await personnelAssignmentsAPI.getByEvent(effectiveEventId);
                    if (paRes?.success) {
                        setPersonnelAssignments(paRes.data || []);
                    }
                } catch (paErr) {
                    console.warn('Error fetching personnel assignments for event:', paErr);
                }
            }

            // Save to in-memory data cache
            dataCache.set(CacheKeys.officeReqs(office.id), {
                reqs,
                assignedMap,
                officeData: updatedOfficeData ? { ...office, ...updatedOfficeData } : office,
                persistedProof: persistedProof
            });
        } catch (error) {
            console.error('Error fetching requirements:', error);
            if (!shouldBeSilent) setRequirements([]);
        } finally {
            if (!shouldBeSilent) setLoading(false);
        }
    };

    // Real-time live synchronization while modal is open
    useLiveRefresh(async () => {
        if (!isOpen || !office?.id) return;
        // Skip full refetch while an optimistic status update is actively in flight
        for (const entry of pendingStatusUpdatesRef.current.values()) {
            if (entry.inFlight) return;
        }
        await fetchOfficeRequirements(true);

        // If UserFilesGridModal is open, silently refresh its files
        if (gridModalData?.requirement?.requirementid && gridModalData?.user?.userid) {
            try {
                const reqId = gridModalData.requirement.requirementid;
                const userid = gridModalData.user.userid;
                const res = await api.get(`/api/requirements/${reqId}/user-file/${userid}${office?.id ? `?officeid=${office.id}` : ''}`);
                if (res.data && res.data.success) {
                    const refreshedFiles = res.data.files || (res.data.file ? [res.data.file] : []);
                    setGridModalData(prev => prev ? { ...prev, files: refreshedFiles } : null);
                }
            } catch (e) {
                // ignore
            }
        }
    }, { entityTypes: ['requirements', 'compliance', 'documents', 'offices', 'all'], deps: [isOpen, office?.id, gridModalData?.requirement?.requirementid, gridModalData?.user?.userid] });

    // Unsubmit (delete) user-uploaded file for a requirement
    const handleUnsubmitUserFile = async (requirementid, fileId = null) => {
        if (!currentUser || !currentUser.userid) {
            await showAlert('No user information available. Please reload and try again.');
            return false;
        }
        const ok = await showConfirm('Are you sure you want to delete this standard file?');
        if (!ok) return false;
        setUnsubmittingReqId(requirementid);
        try {
            const token = localStorage.getItem('token');
            const officeParam = office?.id ? `officeid=${office.id}` : '';
            const fileParam = fileId ? `fileId=${fileId}` : '';
            const queryStr = [officeParam, fileParam].filter(Boolean).join('&');
            const url = queryStr
                ? `${API_BASE_URL}/api/requirements/${requirementid}/file/${currentUser.userid}?${queryStr}`
                : `${API_BASE_URL}/api/requirements/${requirementid}/file/${currentUser.userid}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
            });
            let data = {};
            try { data = await res.json(); } catch (e) { /* ignore JSON parse errors */ }
            if (res.ok && data.success) {
                toast({
                    title: 'Deleted',
                    description: 'Standard file deleted successfully.',
                    variant: 'success'
                });

                // Invalidate dataCache keys immediately
                dataCache.invalidate(CacheKeys.officeReqs(office?.id));
                dataCache.invalidate(CacheKeys.allUserFilesForReq(requirementid, office?.id));
                dataCache.invalidate(CacheKeys.userFiles(requirementid, currentUser.userid, office?.id));
                dataCache.invalidate(CacheKeys.userFiles(requirementid, currentUser.userid));

                // Instantly update assigned users map optimistically so green avatar checkmark disappears with 0ms delay!
                const rem = Number(data.remainingCount);
                const hasMore = !isNaN(rem) ? rem > 0 : false;
                setAssignedUsersMap(prev => {
                    const reqUsers = prev[requirementid] || [];
                    const updatedUsers = reqUsers.map(u => {
                        if (Number(u.userid) === Number(currentUser.userid)) {
                            return { ...u, hasuploaded: hasMore };
                        }
                        return u;
                    });
                    return { ...prev, [requirementid]: updatedUsers };
                });
                setSubmissionViewerUsers(prev => {
                    if (!prev) return prev;
                    return prev.map(u => {
                        if (Number(u.userid) === Number(currentUser.userid)) {
                            return { ...u, hasuploaded: hasMore };
                        }
                        return u;
                    });
                });

                // Fetch fresh assigned users from server in background
                const assignedRes = await requirementsAPI.getAssignedUsers(requirementid, office?.id);
                if (assignedRes?.success) {
                    const freshUsers = assignedRes.users || assignedRes.data || [];
                    setAssignedUsersMap(prev => ({
                        ...prev,
                        [requirementid]: freshUsers
                    }));
                    setSubmissionViewerUsers(freshUsers);
                }
                return true;
            } else if (res.status === 404) {
                console.warn('Unsubmit: file not found on server');
                toast({
                    title: 'Notice',
                    description: 'File was already removed.',
                    variant: 'info'
                });
                dataCache.invalidate(CacheKeys.officeReqs(office?.id));
                dataCache.invalidate(CacheKeys.allUserFilesForReq(requirementid, office?.id));
                dataCache.invalidate(CacheKeys.userFiles(requirementid, currentUser.userid, office?.id));
                dataCache.invalidate(CacheKeys.userFiles(requirementid, currentUser.userid));
                return true;
            } else {
                console.warn('Unsubmit: server returned error', res.status, data);
                await showAlert(data.message || 'Failed to delete file.');
                return false;
            }
        } catch (err) {
            console.error('Unsubmit error:', err);
            await showAlert('Failed to delete file.');
            return false;
        } finally {
            try { await fetchOfficeRequirements(); } catch (e) { console.error('Refresh after unsubmit failed', e); }
            setUnsubmittingReqId(null);
        }
    };

    const handleStatusChange = async (reqId, newStatusId) => {
        const numReqId = Number(reqId);
        const nextStatusId = Number(newStatusId);
        const reqUsers = assignedUsersMap[reqId] || [];
        const hasUserUploaded = reqUsers.some(u => u?.hasuploaded === 1 || u?.hasuploaded === true || Number(u?.totalfiles) > 0);
        const currentReq = (requirements || []).find(r => Number(r.requirementid) === numReqId);
        const hasProofDoc = currentReq && Boolean(currentReq.documentproof || currentReq.ProofDocument || currentReq.hasProof || currentReq.has_proof || currentReq.file_url);

        if (!hasUserUploaded && !hasProofDoc) {
            await showAlert('Cannot change compliance status: Proof document must be uploaded for this standard first.');
            return;
        }

        const prevStatusId = Number(currentReq?.ComplianceStatusID ?? currentReq?.compliancestatusid ?? 3);
        const prevStatusName = currentReq?.ComplianceStatus || (prevStatusId === 5 ? 'Complied' : prevStatusId === 4 ? 'Partially Complied' : 'Not Complied');
        const nextStatusName = nextStatusId === 5 ? 'Complied' : nextStatusId === 4 ? 'Partially Complied' : 'Not Complied';
        const reqCode = currentReq?.requirementcode || currentReq?.code || '';

        // Record pending optimistic update so background sync never reverts it
        pendingStatusUpdatesRef.current.set(numReqId, {
            statusId: nextStatusId,
            statusName: nextStatusName,
            inFlight: true,
            timestamp: Date.now()
        });

        // Optimistically update requirements & office stats immediately (0ms delay)
        const updatedReqs = (requirements || []).map(req =>
            Number(req.requirementid) === numReqId
                ? {
                    ...req,
                    compliancestatusid: nextStatusId,
                    ComplianceStatusID: nextStatusId,
                    ComplianceStatus: nextStatusName
                  }
                : req
        );
        setRequirements(updatedReqs);

        const nextStats = computeOfficeStatsFromReqs(updatedReqs);
        setOfficeData(prev => ({
            ...prev,
            ...nextStats
        }));

        toast?.({
            title: 'Compliance Status Updated',
            description: reqCode
                ? `Standard ${reqCode} set to ${nextStatusName}.`
                : `Compliance status set to ${nextStatusName}.`,
            variant: nextStatusId === 5 ? 'success' : nextStatusId === 4 ? 'warning' : 'info',
            duration: 2500
        });

        if (office?.id) {
            const existingCache = dataCache.get(CacheKeys.officeReqs(office.id));
            if (existingCache) {
                dataCache.set(CacheKeys.officeReqs(office.id), {
                    ...existingCache,
                    reqs: updatedReqs,
                    officeData: { ...(existingCache.officeData || office), ...nextStats }
                });
            }
        }

        try {
            await api.put(`/api/offices/${office.id}/requirements/${reqId}/status`, {
                statusid: nextStatusId
            });
            pendingStatusUpdatesRef.current.set(numReqId, {
                statusId: nextStatusId,
                statusName: nextStatusName,
                inFlight: false,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error updating status:', error);
            pendingStatusUpdatesRef.current.delete(numReqId);
            setRequirements(prev => {
                const rolledBack = prev.map(req =>
                    Number(req.requirementid) === numReqId
                        ? {
                            ...req,
                            compliancestatusid: prevStatusId,
                            ComplianceStatusID: prevStatusId,
                            ComplianceStatus: prevStatusName
                          }
                        : req
                );
                setOfficeData(curr => ({ ...curr, ...computeOfficeStatsFromReqs(rolledBack) }));
                return rolledBack;
            });
            await showAlert(error.response?.data?.message || error.response?.data?.details || 'Failed to update compliance status');
        }
    };

    const handleCommentClick = (req) => {
        setEditingCommentId(req.requirementid);
        setCommentInput(req.comments || "");
    };

    const handleCommentInputChange = (e) => {
        setCommentInput(e.target.value);
    };

    const handleCommentSave = async (req) => {
        setSavingComment(true);
        try {
            await api.put(`/api/offices/${office.id}/requirements/${req.requirementid}/status`, {
                statusid: req.ComplianceStatusID || 3,
                comments: commentInput
            });
            await fetchOfficeRequirements();
            setEditingCommentId(null);
            toast?.({
                title: 'Comment Saved',
                description: 'Your comment has been saved successfully.',
                variant: 'success',
                duration: 2500
            });
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Failed to save comment';
            await showAlert(message);
        } finally {
            setSavingComment(false);
        }
    };

    const handleCommentClear = async (req) => {
        if (!isAdmin || !req?.requirementid) return;
        const ok = await showConfirm('Clear this comment? This cannot be undone.');
        if (!ok) return;

        setSavingComment(true);
        try {
            await api.put(`/api/offices/${office.id}/requirements/${req.requirementid}/status`, {
                statusid: req.ComplianceStatusID || 3,
                comments: ''
            });
            await fetchOfficeRequirements();
            setEditingCommentId(null);
            setCommentInput("");
            setSelectedSubmissionRequirement((prev) => (
                prev && prev.requirementid === req.requirementid ? { ...prev, comments: '' } : prev
            ));
            toast?.({
                title: 'Comment Cleared',
                description: 'The comment has been removed.',
                variant: 'info',
                duration: 2500
            });
        } catch (error) {
            await showAlert('Failed to clear comment');
        } finally {
            setSavingComment(false);
        }
    };

    const handleCommentCancel = () => {
        setEditingCommentId(null);
        setCommentInput("");
    };

    const handleUserReqFileUpload = async (e, requirementid, onSingleFileUploaded) => {
        const fileList = Array.from(e.target.files || []);
        if (fileList.length === 0 || !currentUser) return;

        // Fetch current files count to enforce 40 files max
        let existingFiles = [];
        try {
            const currentFilesRes = await api.get(`/api/requirements/${requirementid}/user-file/${currentUser.userid}${office?.id ? `?officeid=${office.id}` : ''}`);
            if (currentFilesRes.data?.files) {
                existingFiles = currentFilesRes.data.files;
            } else if (currentFilesRes.data?.file) {
                existingFiles = [currentFilesRes.data.file];
            }
        } catch (err) {
            // ignore
        }

        if (existingFiles.length + fileList.length > 40) {
            const allowed = Math.max(0, 40 - existingFiles.length);
            await showAlert(`Maximum limit is 40 files per requirement. You already have ${existingFiles.length} file(s). You can upload at most ${allowed} more file(s).`);
            if (e?.target) e.target.value = '';
            return;
        }
        
        setUserUploadingReqId(requirementid);
        const token = localStorage.getItem('token');
        let successCount = 0;
        let lastUploadErrMsg = '';

        // Initialize progress for all files in this batch
        const initialMap = {};
        fileList.forEach(file => {
            initialMap[file.name] = {
                name: file.name,
                size: file.size,
                percent: 0,
                status: 'uploading'
            };
        });
        setUploadProgressMap(initialMap);
        
        // Upload files concurrently so completed files are posted immediately without waiting for slower files
        const uploadPromises = fileList.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userid', currentUser.userid);
            formData.append('requirementid', requirementid);
            formData.append('displayname', file.name);
            if (office?.id) {
                formData.append('officeid', office.id);
            }
            
            try {
                const res = await axios.post(`${API_BASE_URL}/api/requirements/user-upload`, formData, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const percent = Math.min(99, Math.round((progressEvent.loaded * 100) / progressEvent.total));
                            setUploadProgressMap(prev => {
                                if (!prev[file.name]) return prev;
                                return {
                                    ...prev,
                                    [file.name]: {
                                        ...prev[file.name],
                                        percent,
                                        status: 'uploading'
                                    }
                                };
                            });
                        }
                    }
                });

                if (res.data && res.data.success) {
                    successCount++;
                    const uploadedFileObj = res.data.file || {
                        id: res.data.file?.id,
                        filename: res.data.file?.filename || file.name,
                        displayname: res.data.file?.displayname || file.name,
                        comment: res.data.file?.comment || '',
                        url: res.data.file?.url || res.data.file?.filepath,
                        officeid: office?.id || null,
                        uploadedat: new Date()
                    };

                    // 1. Post immediately into submission viewer state
                    if (typeof onSingleFileUploaded === 'function') {
                        onSingleFileUploaded(uploadedFileObj);
                    }

                    // 2. Update dataCache immediately
                    const cacheKey = CacheKeys.userFiles(requirementid, currentUser.userid, office?.id);
                    const currentCached = dataCache.get(cacheKey) || [];
                    const updatedCached = [...currentCached.filter(f => f.id !== uploadedFileObj.id && f.filename !== uploadedFileObj.filename), uploadedFileObj];
                    dataCache.set(cacheKey, updatedCached);

                    // 3. Update gridModalData if open
                    setGridModalData(prev => {
                        if (!prev || !Array.isArray(prev.files)) return prev;
                        const filtered = prev.files.filter(f => f.id !== uploadedFileObj.id && f.filename !== uploadedFileObj.filename);
                        return { ...prev, files: [...filtered, uploadedFileObj] };
                    });

                    // 4. Mark user as uploaded in memory immediately
                    setAssignedUsersMap(prev => {
                        const currUsers = prev[requirementid] || [];
                        const updatedUsers = currUsers.map(u => 
                            Number(u.userid) === Number(currentUser.userid) 
                                ? { ...u, hasuploaded: 1 } 
                                : u
                        );
                        return { ...prev, [requirementid]: updatedUsers };
                    });

                    // 5. Remove completed file from uploading progress map so it appears as posted above
                    setUploadProgressMap(prev => {
                        const next = { ...prev };
                        delete next[file.name];
                        return next;
                    });

                    // 6. Notify backend of user upload status
                    requirementsAPI.markUserAsUploaded(requirementid, currentUser.userid).catch(() => {});
                }
            } catch (err) {
                console.error('Upload error for file:', file.name, err);
                lastUploadErrMsg = err.response?.data?.message || err.message || 'Failed to upload file(s)';
                setUploadProgressMap(prev => ({
                    ...prev,
                    [file.name]: {
                        ...prev[file.name],
                        status: 'error'
                    }
                }));
            }
        });

        try {
            await Promise.all(uploadPromises);
        } catch (uploadErr) {
            console.error('Upload batch error:', uploadErr);
        } finally {
            setUserUploadingReqId(null);
            setUploadProgressMap({});
            if (e?.target) e.target.value = '';
            if (userReqFileInputRef.current) {
                userReqFileInputRef.current.value = '';
            }
        }
        
        if (successCount > 0) {
            toast?.({
                title: 'Upload Successful',
                description: successCount > 1 
                    ? `Successfully uploaded ${successCount} files.` 
                    : `Successfully uploaded ${fileList[0]?.name || 'file'}.`,
                variant: 'success',
                duration: 3000
            });

            // Background sync: update assigned users badge and refresh requirements without blocking upload UI
            requirementsAPI.getAssignedUsers(requirementid, office?.id)
                .then(assignedRes => {
                    if (assignedRes?.success) {
                        setAssignedUsersMap(prev => ({
                            ...prev,
                            [requirementid]: assignedRes.users || assignedRes.data || []
                        }));
                    }
                })
                .catch(rErr => console.warn('Post-upload refresh warning:', rErr));

            fetchOfficeRequirements(true).catch(rErr => {
                console.warn('Post-upload fetchOfficeRequirements warning:', rErr);
            });
        } else if (fileList.length > 0) {
            toast?.({
                title: 'Upload Failed',
                description: lastUploadErrMsg || 'Failed to upload file(s).',
                variant: 'error',
                duration: 3500
            });
        }
    };

    const handleRenameUserFile = async (requirementid, fileId, newDisplayName) => {
        if (!fileId || !newDisplayName) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/requirements/${requirementid}/file/${fileId}/rename`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ displayname: newDisplayName })
            });
            await fetchOfficeRequirements(true);
        } catch (err) {
            console.error('Failed to rename file title:', err);
        }
    };

    const handleUpdateUserFileComment = async (requirementid, fileId, newComment) => {
        if (!fileId) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/requirements/${requirementid}/file/${fileId}/comment`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ comment: newComment })
            });
            await fetchOfficeRequirements(true);
        } catch (err) {
            console.error('Failed to update file comment:', err);
        }
    };

    // Remove a requirement from this office (admin action)
    const handleRemoveRequirement = async (requirementid) => {
        const targetReq = requirements.find(r => Number(r.requirementid || r.id) === Number(requirementid));
        const standardCode = targetReq?.requirementcode || targetReq?.code || '';
        const confirmMsg = standardCode
            ? `Remove standard "${standardCode}" from this office? This cannot be undone.`
            : 'Remove this requirement from the office? This cannot be undone.';
        const ok = await showConfirm(confirmMsg);
        if (!ok) return;
        try {
            setRemovingReqId(requirementid);
            const token = localStorage.getItem('token');
            const targetOfficeId = officeData?.id || officeData?.officeid || office?.id || office?.officeid;
            await axios.delete(`${API_BASE_URL}/api/offices/${targetOfficeId}/requirements/${requirementid}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            dataCache.invalidate(CacheKeys.officeReqs(targetOfficeId));
            await fetchOfficeRequirements();
            toast?.({
                title: 'Standard Removed',
                description: standardCode
                    ? `Standard ${standardCode} was successfully removed from this office.`
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

    const isUserAssignedToCurrentOffice = useMemo(() => {
        if (!currentUser) return false;
        const currentUid = Number(currentUser.userid ?? currentUser.id ?? currentUser.userid);
        const officeHeadsList = officeData?.heads || officeData?.Heads || office?.heads || office?.Heads || [];
        return officeHeadsList.some(h => Number(h.userid ?? h.userid ?? h.id) === currentUid);
    }, [currentUser, officeData, office]);

    const isUserAssignedAuditorForOffice = useMemo(() => {
        if (!currentUser || !isAuditor) return false;
        const currentUid = Number(currentUser.userid ?? currentUser.id ?? currentUser.userid);
        return officeAuditors.some(a => Number(a.userid ?? a.userid ?? a.id) === currentUid);
    }, [currentUser, isAuditor, officeAuditors]);

    const canUserUploadEvidence = useCallback((req) => {
        if (!currentUser) return false;
        if (isAuditor) return false;
        if (isAdmin) return true;

        const currentUid = Number(currentUser.userid ?? currentUser.id ?? currentUser.userid);

        // Office heads and assigned office personnel
        if (isUserAssignedToCurrentOffice) return true;

        if (req) {
            const reqId = Number(req.requirementid ?? req.requirementid);
            if (myAssignedReqIds.has(reqId)) return true;

            const critId = Number(req.criteriaid || 0);
            if (critId && myAssignedCritIds.has(critId)) return true;

            const parentCritId = Number(req.parentcriteriaid || 0);
            if (parentCritId && myAssignedCritIds.has(parentCritId)) return true;

            const areaId = Number(req.areaid || 0);
            if (areaId && myAssignedAreaIds.has(areaId)) return true;

            const usersForReq = assignedUsersMap?.[reqId] || [];
            if (usersForReq.some(u => Number(u.userid ?? u.userid ?? u.id) === currentUid)) {
                return true;
            }
        }

        return false;
    }, [currentUser, isAdmin, isAuditor, auditorAssignedAreaIds, isUserAssignedAuditorForOffice, isUserAssignedToCurrentOffice, assignedUsersMap, myAssignedReqIds, myAssignedCritIds, myAssignedAreaIds]);

    const isUserAssignedToRequirement = useCallback((requirementid) => {
        if (!currentUser) return false;
        const currentUid = Number(currentUser.userid ?? currentUser.id ?? currentUser.userid);
        const reqId = Number(requirementid);

        if (myAssignedReqIds.has(reqId)) return true;

        const reqObj = (requirements || []).find(r => Number(r.requirementid) === reqId);
        if (reqObj) {
            const critId = Number(reqObj.criteriaid || 0);
            if (critId && myAssignedCritIds.has(critId)) return true;
            const parentCritId = Number(reqObj.parentcriteriaid || 0);
            if (parentCritId && myAssignedCritIds.has(parentCritId)) return true;
            const areaId = Number(reqObj.areaid || 0);
            if (areaId && myAssignedAreaIds.has(areaId)) return true;
        }

        if (assignedUsersMap[requirementid]?.some(u => Number(u.userid ?? u.id) === currentUid)) {
            return true;
        }

        return false;
    }, [currentUser, myAssignedReqIds, myAssignedCritIds, myAssignedAreaIds, requirements, assignedUsersMap]);

    const hasUserUploadedForRequirement = (requirementid) => {
        if (!currentUser || !assignedUsersMap[requirementid]) return false;
        const userAssignment = assignedUsersMap[requirementid].find(u => Number(u.userid) === Number(currentUser.userid));
        return userAssignment && (userAssignment.hasuploaded === 1 || userAssignment.hasuploaded === true);
    };

    const handleExcelPreview = async (fileUrl = null) => {
        const escapeHtml = (value) => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const urlToUse = fileUrl || proofFileUrl || (selectedUserFile?.url);
        if (!urlToUse) {
            setExcelPreviewError('No file URL provided');
            return;
        }

        setExcelHtmlLoading(true);
        setExcelPreviewError(null);
        setExcelHtml('<div style="padding:1em;text-align:center;">Loading Excel preview...</div>');
        
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const response = await fetch(urlToUse, { headers });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();

            // Read workbook with styles enabled so we can preserve formatting
            const workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });

            // Minimal wrapper styles — avoid overriding cell-level styles generated by sheet_to_html
            let html = `
                <div class="excel-preview-root">
                    <style>
                        .excel-preview-root { font-family: 'Poppins', 'Inter', sans-serif; color: #0f172a; padding: 12px; background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); height:100%; box-sizing: border-box; display:flex; flex-direction:column; }
                        .excel-sheet { border:1px solid #e2e8f0; border-radius:10px; background:#fff; margin-bottom:12px; overflow:hidden; display:flex; flex-direction:column; }
                        .excel-sheet-title { position:sticky; top:0; z-index:2; padding:10px 12px; border-bottom:1px solid #e2e8f0; background:linear-gradient(90deg,#0f3a8a 0%,#1d4ed8 100%); color:#fff; font-size:12px; font-weight:700; text-transform:uppercase; }
                        .excel-sheet-table { overflow:auto; flex:1 1 auto; min-height:0; padding:12px; }
                        .excel-sheet-table table { border-collapse:collapse; width:100%; table-layout:fixed; }
                        .excel-sheet-table th, .excel-sheet-table td { border:1px solid #e6eef8; padding:6px 8px; vertical-align:top; white-space:pre-wrap; word-break:break-word; }
                        .excel-sheet-table thead th { position:sticky; top:0; background:rgba(255,255,255,0.95); z-index:3; }
                    </style>
            `;

            // Helper to compute pixel width for a column definition
            const computeColPx = (col) => {
                if (!col) return null;
                if (typeof col.wpx === 'number') return Math.round(col.wpx);
                if (typeof col.wch === 'number') return Math.round(col.wch * 7 + 5);
                return null;
            };

            workbook.SheetNames.forEach((sheetName, index) => {
                const worksheet = workbook.Sheets[sheetName];
                html += `<section class="excel-sheet" style="margin-top:${index === 0 ? '0' : '14px'};">`;
                html += `<div class="excel-sheet-title">Sheet: ${escapeHtml(sheetName)}</div>`;
                html += '<div class="excel-sheet-table">';

                // Generate HTML from sheet (ask xlsx to include inline cell styles)
                const sheetHtmlRaw = XLSX.utils.sheet_to_html(worksheet, {
                    id: `sheet-${index}`,
                    editable: false,
                    blankrows: false,
                    cellStyles: true
                });

                // Use DOM to inject colgroup widths and row heights from worksheet metadata
                try {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = sheetHtmlRaw;
                    const table = wrapper.querySelector('table');
                    if (table) {
                        // Determine range and number of columns/rows
                        const ref = worksheet['!ref'] || table.getAttribute('data-range') || null;
                        const range = ref ? XLSX.utils.decode_range(ref) : null;
                        const ncols = range ? (range.e.c - range.s.c + 1) : (table.querySelectorAll('tr:first-child th, tr:first-child td').length || 0);

                        // Inject colgroup based on worksheet['!cols'] if present
                        const colgroup = document.createElement('colgroup');
                        for (let c = 0; c < ncols; c++) {
                            const colEl = document.createElement('col');
                            const colMeta = (worksheet['!cols'] && worksheet['!cols'][c]) ? worksheet['!cols'][c] : null;
                            const wpx = computeColPx(colMeta);
                            if (wpx) colEl.style.width = `${wpx}px`;
                            colgroup.appendChild(colEl);
                        }
                        table.insertBefore(colgroup, table.firstChild);

                        // Apply row heights if available
                        if (worksheet['!rows'] && table.tBodies && table.tBodies[0]) {
                            const rows = table.tBodies[0].rows;
                            for (let r = 0; r < rows.length && r < worksheet['!rows'].length; r++) {
                                const rowMeta = worksheet['!rows'][r];
                                const hpx = rowMeta && (rowMeta.hpx || rowMeta.hpt ? (rowMeta.hpx || Math.round((rowMeta.hpt || 0) * 1.3333)) : null);
                                if (hpx) rows[r].style.height = `${hpx}px`;
                            }
                        }

                        // Use the modified table HTML
                        html += wrapper.innerHTML;
                    } else {
                        // Fallback: append raw HTML
                        html += sheetHtmlRaw;
                    }
                } catch (e) {
                    console.warn('Failed to post-process sheet HTML for precise sizing, using raw HTML fallback', e);
                    html += sheetHtmlRaw;
                }

                html += '</div>';
                html += '</section>';
            });
            html += '</div>';
            setExcelHtml(html);
        } catch (err) {
            console.error('Excel preview error:', err);
            setExcelPreviewError(err.message || 'Failed to load Excel file');
            setExcelHtml(`<div style="color:#2563eb;padding:1em;text-align:center;">
                <p style="font-weight:bold;margin-bottom:0.5em;">Error loading preview</p>
                <p style="font-size:0.9em;color:#6b7280;">${err.message || 'Unable to load file'}</p>
            </div>`);
        } finally {
            setExcelHtmlLoading(false);
        }
    };

    const handleUserAvatarClick = (e, user, requirementid) => {
        if (!isAdmin && !isOfficeHead && !isAuditor) return;
        // Toggle popup: if already open for same user, close it
        if (avatarPopup && avatarPopup.user.userid === user.userid && avatarPopup.requirementid === requirementid) {
            setAvatarPopup(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            setAvatarPopup({ user, requirementid, rect });
        }
    };

    const handleViewUserFile = async (user, requirementid, specificFile) => {
        setAvatarPopup(null);
        if (specificFile && (specificFile.url || specificFile.filename)) {
            setExcelHtml(null);
            setExcelPreviewError(null);
            setExcelHtmlLoading(false);
            setSelectedUserFile(specificFile);
            setShowUserFileViewer(true);
            return;
        }
        try {
            const res = await api.get(`/api/requirements/${requirementid}/user-file/${user.userid}${office?.id ? `?officeid=${office.id}` : ''}`);
            if (res.data && res.data.success && res.data.file) {
                setExcelHtml(null);
                setExcelPreviewError(null);
                setExcelHtmlLoading(false);
                setSelectedUserFile(res.data.file);
                setShowUserFileViewer(true);
            } else {
                await showAlert('No file found for this user.');
            }
        } catch (err) {
            await showAlert('Error fetching user file.');
        }
    };

    useEffect(() => {
        if (!isOpen) {
            deepLinkAppliedRef.current = false;
            return;
        }
        if (!deepLink || deepLinkAppliedRef.current || loading || requirements.length === 0) return;

        const reqId = deepLink.requirementid ? Number(deepLink.requirementid) : null;
        if (!reqId) {
            deepLinkAppliedRef.current = true;
            onDeepLinkHandled?.();
            return;
        }

        const req = requirements.find((r) => Number(r.requirementid) === reqId);
        if (!req) {
            deepLinkAppliedRef.current = true;
            onDeepLinkHandled?.();
            return;
        }

        if (deepLink.openSubmission) {
            const usersForReq = assignedUsersMap[reqId] || [];
            setSelectedSubmissionRequirement(req);
            setSubmissionViewerUsers(usersForReq);
            setShowSubmissionViewer(true);

            if (deepLink.viewUserId) {
                const targetUser = usersForReq.find((u) => Number(u.userid) === Number(deepLink.viewUserId));
                if (targetUser) {
                    setTimeout(() => {
                        handleViewUserFile(targetUser, reqId);
                    }, 450);
                }
            }
        }

        deepLinkAppliedRef.current = true;
        onDeepLinkHandled?.();
    }, [isOpen, deepLink, loading, requirements, assignedUsersMap, onDeepLinkHandled]);

    const handleDownloadUserFile = async (user, requirementid) => {
        try {
            const res = await api.get(`/api/requirements/${requirementid}/user-file/${user.userid}${office?.id ? `?officeid=${office.id}` : ''}`);
            if (!(res.data && res.data.success && res.data.file && res.data.file.url)) {
                await showAlert('No file found for this user.');
                return;
            }

            const fileMeta = res.data.file;
            const fileUrl = fileMeta.url;
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const fetchRes = await fetch(fileUrl, { headers });
            if (!fetchRes.ok) throw new Error('Failed to download file');
            const blob = await fetchRes.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const rawName = String(fileMeta.displayname || fileMeta.filename || 'download').trim();
            const extMatch = String(fileMeta.filename || fileUrl).match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
            const ext = extMatch ? extMatch[1] : '';
            let finalDownloadName = rawName;
            if (ext && !finalDownloadName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
                finalDownloadName = `${finalDownloadName}.${ext}`;
            }

            a.download = finalDownloadName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 2000);
        } catch (err) {
            console.error('Download error:', err);
            await showAlert(err?.message || 'Failed to download file');
        }
    };

    const handleSendNotificationToUser = async (user, requirementid) => {
        if (!currentUser) return;
        setSendingNotification(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/notifications/create`, {
                userIds: [user.userid],
                adminid: currentUser.userid,
                title: notifTitle,
                message: notifMessage,
                type: 'info',
                relatedtable: 'requirements',
                relatedid: requirementid
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowNotifForm(null);
            setNotifTitle('');
            setNotifMessage('');
            await showAlert(`Notification sent to ${user.firstname} ${user.lastname}`);
        } catch (err) {
            console.error('Error sending notification:', err);
            await showAlert('Failed to send notification');
        } finally {
            setSendingNotification(false);
        }
    };

    const openNotifForm = (user, requirementid) => {
        const req = requirements.find(r => r.requirementid === requirementid);
        setAvatarPopup(null);
        const desc = req?.description || req?.Description || '';
        setNotifMessage(`Please upload your compliance document for requirement: ${req?.requirementcode || ''} - ${desc ? desc.substring(0, 80) : 'N/A'}`);
        setShowNotifForm({ user, requirementid });
    };

    useEffect(() => {
        if (!showDocViewer || !proofFileUrl) return;
        if (!/\.(xlsx|xls)$/i.test(proofFileUrl)) return;
        handleExcelPreview(proofFileUrl);
    }, [showDocViewer, proofFileUrl]);

    useEffect(() => {
        const fileUrl = selectedUserFile?.url;
        if (!showUserFileViewer || !fileUrl) return;
        if (!/\.(xlsx|xls)$/i.test(fileUrl)) return;
        handleExcelPreview(fileUrl);
    }, [showUserFileViewer, selectedUserFile]);

    useEffect(() => {
        const renderProofDocx = async () => {
            if (!showDocViewer || !proofFileUrl || !/\.docx$/i.test(proofFileUrl)) return;
            if (!docxPreviewRef.current) return;

            setDocxPreviewLoading(true);
            setDocxPreviewError(null);

            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const response = await fetch(proofFileUrl, { headers });
                if (!response.ok) {
                    throw new Error(`Failed to load DOCX (HTTP ${response.status})`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const container = docxPreviewRef.current;
                if (!container) return;
                container.innerHTML = '';
                await renderAsync(arrayBuffer, container, undefined, {
                    className: 'docx-preview-container',
                    inWrapper: true,
                });
            } catch (error) {
                console.error('DOCX preview error:', error);
                setDocxPreviewError(error?.message || 'Failed to preview DOCX file');
            } finally {
                setDocxPreviewLoading(false);
            }
        };

        renderProofDocx();
    }, [showDocViewer, proofFileUrl]);

    useEffect(() => {
        const fileUrl = selectedUserFile?.url;

        const renderUserDocx = async () => {
            if (!showUserFileViewer || !fileUrl || !/\.docx$/i.test(fileUrl)) return;
            if (!userDocxPreviewRef.current) return;

            setUserDocxPreviewLoading(true);
            setUserDocxPreviewError(null);

            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const response = await fetch(fileUrl, { headers });
                if (!response.ok) {
                    throw new Error(`Failed to load DOCX (HTTP ${response.status})`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const container = userDocxPreviewRef.current;
                if (!container) return;
                container.innerHTML = '';
                await renderAsync(arrayBuffer, container, undefined, {
                    className: 'docx-preview-container',
                    inWrapper: true,
                });
            } catch (error) {
                console.error('User DOCX preview error:', error);
                setUserDocxPreviewError(error?.message || 'Failed to preview DOCX file');
            } finally {
                setUserDocxPreviewLoading(false);
            }
        };

        renderUserDocx();
    }, [showUserFileViewer, selectedUserFile]);

    if (!isOpen || !office) return null;

    const overlayLeftStyle = { left: 'var(--sidebar-width, 0px)', transition: 'left 200ms ease-in-out' };

    const assignedRequirementCount = requirements.filter((req) => isUserAssignedToRequirement(req.requirementid)).length;
    const isAssignedInCurrentOffice = assignedRequirementCount > 0;

    const modalContent = (
        <div
            className="fixed inset-y-0 right-0 left-0 z-[45] flex bg-slate-900/55 backdrop-blur-[2px] lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out"
            style={{ left: 'var(--sidebar-width, 0px)', transition: 'left 200ms ease-in-out' }}
            onClick={onClose}
        >
            <div className="flex h-full w-full flex-col bg-app-muted shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <ModalHeader
                    officeData={officeData}
                    isAdmin={isAdmin}
                    showMenu={showMenu}
                    setShowMenu={setShowMenu}
                    onEditOffice={onEditOffice}
                    onAddRequirements={onAddRequirements}
                    onDeleteOffice={onDeleteOffice}
                    onClose={onClose}
                    office={office}
                    onUpdateLevel={handleUpdateOfficeLevel}
                />

                <OfficeInfoBar
                    officeData={officeData}
                    requirements={requirements}
                    isAssignedInCurrentOffice={isAssignedInCurrentOffice}
                    assignedRequirementCount={assignedRequirementCount}
                    isAdmin={isAdmin}
                    isAuditor={isAuditor}
                    currentUser={currentUser}
                />

                <RequirementsToolbar
                    showStatusDropdown={showStatusDropdown}
                    setShowStatusDropdown={setShowStatusDropdown}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    submissionFilter={submissionFilter}
                    setSubmissionFilter={setSubmissionFilter}
                    isPersonnel={isPersonnel}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                />

                {/* Requirements List */}
                <RequirementsTree
                    loading={loading}
                    requirements={requirements}
                    searchTerm={searchTerm}
                    statusFilter={statusFilter}
                    submissionFilter={submissionFilter}
                    isAdmin={isAdmin}
                    isOfficeHead={isOfficeHead}
                    isAuditor={isAuditor}
                    assignedUsersMap={assignedUsersMap}
                    personnelAssignments={personnelAssignments}
                    expandedReqs={expandedReqs}
                    toggleExpandReq={toggleExpandReq}
                    isUserAssignedToRequirement={isUserAssignedToRequirement}
                    isUserAssignedToCurrentOffice={isUserAssignedToCurrentOffice}
                    canUserUploadEvidence={canUserUploadEvidence}
                    editingCommentId={editingCommentId}
                    commentInput={commentInput}
                    savingComment={savingComment}
                    handleCommentInputChange={handleCommentInputChange}
                    handleCommentSave={handleCommentSave}
                    handleCommentClear={handleCommentClear}
                    handleCommentCancel={handleCommentCancel}
                    handleCommentClick={handleCommentClick}
                    handleStatusChange={handleStatusChange}
                    currentUser={currentUser}
                    userUploadingReqId={userUploadingReqId}
                    handleUserReqFileUpload={handleUserReqFileUpload}
                    hasUserUploadedForRequirement={hasUserUploadedForRequirement}
                    handleViewUserFile={handleViewUserFile}
                    handleDownloadUserFile={handleDownloadUserFile}
                    handleUnsubmitUserFile={handleUnsubmitUserFile}
                    handleRenameUserFile={handleRenameUserFile}
                    unsubmittingReqId={unsubmittingReqId}
                    removingReqId={removingReqId}
                    handleRemoveRequirement={handleRemoveRequirement}
                    handleUserAvatarClick={handleUserAvatarClick}
                    onViewSubmission={(req) => {
                        setSelectedSubmissionRequirement(req);
                        const usersForReq = assignedUsersMap?.[req.requirementid] || [];
                        setSubmissionViewerUsers(usersForReq);
                        setShowSubmissionViewer(true);
                    }}
                    onViewMySubmission={(req) => {
                        if (!currentUser) return;
                        if (!canUserUploadEvidence(req)) {
                            setSelectedSubmissionRequirement(req);
                            const usersForReq = assignedUsersMap?.[req.requirementid] || [];
                            setSubmissionViewerUsers(usersForReq);
                            setShowSubmissionViewer(true);
                            return;
                        }
                        const reqId = req?.requirementid;
                        if (!reqId) return;
                        const userFromMap = (assignedUsersMap?.[reqId] || []).find((u) => u?.userid === currentUser.userid);
                        const hasuploaded = hasUserUploadedForRequirement(reqId);
                        const userEntry = userFromMap ? { ...userFromMap, hasuploaded: hasuploaded } : { ...currentUser, hasuploaded: hasuploaded };
                        setSelectedSubmissionRequirement(req);
                        const usersForReq = [userEntry];
                        setSubmissionViewerUsers(usersForReq);
                        setShowSubmissionViewer(true);
                    }}
                />

                <ProofFooterBar
                    isAdmin={isAdmin}
                    proofFileUrl={proofFileUrl}
                    fileInputRef={fileInputRef}
                    handleProofFileChange={handleProofFileChange}
                    uploadingProof={uploadingProof}
                    showConfirm={showConfirm}
                    showAlert={showAlert}
                    officeid={office.id}
                    fetchOfficeRequirements={fetchOfficeRequirements}
                    unsubmittingProof={unsubmittingProof}
                    setUnsubmittingProof={setUnsubmittingProof}
                    setPersistedProof={setPersistedProof}
                    setProofFileName={setProofFileName}
                    setProofFileUrl={setProofFileUrl}
                    setExcelHtml={setExcelHtml}
                    setExcelPreviewError={setExcelPreviewError}
                    setExcelHtmlLoading={setExcelHtmlLoading}
                    setDocxPreviewError={setDocxPreviewError}
                    setShowDocViewer={setShowDocViewer}
                    onClose={onClose}
                />
            </div>

            {/* Document Viewer Modal - Compact */}
            <ProofDocumentViewerModal
                show={!!(proofFileUrl && showDocViewer)}
                leftStyle={overlayLeftStyle}
                proofFileUrl={proofFileUrl}
                proofFileName={proofFileName}
                excelHtml={excelHtml}
                excelHtmlLoading={excelHtmlLoading}
                excelPreviewError={excelPreviewError}
                handleExcelPreview={handleExcelPreview}
                docxPreviewRef={docxPreviewRef}
                docxPreviewLoading={docxPreviewLoading}
                docxPreviewError={docxPreviewError}
                onClose={() => {
                    setShowDocViewer(false);
                    setExcelHtml(null);
                    setExcelPreviewError(null);
                    setDocxPreviewError(null);
                }}
            />

            {/* Assign User Modal */}


            {/* User File Preview Modal - Compact */}
            <UserFileViewerModal
                show={!!(showUserFileViewer && selectedUserFile)}
                leftStyle={overlayLeftStyle}
                selectedUserFile={selectedUserFile}
                excelHtml={excelHtml}
                excelHtmlLoading={excelHtmlLoading}
                excelPreviewError={excelPreviewError}
                handleExcelPreview={handleExcelPreview}
                userDocxPreviewRef={userDocxPreviewRef}
                userDocxPreviewLoading={userDocxPreviewLoading}
                userDocxPreviewError={userDocxPreviewError}
                onClose={() => {
                    setShowUserFileViewer(false);
                    setExcelHtml(null);
                    setExcelPreviewError(null);
                    setUserDocxPreviewError(null);
                }}
            />

            {/* Avatar Popup Menu - rendered as fixed overlay via portal */}
            <AvatarPopupMenu
                isAdmin={isAdmin}
                isOfficeHead={isOfficeHead}
                isAuditor={isAuditor}
                avatarPopup={avatarPopup}
                onClose={() => setAvatarPopup(null)}
                onViewUserFile={handleViewUserFile}
                onDownloadUserFile={handleDownloadUserFile}
                onOpenNotifForm={openNotifForm}
            />

            {/* Send Notification Form Modal */}
            <SendNotificationModal
                show={!!showNotifForm}
                leftStyle={overlayLeftStyle}
                showNotifForm={showNotifForm}
                notifTitle={notifTitle}
                setNotifTitle={setNotifTitle}
                notifMessage={notifMessage}
                setNotifMessage={setNotifMessage}
                sendingNotification={sendingNotification}
                onClose={() => {
                    setShowNotifForm(null);
                    setNotifTitle('');
                    setNotifMessage('');
                }}
                onSend={() => handleSendNotificationToUser(showNotifForm.user, showNotifForm.requirementid)}
            />

            <SubmissionViewer
                show={showSubmissionViewer}
                leftStyle={overlayLeftStyle}
                requirement={selectedSubmissionRequirement}
                users={
                    (() => {
                        const baseUsers = submissionViewerUsers || (selectedSubmissionRequirement ? (assignedUsersMap?.[selectedSubmissionRequirement.requirementid] || []) : []);
                        const canUpload = canUserUploadEvidence(selectedSubmissionRequirement);

                        if (canUpload && (isOfficeHead || currentUser?.roleid === 2 || !isAdmin) && selectedSubmissionRequirement && currentUser) {
                            const reqId = selectedSubmissionRequirement.requirementid;
                            const userFromMap = (assignedUsersMap?.[reqId] || []).find((u) => Number(u?.userid) === Number(currentUser.userid));
                            const hasuploaded = hasUserUploadedForRequirement(reqId);
                            const entry = userFromMap
                                ? { ...userFromMap, hasuploaded: hasuploaded }
                                : { ...currentUser, hasuploaded: hasuploaded };
                            if (submissionViewerUsers && submissionViewerUsers.length === 1 && Number(submissionViewerUsers[0]?.userid) === Number(currentUser.userid)) {
                                return [entry];
                            }
                            if (!baseUsers.some(u => Number(u?.userid) === Number(currentUser.userid))) {
                                return [entry, ...baseUsers];
                            }
                        }

                        if (canUpload && isAuditor && currentUser && selectedSubmissionRequirement) {
                            const hasAuditor = baseUsers.some(u => u.userid === currentUser.userid);
                            if (!hasAuditor) {
                                const reqId = selectedSubmissionRequirement.requirementid;
                                const hasuploaded = hasUserUploadedForRequirement(reqId);
                                const auditorEntry = { ...currentUser, hasuploaded: hasuploaded };
                                return [auditorEntry, ...baseUsers];
                            }
                        }

                        return baseUsers;
                    })()
                }
                officeid={office?.id}
                currentUser={currentUser}
                showPrivateComments={!isAuditor}
                canEditPrivateComments={!!isAdmin}
                allowWorkActions={canUserUploadEvidence(selectedSubmissionRequirement)}
                viewerRoleId={currentRoleId}
                onFileUpload={handleUserReqFileUpload}
                onFileUnsubmit={handleUnsubmitUserFile}
                onFileRename={handleRenameUserFile}
                onFileUpdateComment={handleUpdateUserFileComment}
                uploadingFile={userUploadingReqId === selectedSubmissionRequirement?.requirementid}
                uploadProgressMap={uploadProgressMap}
                unsubmittingFile={unsubmittingReqId === selectedSubmissionRequirement?.requirementid}
                onViewUserFile={handleViewUserFile}
                onViewUserFilesModal={handleOpenUserFilesGridModal}
                onCommentSaved={async (newComment) => {
                    setSelectedSubmissionRequirement((prev) => (prev ? { ...prev, comments: newComment } : prev));
                    try {
                        await fetchOfficeRequirements();
                    } catch (e) {
                        // ignore
                    }
                }}
                onClose={() => {
                    setShowSubmissionViewer(false);
                    setSelectedSubmissionRequirement(null);
                    setSubmissionViewerUsers(null);
                }}
            />

            <UserFilesGridModal
                show={!!gridModalData}
                user={gridModalData?.user}
                requirement={gridModalData?.requirement}
                files={gridModalData?.files || []}
                officeid={office?.id}
                onClose={() => setGridModalData(null)}
                onViewFile={(fileItem) => {
                    if (gridModalData?.user && gridModalData?.requirement) {
                        handleViewUserFile(gridModalData.user, gridModalData.requirement.requirementid, fileItem);
                    }
                }}
                onUpdateComment={async (reqId, fileId, newComment) => {
                    // Update gridModalData files synchronously & optimistically
                    setGridModalData(prev => {
                        if (!prev || !Array.isArray(prev.files)) return prev;
                        return {
                            ...prev,
                            files: prev.files.map(f => f.id === fileId ? {
                                ...f,
                                comment: newComment,
                                rejectionreason: f.reviewstatus === 'rejected' ? newComment : f.rejectionreason
                            } : f)
                        };
                    });
                    await handleUpdateUserFileComment(reqId, fileId, newComment);
                }}
                onReviewFile={async (reqId, fileId, status, reason) => {
                    const targetUserId = gridModalData?.user?.userid;

                    // Optimistically update gridModalData immediately so status never flashes or reverts
                    setGridModalData(prev => {
                        if (!prev || !Array.isArray(prev.files)) return prev;
                        const updated = prev.files.map(f => f.id === fileId ? {
                            ...f,
                            reviewstatus: status,
                            rejectionreason: status === 'rejected' ? reason : null,
                            comment: reason || f.comment
                        } : f);
                        if (targetUserId && reqId) {
                            dataCache.set(CacheKeys.userFiles(reqId, targetUserId, office?.id), updated);
                        }
                        return { ...prev, files: updated };
                    });

                    if (targetUserId && reqId) {
                        window.dispatchEvent(new CustomEvent('evidence-file-reviewed', {
                            detail: { reqId, fileId, status, userid: targetUserId, reason }
                        }));
                    }

                    try {
                        const token = localStorage.getItem('token');
                        const res = await axios.patch(
                            `${API_BASE_URL}/api/requirements/${reqId}/file/${fileId}/review`,
                            { status, reason },
                            { headers: { Authorization: token ? `Bearer ${token}` : '' } }
                        );
                        if (res.data && res.data.success) {
                            // Update gridModalData files with server-confirmed reviewer info
                            setGridModalData(prev => {
                                if (!prev || !Array.isArray(prev.files)) return prev;
                                const updated = prev.files.map(f => f.id === fileId ? {
                                    ...f,
                                    reviewstatus: res.data.reviewstatus,
                                    rejectionreason: res.data.rejectionreason,
                                    comment: res.data.comment || reason || f.comment,
                                    reviewedby: res.data.reviewedby,
                                    reviewedat: res.data.reviewedat,
                                    reviewerName: res.data.reviewerName
                                } : f);
                                if (targetUserId && reqId) {
                                    dataCache.set(CacheKeys.userFiles(reqId, targetUserId, office?.id), updated);
                                }
                                return { ...prev, files: updated };
                            });

                            // Update local submission files cache if present
                            setSubmissionViewerUsers(prev => {
                                const base = Array.isArray(prev) ? prev : (assignedUsersMap?.[reqId] || []);
                                return base.map(u => {
                                    if (Number(u.userid) === Number(targetUserId) && u.userFiles && Array.isArray(u.userFiles)) {
                                        return {
                                            ...u,
                                            userFiles: u.userFiles.map(f => f.id === fileId ? {
                                                ...f,
                                                reviewstatus: res.data.reviewstatus,
                                                rejectionreason: res.data.rejectionreason,
                                                comment: res.data.comment || reason || f.comment,
                                                reviewedby: res.data.reviewedby,
                                                reviewedat: res.data.reviewedat,
                                                reviewerName: res.data.reviewerName
                                            } : f)
                                        };
                                    }
                                    return u;
                                });
                            });

                            if (targetUserId && reqId) {
                                window.dispatchEvent(new CustomEvent('evidence-file-reviewed', {
                                    detail: {
                                        reqId,
                                        fileId,
                                        status: res.data.reviewstatus,
                                        userid: targetUserId,
                                        reason: res.data.rejectionreason,
                                        resData: res.data
                                    }
                                }));
                            }

                            return res.data;
                        }
                    } catch (err) {
                        console.error('Error reviewing evidence:', err);
                        throw err;
                    }
                }}
                onRename={handleRenameUserFile}
                onReorderFiles={(reqId, newFiles) => {
                    setGridModalData(prev => prev ? { ...prev, files: newFiles } : null);
                }}
                isAdmin={isAdmin}
                currentUser={currentUser}
                viewerRoleId={currentRoleId}
                onUpload={async (e, reqId) => {
                    await handleUserReqFileUpload(e, reqId);
                    try {
                        const res = await api.get(`/api/requirements/${reqId}/user-file/${currentUser.userid}${office?.id ? `?officeid=${office.id}` : ''}`);
                        if (res.data && res.data.success) {
                            const newFiles = res.data.files || (res.data.file ? [res.data.file] : []);
                            setGridModalData(prev => prev ? { ...prev, files: newFiles } : null);
                        }
                    } catch (err) {
                        console.error('Error refreshing files in grid modal:', err);
                    }
                }}
                onUnsubmit={async (fileId) => {
                    const reqId = gridModalData?.requirement?.requirementid;
                    if (!reqId) return;
                    const ok = await handleUnsubmitUserFile(reqId, fileId);
                    if (ok === false) return;
                    try {
                        const res = await api.get(`/api/requirements/${reqId}/user-file/${currentUser.userid}${office?.id ? `?officeid=${office.id}` : ''}`);
                        if (res.data && res.data.success) {
                            const newFiles = res.data.files || (res.data.file ? [res.data.file] : []);
                            setGridModalData(prev => prev ? { ...prev, files: newFiles } : null);
                        } else {
                            setGridModalData(prev => prev ? { ...prev, files: [] } : null);
                        }
                    } catch (err) {
                        setGridModalData(prev => prev ? { ...prev, files: [] } : null);
                    }
                }}
                uploading={userUploadingReqId === gridModalData?.requirement?.requirementid}
            />
        </div>
    );

    return createPortal(modalContent, document.body);
}

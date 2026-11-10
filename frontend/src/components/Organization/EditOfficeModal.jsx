import { API_BASE_URL } from '../../utils/apiBase';

import React, { useState, useEffect, useMemo } from "react";
import api, { officeHeadsAPI } from "../../utils/api";
import { useModal } from "../UI/ModalProvider";
import CustomSelect from "../UI/CustomSelect";
import SmartUserAvatar from "../UI/SmartUserAvatar";

export default function EditOfficeModal({ visible, onClose, office, onSave, officeTypes, userRole = 'user' }) {
    const [officename, setOfficeName] = useState("");
    const [officeTypeID, setOfficeTypeID] = useState("");
    const [selectedHeadIDs, setSelectedHeadIDs] = useState([]); // Array for multiple heads
    const [heads, setHeads] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [programTypes, setProgramTypes] = useState([]);
    const [selectedDepartmentID, setSelectedDepartmentID] = useState("");
    const [selectedProgramTypeID, setSelectedProgramTypeID] = useState("");
    const [accreditationlevel, setAccreditationLevel] = useState("None");
    const [loadingHeads, setLoadingHeads] = useState(false);
    const [showHeadDropdown, setShowHeadDropdown] = useState(false);
    const isAdmin = userRole === 'admin' || userRole === 1;
    const MAX_HEADS = 4;

    const getHeadDisplayName = (head) => {
        return `${head?.firstname || ""} ${head?.middleinitial ? `${head.middleinitial}.` : ""} ${head?.lastname || ""}`
            .replace(/\s+/g, " ")
            .trim();
    };

    const getHeadPicUrl = (head) => {
        return head?.profilepic ? `${API_BASE_URL}/uploads/profile-pics/${head.profilepic}` : null;
    };

    const [headSearchTerm, setHeadSearchTerm] = useState("");

    const filteredHeads = useMemo(() => {
        const query = headSearchTerm.trim().toLowerCase();
        if (!query) return heads;
        return heads.filter((head) => {
            const fullName = `${head.firstname || ""} ${head.middleinitial ? `${head.middleinitial}.` : ""} ${head.lastname || ""}`
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
            const position = String(head.Position || "").toLowerCase();
            return fullName.includes(query) || position.includes(query);
        });
    }, [heads, headSearchTerm]);

    const isHeadLimitReached = selectedHeadIDs.length >= MAX_HEADS;
    const { showAlert } = useModal();
    const [isSaving, setIsSaving] = useState(false);

    const getOfficeTypeById = (id) => {
        return officeTypes?.find((t) => String(t.officetypeid || t.id) === String(id));
    };

    const isAcademicType = (officetypeid) => {
        const t = getOfficeTypeById(officetypeid);
        const name = String(t?.typename || t?.name || office?.office_type_name || office?.typename || '').toLowerCase();
        if (!name) return false;
        if (/\bnon\b|non-?academic|not\s+academic/.test(name)) return false;
        return /\bacademic\b/.test(name);
    };

    const departmentRequiresProgramTypes = (dept) => {
        if (!dept) return true;
        const name = String(dept?.name || dept?.Name || dept).toLowerCase();
        return name !== 'ibed';
    };

    useEffect(() => {
        if (!office) return;
        setOfficeName(office.officename || office.officename || "");
        setOfficeTypeID(office.office_type || office.officetypeid || office.officetypeid || "");
        setSelectedDepartmentID(office.departmentid || office.DepartmentID || office.departmentID || "");
        setSelectedProgramTypeID(office.program_type_id || office.ProgramTypeID || office.programTypeID || "");
        setAccreditationLevel(office.accreditationlevel || "None");

        let headIds = [];
        if (Array.isArray(office.head_ids) && office.head_ids.length > 0) {
            headIds = office.head_ids;
        } else if (Array.isArray(office.HeadIDs) && office.HeadIDs.length > 0) {
            headIds = office.HeadIDs;
        } else if (Array.isArray(office.heads) && office.heads.length > 0) {
            headIds = office.heads.map(h => h.headid ?? h.headid ?? h.id ?? h.userid);
        } else if (office.headid) {
            headIds = [office.headid];
        } else if (office.headid) {
            headIds = [office.headid];
        }

        setSelectedHeadIDs(headIds.map(Number).filter(n => !isNaN(n)));
    }, [office]);

    useEffect(() => {
        if (!visible) return;

        const fetchLookups = async () => {
            try {
                const [depsRes, ptypesRes] = await Promise.all([
                    api.get('/api/departments').then(r => r.data).catch(() => ({ data: [] })),
                    api.get('/api/programtypes').then(r => r.data).catch(() => ({ data: [] })),
                ]);

                const deps = Array.isArray(depsRes) ? depsRes : (depsRes?.data || depsRes?.departments || []);
                const ptypes = Array.isArray(ptypesRes) ? ptypesRes : (ptypesRes?.data || ptypesRes?.programtypes || []);

                setDepartments(Array.isArray(deps) ? deps : []);
                setProgramTypes(Array.isArray(ptypes) ? ptypes : []);
            } catch (err) {
                setDepartments([]);
                setProgramTypes([]);
            }
        };

        fetchLookups();
    }, [visible]);

    // Fetch heads when modal opens
    useEffect(() => {
        if (!visible) return;
        setLoadingHeads(true);
        setShowHeadDropdown(false);
        const fetchHeads = async () => {
            try {
                const headsArr = await officeHeadsAPI.getAllHeads();
                // API returns array directly now
                const headsData = Array.isArray(headsArr) ? headsArr : (headsArr?.data || []);
                setHeads(headsData);
            } catch (err) {
                setHeads([]);
            } finally {
                setLoadingHeads(false);
            }
        };
        fetchHeads();
    }, [visible]);

    useEffect(() => {
        if (!isAcademicType(officeTypeID)) {
            setSelectedDepartmentID("");
            setSelectedProgramTypeID("");
            return;
        }

        if (!selectedDepartmentID) {
            setSelectedProgramTypeID("");
            return;
        }

        const dept = departments.find((d) => String(d.id ?? d.DepartmentID ?? d.ID ?? d.Id) === String(selectedDepartmentID));
        const deptName = String(dept?.name || dept?.DepartmentName || dept?.Name || '').toLowerCase();

        const findProgramTypeId = (match) => {
            if (!Array.isArray(programTypes) || programTypes.length === 0) return null;
            const found = programTypes.find((p) => {
                const pname = String(p.name || p.ProgramTypeName || p.Name || p.typename || '').toLowerCase();
                return pname.includes(match);
            });
            return found ? (found.id ?? found.ProgramTypeID ?? found.ID ?? found.Id ?? '') : null;
        };

        if (deptName.includes('graduate')) {
            const id = findProgramTypeId('graduate');
            if (id) setSelectedProgramTypeID(String(id));
            return;
        }

        if (deptName.includes('continuing') || deptName.includes('tcp') || deptName.includes('eteeap')) {
            const id = findProgramTypeId('continu');
            if (id) setSelectedProgramTypeID(String(id));
            return;
        }

        setSelectedProgramTypeID("");
    }, [officeTypeID, selectedDepartmentID, departments, programTypes]);

    const getHeadId = (h) => Number(h?.headid ?? h?.headid ?? h?.userid ?? h?.userid ?? h?.id);

    // Toggle head selection
    const toggleHeadSelection = (rawId) => {
        const headid = Number(rawId);
        const selectedNums = selectedHeadIDs.map(Number);

        if (!selectedNums.includes(headid) && selectedNums.length >= MAX_HEADS) {
            showAlert(`You can select up to ${MAX_HEADS} heads.`);
            return;
        }

        setSelectedHeadIDs(prev => {
            const nums = prev.map(Number);
            if (nums.includes(headid)) {
                return nums.filter(id => id !== headid);
            } else {
                return [...nums, headid];
            }
        });
    };

    // Get selected heads display text
    const getSelectedHeadsText = () => {
        const selectedNums = selectedHeadIDs.map(Number);
        if (selectedNums.length === 0) return "Select Head(s)";
        const selectedHeads = heads.filter(h => selectedNums.includes(getHeadId(h)));
        if (selectedHeads.length === 1 && selectedHeads[0]) {
            const h = selectedHeads[0];
            return `${h.firstname || h.firstname || ''} ${h.lastname || h.lastname || ''}`.trim() || '1 head selected';
        }
        if (selectedHeads.length > 0) {
            return `${selectedHeads.length} heads selected`;
        }
        return `${selectedNums.length} heads selected`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!office || isSaving) return;

        const updatedOffice = {
            masterlistid: office.masterlistid || null,
            officename: officename,
            officetypeid: officeTypeID,
            accreditationlevel: isAcademicType(officeTypeID) ? accreditationlevel : null,
            HeadIDs: [],
            eventid: office.eventid || office.eventid || null,
        };

        setIsSaving(true);
        try {
            if (typeof onSave === 'function') {
                const res = await onSave({ id: office.id || office.officeid, ...updatedOffice });
                if (res && res.success === false) {
                    return;
                }
            }
            onClose();
        } catch (err) {
            console.error("Failed to save office personnel:", err);
        } finally {
            setIsSaving(false);
        }
    };


    if (!visible) return null;

    const safeHeads = Array.isArray(heads) ? heads : [];

    return (
        <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out z-[50] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-slate-800">{isAdmin ? 'Edit Office' : 'View Office'}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Update configuration and details for this entity.</p>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose} 
                        disabled={isSaving}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                        aria-label="Close"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1">Office Name</label>
                        <input
                            type="text"
                            value={officename}
                            onChange={(e) => setOfficeName(e.target.value)}
                            disabled={!isAdmin}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                            placeholder="Enter office name"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Office Type</label>
                        <CustomSelect
                            value={officeTypeID}
                            onChange={(val) => setOfficeTypeID(val)}
                            disabled={!isAdmin}
                            placeholder="Select Office Type"
                            options={[
                                { value: "", label: "Select Office Type" },
                                ...(officeTypes || []).map((type) => ({
                                    value: String(type.officetypeid || type.id),
                                    label: type.typename || type.name,
                                })),
                            ]}
                            required
                        />
                    </div>

                    {isAcademicType(officeTypeID) && (
                        <>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
                                <CustomSelect
                                    value={selectedDepartmentID}
                                    onChange={(val) => setSelectedDepartmentID(val)}
                                    disabled={!isAdmin}
                                    placeholder="Select Department (Optional)"
                                    options={[
                                        { value: "", label: "Select Department (Optional)" },
                                        ...departments.map((dept) => ({
                                            value: String(dept.id ?? dept.DepartmentID),
                                            label: dept.name || dept.DepartmentName,
                                        })),
                                    ]}
                                />
                            </div>

                            {departmentRequiresProgramTypes(departments.find(d => String(d.id ?? d.DepartmentID) === String(selectedDepartmentID))) && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Program Type</label>
                                    <CustomSelect
                                        value={selectedProgramTypeID}
                                        onChange={(val) => setSelectedProgramTypeID(val)}
                                        disabled={!isAdmin}
                                        placeholder="Select Program Type (Optional)"
                                        options={[
                                            { value: "", label: "Select Program Type (Optional)" },
                                            ...programTypes.map((pt) => ({
                                                value: String(pt.id ?? pt.ProgramTypeID),
                                                label: pt.name || pt.ProgramTypeName || pt.typename,
                                            })),
                                        ]}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Accreditation Level</label>
                                <CustomSelect
                                    value={accreditationlevel}
                                    onChange={(val) => setAccreditationLevel(val)}
                                    disabled={!isAdmin}
                                    placeholder="Select Accreditation Level"
                                    options={[
                                        { value: "None", label: "None" },
                                        { value: "Candidate", label: "Candidate" },
                                        { value: "Level I", label: "Level I" },
                                        { value: "Level II", label: "Level II" },
                                        { value: "Level III", label: "Level III" },
                                        { value: "Level IV", label: "Level IV" },
                                    ]}
                                />
                            </div>
                        </>
                    )}



                    <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                        {isAdmin && (
                            <>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSaving}
                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSaving && (
                                        <svg className="h-3.5 w-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                    )}
                                    <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                                </button>
                            </>
                        )}
                        {!isAdmin && (
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

import { useEffect, useMemo, useState, useRef } from 'react';
import { criteriaAPI, officesAPI, requirementsAPI } from '../../utils/api';
import ModalHeader from './AddAreaPop/ModalHeader';
import EventStructureSidebar from './AddAreaPop/EventStructureSidebar';
import ToastBanner from './AddAreaPop/ToastBanner';
import AddAreaForm from './AddAreaPop/AddAreaForm';
import AddCriteriaForm from './AddAreaPop/AddCriteriaForm';
import AddRequirementForm from './AddAreaPop/AddRequirementForm';
import StructureLivePreview from './AddAreaPop/StructureLivePreview';
import AssignPanel from './AddAreaPop/AssignPanel';
import { saveButtonClass } from './AddAreaPop/formStyles';
import { useToast } from '../UI/Toast';

export default function AddAreaPop({
	isOpen,
	onClose,
	event,
	areas,
	criteriaOptions,
	onAddArea,
	onAddCriteria,
	onAddRequirement,
	onLoadRequirementsByCriteria,
	onEditArea
}) {
	const { toast } = useToast();
	const [mainMode, setMainMode] = useState('add');
	const [mode, setMode] = useState('add-area'); // for backward compatibility, will be used for add sub-tabs
	const [saving, setSaving] = useState(false);
	const [loadingParents, setLoadingParents] = useState(false);
	const [loadingAssignmentData, setLoadingAssignmentData] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [toastVisible, setToastVisible] = useState(false);
	const toastTimerRef = useRef(null);

	const [areaForm, setAreaForm] = useState({ areacode: '', areaname: '', Description: '' });
	const [criteriaForm, setCriteriaForm] = useState({ criteriacode: '', criterianame: '', Description: '', areaid: '', parentcriteriaid: '' });
	const [requirementForm, setRequirementForm] = useState({ requirementcode: '', Description: '', criteriaid: '', parentrequirementcode: '', AreaFilter: '', ChildCriteriaID: '' });
	const [parentRequirementOptions, setParentRequirementOptions] = useState([]);
	const parentCriteriaOptions = useMemo(() => {
		const list = criteriaOptions || [];
		if (!event) return [];
		// only criteria for this event
		const byEvent = list.filter(c => Number(c.eventid) === Number(event.eventid) || Number(c.eventid) === Number(event.eventid));
		// only top-level criteria (exclude children)
		const topLevel = byEvent.filter((c) => c.parentcriteriaid === null || c.parentcriteriaid === undefined || String(c.parentcriteriaid) === '');
		// if areaid selected, filter by same area; empty means show all
		if (!criteriaForm.areaid) return topLevel;
		if (criteriaForm.areaid === '__no_area__') {
			return topLevel.filter((c) => {
				const noArea = c.areaid === null || c.areaid === undefined || c.areaid === '' || Number(c.areaid) === 0;
				return noArea;
			});
		}
		return topLevel.filter(c => String(c.areaid) === String(criteriaForm.areaid));
	}, [criteriaOptions, criteriaForm.areaid, event]);
	const [eventOffices, setEventOffices] = useState([]);
	const [assignmentCriteriaByArea, setAssignmentCriteriaByArea] = useState({});
	const [assignmentRequirementsByCriteria, setAssignmentRequirementsByCriteria] = useState({});
	const [loadingAssignmentCriteria, setLoadingAssignmentCriteria] = useState(new Set());
	const [loadingAssignmentRequirements, setLoadingAssignmentRequirements] = useState(new Set());
	const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
	const [selectedRequirementIds, setSelectedRequirementIds] = useState([]);
	const [officeSearchTerm, setOfficeSearchTerm] = useState('');
	const [requirementSearchTerm, setRequirementSearchTerm] = useState('');
    

	const filteredCriteriaOptions = useMemo(() => {
		const list = criteriaOptions || [];
		// Only show top-level criteria here (exclude children)
		const topLevel = list.filter((crit) => crit.parentcriteriaid === null || crit.parentcriteriaid === undefined || String(crit.parentcriteriaid) === '');
		const af = requirementForm.AreaFilter;
		if (!af) return [];

		if (af === '__no_area__') {
			return topLevel.filter((crit) => {
				const noArea = crit.areaid === null || crit.areaid === undefined || crit.areaid === '' || Number(crit.areaid) === 0;
				const sameEvent = event && (Number(crit.eventid) === Number(event.eventid) || Number(crit.eventid) === Number(event.eventid));
				return noArea && (event ? sameEvent : true);
			});
		}

		return topLevel.filter(crit => Number(crit.areaid) === Number(af));
	}, [criteriaOptions, requirementForm.AreaFilter, event]);

	// child criteria options for the selected criteria (only direct children)
	const childCriteriaOptions = useMemo(() => {
		if (!requirementForm.criteriaid) return [];
		return (criteriaOptions || []).filter(c => {
			const isChild = c.parentcriteriaid !== undefined && c.parentcriteriaid !== null && String(c.parentcriteriaid) !== '' && String(c.parentcriteriaid) === String(requirementForm.criteriaid);
			const sameEvent = event ? (Number(c.eventid) === Number(event.eventid) || Number(c.eventid) === Number(event.eventid)) : true;
			return isChild && sameEvent;
		});
	}, [criteriaOptions, requirementForm.criteriaid, event]);

	// helper: get the effective base criteriacode for a target criteria id
	const getBaseCriteriaCode = (criteriaid) => {
		if (!criteriaid) return '';
		const list = criteriaOptions || [];
		const crit = list.find(c => String(c.criteriaid) === String(criteriaid) || Number(c.criteriaid) === Number(criteriaid));
		if (!crit) return '';
		const code = crit.criteriacode ?? crit.criteriacode ?? '';
		if (code) return code;
		// if this crit has no code but has a parent, use parent's code
		const parentId = crit.parentcriteriaid ?? crit.parentcriteriaid ?? null;
		if (parentId) {
			const parent = list.find(c => String(c.criteriaid) === String(parentId) || Number(c.criteriaid) === Number(parentId));
			return parent?.criteriacode ?? parent?.criteriacode ?? '';
		}
		return '';
	};

	const resolvedPreviewArea = useMemo(() => {
		if (mode === 'add-area') {
			return areaForm;
		}
		if (mode === 'add-criteria') {
			return (areas || []).find((a) => String(a.areaid) === String(criteriaForm.areaid)) || null;
		}
		if (mode === 'add-requirement') {
			if (requirementForm.AreaFilter === '__no_area__') return null;
			return (areas || []).find((a) => String(a.areaid) === String(requirementForm.AreaFilter)) || null;
		}
		return null;
	}, [mode, areaForm, criteriaForm.areaid, requirementForm.AreaFilter, areas]);

	const resolvedPreviewCriteria = useMemo(() => {
		if (mode === 'add-area') return null;
		if (mode === 'add-criteria') {
			return criteriaForm;
		}
		if (mode === 'add-requirement') {
			return (criteriaOptions || []).find((c) => String(c.criteriaid) === String(requirementForm.criteriaid)) || null;
		}
		return null;
	}, [mode, criteriaForm, requirementForm.criteriaid, criteriaOptions]);

	const resolvedPreviewRequirement = useMemo(() => {
		if (mode !== 'add-requirement') return null;
		return requirementForm;
	}, [mode, requirementForm]);

	const requirementTree = useMemo(() => {
		const eventAreas = (areas || [])
			.filter((area) => !event?.eventid || Number(area.eventid ?? area.EventChildID ?? event.eventid) === Number(event.eventid))
			.slice()
			.sort((a, b) => String(a.areacode || a.areaname || '').localeCompare(String(b.areacode || b.areaname || ''), undefined, { numeric: true, sensitivity: 'base' }));

		return eventAreas.map((area) => {
			const areaid = Number(area.areaid);
			const criteria = (assignmentCriteriaByArea[areaid] || []).map((crit) => {
				const criteriaid = Number(crit.criteriaid);
				const code = crit.criteriacode ?? crit.criteriacode ?? '';
				const name = crit.criterianame ?? crit.criterianame ?? '';
				const requirementsLoaded = Object.prototype.hasOwnProperty.call(assignmentRequirementsByCriteria, criteriaid);
				return {
					...crit,
					id: criteriaid,
					key: `criteria-${criteriaid}`,
					label: code ? `${code} - ${name}` : name,
					requirements: requirementsLoaded ? assignmentRequirementsByCriteria[criteriaid] || [] : [],
					requirementsLoaded,
				};
			});

			const areacode = area.areacode ?? area.areacode ?? '';
			const areaname = area.areaname ?? area.areaname ?? '';
			return {
				...area,
				id: areaid,
				key: `area-${areaid}`,
				label: areacode ? `${areacode} - ${areaname}` : areaname,
				criteria,
				criteriaLoaded: Object.prototype.hasOwnProperty.call(assignmentCriteriaByArea, areaid),
			};
		});
	}, [areas, assignmentCriteriaByArea, assignmentRequirementsByCriteria, event?.eventid]);

	const selectedRequirementIdSet = useMemo(() => {
		return new Set(selectedRequirementIds.map((id) => Number(id)));
	}, [selectedRequirementIds]);

	const filteredEventOffices = useMemo(() => {
		const query = officeSearchTerm.trim().toLowerCase();
		if (!query) return eventOffices;

		return eventOffices.filter((office) => {
			const label = String(office.officename || office.officename || '').toLowerCase();
			const typename = String(office.office_type_name || office.typename || '').toLowerCase();
			const headName = String(office.head_name || '').toLowerCase();
			return label.includes(query) || typename.includes(query) || headName.includes(query);
		});
	}, [eventOffices, officeSearchTerm]);

	const filteredRequirementTree = useMemo(() => {
		const query = requirementSearchTerm.trim().toLowerCase();
		if (!query) return requirementTree;

		return requirementTree.reduce((areaAcc, area) => {
			const areaMatches = String(area.label || '').toLowerCase().includes(query);

			if (areaMatches) {
				areaAcc.push(area);
				return areaAcc;
			}

			const nextCriteria = area.criteria.reduce((criteriaAcc, criteria) => {
				const criteriaMatches = String(criteria.label || '').toLowerCase().includes(query);
				const nextRequirements = criteria.requirements.filter((req) => {
					const requirementText = `${req.requirementcode || ''} ${req.Description || ''}`.toLowerCase();
					return criteriaMatches || requirementText.includes(query);
				});

				if (criteriaMatches || nextRequirements.length > 0) {
					criteriaAcc.push({
						...criteria,
						requirements: criteriaMatches ? criteria.requirements : nextRequirements,
					});
				}

				return criteriaAcc;
			}, []);

			if (nextCriteria.length > 0) {
				areaAcc.push({
					...area,
					criteria: nextCriteria,
				});
			}

			return areaAcc;
		}, []);
	}, [requirementTree, requirementSearchTerm]);

	const allOfficeIds = useMemo(() => {
		return filteredEventOffices.map((office) => Number(office.id || office.officeid)).filter(Boolean);
	}, [filteredEventOffices]);

	const allRequirementIds = useMemo(() => {
		return filteredRequirementTree
			.flatMap((area) => area.criteria)
			.flatMap((criteria) => criteria.requirements)
			.map((req) => Number(req.requirementid))
			.filter(Boolean);
	}, [filteredRequirementTree]);

	const allOfficesSelected = allOfficeIds.length > 0 && allOfficeIds.every((id) => selectedOfficeIds.includes(id));
	const allRequirementsSelected = allRequirementIds.length > 0 && allRequirementIds.every((id) => selectedRequirementIdSet.has(id));

	const loadAssignmentCriteriaForArea = async (areaid, force = false) => {
		const normalizedAreaId = Number(areaid);
		if (!Number.isInteger(normalizedAreaId) || normalizedAreaId <= 0) return [];
		if (!force && Object.prototype.hasOwnProperty.call(assignmentCriteriaByArea, normalizedAreaId)) {
			return assignmentCriteriaByArea[normalizedAreaId] || [];
		}

		try {
			setLoadingAssignmentCriteria((prev) => new Set([...prev, normalizedAreaId]));
			const payload = await criteriaAPI.getByArea(normalizedAreaId);
			const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
			setAssignmentCriteriaByArea((prev) => ({ ...prev, [normalizedAreaId]: list }));
			return list;
		} catch (err) {
			console.error('Failed to load assignment criteria:', err);
			setAssignmentCriteriaByArea((prev) => ({ ...prev, [normalizedAreaId]: [] }));
			return [];
		} finally {
			setLoadingAssignmentCriteria((prev) => {
				const next = new Set(prev);
				next.delete(normalizedAreaId);
				return next;
			});
		}
	};

	const loadAssignmentRequirementsForCriteria = async (criteriaid, force = false) => {
		const normalizedCriteriaId = Number(criteriaid);
		if (!Number.isInteger(normalizedCriteriaId) || normalizedCriteriaId <= 0) return [];
		if (!force && Object.prototype.hasOwnProperty.call(assignmentRequirementsByCriteria, normalizedCriteriaId)) {
			return assignmentRequirementsByCriteria[normalizedCriteriaId] || [];
		}

		try {
			setLoadingAssignmentRequirements((prev) => new Set([...prev, normalizedCriteriaId]));
			const payload = await requirementsAPI.getRequirementsByCriteria(normalizedCriteriaId);
			const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
			setAssignmentRequirementsByCriteria((prev) => ({ ...prev, [normalizedCriteriaId]: list }));
			return list;
		} catch (err) {
			console.error('Failed to load assignment requirements:', err);
			setAssignmentRequirementsByCriteria((prev) => ({ ...prev, [normalizedCriteriaId]: [] }));
			return [];
		} finally {
			setLoadingAssignmentRequirements((prev) => {
				const next = new Set(prev);
				next.delete(normalizedCriteriaId);
				return next;
			});
		}
	};

	useEffect(() => {
		if (!isOpen || !event?.eventid || mainMode !== 'assign') return;

		const loadAssignmentData = async () => {
			setLoadingAssignmentData(true);
			setError('');
			setSuccess('');
			try {
				const officesPayload = await officesAPI.getAll();

				const officesList = Array.isArray(officesPayload)
					? officesPayload
					: Array.isArray(officesPayload?.data)
						? officesPayload.data
						: [];

				const filteredOffices = officesList.filter((office) => {
					const officeEventId = office.eventid ?? office.eventid ?? office.eventid;
					return Number(officeEventId) === Number(event.eventid);
				});

				setEventOffices(filteredOffices);

				// Preload all criteria and requirements for this event in batch so searching (e.g. A.1) works immediately
				let eventCriteria = [];
				let eventRequirements = [];
				try {
					const [critRes, reqRes] = await Promise.all([
						criteriaAPI.getByEvent(event.eventid).catch(() => []),
						requirementsAPI.getAllRequirements({ eventid: event.eventid }).catch(() => ({ data: [] })),
					]);
					eventCriteria = Array.isArray(critRes) ? critRes : Array.isArray(critRes?.data) ? critRes.data : [];
					eventRequirements = Array.isArray(reqRes) ? reqRes : Array.isArray(reqRes?.data) ? reqRes.data : [];
				} catch (preErr) {
					console.warn('Could not preload full criteria/requirements:', preErr);
				}

				// Organize criteria by area
				const critByArea = {};
				eventCriteria.forEach((c) => {
					const aId = Number(c.areaid || c.areaid);
					if (aId) {
						if (!critByArea[aId]) critByArea[aId] = [];
						critByArea[aId].push(c);
					}
				});

				// Organize requirements by criteria
				const reqsByCrit = {};
				eventRequirements.forEach((r) => {
					const cId = Number(r.criteriaid || r.criteriaid);
					if (cId) {
						if (!reqsByCrit[cId]) reqsByCrit[cId] = [];
						reqsByCrit[cId].push(r);
					}
				});

				// Ensure all criteria have a requirements entry so requirementsLoaded is true
				eventCriteria.forEach((c) => {
					const cId = Number(c.criteriaid || c.id);
					if (cId && !reqsByCrit[cId]) {
						reqsByCrit[cId] = [];
					}
				});

				setAssignmentCriteriaByArea(critByArea);
				setAssignmentRequirementsByCriteria(reqsByCrit);
				setLoadingAssignmentCriteria(new Set());
				setLoadingAssignmentRequirements(new Set());
				setSelectedOfficeIds([]);
				setSelectedRequirementIds([]);
				setOfficeSearchTerm('');
				setRequirementSearchTerm('');
			} catch (err) {
				showError(err?.message || 'Failed to load offices and requirements for assignment.');
			} finally {
				setLoadingAssignmentData(false);
			}
		};

		loadAssignmentData();
	}, [isOpen, event?.eventid, mainMode]);

	const fieldClass =
		'w-full rounded-lg border border-blue-100 bg-app-surface px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors';

	const resetAndClose = () => {
		setMainMode('add');
		setMode('add-area');
		setError('');
		setSuccess('');
		if (toastTimerRef.current) {
			clearTimeout(toastTimerRef.current);
			toastTimerRef.current = null;
			setToastVisible(false);
		}
		setSaving(false);
		setEventOffices([]);
		setAssignmentCriteriaByArea({});
		setAssignmentRequirementsByCriteria({});
		setLoadingAssignmentCriteria(new Set());
		setLoadingAssignmentRequirements(new Set());
		setCriteriaForm({ criteriacode: '', criterianame: '', Description: '', areaid: '' });
		setAreaForm({ areacode: '', areaname: '', Description: '' });
		setSelectedOfficeIds([]);
		setSelectedRequirementIds([]);
		setOfficeSearchTerm('');
		setRequirementSearchTerm('');
		onClose();
	};

	const setMessage = (msg) => {
		if (toastTimerRef.current) {
			clearTimeout(toastTimerRef.current);
			toastTimerRef.current = null;
		}

		setSuccess(msg);
		setError('');
		setToastVisible(true);

		// Trigger standard floating toast slide-in from right
		toast({ title: 'Success', description: msg, variant: 'success' });

		// fade out after 2.5s, then clear string shortly after
		toastTimerRef.current = setTimeout(() => {
			setToastVisible(false);
			toastTimerRef.current = setTimeout(() => {
				setSuccess('');
				toastTimerRef.current = null;
			}, 400);
		}, 2500);
	};

	const showError = (msg) => {
		if (toastTimerRef.current) {
			clearTimeout(toastTimerRef.current);
			toastTimerRef.current = null;
		}

		setError(msg);
		setSuccess('');
		setToastVisible(true);

		// Trigger standard floating toast slide-in from right
		toast({ title: 'Error', description: msg, variant: 'error' });

		toastTimerRef.current = setTimeout(() => {
			setToastVisible(false);
			toastTimerRef.current = setTimeout(() => {
				setError('');
				toastTimerRef.current = null;
			}, 400);
		}, 4000);
	};

	const handleAddArea = async (e) => {
		e.preventDefault();
		setError('');
		setSuccess('');
		if (!areaForm.areacode.trim() || !areaForm.areaname.trim()) {
			showError('Area code and area name are required.');
			return;
		}
		try {
			setSaving(true);
			await onAddArea(event.eventid, { ...areaForm, Description: areaForm.Description?.trim() ? areaForm.Description : null });
			setAreaForm({ areacode: '', areaname: '', Description: '' });
			setMessage('Area added successfully.');
		} catch (err) {
			showError(err?.message || 'Failed to add area.');
		} finally {
			setSaving(false);
		}
	};

	const handleAddCriteria = async (e) => {
		e.preventDefault();
		setError('');
		setSuccess('');
		// If a parent criteria is selected, child criteria do not require a criteriacode
		if (!criteriaForm.criterianame.trim()) {
			showError('Sub area name is required.');
			return;
		}
		if (!criteriaForm.parentcriteriaid && !criteriaForm.criteriacode.trim()) {
			showError('Sub area code is required for top-level sub areas.');
			return;
		}
		try {
			setSaving(true);
			// ensure criteria code uniqueness within this event (case-insensitive)
			const newCode = String(criteriaForm.criteriacode || '').trim().toLowerCase();
			if (newCode) {
				const duplicate = (criteriaOptions || []).find((c) => String(c.criteriacode || '').trim().toLowerCase() === newCode && Number(c.eventid) === Number(event.eventid));
				if (duplicate) {
					showError('A sub area with this code already exists for this event.');
					setSaving(false);
					return;
				}
			}

					const selectedArea = criteriaForm.areaid;
					const selectedParent = criteriaForm.parentcriteriaid || '';
					await onAddCriteria(event.eventid, {
						// explicitly send criteriacode as null when creating a child criteria
						criteriacode: criteriaForm.parentcriteriaid ? null : criteriaForm.criteriacode,
						...criteriaForm,
						areaid: criteriaForm.areaid ? Number(criteriaForm.areaid) : null,
						parentcriteriaid: criteriaForm.parentcriteriaid === '' ? null : criteriaForm.parentcriteriaid,
						Description: criteriaForm.Description?.trim() ? criteriaForm.Description : null,
					});
			// keep last chosen areaid and parentcriteriaid after saving; clear other fields
			setCriteriaForm({ criteriacode: '', criterianame: '', Description: '', areaid: selectedArea || '', parentcriteriaid: selectedParent || '' });
			setMessage('Sub area added successfully.');
		} catch (err) {
			showError(err?.message || 'Failed to add sub area.');
		} finally {
			setSaving(false);
		}
	};

	const handleAddRequirement = async (e) => {
		e.preventDefault();
		setError('');
		setSuccess('');
		if (!requirementForm.Description.trim() || !requirementForm.criteriaid) {
			showError('Standard description and sub area are required.');
			return;
		}

		try {
			setSaving(true);
			const selectedArea = requirementForm.AreaFilter;
			const selectedCriteria = requirementForm.criteriaid;
			const selectedChild = requirementForm.ChildCriteriaID || '';
			const selectedParent = requirementForm.parentrequirementcode || '';
			await onAddRequirement({
				requirementcode: requirementForm.requirementcode || null,
				Description: requirementForm.Description,
				criteriaid: Number(selectedChild || requirementForm.criteriaid),
				parentrequirementcode: requirementForm.parentrequirementcode || null
			});
			// keep selected Area, Criteria, Child and Parent after saving; clear other fields except preserved selections
			setRequirementForm({ requirementcode: '', Description: '', criteriaid: selectedCriteria || '', ChildCriteriaID: selectedChild || '', parentrequirementcode: selectedParent || '', AreaFilter: selectedArea || '' });
			// reload parent options and regenerate next requirement code for the preserved criteria (preserve parent)
			if (selectedChild) {
				// if we added under a child, reload parent options for that child so the parent list updates immediately
				await loadParentRequirementsFor(selectedChild, true, selectedArea);
			} else if (selectedCriteria) {
				await handleRequirementCriteriaChange(selectedCriteria, true, selectedArea);
			} else {
				setParentRequirementOptions([]);
			}
			setMessage('Standard added successfully.');
		} catch (err) {
			showError(err?.message || 'Failed to add requirement.');
		} finally {
			setSaving(false);
		}
	};

	const handleRequirementCriteriaChange = async (criteriaid, preserveParent = false, areaFilter = null) => {
		setRequirementForm(prev => ({
			...prev,
			criteriaid: criteriaid,
			parentrequirementcode: preserveParent ? prev.parentrequirementcode : '',
			ChildCriteriaID: preserveParent ? prev.ChildCriteriaID : ''
		}));

		if (!criteriaid) {
			setParentRequirementOptions([]);
			return;
		}

		try {
			setLoadingParents(true);
			const options = await onLoadRequirementsByCriteria(Number(criteriaid));
			// DEBUG: log criteriaid and API response for troubleshooting empty parent list
			console.log('[DEBUG] handleRequirementCriteriaChange criteriaid=', criteriaid, 'options=', options);
			let list = Array.isArray(options) ? options : [];
			// if an area filter is provided (or set in form), filter parent requirement options by area
			// do not filter by area here — parent requirements for a chosen child should come from that child directly
			setParentRequirementOptions(list);

			// auto-generate next requirement code based on criteria code and existing requirements
			const baseCode = getBaseCriteriaCode(criteriaid);
			let nextCode = '';
			if (baseCode) {
				const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const nums = list.map(o => {
					const rc = String(o.requirementcode || '');
					const m = rc.match(new RegExp(`^${escapedBase}\\.(\\d+)$`));
					return m ? Number(m[1]) : null;
				}).filter(n => n !== null);
				const next = nums.length ? Math.max(...nums) + 1 : 1;
				nextCode = `${baseCode}.${next}`;
			}

			setRequirementForm(prev => ({ ...prev, requirementcode: nextCode }));
		} catch {
			setParentRequirementOptions([]);
			setRequirementForm(prev => ({ ...prev, requirementcode: '' }));
		} finally {
			setLoadingParents(false);
		}
	};

	// Load parent requirement options for a given criteria id without changing the selected criteriaid
	const loadParentRequirementsFor = async (criteriaid, preserveParent = false, areaFilter = null) => {
		if (!criteriaid) {
			setParentRequirementOptions([]);
			setRequirementForm(prev => ({ ...prev, requirementcode: '' }));
			return;
		}
		try {
			setLoadingParents(true);
			const options = await onLoadRequirementsByCriteria(Number(criteriaid));
			// DEBUG: log criteriaid and API response for troubleshooting empty parent list
			console.log('[DEBUG] loadParentRequirementsFor criteriaid=', criteriaid, 'options=', options);
			let list = Array.isArray(options) ? options : [];
			// Do not filter by area here; show requirements belonging to the chosen criteria (child or parent)
			setParentRequirementOptions(list);

			// auto-generate next requirement code based on the target criteria code and existing requirements
			const baseCode = getBaseCriteriaCode(criteriaid);
			let nextCode = '';
			if (baseCode) {
				const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const nums = list.map(o => {
					const rc = String(o.requirementcode || '');
					const m = rc.match(new RegExp(`^${escapedBase}\\.(\\d+)$`));
					return m ? Number(m[1]) : null;
				}).filter(n => n !== null);
				const next = nums.length ? Math.max(...nums) + 1 : 1;
				nextCode = `${baseCode}.${next}`;
			}

			setRequirementForm(prev => ({ ...prev, requirementcode: nextCode }));
		} catch {
			setParentRequirementOptions([]);
			setRequirementForm(prev => ({ ...prev, requirementcode: '' }));
		} finally {
			setLoadingParents(false);
		}
	};

	const handleParentRequirementChange = (parentCode) => {
		setRequirementForm(prev => ({ ...prev, parentrequirementcode: parentCode }));

		if (!parentCode) {
			// if no parent selected, regenerate top-level code based on criteria
			const crit = (criteriaOptions || []).find(c => Number(c.criteriaid) === Number(requirementForm.criteriaid));
			const baseCode = crit?.criteriacode || '';
			if (!baseCode) {
				setRequirementForm(prev => ({ ...prev, requirementcode: '' }));
				return;
			}
			const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const nums = parentRequirementOptions.map(o => {
				const rc = String(o.requirementcode || '');
				const m = rc.match(new RegExp(`^${escapedBase}\\.(\\d+)$`));
				return m ? Number(m[1]) : null;
			}).filter(n => n !== null);
			const next = nums.length ? Math.max(...nums) + 1 : 1;
			setRequirementForm(prev => ({ ...prev, requirementcode: `${baseCode}.${next}` }));
			return;
		}

		// generate child code under selected parent (e.g., parentCode.1, parentCode.2)
		const escapedParent = parentCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const nums = parentRequirementOptions.map(o => {
			const rc = String(o.requirementcode || '');
			const m = rc.match(new RegExp(`^${escapedParent}\\.(\\d+)$`));
			return m ? Number(m[1]) : null;
		}).filter(n => n !== null);
		const next = nums.length ? Math.max(...nums) + 1 : 1;
		setRequirementForm(prev => ({ ...prev, requirementcode: `${parentCode}.${next}` }));
	};

	// regenerate requirementcode whenever relevant selection changes
	useEffect(() => {
		const targetCriteriaId = requirementForm.ChildCriteriaID || requirementForm.criteriaid;
		const baseCode = getBaseCriteriaCode(targetCriteriaId || requirementForm.criteriaid);
		if (!baseCode) {
			setRequirementForm(prev => ({ ...prev, requirementcode: '' }));
			return;
		}

		if (requirementForm.parentrequirementcode) {
			// generate child code under selected parent
			const escapedParent = requirementForm.parentrequirementcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const nums = (parentRequirementOptions || []).map(o => {
				const rc = String(o.requirementcode || '');
				const m = rc.match(new RegExp(`^${escapedParent}\\.(\\d+)$`));
				return m ? Number(m[1]) : null;
			}).filter(n => n !== null);
			const next = nums.length ? Math.max(...nums) + 1 : 1;
			setRequirementForm(prev => ({ ...prev, requirementcode: `${requirementForm.parentrequirementcode}.${next}` }));
			return;
		}

		// otherwise generate top-level code under the target criteria
		const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const nums = (parentRequirementOptions || []).map(o => {
			const rc = String(o.requirementcode || '');
			const m = rc.match(new RegExp(`^${escapedBase}\\.(\\d+)$`));
			return m ? Number(m[1]) : null;
		}).filter(n => n !== null);
		const next = nums.length ? Math.max(...nums) + 1 : 1;
		setRequirementForm(prev => ({ ...prev, requirementcode: `${baseCode}.${next}` }));
	}, [requirementForm.parentrequirementcode, requirementForm.ChildCriteriaID, requirementForm.criteriaid, parentRequirementOptions]);

	const toggleOffice = (officeid, checked) => {
		setSelectedOfficeIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(Number(officeid));
			else next.delete(Number(officeid));
			return Array.from(next);
		});
	};

	const toggleRequirement = (requirementid, checked) => {
		setSelectedRequirementIds((prev) => {
			const next = new Set(prev.map((id) => Number(id)));
			if (checked) next.add(Number(requirementid));
			else next.delete(Number(requirementid));
			return Array.from(next);
		});
	};

	const toggleRequirementBatch = (ids, checked) => {
		setSelectedRequirementIds((prev) => {
			const next = new Set(prev.map((id) => Number(id)));
			for (const id of ids) {
				if (checked) next.add(Number(id));
				else next.delete(Number(id));
			}
			return Array.from(next);
		});
	};

	const handleAssignRequirementsToOffices = async (e) => {
		e.preventDefault();
		setError('');
		setSuccess('');

		const normalizedRequirementIds = [...new Set(
			selectedRequirementIds
				.map((id) => Number(id))
				.filter((id) => Number.isInteger(id) && id > 0)
		)];

		if (selectedOfficeIds.length === 0) {
			showError('Select at least one office.');
			return;
		}

		if (normalizedRequirementIds.length === 0) {
			showError('Select at least one standard, sub area, or area.');
			return;
		}

		try {
			setSaving(true);
			const results = await Promise.all(
				selectedOfficeIds.map(async (officeid) => {
					let fallbackAdded = 0;
					let fallbackDuplicates = 0;

					try {
						const existingResponse = await officesAPI.getOfficeRequirements(officeid);
						const existingList = Array.isArray(existingResponse?.data) ? existingResponse.data : [];
						const existingSet = new Set(
							existingList
								.map((row) => Number(row.requirementid))
								.filter((id) => Number.isInteger(id) && id > 0)
						);

						fallbackDuplicates = normalizedRequirementIds.filter((id) => existingSet.has(id)).length;
						fallbackAdded = normalizedRequirementIds.length - fallbackDuplicates;
					} catch {
						fallbackDuplicates = 0;
						fallbackAdded = normalizedRequirementIds.length;
					}

					const result = await officesAPI.addOfficeRequirements(officeid, normalizedRequirementIds);
					const addedRaw = result?.addedCount ?? result?.data?.addedCount;
					const duplicateRaw = result?.duplicateCount ?? result?.data?.duplicateCount;

					const hasBackendCounts = addedRaw !== undefined && duplicateRaw !== undefined;
					if (hasBackendCounts) {
						return {
							added: Number(addedRaw) || 0,
							duplicates: Number(duplicateRaw) || 0,
						};
					}

					return {
						added: fallbackAdded,
						duplicates: fallbackDuplicates,
					};
				})
			);

			let totalAdded = 0;
			let totalDuplicates = 0;

			for (const result of results) {
				totalAdded += Number(result?.added || 0);
				totalDuplicates += Number(result?.duplicates || 0);
			}

			setMessage(
				`${totalDuplicates} duplicate(s) already assigned, ${totalAdded} new requirement(s) added across ${selectedOfficeIds.length} office(s).`
			);
		} catch (err) {
			showError(err?.message || 'Failed to assign requirements to selected offices.');
		} finally {
			setSaving(false);
		}
	};

    
    
	if (!isOpen || !event) return null;

	return (
		<div className="fixed top-4 right-4 bottom-4 z-[50] flex bg-transparent" style={{ left: 'calc(var(--sidebar-width, 0px) + 28px)' }}>
			<div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
				<ModalHeader event={event} onClose={resetAndClose} mainMode={mainMode} />
				<div className="flex min-h-0 flex-1">
					<EventStructureSidebar
						mainMode={mainMode}
						mode={mode}
						onSelectAdd={() => {
							setMainMode('add');
							setMode('add-area');
							setError('');
							setSuccess('');
						}}
						onSelectAssign={() => {
							setMainMode('assign');
							setError('');
							setSuccess('');
						}}
						onSelectAddArea={() => {
							setMainMode('add');
							setMode('add-area');
							setError('');
							setSuccess('');
						}}
						onSelectAddCriteria={() => {
							setMainMode('add');
							setMode('add-criteria');
							setError('');
							setSuccess('');
						}}
						onSelectAddRequirement={() => {
							setMainMode('add');
							setMode('add-requirement');
							setError('');
							setSuccess('');
						}}
					/>

					<div className="relative flex min-w-0 flex-1 flex-col bg-slate-50/50 overflow-y-auto">
						<div
							className={`flex min-h-0 flex-1 flex-col ${
								mainMode === 'assign' ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
							}`}
						>
							{mainMode === 'add' && (
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
									<div className="flex flex-col justify-start">
										{mode === 'add-area' && (
											<AddAreaForm
												fieldClass={fieldClass}
												saving={saving}
												areaForm={areaForm}
												setAreaForm={setAreaForm}
												onSubmit={handleAddArea}
											/>
										)}
										{mode === 'add-criteria' && (
											<AddCriteriaForm
												areas={areas}
												criteriaForm={criteriaForm}
												setCriteriaForm={setCriteriaForm}
												parentCriteriaOptions={parentCriteriaOptions}
												fieldClass={fieldClass}
												saving={saving}
												onSubmit={handleAddCriteria}
											/>
										)}
										{mode === 'add-requirement' && (
											<AddRequirementForm
												areas={areas}
												requirementForm={requirementForm}
												setRequirementForm={setRequirementForm}
												filteredCriteriaOptions={filteredCriteriaOptions}
												handleRequirementCriteriaChange={handleRequirementCriteriaChange}
												onChildCriteriaChange={(val) => {
													if (val) loadParentRequirementsFor(val, false, requirementForm.AreaFilter);
													else if (requirementForm.criteriaid)
														loadParentRequirementsFor(requirementForm.criteriaid, false, requirementForm.AreaFilter);
												}}
												childCriteriaOptions={childCriteriaOptions}
												parentRequirementOptions={parentRequirementOptions}
												handleParentRequirementChange={handleParentRequirementChange}
												loadingParents={loadingParents}
												fieldClass={fieldClass}
												saving={saving}
												onSubmit={handleAddRequirement}
											/>
										)}
									</div>

									<div className="flex flex-col justify-start">
										<StructureLivePreview
											mode={mode}
											areaData={resolvedPreviewArea}
											criteriaData={resolvedPreviewCriteria}
											requirementData={resolvedPreviewRequirement}
											event={event}
										/>
									</div>
								</div>
							)}

							{mainMode === 'assign' && (
								<div className="flex min-h-0 flex-1 flex-col">
								<AssignPanel
									onAssign={handleAssignRequirementsToOffices}
									loadingAssignmentData={loadingAssignmentData}
									allOfficesSelected={allOfficesSelected}
									allOfficeIds={allOfficeIds}
									setSelectedOfficeIds={setSelectedOfficeIds}
									officeSearchTerm={officeSearchTerm}
									setOfficeSearchTerm={setOfficeSearchTerm}
									eventOffices={eventOffices}
									filteredEventOffices={filteredEventOffices}
									selectedOfficeIds={selectedOfficeIds}
									toggleOffice={toggleOffice}
									requirementSearchTerm={requirementSearchTerm}
									setRequirementSearchTerm={setRequirementSearchTerm}
									requirementTree={requirementTree}
									filteredRequirementTree={filteredRequirementTree}
									selectedRequirementIdSet={selectedRequirementIdSet}
									toggleRequirement={toggleRequirement}
									toggleRequirementBatch={toggleRequirementBatch}
									loadCriteriaForArea={loadAssignmentCriteriaForArea}
									loadRequirementsForCriteria={loadAssignmentRequirementsForCriteria}
									loadingCriteriaIds={loadingAssignmentCriteria}
									loadingRequirementIds={loadingAssignmentRequirements}
									allRequirementsSelected={allRequirementsSelected}
									allRequirementIds={allRequirementIds}
									selectedRequirementIds={selectedRequirementIds}
									actionButtonClass={saveButtonClass}
									saving={saving}
									error={error}
									success={success}
									criteriaOptions={criteriaOptions}
								/>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

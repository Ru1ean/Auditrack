import React, { useEffect, useMemo, useState } from "react";
import SmartUserAvatar from "../UI/SmartUserAvatar";
import { eventsAPI, personnelAssignmentsAPI } from "../../utils/api";
import { 
	Award, 
	Layers, 
	Folder, 
	FileText, 
	CheckSquare, 
	Building2, 
	GraduationCap, 
	Plus, 
	Loader2, 
	Info,
	CheckCircle2,
	ChevronRight
} from "lucide-react";

export default function OfficeHeaddetails({ visible, onClose, head, offices = [], onAssignScope }) {
	const [eventStatusById, setEventStatusById] = useState({});
	const [eventNameById, setEventNameById] = useState({});
	const [assignments, setAssignments] = useState([]);
	const [loadingAssignments, setLoadingAssignments] = useState(false);

	const safeHead = head || {};
	const targetUserId = safeHead.userid || safeHead.id || safeHead.headid;

	const getEventId = (office = {}) => {
		const rawId = office.eventid ?? office.eventid ?? office.eventid;
		const parsedId = Number(rawId);
		return Number.isInteger(parsedId) ? parsedId : null;
	};

	// Fetch personnel assignments (Area, Sub-area, Standard hierarchy)
	useEffect(() => {
		if (!visible || !targetUserId) {
			setAssignments([]);
			return;
		}

		let cancelled = false;
		setLoadingAssignments(true);

		personnelAssignmentsAPI.getByUser(targetUserId)
			.then((res) => {
				if (!cancelled) {
					const items = Array.isArray(res) ? res : (res?.data || []);
					setAssignments(items);
				}
			})
			.catch((err) => {
				console.error('Failed to fetch personnel assignments:', err);
				if (!cancelled) setAssignments([]);
			})
			.finally(() => {
				if (!cancelled) setLoadingAssignments(false);
			});

		return () => {
			cancelled = true;
		};
	}, [visible, targetUserId]);

	// Fetch event names and statuses for active filtering
	useEffect(() => {
		if (!visible) return;

		let cancelled = false;

		const fetchEvents = async () => {
			try {
				const response = await eventsAPI.getAllEvents();
				const events = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];

				const fetchedNames = {};
				const fetchedStatuses = {};

				events.forEach((event) => {
					const eventid = Number(event.eventid ?? event.id);
					const eventcode = event.eventcode || event.code || null;
					const eventname = event.eventname || null;
					const label = eventcode || eventname;
					const status = event.status || event.Status || 'active';

					if (Number.isInteger(eventid)) {
						if (label) fetchedNames[eventid] = label;
						fetchedStatuses[eventid] = String(status).toLowerCase();
					}
				});

				if (!cancelled) {
					setEventNameById((prev) => ({ ...prev, ...fetchedNames }));
					setEventStatusById((prev) => ({ ...prev, ...fetchedStatuses }));
				}
			} catch (error) {
				console.error('Failed to fetch events for office head details:', error);
			}
		};

		fetchEvents();

		return () => {
			cancelled = true;
		};
	}, [visible]);

	// Filter active legacy offices
	const activeOffices = useMemo(() => {
		return (offices || []).filter((office) => {
			const eventid = getEventId(office);
			if (!eventid) return true;
			if (!(eventid in eventStatusById)) return true;
			return eventStatusById[eventid] === 'active';
		});
	}, [offices, eventStatusById]);

	const isAcademicProgram = (office = {}) => {
		const typeId = Number(office.entitytypeid || office.officetypeid || office.type_id || office.EntityTypeID);
		if (typeId === 1) return true;
		if (typeId === 2) return false;

		const typename = String(
			office.category_name || office.typename || office.office_type_name || office.office_type || office.CategoryName || office.OfficeTypeName || ''
		).toLowerCase();

		if (typename.includes('non academic') || typename.includes('non-academic') || typename.includes('office') || typename.includes('administrative')) {
			return false;
		}
		return typename.includes('academic') || typename.includes('program');
	};

	// Group Scope by Accreditation Event
	const groupedScopeByEvent = useMemo(() => {
		const eventMap = new Map();

		const getEventBucket = (evId, evCode, evName) => {
			const key = evId || 0;
			if (!eventMap.has(key)) {
				const fallbackCode = evId ? eventNameById[evId] : null;
				eventMap.set(key, {
					eventId: evId,
					eventCode: evCode || fallbackCode || 'General',
					eventName: evName || fallbackCode || 'Accreditation Event',
					areas: [],
					criteria: [],
					requirements: [],
					offices: []
				});
			}
			return eventMap.get(key);
		};

		// 1. Process personnel assignments (Areas, Sub-areas, Standards)
		assignments.forEach((pa) => {
			const bucket = getEventBucket(pa.eventid, pa.eventcode, pa.eventname);

			if (pa.requirementid) {
				bucket.requirements.push({
					id: pa.id,
					requirementid: pa.requirementid,
					code: pa.requirementcode || 'Standard',
					description: pa.requirementdescription || '',
					criteriaCode: pa.criteriacode,
					criteriaName: pa.criterianame,
					areaCode: pa.areacode,
					areaName: pa.areaname,
				});
			} else if (pa.criteriaid) {
				bucket.criteria.push({
					id: pa.id,
					criteriaid: pa.criteriaid,
					code: pa.criteriacode || 'Sub-area',
					name: pa.criterianame || '',
					areaCode: pa.areacode,
					areaName: pa.areaname,
				});
			} else if (pa.areaid) {
				bucket.areas.push({
					id: pa.id,
					areaid: pa.areaid,
					code: pa.areacode || 'Area',
					name: pa.areaname || '',
				});
			}
		});

		// 2. Process legacy active offices (if any)
		activeOffices.forEach((office) => {
			const evId = getEventId(office);
			const bucket = getEventBucket(evId, office.eventcode, office.eventname);
			bucket.offices.push(office);
		});

		return Array.from(eventMap.values()).filter(group => 
			group.areas.length > 0 || 
			group.criteria.length > 0 || 
			group.requirements.length > 0 || 
			group.offices.length > 0
		);
	}, [assignments, activeOffices, eventNameById]);

	// Total count calculations
	const totalAssignedAreas = useMemo(() => 
		groupedScopeByEvent.reduce((sum, g) => sum + g.areas.length, 0),
		[groupedScopeByEvent]
	);
	const totalAssignedCriteria = useMemo(() => 
		groupedScopeByEvent.reduce((sum, g) => sum + g.criteria.length, 0),
		[groupedScopeByEvent]
	);
	const totalAssignedRequirements = useMemo(() => 
		groupedScopeByEvent.reduce((sum, g) => sum + g.requirements.length, 0),
		[groupedScopeByEvent]
	);

	if (!visible || !head) return null;

	const fullName = `${safeHead.firstname || ''}${safeHead.middleinitial ? ` ${safeHead.middleinitial}.` : ''} ${safeHead.lastname || ''}`.trim() || 'Office Personnel';

	return (
		<div
			className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
			onClick={onClose}
		>
			<div 
				className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]" 
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 p-5 text-white flex items-center justify-between shrink-0 shadow-sm">
					<div className="flex items-center gap-3 min-w-0">
						<SmartUserAvatar
							user={safeHead}
							fullName={fullName}
							size="h-12 w-12"
							textSize="text-base font-bold"
							ring="border-2 border-white/60 shadow-sm"
						/>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<h3 className="font-bold text-lg text-white leading-tight truncate">
									{fullName}
								</h3>
								<span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-xs">
									{safeHead.Position || safeHead.rolename || 'Office Personnel'}
								</span>
							</div>
							<p className="text-xs text-blue-100 mt-1 truncate">
								{safeHead.Email || safeHead.contactinfo || 'No contact email provided'}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{onAssignScope && (
							<button
								type="button"
								onClick={() => onAssignScope(head)}
								className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer shadow-2xs"
								title="Manage Area, Sub-area, or Standard Scope"
							>
								<Layers className="w-3.5 h-3.5" />
								<span>Manage Scope</span>
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition shrink-0 cursor-pointer"
							aria-label="Close"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				{/* Scope Summary Toolbar */}
				<div className="border-b border-slate-200 bg-slate-50 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
							<Award className="h-4 w-4" />
						</div>
						<div>
							<h4 className="text-xs font-bold text-slate-900">Accreditation Scope & Assignments</h4>
							<p className="text-[11px] text-slate-500">Hierarchy assigned to this personnel across all accreditation events</p>
						</div>
					</div>

					{/* Summary Pills */}
					<div className="flex items-center gap-1.5 flex-wrap">
						{totalAssignedAreas > 0 && (
							<span className="inline-flex items-center gap-1 rounded-full bg-blue-100/80 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200/60">
								<Folder className="w-3 h-3 text-blue-600" />
								{totalAssignedAreas} {totalAssignedAreas === 1 ? 'Area' : 'Areas'}
							</span>
						)}
						{totalAssignedCriteria > 0 && (
							<span className="inline-flex items-center gap-1 rounded-full bg-indigo-100/80 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-200/60">
								<FileText className="w-3 h-3 text-indigo-600" />
								{totalAssignedCriteria} {totalAssignedCriteria === 1 ? 'Sub-area' : 'Sub-areas'}
							</span>
						)}
						{totalAssignedRequirements > 0 && (
							<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200/60">
								<CheckSquare className="w-3 h-3 text-emerald-600" />
								{totalAssignedRequirements} {totalAssignedRequirements === 1 ? 'Standard' : 'Standards'}
							</span>
						)}
						{activeOffices.length > 0 && (
							<span className="inline-flex items-center gap-1 rounded-full bg-cyan-100/80 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800 border border-cyan-200/60">
								<Building2 className="w-3 h-3 text-cyan-600" />
								{activeOffices.length} {activeOffices.length === 1 ? 'Office/Program' : 'Offices/Programs'}
							</span>
						)}
					</div>
				</div>

				{/* Main Content Body */}
				<div className="p-5 bg-slate-100/40 overflow-y-auto flex-1 space-y-4">
					{loadingAssignments ? (
						<div className="py-16 text-center">
							<Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600 mb-2" />
							<p className="text-xs font-semibold text-slate-600">Loading assigned accreditation scope...</p>
						</div>
					) : groupedScopeByEvent.length > 0 ? (
						<div className="space-y-4">
							{groupedScopeByEvent.map((group) => {
								return (
									<div 
										key={group.eventId || group.eventCode} 
										className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden transition hover:shadow-xs"
									>
										{/* Accreditation Event Header */}
										<div className="bg-slate-50/90 border-b border-slate-200/80 px-4 py-3 flex items-center justify-between gap-3">
											<div className="flex items-center gap-2.5 min-w-0">
												<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shrink-0 shadow-2xs">
													<Award className="h-4 w-4" />
												</div>
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-extrabold text-xs text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
															{group.eventCode}
														</span>
														<h4 className="text-xs font-bold text-slate-800 truncate" title={group.eventName}>
															{group.eventName}
														</h4>
													</div>
												</div>
											</div>

											<div className="flex items-center gap-1.5 shrink-0">
												<span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700">
													{[
														group.areas.length ? `${group.areas.length} Areas` : null,
														group.criteria.length ? `${group.criteria.length} Sub-areas` : null,
														group.requirements.length ? `${group.requirements.length} Standards` : null,
													].filter(Boolean).join(' • ') || 'Scope Active'}
												</span>
											</div>
										</div>

										{/* Event Body Sections */}
										<div className="p-4 space-y-4">
											{/* 1. Areas Scope */}
											{group.areas.length > 0 && (
												<div>
													<div className="flex items-center gap-1.5 mb-2">
														<Folder className="w-3.5 h-3.5 text-blue-600" />
														<span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
															Assigned Areas ({group.areas.length})
														</span>
														<span className="text-[10px] text-slate-400 font-medium ml-1">
															— Full access to all sub-areas and standards under these areas
														</span>
													</div>

													<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
														{group.areas.map((area) => (
															<div 
																key={`area-${area.id || area.areaid}`}
																className="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/40 p-2.5 text-xs transition hover:bg-blue-50/80"
															>
																<span className="shrink-0 rounded-lg bg-blue-600 text-white font-extrabold px-2 py-1 text-[10px] shadow-2xs">
																	{area.code}
																</span>
																<div className="min-w-0 flex-1">
																	<div className="font-bold text-slate-900 leading-snug">
																		{area.name}
																	</div>
																	<div className="text-[10px] font-semibold text-blue-700 mt-0.5 flex items-center gap-1">
																		<CheckCircle2 className="w-3 h-3 text-blue-500" />
																		<span>Full Area Scope</span>
																	</div>
																</div>
															</div>
														))}
													</div>
												</div>
											)}

											{/* 2. Sub-areas Scope */}
											{group.criteria.length > 0 && (
												<div>
													<div className="flex items-center gap-1.5 mb-2">
														<FileText className="w-3.5 h-3.5 text-indigo-600" />
														<span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
															Assigned Sub-areas / Criteria ({group.criteria.length})
														</span>
														<span className="text-[10px] text-slate-400 font-medium ml-1">
															— Full access to all standards within these sub-areas
														</span>
													</div>

													<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
														{group.criteria.map((crit) => (
															<div 
																key={`crit-${crit.id || crit.criteriaid}`}
																className="flex items-start gap-2.5 rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-2.5 text-xs transition hover:bg-indigo-50/80"
															>
																<span className="shrink-0 rounded-lg bg-indigo-600 text-white font-extrabold px-2 py-1 text-[10px] shadow-2xs">
																	{crit.code}
																</span>
																<div className="min-w-0 flex-1">
																	<div className="font-bold text-slate-900 leading-snug">
																		{crit.name}
																	</div>
																	{crit.areaCode && (
																		<div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
																			<span>{crit.areaCode}: {crit.areaName}</span>
																		</div>
																	)}
																	<div className="text-[10px] font-semibold text-indigo-700 mt-0.5 flex items-center gap-1">
																		<CheckCircle2 className="w-3 h-3 text-indigo-500" />
																		<span>Sub-area Scope</span>
																	</div>
																</div>
															</div>
														))}
													</div>
												</div>
											)}

											{/* 3. Standards Scope */}
											{group.requirements.length > 0 && (
												<div>
													<div className="flex items-center gap-1.5 mb-2">
														<CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
														<span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
															Assigned Specific Standards ({group.requirements.length})
														</span>
														<span className="text-[10px] text-slate-400 font-medium ml-1">
															— Direct assignment to upload evidence for these standards
														</span>
													</div>

													<div className="space-y-2">
														{group.requirements.map((req) => (
															<div 
																key={`req-${req.id || req.requirementid}`}
																className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-3 text-xs transition hover:bg-emerald-50/70"
															>
																<div className="flex items-center justify-between gap-2">
																	<div className="flex items-center gap-2">
																		<span className="shrink-0 rounded-lg bg-emerald-600 text-white font-extrabold px-2 py-0.5 text-[11px] shadow-2xs">
																			{req.code}
																		</span>
																		{req.criteriaCode && (
																			<span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
																				{req.areaCode ? `${req.areaCode} › ` : ''}Criteria {req.criteriaCode}
																			</span>
																		)}
																	</div>
																	<span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
																		Standard Scope
																	</span>
																</div>

																{req.description && (
																	<p className="mt-1.5 text-slate-700 text-[11px] leading-relaxed line-clamp-2">
																		{req.description}
																	</p>
																)}
															</div>
														))}
													</div>
												</div>
											)}

											{/* 4. Legacy Programs / Offices (if any) */}
											{group.offices.length > 0 && (
												<div>
													<div className="flex items-center gap-1.5 mb-2">
														<Building2 className="w-3.5 h-3.5 text-cyan-600" />
														<span className="text-[11px] font-bold uppercase tracking-wider text-cyan-900">
															Programs & Offices Managed ({group.offices.length})
														</span>
													</div>

													<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
														{group.offices.map((office, idx) => {
															const isProg = isAcademicProgram(office);
															const label = office.officename || `Office #${office.id || office.officeid}`;

															return (
																<div 
																	key={`office-${office.id || office.officeid || idx}`}
																	className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-2xs"
																>
																	<div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
																		isProg 
																			? 'bg-cyan-50 border-cyan-200 text-cyan-600' 
																			: 'bg-emerald-50 border-emerald-200 text-emerald-600'
																	}`}>
																		{isProg ? <GraduationCap className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
																	</div>
																	<div className="min-w-0">
																		<span className="font-bold text-slate-900 block truncate">
																			{label}
																		</span>
																		<span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
																			{isProg ? 'Academic Program' : 'Administrative Office'}
																		</span>
																	</div>
																</div>
															);
														})}
													</div>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					) : (
						/* Empty State when no scope or offices are assigned */
						<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-2xs">
							<div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs border border-indigo-100">
								<Layers className="h-7 w-7 text-indigo-600" />
							</div>
							<h4 className="text-base font-bold text-slate-800">No Accreditation Scope Assigned</h4>
							<p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
								This personnel currently has no assigned Areas, Sub-areas, or Standards under any accreditation event.
							</p>

							{onAssignScope && (
								<div className="mt-5">
									<button
										type="button"
										onClick={() => onAssignScope(head)}
										className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
									>
										<Plus className="w-4 h-4" />
										<span>Assign Scope to Personnel</span>
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
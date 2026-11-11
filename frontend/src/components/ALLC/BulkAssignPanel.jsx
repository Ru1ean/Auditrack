import React, { useMemo, useState, useEffect } from 'react';

function Checkbox({ checked, onChange, className = '' }) {
	return (
		<input
			type="checkbox"
			className={`h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 ${className}`}
			checked={checked}
			onChange={onChange}
		/>
	);
}

const getAreaId = (area) => Number(area.id || String(area.key || '').replace('area-', ''));
const getCriteriaId = (criteria) => Number(criteria.id || criteria.criteriaid || String(criteria.key || '').replace('criteria-', ''));

export default function BulkAssignPanel({
	onAssign,
	loadingAssignmentData,
	allOfficesSelected,
	allOfficeIds,
	setSelectedOfficeIds,
	officeSearchTerm,
	setOfficeSearchTerm,
	eventOffices,
	filteredEventOffices,
	selectedOfficeIds,
	toggleOffice,
	requirementSearchTerm,
	setRequirementSearchTerm,
	requirementTree,
	filteredRequirementTree,
	selectedRequirementIdSet,
	toggleRequirement,
	toggleRequirementBatch,
	loadCriteriaForArea,
	loadRequirementsForCriteria,
	loadingCriteriaIds = new Set(),
	loadingRequirementIds = new Set(),
	allRequirementsSelected,
	allRequirementIds,
	selectedRequirementIds,
	actionButtonClass,
	saving,
	error,
	success,
}) {
	const [expandedAreas, setExpandedAreas] = useState(() => new Set());
	const [expandedCriteria, setExpandedCriteria] = useState(() => new Set());
	const [expandedReqIds, setExpandedReqIds] = useState(() => new Set());
	const [activeOfficeTab, setActiveOfficeTab] = useState("All");

	const formatDateString = (dateStr) => {
		if (!dateStr) return "N/A";
		try {
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return "N/A";
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric"
			});
		} catch {
			return "N/A";
		}
	};

	const displayedOffices = useMemo(() => {
		let list = filteredEventOffices || [];
		
		if (activeOfficeTab === "Programs") {
			list = list.filter(o => o.entitytypeid === 1 || String(o.category_name || o.typename || "").toLowerCase().includes("academic program") || String(o.category_name || o.typename || "").toLowerCase().includes("program"));
		} else if (activeOfficeTab === "Offices") {
			list = list.filter(o => o.entitytypeid === 2 || String(o.category_name || o.typename || "").toLowerCase().includes("non-academic") || String(o.category_name || o.typename || "").toLowerCase().includes("office"));
		}
		
		return list;
	}, [filteredEventOffices, activeOfficeTab]);

	const displayedOfficeIds = useMemo(() => {
		return displayedOffices.map((o) => Number(o.id || o.officeid)).filter(Boolean);
	}, [displayedOffices]);

	const allDisplayedSelected = displayedOfficeIds.length > 0 && displayedOfficeIds.every(id => selectedOfficeIds.includes(id));

	const officeCount = selectedOfficeIds.length;
	const reqCount = selectedRequirementIds.length;

	const toggleSet = (setter, id) => {
		setter((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const buildCriteriaTree = (criteriaList = []) => {
		const nodeMap = new Map();
		const roots = [];

		for (const criteria of criteriaList) {
			const id = Number(criteria.criteriaid);
			nodeMap.set(id, {
				...criteria,
				id,
				key: criteria.key || `criteria-${id}`,
				label: criteria.label || (criteria.criteriacode ? `${criteria.criteriacode} - ${criteria.criterianame}` : criteria.criterianame),
				requirements: criteria.requirements || [],
				requirementsLoaded: Boolean(criteria.requirementsLoaded),
				children: [],
			});
		}

		for (const node of nodeMap.values()) {
			const parentId = node.parentcriteriaid ?? node.parentcriteriaid ?? null;
			if (parentId && nodeMap.has(Number(parentId))) {
				nodeMap.get(Number(parentId)).children.push(node);
			} else {
				roots.push(node);
			}
		}

		return roots;
	};

	const gatherLoadedRequirementIds = (node) => {
		const own = (node.requirements || []).map((req) => Number(req.requirementid)).filter(Boolean);
		const childIds = (node.children || []).flatMap((child) => gatherLoadedRequirementIds(child));
		return [...own, ...childIds];
	};

	const loadRequirementsForNode = async (node) => {
		const criteriaid = getCriteriaId(node);
		const loaded = await loadRequirementsForCriteria?.(criteriaid);
		return (loaded || []).map((req) => Number(req.requirementid)).filter(Boolean);
	};

	const renderCriteriaNode = (node, depth = 0) => {
		const criteriaid = getCriteriaId(node);
		const critKey = node.key || `criteria-${criteriaid}`;
		const critExpanded = expandedCriteria.has(critKey);
		const loading = loadingRequirementIds.has(criteriaid);
		const loadedReqIds = Array.from(new Set(gatherLoadedRequirementIds(node)));
		const criteriaChecked = loadedReqIds.length > 0 && loadedReqIds.every((id) => selectedRequirementIdSet.has(id));
		const requirementsLoaded = Boolean(node.requirementsLoaded);

		const handleExpand = async () => {
			toggleSet(setExpandedCriteria, critKey);
			if (!critExpanded && !requirementsLoaded) {
				await loadRequirementsForNode(node);
			}
		};

		const handleCheck = async (checked) => {
			const ids = requirementsLoaded ? loadedReqIds : await loadRequirementsForNode(node);
			toggleRequirementBatch(ids, checked);
		};

		return (
			<div key={critKey} className={depth > 0 ? 'ml-3 border-l-2 border-slate-200 pl-3 mt-2' : 'mt-2'}>
				<div className={`flex items-start gap-2.5 rounded-xl p-2.5 transition-all bg-blue-500 text-white shadow-sm hover:bg-blue-600`}>
					<Checkbox
						className="border-white/50 bg-white text-blue-600 focus:ring-white/30"
						checked={criteriaChecked}
						onChange={(event) => handleCheck(event.target.checked)}
					/>
					<button type="button" className="min-w-0 flex-1 text-left" onClick={handleExpand}>
						<span className="text-[9px] font-bold uppercase tracking-wider text-blue-100">Sub Area</span>
						<p className="text-xs font-semibold leading-snug text-white">{node.label}</p>
					</button>
					<span className="shrink-0 rounded-[4px] bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white border border-white/10">
						{requirementsLoaded ? loadedReqIds.length : '...'}
					</span>
					<button
						type="button"
						className="shrink-0 rounded p-1 text-blue-100 hover:bg-white/15 hover:text-white"
						onClick={handleExpand}
						aria-label={critExpanded ? 'Collapse' : 'Expand'}
					>
						<svg className={`h-4 w-4 transition ${critExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
				</div>

				{critExpanded && (
					<div className="mt-2 space-y-2 pb-2 pl-5">
						{loading && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Loading standards...</p>}
						{!loading && requirementsLoaded && (node.requirements || []).length === 0 && (
							<p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No standards</p>
						)}
						{(node.requirements || []).map((req) => {
							const reqId = Number(req.requirementid);
							const reqChecked = selectedRequirementIdSet.has(reqId);
							const reqLabel = req.requirementcode ? `${req.requirementcode} - ${req.Description}` : req.Description;
							const reqExpanded = expandedReqIds.has(reqId);

							return (
								<label
									key={reqId}
									className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-l-4 px-3 py-2.5 text-xs transition-all ${
										reqChecked
											? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm font-semibold'
											: 'border-blue-300 bg-blue-50/20 text-slate-700 hover:bg-blue-50/40'
									}`}
								>
									<Checkbox 
										className="border-slate-350 text-blue-600 focus:ring-blue-500/30"
										checked={reqChecked} 
										onChange={(event) => toggleRequirement(reqId, event.target.checked)} 
									/>
									<span className={`min-w-0 flex-1 leading-normal font-medium ${reqExpanded ? '' : 'line-clamp-2'}`}>{reqLabel}</span>
									<button
										type="button"
										className="shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition"
										onClick={(event) => {
											event.preventDefault();
											toggleSet(setExpandedReqIds, reqId);
										}}
									>
										{reqExpanded ? 'Less' : 'More'}
									</button>
								</label>
							);
						})}
						{(node.children || []).map((child) => renderCriteriaNode(child, depth + 1))}
					</div>
				)}
			</div>
		);
	};

	const treesWithRoots = useMemo(() => {
		return filteredRequirementTree.map((area) => ({
			...area,
			roots: buildCriteriaTree(area.criteria),
		}));
	}, [filteredRequirementTree]);

	// Auto-expand areas and criteria when search term is active so matching items are visible immediately
	useEffect(() => {
		const q = (requirementSearchTerm || '').trim().toLowerCase();
		if (!q) return;

		const nextExpandedAreas = new Set();
		const nextExpandedCriteria = new Set();

		(treesWithRoots || []).forEach((area) => {
			nextExpandedAreas.add(area.key);

			const expandBranch = (node) => {
				const critKey = node.key || `criteria-${getCriteriaId(node)}`;
				nextExpandedCriteria.add(critKey);
				(node.children || []).forEach(expandBranch);
			};

			(area.roots || []).forEach(expandBranch);
		});

		setExpandedAreas(nextExpandedAreas);
		setExpandedCriteria(nextExpandedCriteria);
	}, [requirementSearchTerm, treesWithRoots]);

	const loadAreaRequirementIds = async (area) => {
		const areaid = getAreaId(area);
		const criteriaList = area.criteriaLoaded ? area.criteria || [] : await loadCriteriaForArea?.(areaid);
		const reqLists = await Promise.all((criteriaList || []).map((criteria) => loadRequirementsForCriteria?.(criteria.criteriaid)));
		return reqLists.flat().map((req) => Number(req.requirementid)).filter(Boolean);
	};

	const handleAreaExpand = async (area) => {
		const isExpanded = expandedAreas.has(area.key);
		toggleSet(setExpandedAreas, area.key);
		if (!isExpanded && !area.criteriaLoaded) {
			await loadCriteriaForArea?.(getAreaId(area));
		}
	};

	const handleAreaCheck = async (area, checked, loadedIds) => {
		const allRequirementsLoaded = (area.roots || []).every((root) => {
			const stack = [root];
			while (stack.length > 0) {
				const node = stack.pop();
				if (!node.requirementsLoaded) return false;
				stack.push(...(node.children || []));
			}
			return true;
		});
		const ids = area.criteriaLoaded && allRequirementsLoaded ? loadedIds : await loadAreaRequirementIds(area);
		toggleRequirementBatch(ids, checked);
	};

	return (
		<form onSubmit={onAssign} className="flex h-full min-h-0 flex-col">
			{loadingAssignmentData ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
					<p className="text-sm text-slate-500">Loading offices and areas...</p>
				</div>
			) : (
				<>
					<div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,28%)_minmax(0,1fr)]">
						<section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200/90 bg-app-surface">
							<div className="border-b border-slate-300/50 px-3 py-3 flex flex-col gap-2 shrink-0">
								<div className="flex items-center justify-between gap-2">
									<h3 className="text-sm font-semibold text-slate-800">1. Select programs and offices</h3>
									<label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
										<Checkbox
											checked={allDisplayedSelected}
											onChange={(event) => {
												if (event.target.checked) {
													const nextIds = Array.from(new Set([...selectedOfficeIds, ...displayedOfficeIds]));
													setSelectedOfficeIds(nextIds);
												} else {
													const nextIds = selectedOfficeIds.filter(id => !displayedOfficeIds.includes(id));
													setSelectedOfficeIds(nextIds);
												}
											}}
										/>
										All
									</label>
								</div>
								<input
									type="search"
									className="w-full rounded-lg border border-slate-300/60 bg-white px-2.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
									placeholder="Search programs and offices..."
									value={officeSearchTerm}
									onChange={(event) => setOfficeSearchTerm(event.target.value)}
								/>
								
								{/* Programs & Offices Filtering Tabs */}
								<div className="flex border-b border-slate-200 mt-1">
									{["All", "Programs", "Offices"].map((tab) => {
										const isSelected = activeOfficeTab === tab;
										return (
											<button
												key={tab}
												type="button"
												onClick={() => setActiveOfficeTab(tab)}
												className={`pb-1.5 px-3 text-[11px] font-semibold transition-all border-b-2 -mb-[1.5px] ${
													isSelected 
														? 'border-blue-600 text-blue-600' 
														: 'border-transparent text-slate-500 hover:text-slate-800'
												}`}
											>
												{tab}
											</button>
										);
									})}
								</div>
							</div>
							<div className="flex-1 space-y-3 overflow-y-auto p-3 [scrollbar-width:thin]">
								{eventOffices.length === 0 ? (
									<p className="px-2 py-4 text-center text-xs text-slate-500">No programs or offices for this event.</p>
								) : displayedOffices.length === 0 ? (
									<p className="px-2 py-4 text-center text-xs text-slate-500">No matching records found.</p>
								) : (
									displayedOffices.map((office) => {
										const officeid = Number(office.id || office.officeid);
										const checked = selectedOfficeIds.includes(officeid);
										const isAcademic = office.entitytypeid === 1 || String(office.category_name || office.typename || "").toLowerCase().includes("academic program") || String(office.category_name || office.typename || "").toLowerCase().includes("program");
										
										return (
											<label
												key={officeid}
												className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all relative ${
													checked
														? 'border-blue-300 bg-blue-50/40 text-slate-800 shadow-sm'
														: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm'
												}`}
											>
												{/* Checkbox on the left */}
												<div className="pt-1.5 shrink-0">
													<Checkbox checked={checked} onChange={(event) => toggleOffice(officeid, event.target.checked)} />
												</div>
												
												{/* Card Content on the right */}
												<div className="flex-1 min-w-0 flex flex-col gap-2.5">
													{/* Header: Icon + Name */}
													<div className="flex items-center gap-2.5 min-w-0">
														{/* Icon */}
														{isAcademic ? (
															<div className="h-8 w-8 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100">
																<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
																	<path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A57.778 57.778 0 0012 13.5" />
																</svg>
															</div>
														) : (
															<div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
																<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
																	<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 16.5h1.5m3 0H15M9 21v-3a1 1 0 011-1h4a1 1 0 011 1v3" />
																</svg>
															</div>
														)}
														
														{/* Name & Subtitle */}
														<div className="min-w-0">
															<h5 className="text-[10px] font-bold text-slate-800 truncate leading-snug">
																{office.officename || office.officename}
															</h5>
																<p className="text-[8.5px] text-slate-500 truncate leading-normal mt-0.5">
																	{office.department_name || 'Institution-wide'}
																</p>
														</div>
													</div>

													{/* Dates Grid */}
													<div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[8px] text-slate-400 font-semibold tracking-wider">
														<div>
															<p className="uppercase text-[7.5px] text-slate-400 font-bold mb-0.5">Created</p>
															<p className="text-slate-600 font-bold">{formatDateString(office.createdat)}</p>
														</div>
														<div>
															<p className="uppercase text-[7.5px] text-slate-400 font-bold mb-0.5">Updated</p>
															<p className="text-slate-600 font-bold">{formatDateString(office.updatedat)}</p>
														</div>
													</div>

													{/* Bottom Badges */}
													<div className="flex items-center justify-between border-t border-slate-50 pt-1.5 mt-0.5">
														<span className={`px-1 rounded-[3px] text-[7.5px] font-bold border ${
															isAcademic
																? 'bg-blue-50 text-blue-700 border-blue-150'
																: 'bg-emerald-50 text-emerald-700 border-emerald-150'
														}`}>
															{isAcademic ? 'Academic Program' : 'Non-Academic Office'}
														</span>
														
															<span className="text-[7.5px] font-bold text-slate-450 uppercase tracking-wider">
																{office.department_name || 'Institution-wide'}
															</span>
													</div>
												</div>
											</label>
										);
									})
								)}
							</div>
						</section>

						<section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200/90 bg-app-surface">
							<div className="border-b border-slate-100/80 px-4 py-3.5 bg-slate-50/50">
								<div className="flex items-center justify-between gap-2">
									<h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Select standards</h3>
									<label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition">
										<Checkbox checked={allRequirementsSelected} onChange={(event) => toggleRequirementBatch(allRequirementIds, event.target.checked)} />
										All
									</label>
								</div>
								<p className="mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Area &gt; Sub Area &gt; Standard</p>
								<div className="mt-3 relative">
									<svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
									</svg>
									<input
										type="text"
										className="w-full rounded-lg border border-slate-200 pl-10 pr-8 py-2 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:bg-slate-100/50 focus:bg-white transition-all shadow-sm"
										placeholder="Search areas, sub areas, or standards (e.g. A.1)..."
										value={requirementSearchTerm}
										onChange={(event) => setRequirementSearchTerm(event.target.value)}
									/>
									{requirementSearchTerm && (
										<button
											type="button"
											onClick={() => setRequirementSearchTerm('')}
											className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors"
											title="Clear search"
										>
											<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									)}
								</div>
							</div>
							<div className="flex-1 space-y-3 overflow-y-auto p-3 [scrollbar-width:thin]">
								{requirementTree.length === 0 ? (
									<p className="py-8 text-center text-xs text-slate-500">No areas for this accreditation.</p>
								) : treesWithRoots.length === 0 ? (
									<div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
										<p>No standards match "{requirementSearchTerm}".</p>
										<button
											type="button"
											onClick={() => setRequirementSearchTerm('')}
											className="text-xs text-blue-600 hover:underline font-semibold"
										>
											Clear search
										</button>
									</div>
								) : (
									treesWithRoots.map((area) => {
										const areaRequirementIds = area.roots.flatMap((root) => gatherLoadedRequirementIds(root));
										const areaChecked = areaRequirementIds.length > 0 && areaRequirementIds.every((id) => selectedRequirementIdSet.has(id));
										const areaExpanded = expandedAreas.has(area.key);
										const areaLoading = loadingCriteriaIds.has(getAreaId(area));

										return (
											<div key={area.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
												<div className="flex items-center gap-2 bg-blue-600 px-3.5 py-3 text-white">
													<Checkbox
														className="border-white/50 bg-white text-blue-600 focus:ring-white/30"
														checked={areaChecked}
														onChange={(event) => handleAreaCheck(area, event.target.checked, areaRequirementIds)}
													/>
													<button type="button" className="min-w-0 flex-1 text-left" onClick={() => handleAreaExpand(area)}>
														<span className="text-[9px] font-bold uppercase tracking-wider text-blue-100">Area</span>
														<p className="truncate text-xs font-bold leading-normal text-white">{area.label}</p>
													</button>
													<span className="rounded-[4px] bg-white/15 px-1.5 py-0.5 text-[9px] font-bold border border-white/10 text-white">
														{area.criteriaLoaded ? areaRequirementIds.length : '...'}
													</span>
													<button type="button" className="rounded p-1 text-blue-100 hover:bg-white/15 hover:text-white" onClick={() => handleAreaExpand(area)}>
														<svg className={`h-4 w-4 transition ${areaExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
															<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
														</svg>
													</button>
												</div>

												{areaExpanded && (
													<div className="space-y-2 p-3">
														{areaLoading ? (
															<p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Loading sub areas...</p>
														) : area.roots.length === 0 ? (
															<p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No sub areas</p>
														) : (
															area.roots.map((root) => renderCriteriaNode(root))
														)}
													</div>
												)}
											</div>
										);
									})
								)}
							</div>
						</section>
					</div>

					<footer className="mt-4 flex shrink-0 flex-col gap-3 border-t border-slate-200/60 bg-white pt-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex flex-wrap items-center gap-3 text-xs">
							<span className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 shadow-sm">
								<span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mr-1.5">Offices</span> {officeCount}
							</span>
							<span className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 shadow-sm">
								<span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mr-1.5">Standards</span> {reqCount}
							</span>
							{(error || success) && (
								<p className={`text-xs font-medium ${error ? 'text-rose-700' : 'text-emerald-700'}`}>{error || success}</p>
							)}
						</div>
						<button
							type="submit"
							disabled={saving || loadingAssignmentData || officeCount === 0 || reqCount === 0}
							className={`${actionButtonClass} min-w-[160px]`}
						>
							{saving ? 'Assigning...' : 'Assign to offices'}
						</button>
					</footer>
				</>
			)}
		</form>
	);
}


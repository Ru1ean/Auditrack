import React from 'react';
import { ChevronDown, MoreVertical, AlertCircle } from 'lucide-react';
import { formatDateTime } from '../../../utils/formatDateTime';

export default function StructureLivePreview({
	mode = 'add-area',
	areaData = null,
	criteriaData = null,
	requirementData = null,
	event = null,
}) {
	const currentDate = new Date().toISOString();

	// Format Area title
	const formatAreaTitle = (data) => {
		if (!data) return 'AREA (Select Area)';
		const code = (data.areacode || '').trim();
		const name = (data.areaname || '').trim();
		if (!code && !name) return 'AREA: Untitled Area';
		if (!code) return name;
		if (!name) return code.toUpperCase().startsWith('AREA') ? code : `AREA ${code}`;
		return code.toUpperCase().startsWith('AREA') ? `${code}: ${name}` : `AREA ${code}: ${name}`;
	};

	// Format Criteria title
	const formatCriteriaTitle = (data) => {
		if (!data) return 'Sub Area (Select Sub Area)';
		const code = (data.criteriacode || '').trim().replace(/\.$/, '');
		const name = (data.criterianame || '').trim();
		if (!code && !name) return 'Untitled Sub Area';
		if (code && name) return `${code}. ${name}`;
		return code ? `${code}.` : name;
	};

	return (
		<div className="flex flex-col rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
			<div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-100">
				<div className="flex items-center gap-2">
					<span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
					<span className="text-xs font-bold uppercase tracking-wider text-slate-700">
						Structure Live Preview
					</span>
				</div>
				<span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
					{mode === 'add-area' ? 'New Area' : mode === 'add-criteria' ? 'New Sub Area' : 'New Standard'}
				</span>
			</div>

			<div className="space-y-3">
				{/* 1. AREA LEVEL */}
				{mode === 'add-area' && (
					<div>
						{/* Area Card */}
						<div className="bg-blue-600 text-white p-3.5 rounded-xl flex items-center justify-between shadow-sm transition-all duration-200 ring-2 ring-blue-400/40">
							<div className="flex items-center gap-3 min-w-0 flex-1">
								<ChevronDown className="h-5 w-5 shrink-0 text-white/90" />
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-[15px] truncate">
										{formatAreaTitle(areaData)}
									</p>
									<div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-blue-100/90">
										<span>Created: {formatDateTime(currentDate)}</span>
										<span>Updated: {formatDateTime(currentDate)}</span>
									</div>
								</div>
							</div>
							<div className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/10 text-white">
								<MoreVertical className="h-4 w-4" />
							</div>
						</div>

						{/* Sub-tree empty state connector */}
						<div className="relative ml-6 pl-6 my-3">
							<span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300/60 rounded-full" />
							<div className="relative">
								<span className="absolute -left-6 top-4 w-5 h-1 bg-blue-300/60 rounded-r-full" />
								<div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 text-center">
									<p className="text-xs text-slate-500 font-medium">No sub areas or standards yet</p>
									<p className="text-[11px] text-slate-400 mt-0.5">This area will be created as an empty section ready for sub areas.</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* 2. CRITERIA LEVEL */}
				{mode === 'add-criteria' && (
					<div>
						{/* Parent Area (if selected or placeholder) */}
						{areaData ? (
							<div className="bg-blue-600/90 text-white p-3 rounded-xl flex items-center justify-between shadow-xs opacity-95">
								<div className="flex items-center gap-2.5 min-w-0 flex-1">
									<ChevronDown className="h-4 w-4 shrink-0 text-white/80" />
									<div className="min-w-0 flex-1">
										<p className="font-medium text-sm truncate">
											{formatAreaTitle(areaData)}
										</p>
										<div className="mt-0.5 flex flex-wrap gap-2 text-[9px] text-blue-100/80">
											<span>Created: {formatDateTime(areaData.createdat || currentDate)}</span>
										</div>
									</div>
								</div>
								<div className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-white">
									<MoreVertical className="h-3.5 w-3.5" />
								</div>
							</div>
						) : (
							<div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-2.5 text-xs text-blue-600 font-medium flex items-center gap-1.5">
								<AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
								<span>No parent area selected (Top-level / Global Sub Area)</span>
							</div>
						)}

						{/* Nested Criteria Branch */}
						<div className="relative ml-6 pl-6 my-3">
							<span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-full" />
							<div className="relative">
								<span className="absolute -left-6 top-6 w-5 h-1 bg-blue-400 rounded-r-full" />
								{/* Criteria Item Card */}
								<div className="bg-blue-500 text-white p-3 rounded-xl flex items-center justify-between shadow-sm ring-2 ring-blue-400/40">
									<div className="flex items-center gap-2.5 min-w-0 flex-1">
										<ChevronDown className="h-4 w-4 shrink-0 text-white" />
										<div className="min-w-0 flex-1">
											<p className="font-semibold text-sm truncate">
												{formatCriteriaTitle(criteriaData)}
											</p>
											<div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-blue-100">
												<span>Created: {formatDateTime(currentDate)}</span>
												<span>Updated: {formatDateTime(currentDate)}</span>
											</div>
										</div>
									</div>
									<div className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/40 bg-white/10 text-white">
										<MoreVertical className="h-3.5 w-3.5" />
									</div>
								</div>

								{/* Criteria description if typed */}
								{criteriaData?.Description && (
									<div className="mt-2 text-xs text-slate-600 bg-blue-50/60 rounded-lg p-2.5 border border-blue-100">
										<span className="font-semibold text-slate-700">Description: </span>
										{criteriaData.Description}
									</div>
								)}

								{/* Sub-tree empty state */}
								<div className="relative ml-5 pl-5 my-2.5">
									<span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300/50 rounded-full" />
									<div className="relative">
										<span className="absolute -left-5 top-4 w-4 h-1 bg-blue-300/50 rounded-r-full" />
										<div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-2.5 text-center">
											<p className="text-xs text-slate-500 font-medium">No standards yet</p>
											<p className="text-[11px] text-slate-400 mt-0.5">Standards can be assigned under this sub area once created.</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* 3. REQUIREMENT LEVEL */}
				{mode === 'add-requirement' && (
					<div>
						{/* Parent Area (if selected) */}
						{areaData ? (
							<div className="bg-blue-600/90 text-white p-3 rounded-xl flex items-center justify-between shadow-xs opacity-95">
								<div className="flex items-center gap-2.5 min-w-0 flex-1">
									<ChevronDown className="h-4 w-4 shrink-0 text-white/80" />
									<div className="min-w-0 flex-1">
										<p className="font-medium text-sm truncate">
											{formatAreaTitle(areaData)}
										</p>
										<div className="mt-0.5 flex flex-wrap gap-2 text-[9px] text-blue-100/80">
											<span>Created: {formatDateTime(areaData.createdat || currentDate)}</span>
										</div>
									</div>
								</div>
								<div className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-white">
									<MoreVertical className="h-3.5 w-3.5" />
								</div>
							</div>
						) : (
							<div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-2.5 text-xs text-blue-600 font-medium flex items-center gap-1.5">
								<AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
								<span>Select an Area to attach this standard</span>
							</div>
						)}

						{/* Criteria Branch */}
						<div className="relative ml-6 pl-6 my-2.5">
							<span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-full" />
							<div className="relative">
								<span className="absolute -left-6 top-5 w-5 h-1 bg-blue-400 rounded-r-full" />
								{criteriaData ? (
									<div className="bg-blue-500 text-white p-2.5 rounded-xl flex items-center justify-between shadow-xs">
										<div className="flex items-center gap-2 min-w-0 flex-1">
											<ChevronDown className="h-4 w-4 shrink-0 text-white/90" />
											<div className="min-w-0 flex-1">
												<p className="font-semibold text-xs truncate">
													{formatCriteriaTitle(criteriaData)}
												</p>
												<div className="mt-0.5 flex flex-wrap gap-2 text-[9px] text-blue-100/80">
													<span>Created: {formatDateTime(criteriaData.createdat || currentDate)}</span>
												</div>
											</div>
										</div>
										<div className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-white">
											<MoreVertical className="h-3 w-3" />
										</div>
									</div>
								) : (
									<div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-2 text-xs text-blue-600 font-medium flex items-center gap-1.5">
										<AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
										<span>Select a Sub Area to place this standard</span>
									</div>
								)}

								{/* Requirement Card */}
								<div className="relative ml-5 pl-5 my-2.5">
									<span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-full" />
									<div className="relative">
										<span className="absolute -left-5 top-5 w-4 h-1 bg-blue-400 rounded-r-full" />
										<div className="bg-blue-100 border-l-4 border-blue-500 p-3 rounded-lg flex items-start gap-3 shadow-xs ring-2 ring-blue-400/40">
											<div className="flex-1 min-w-0">
												<p className="font-bold text-slate-800 text-sm">
													{requirementData?.requirementcode?.trim() || 'A.1 (Code)'}
												</p>
												<p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">
													{requirementData?.Description?.trim() || 'Standard description text will appear here...'}
												</p>
												<div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
													<span>Created: {formatDateTime(currentDate)}</span>
													<span>Updated: {formatDateTime(currentDate)}</span>
												</div>
											</div>
											<div className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 shadow-2xs">
												<MoreVertical className="h-3.5 w-3.5" />
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

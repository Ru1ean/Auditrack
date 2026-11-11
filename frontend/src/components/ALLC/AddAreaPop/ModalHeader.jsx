export default function ModalHeader({ event, onClose, mainMode }) {
	const subtitle =
		mainMode === 'assign'
			? 'Assign standards from your accreditation structure to one or more offices.'
			: 'Create and organize areas, sub areas, and standards.';

	return (
		<header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/60 bg-white px-6 py-5">
			<div className="min-w-0">
				<h2 className="text-lg font-bold tracking-tight text-slate-900 leading-normal">Manage accreditation structure</h2>
				<p className="mt-0.5 text-xs text-slate-500 leading-normal">{subtitle}</p>
				{event && (
					<div className="mt-1.5">
						<span className="inline-flex items-center rounded-[6px] border border-blue-150 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 shadow-sm">
							{event.eventcode || event.eventname}
						</span>
					</div>
				)}
			</div>
			<button
				type="button"
				onClick={onClose}
				className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 shadow-sm"
				aria-label="Close"
			>
				<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
					<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</header>
	);
}

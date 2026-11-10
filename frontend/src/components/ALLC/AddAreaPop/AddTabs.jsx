export default function AddTabs({ mode, setMode, tabClass }) {
	return (
		<div className="grid grid-cols-3 gap-2 mb-4 rounded-xl border border-slate-200 bg-slate-100 p-1">
			<button onClick={() => setMode('add-area')} className={tabClass(mode === 'add-area')}>
				Add Area
			</button>
			<button onClick={() => setMode('add-criteria')} className={tabClass(mode === 'add-criteria')}>
				Add Criteria
			</button>
			<button onClick={() => setMode('add-requirement')} className={tabClass(mode === 'add-requirement')}>
				Add Evidence
			</button>
		</div>
	);
}

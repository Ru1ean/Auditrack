export default function ModeTabs({ mainMode, onSelectAdd, onSelectAssign, mainTabClass }) {
	return (
		<div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
			<button onClick={onSelectAdd} className={mainTabClass(mainMode === 'add')}>
				Add
			</button>
			<button onClick={onSelectAssign} className={mainTabClass(mainMode === 'assign')}>
				Assign To Offices
			</button>
		</div>
	);
}

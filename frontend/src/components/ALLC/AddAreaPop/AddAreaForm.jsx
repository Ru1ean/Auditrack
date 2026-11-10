import { saveButtonClass } from './formStyles';

export default function AddAreaForm({ fieldClass, saving, areaForm, setAreaForm, onSubmit }) {
	const areaFieldClass =
		'w-full rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

	return (
		<form
			onSubmit={onSubmit}
			className="space-y-4 rounded-xl border border-blue-100 bg-white px-6 py-5 shadow-sm"
		>
			<div>
				<label htmlFor="area-name" className="mb-1 block text-sm font-semibold text-slate-700">
					Area Name
				</label>
				<input
					id="area-name"
					className={areaFieldClass || fieldClass}
					placeholder="AREA"
					value={areaForm.areaname}
					disabled={saving}
					onChange={(e) => setAreaForm((prev) => ({ ...prev, areaname: e.target.value }))}
				/>
			</div>
			<div>
				<label htmlFor="area-code" className="mb-1 block text-sm font-semibold text-slate-700">
					Area Code
				</label>
				<input
					id="area-code"
					className={areaFieldClass || fieldClass}
					placeholder="1"
					value={areaForm.areacode}
					disabled={saving}
					onChange={(e) => setAreaForm((prev) => ({ ...prev, areacode: e.target.value }))}
				/>
			</div>
			<div className="flex justify-end border-t border-blue-100 pt-4">
				<button type="submit" disabled={saving} className={saveButtonClass}>
					{saving ? 'Saving...' : 'Save area'}
				</button>
			</div>
		</form>
	);
}

import { useMemo } from 'react';
import LongSelectPreview from './LongSelectPreview';
import { formShellClass, saveButtonClass, formFooterClass } from './formStyles';
import CustomSelect from '../../UI/CustomSelect';

export default function AddCriteriaForm({
	areas,
	criteriaForm,
	setCriteriaForm,
	parentCriteriaOptions,
	fieldClass,
	saving,
	onSubmit,
}) {
	const selectedParent = useMemo(
		() => parentCriteriaOptions.find((c) => String(c.criteriaid) === String(criteriaForm.parentcriteriaid)),
		[parentCriteriaOptions, criteriaForm.parentcriteriaid]
	);

	const selectedArea = useMemo(
		() => (areas || []).find((a) => String(a.areaid) === String(criteriaForm.areaid)),
		[areas, criteriaForm.areaid]
	);

	return (
		<form onSubmit={onSubmit} className={formShellClass}>
			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Area</label>
				<CustomSelect
					size="md"
					value={criteriaForm.areaid}
					onChange={(v) => {
						setCriteriaForm((prev) => ({ ...prev, areaid: v, parentcriteriaid: v ? prev.parentcriteriaid : '' }));
					}}
					options={[
						{ value: '', label: 'No area (optional)' },
						...(areas || []).map((area) => ({
							value: String(area.areaid),
							label: area.areacode ? `${area.areacode} - ${area.areaname}` : area.areaname
						}))
					]}
					placeholder="No area (optional)"
				/>
				{selectedArea && (
					<div className="mt-2">
						<LongSelectPreview
							label="Selected area"
							title={selectedArea.areacode ? `${selectedArea.areacode} - ${selectedArea.areaname}` : selectedArea.areaname}
						/>
					</div>
				)}
			</div>

			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Parent sub area (optional)</label>
				<CustomSelect
					size="md"
					value={criteriaForm.parentcriteriaid}
					onChange={(val) => setCriteriaForm((prev) => ({ ...prev, parentcriteriaid: val }))}
					disabled={!criteriaForm.areaid}
					options={[
						{ value: '', label: 'No parent (optional)' },
						...parentCriteriaOptions.map((crit) => ({
							value: String(crit.criteriaid),
							label: crit.criteriacode ? `${crit.criteriacode} - ${crit.criterianame}` : crit.criterianame
						}))
					]}
					placeholder="No parent (optional)"
				/>
				<div className="mt-2">
					<LongSelectPreview
						label="Selected parent sub area"
						title={
							selectedParent
								? selectedParent.criteriacode
									? `${selectedParent.criteriacode} - ${selectedParent.criterianame}`
									: selectedParent.criterianame
								: null
						}
						body={selectedParent?.Description || null}
						emptyHint={criteriaForm.areaid ? 'No parent selected — this will be a top-level sub area.' : null}
					/>
				</div>
			</div>

			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Sub area code</label>
				<input
					className={fieldClass}
					placeholder={criteriaForm.parentcriteriaid ? 'No code required for child sub area' : 'Sub Area "A"'}
					value={criteriaForm.criteriacode}
					onChange={(e) => setCriteriaForm((prev) => ({ ...prev, criteriacode: (e.target.value || '').toUpperCase() }))}
					disabled={!!criteriaForm.parentcriteriaid}
				/>
			</div>

			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Sub area name</label>
				<input
					className={fieldClass}
					placeholder="Sub area name"
					value={criteriaForm.criterianame}
					onChange={(e) => setCriteriaForm((prev) => ({ ...prev, criterianame: e.target.value }))}
				/>
			</div>

			<div className={formFooterClass}>
				<button type="submit" disabled={saving} className={saveButtonClass}>
					{saving ? 'Saving…' : 'Save sub area'}
				</button>
			</div>
		</form>
	);
}

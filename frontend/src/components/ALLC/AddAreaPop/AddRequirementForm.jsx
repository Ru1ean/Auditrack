import { useMemo } from 'react';
import LongSelectPreview from './LongSelectPreview';
import { formShellClass, saveButtonClass, formFooterClass } from './formStyles';
import CustomSelect from '../../UI/CustomSelect';

function optionLabel(code, name, suffix = '') {
	const base = code ? `${code} - ${name}` : name;
	return suffix ? `${base} ${suffix}` : base;
}

export default function AddRequirementForm({
	areas,
	requirementForm,
	setRequirementForm,
	filteredCriteriaOptions,
	handleRequirementCriteriaChange,
	onChildCriteriaChange,
	childCriteriaOptions,
	parentRequirementOptions,
	handleParentRequirementChange,
	loadingParents,
	fieldClass,
	saving,
	onSubmit,
}) {
	const selectedCriteria = useMemo(
		() => filteredCriteriaOptions.find((c) => String(c.criteriaid) === String(requirementForm.criteriaid)),
		[filteredCriteriaOptions, requirementForm.criteriaid]
	);

	const selectedParent = useMemo(
		() =>
			parentRequirementOptions.find(
				(r) => String(r.requirementcode) === String(requirementForm.parentrequirementcode)
			),
		[parentRequirementOptions, requirementForm.parentrequirementcode]
	);

	const selectedArea = useMemo(() => {
		if (requirementForm.AreaFilter === '__no_area__') return { label: 'No Area (sub areas without area)' };
		return (areas || []).find((a) => String(a.areaid) === String(requirementForm.AreaFilter));
	}, [areas, requirementForm.AreaFilter]);

	return (
		<form onSubmit={onSubmit} className={formShellClass}>
			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Area</label>
				<CustomSelect
					size="md"
					value={requirementForm.AreaFilter}
					onChange={(val) => setRequirementForm((prev) => ({ ...prev, AreaFilter: val, criteriaid: '' }))}
					options={[
						{ value: '', label: 'Select area' },
						{ value: '__no_area__', label: 'No Area (sub areas without area)' },
						...(areas || []).map((area) => ({
							value: String(area.areaid),
							label: optionLabel(area.areacode, area.areaname)
						}))
					]}
					placeholder="Select area"
				/>
				{selectedArea && requirementForm.AreaFilter && (
					<div className="mt-2">
						<LongSelectPreview
							label="Selected area"
							title={
								requirementForm.AreaFilter === '__no_area__'
									? selectedArea.label
									: optionLabel(selectedArea.areacode, selectedArea.areaname)
							}
						/>
					</div>
				)}
			</div>

			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Sub Area</label>
				<CustomSelect
					size="md"
					value={requirementForm.criteriaid}
					onChange={(val) => handleRequirementCriteriaChange(val, false, requirementForm.AreaFilter)}
					disabled={!requirementForm.AreaFilter}
					options={[
						{ value: '', label: 'Select sub area' },
						...filteredCriteriaOptions.map((crit) => ({
							value: String(crit.criteriaid),
							label: optionLabel(
								crit.criteriacode,
								crit.criterianame,
								crit.areaname ? `- (${crit.areaname})` : '- (No Area)'
							)
						}))
					]}
					placeholder="Select sub area"
				/>
				{requirementForm.AreaFilter && filteredCriteriaOptions.length === 0 && (
					<p className="mt-1 text-xs text-stone-500">No sub areas found for the selected area filter.</p>
				)}
				{!requirementForm.AreaFilter && (
					<p className="mt-1 text-xs text-stone-500">Select an area first to load sub areas.</p>
				)}
				{selectedCriteria && (
					<div className="mt-2">
						<LongSelectPreview
							label="Selected sub area"
							title={optionLabel(selectedCriteria.criteriacode, selectedCriteria.criterianame)}
							body={selectedCriteria.description || selectedCriteria.Description || null}
						/>
					</div>
				)}
			</div>

			{childCriteriaOptions.length > 0 && (
				<div>
					<label className="mb-1 block text-xs font-semibold text-stone-600">Child sub area (optional)</label>
					<CustomSelect
						size="md"
						value={requirementForm.ChildCriteriaID}
						onChange={(val) => {
							setRequirementForm((prev) => ({ ...prev, ChildCriteriaID: val }));
							onChildCriteriaChange?.(val);
						}}
						disabled={!requirementForm.criteriaid}
						options={[
							{ value: '', label: 'No child selected (use selected sub area)' },
							...childCriteriaOptions.map((cc) => ({
								value: String(cc.criteriaid),
								label: optionLabel(cc.criteriacode, cc.criterianame)
							}))
						]}
						placeholder="No child selected (use selected sub area)"
					/>
				</div>
			)}

			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Parent standard (optional)</label>
				<CustomSelect
					size="md"
					value={requirementForm.parentrequirementcode}
					onChange={(val) => handleParentRequirementChange(val)}
					disabled={!requirementForm.criteriaid || loadingParents}
					options={[
						{ value: '', label: 'No parent standard (optional)' },
						...parentRequirementOptions.map((req) => ({
							value: req.requirementcode,
							label: optionLabel(req.requirementcode, req.description || req.Description)
						}))
					]}
					placeholder="No parent standard (optional)"
				/>
				{requirementForm.criteriaid && loadingParents && (
					<p className="mt-1 text-xs text-stone-500">Loading parent standard options…</p>
				)}
				<div className="mt-2">
					<LongSelectPreview
						label="Selected parent standard"
						title={
							selectedParent
								? selectedParent.requirementcode
								: requirementForm.parentrequirementcode
									? requirementForm.parentrequirementcode
									: null
						}
						body={selectedParent?.description || selectedParent?.Description}
						emptyHint={
							requirementForm.criteriaid && !loadingParents
								? 'No parent selected — this will be top-level standard under the sub area.'
								: null
						}
					/>
				</div>
			</div>

			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Standard code (editable)</label>
				<input
					className={fieldClass}
					value={requirementForm.requirementcode || ''}
					onChange={(e) => setRequirementForm((prev) => ({ ...prev, requirementcode: e.target.value }))}
					placeholder="Leave empty to auto-generate"
					disabled={!requirementForm.criteriaid}
				/>
			</div>

			<div>
				<label className="mb-1 block text-xs font-semibold text-stone-600">Standard description</label>
				<textarea
					className={`${fieldClass} min-h-[120px] resize-y`}
					placeholder="Standard description"
					value={requirementForm.Description}
					onChange={(e) => setRequirementForm((prev) => ({ ...prev, Description: e.target.value }))}
					disabled={!requirementForm.criteriaid}
				/>
			</div>

			<div className={formFooterClass}>
				<button type="submit" disabled={saving || !requirementForm.criteriaid} className={saveButtonClass}>
					{saving ? 'Saving…' : 'Save standard'}
				</button>
			</div>
		</form>
	);
}

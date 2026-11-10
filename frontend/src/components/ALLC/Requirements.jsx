import RowActionMenu from './RowActionMenu';
import { formatDateTime } from '../../utils/formatDateTime';
import SmartUserAvatar from '../UI/SmartUserAvatar';

export default function RequirementItem({
    requirement,
    showCheckbox = false,
    isChecked = false,
    onToggleSelect,
    onMenuClick,
    onDeleteClick,
    onEditClick,
    onAssignClick,
    assignedPersonnelCount = 0,
    assignedPersonnel = [],
    inheritedPersonnel = [],
    isAssigned = false
}) {
    const handleEdit = onEditClick || onMenuClick;
    return (
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
            {showCheckbox && (
                <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onToggleSelect?.(e.target.checked)}
                    className="h-4 w-4 mt-1 accent-blue-600 cursor-pointer"
                />
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-xs text-slate-900">{requirement.requirementcode}</p>
                    {isAssigned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-bold text-white border border-emerald-500/30 shadow-2xs whitespace-nowrap">
                            <span>Assigned to you</span>
                        </span>
                    )}
                    {/* Directly Assigned to Standard */}
                    {assignedPersonnel && assignedPersonnel.map((person) => (
                        <div
                            key={`req-direct-${person.userid}`}
                            className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 rounded-full pl-1 pr-2.5 py-0.5 border border-blue-300 shadow-2xs"
                            title={`Directly assigned to Standard: ${person.fullname}`}
                        >
                            <SmartUserAvatar
                                user={person}
                                size="w-4 h-4"
                                textSize="text-[8px]"
                                className="ring-1 ring-white shrink-0"
                            />
                            <span className="text-[10px] font-semibold leading-none truncate max-w-[130px]">
                                {person.fullname}
                            </span>
                        </div>
                    ))}

                    {/* Inherited from Sub-area or Area */}
                    {inheritedPersonnel && inheritedPersonnel.map((person) => (
                        <div
                            key={`req-inherited-${person.userid}`}
                            className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-full pl-1 pr-2 py-0.5 border border-slate-200 shadow-2xs"
                            title={`Inherited: ${person.fullname} (${person.source || 'Inherited'})`}
                        >
                            <SmartUserAvatar
                                user={person}
                                size="w-4 h-4"
                                textSize="text-[8px]"
                                className="ring-1 ring-white shrink-0"
                            />
                            <span className="text-[9px] font-medium leading-none text-slate-600 truncate max-w-[130px]">
                                {person.fullname} <span className="text-slate-400 text-[8px]">({person.source || 'Inherited'})</span>
                            </span>
                        </div>
                    ))}

                    {(!assignedPersonnel || assignedPersonnel.length === 0) &&
                     (!inheritedPersonnel || inheritedPersonnel.length === 0) &&
                     assignedPersonnelCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 text-[9px] font-semibold shadow-2xs whitespace-nowrap">
                            <span>{assignedPersonnelCount} Personnel</span>
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{requirement.description || requirement.Description}</p>
                <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-400">
                    <span>Created: {formatDateTime(requirement.createdat)}</span>
                    <span>Updated: {formatDateTime(requirement.updatedat || requirement.createdat)}</span>
                </div>
            </div>
            <RowActionMenu
                onAssign={onAssignClick ? () => onAssignClick(requirement) : undefined}
                onEdit={handleEdit ? () => handleEdit(requirement) : undefined}
                onDelete={onDeleteClick ? () => onDeleteClick(requirement) : undefined}
                buttonClassName="office-card-actions-button inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 shadow-2xs"
            />
        </div>
    );
}

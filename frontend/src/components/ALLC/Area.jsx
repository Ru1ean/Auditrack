import RowActionMenu from './RowActionMenu';
import { formatDateTime } from '../../utils/formatDateTime';
import { ChevronDown, ChevronRight, Loader2, Check } from 'lucide-react';
import SmartUserAvatar from '../UI/SmartUserAvatar';

export default function AreaItem({
    area,
    isExpanded,
    onToggle,
    loading,
    showCheckbox = false,
    isChecked = false,
    onToggleSelect,
    onMenuClick,
    onDeleteClick,
    onEditClick,
    onAssignClick,
    assignedPersonnelCount = 0,
    assignedPersonnel = [],
    childPersonnel = [],
    isAssigned,
    isAuditor
}) {
    const handleEdit = onEditClick || onMenuClick;
    return (
        <div
            className="bg-blue-600 hover:bg-blue-700 text-white p-3.5 rounded-xl shadow-sm cursor-pointer transition-all flex items-center gap-3"
            onClick={onToggle}
        >
            {showCheckbox && (
                <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onToggleSelect?.(e.target.checked)}
                    className="h-4 w-4 accent-white cursor-pointer"
                />
            )}
            {isExpanded ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-white transition-transform" />
            ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-white transition-transform" />
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate block">
                        {`${area.areacode || ''}: ${area.areaname || ''}`}
                    </span>
                    {isAssigned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-bold text-white border border-emerald-500/30 shadow-2xs whitespace-nowrap">
                            <Check className="w-2.5 h-2.5" />
                            <span>Assigned to you</span>
                        </span>
                    )}
                    {/* Directly Assigned Personnel */}
                    {assignedPersonnel && assignedPersonnel.map((person) => (
                        <div
                            key={`area-direct-${person.userid}`}
                            className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white rounded-full pl-1 pr-2.5 py-0.5 border border-white/30 shadow-2xs transition"
                            title={`Directly assigned to Area: ${person.fullname}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <SmartUserAvatar
                                user={person}
                                size="w-4 h-4"
                                textSize="text-[8px]"
                                className="ring-1 ring-white shrink-0"
                            />
                            <span className="text-[10px] font-medium leading-none truncate max-w-[130px]">
                                {person.fullname}
                            </span>
                        </div>
                    ))}

                    {/* Child Assigned Personnel (sub-areas or standards) */}
                    {childPersonnel && childPersonnel.map((person) => (
                        <div
                            key={`area-child-${person.userid}`}
                            className="inline-flex items-center gap-1.5 bg-amber-400/25 hover:bg-amber-400/35 text-amber-100 rounded-full pl-1 pr-2.5 py-0.5 border border-amber-300/40 shadow-2xs transition"
                            title={`Assigned in sub-areas: ${person.fullname}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <SmartUserAvatar
                                user={person}
                                size="w-4 h-4"
                                textSize="text-[8px]"
                                className="ring-1 ring-amber-200 shrink-0"
                            />
                            <span className="text-[10px] font-medium leading-none truncate max-w-[140px]">
                                {person.fullname} <span className="text-amber-200/80 text-[9px]">(Sub-areas)</span>
                            </span>
                        </div>
                    ))}

                    {(!assignedPersonnel || assignedPersonnel.length === 0) && (!childPersonnel || childPersonnel.length === 0) && assignedPersonnelCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/80 px-2 py-0.5 text-[9px] font-semibold text-white border border-blue-400/40 shadow-2xs whitespace-nowrap">
                            <span>{assignedPersonnelCount} Personnel</span>
                        </span>
                    )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-blue-100">
                    <span>Created: {formatDateTime(area.createdat)}</span>
                    <span>Updated: {formatDateTime(area.updatedat || area.createdat)}</span>
                </div>
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-white opacity-75" />}
            <RowActionMenu
                onAssign={onAssignClick ? () => onAssignClick(area) : undefined}
                onEdit={handleEdit ? () => handleEdit(area) : undefined}
                onDelete={onDeleteClick ? () => onDeleteClick(area) : undefined}
                buttonClassName="office-card-actions-button inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/60 bg-white/10 text-white transition hover:border-white hover:bg-white/20 shadow-2xs"
            />
        </div>
    );
}

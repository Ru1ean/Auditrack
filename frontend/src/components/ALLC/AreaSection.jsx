import AreaItem from './Area';

export default function AreaSection({
    area,
    isExpanded,
    onToggle,
    loading,
    showCheckbox,
    isChecked,
    onToggleSelect,
    onMenuClick,
    onDeleteClick,
    onAssignClick,
    assignedPersonnelCount,
    assignedPersonnel = [],
    childPersonnel = [],
    isAssigned,
    isAuditor,
    children
}) {
    return (
        <div className="mb-3">
            <AreaItem
                area={area}
                isExpanded={isExpanded}
                onToggle={onToggle}
                loading={loading}
                showCheckbox={showCheckbox}
                isChecked={isChecked}
                onToggleSelect={onToggleSelect}
                onMenuClick={onMenuClick}
                onDeleteClick={onDeleteClick}
                onAssignClick={onAssignClick}
                assignedPersonnelCount={assignedPersonnelCount}
                assignedPersonnel={assignedPersonnel}
                childPersonnel={childPersonnel}
                isAssigned={isAssigned}
                isAuditor={isAuditor}
            />
            {isExpanded && children}
        </div>
    );
}

import CriteriaItem from './Criteria';

export default function CriteriaSection({
    criteria,
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
    inheritedPersonnel = [],
    childPersonnel = [],
    isAssigned,
    children
}) {
    return (
        <div className="relative my-3">
            <span className="absolute -left-5 top-6 w-4 h-1 bg-blue-300 rounded-r-full" />
            <CriteriaItem
                criteria={criteria}
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
                inheritedPersonnel={inheritedPersonnel}
                childPersonnel={childPersonnel}
                isAssigned={isAssigned}
            />
            {isExpanded && children}
        </div>
    );
}

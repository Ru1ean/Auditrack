import RequirementItem from './Requirements';

export default function RequirementsSection({
    requirements,
    isLoading = false,
    showCheckbox = false,
    selectedRequirementIds = new Set(),
    onToggleRequirement,
    onMenuClick,
    onDeleteClick,
    onAssignClick,
    assignedPersonnelCounts = {},
    assignedPersonnelMap = {},
    inheritedPersonnel = [],
    myAssignedReqIds = new Set()
}) {
    if (isLoading) {
        return <p className="text-gray-500 text-sm ml-4 my-2">Loading standards...</p>;
    }

    if (!requirements || requirements.length === 0) {
        return <p className="text-gray-500 text-sm ml-4 my-2">No standards</p>;
    }

    return (
        <div className="relative ml-6 pl-6 my-3">
            <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-full" />
            <div className="space-y-2">
                {requirements.map((req) => {
                    const reqDirectUsers = assignedPersonnelMap[Number(req.requirementid)] || [];
                    const reqDirectIds = new Set(reqDirectUsers.map(u => Number(u.userid)));
                    const reqInheritedUsers = (inheritedPersonnel || []).filter(u => !reqDirectIds.has(Number(u.userid)));

                    return (
                        <div key={`${req.requirementid}-${req.requirementcode || ''}-${req.Type || req.SuggestedEvidence || ''}`} className="relative">
                            <span className="absolute -left-6 top-6 w-5 h-1 bg-blue-400 rounded-r-full" />
                            <RequirementItem
                                requirement={req}
                                showCheckbox={showCheckbox}
                                isChecked={selectedRequirementIds.has(Number(req.requirementid))}
                                onToggleSelect={(checked) => onToggleRequirement?.(req, checked)}
                                onMenuClick={onMenuClick}
                                onDeleteClick={onDeleteClick}
                                onAssignClick={onAssignClick}
                                assignedPersonnelCount={assignedPersonnelCounts[Number(req.requirementid)] || 0}
                                assignedPersonnel={reqDirectUsers}
                                inheritedPersonnel={reqInheritedUsers}
                                isAssigned={myAssignedReqIds.has(Number(req.requirementid))}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

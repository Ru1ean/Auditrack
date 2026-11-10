import React from 'react';
import CustomDropdown from '../UI/CustomDropdown';

export default function Sorthead({ value = 'name', onChange }) {
    return (
        <CustomDropdown
            value={value}
            onChange={onChange}
            options={[
                { value: 'name', label: 'All Personnel' },
                { value: 'assigned', label: 'Assigned' },
                { value: 'unassigned', label: 'Unassigned' },
            ]}
            minWidth="min-w-[146px]"
            size="sm"
        />
    );
}

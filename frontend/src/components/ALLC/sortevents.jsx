import React from 'react';
import CustomDropdown from '../UI/CustomDropdown';

export default function SortEvents({ value = 'active', onChange }) {
    return (
        <CustomDropdown
            value={value}
            onChange={onChange}
            options={[
                { value: 'active', label: 'Active Standards' },
                { value: 'inactive', label: 'Inactive Standards' },
            ]}
            minWidth="min-w-[146px]"
            size="sm"
        />
    );
}

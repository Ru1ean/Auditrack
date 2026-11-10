import React from 'react';
import RowActionMenu from '../ALLC/RowActionMenu';

export default function OfficeAddDelete({ onEdit, onAddRequirements, onExportExcel, onDelete }) {
	return (
		<RowActionMenu
			items={[
				{
					label: 'Edit Office Info',
					tone: 'indigo',
					onClick: () => onEdit?.(),
					icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				},
				{
					label: 'Add Requirements',
					tone: 'emerald',
					onClick: () => onAddRequirements?.(),
					icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				},
				{
					label: 'Export Excel',
					tone: 'slate',
					onClick: () => onExportExcel?.(),
					icon: <>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V6m0 0l-4 4m4-4 4 4" />
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21H3" />
					</>
				},
				{
					label: 'Delete Office',
					tone: 'red',
					onClick: () => onDelete?.(),
					icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
				}
			]}
		/>
	);
}

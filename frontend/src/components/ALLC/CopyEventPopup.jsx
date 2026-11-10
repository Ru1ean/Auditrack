import { useState } from "react";
import { createPortal } from "react-dom";

export default function CopyEventPopup({
	open,
	defaultName = "",
	defaultCode = "",
	onCancel,
	onConfirm
}) {
	const [eventname, setEventName] = useState(defaultName);
	const [eventcode, setEventCode] = useState(defaultCode);
	const [submitting, setSubmitting] = useState(false);

	if (!open) return null;

	const handleCopy = async () => {
		if (!eventname.trim() || !eventcode.trim() || submitting) return;
		setSubmitting(true);
		try {
			await onConfirm({ eventname, eventcode, description: null });
		} catch (e) {
			console.error(e);
		} finally {
			setSubmitting(false);
		}
	};

	const modalContent = (
		<div className="fixed inset-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
			<div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
				<h2 className="text-xl font-bold mb-4">Copy Accreditation</h2>
				<div className="mb-3">
					<label className="block text-sm font-medium mb-1">Accreditation Name</label>
					<input
						className="w-full border rounded px-3 py-2 text-sm disabled:opacity-50"
						value={eventname}
						onChange={e => setEventName(e.target.value)}
						disabled={submitting}
						autoFocus
					/>
				</div>
				<div className="mb-4">
					<label className="block text-sm font-medium mb-1">Accreditation Code</label>
					<input
						className="w-full border rounded px-3 py-2 text-sm disabled:opacity-50"
						value={eventcode}
						onChange={e => setEventCode(e.target.value)}
						disabled={submitting}
					/>
				</div>
				<div className="flex justify-end gap-2">
					<button
						className="px-4 py-2 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
						onClick={onCancel}
						disabled={submitting}
					>
						Cancel
					</button>
					<button
						className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2 font-medium text-sm"
						onClick={handleCopy}
						disabled={!eventname.trim() || !eventcode.trim() || submitting}
					>
						{submitting ? (
							<>
								<svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span>Copying...</span>
							</>
						) : (
							<span>Copy</span>
						)}
					</button>
				</div>
			</div>
		</div>
	);

	return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}


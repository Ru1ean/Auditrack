/**
 * Native <select> truncates long labels. Pair with this read-only preview for full text.
 */
export default function LongSelectPreview({ label, title, body, emptyHint }) {
	if (!title && !body) {
		if (!emptyHint) return null;
		return <p className="text-xs text-slate-500">{emptyHint}</p>;
	}

	return (
		<div className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5">
			{label && (
				<p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">{label}</p>
			)}
			{title && <p className="mt-0.5 text-sm font-semibold text-slate-900">{title}</p>}
			{body && (
				<p className="mt-1 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap break-words">{body}</p>
			)}
		</div>
	);
}

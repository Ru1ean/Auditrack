export default function ToastBanner({ error, success, toastVisible }) {
	if (!error && !success) return null;

	return (
		<div
			className="pointer-events-none absolute left-1/2 top-20 z-30 w-[min(92%,520px)] -translate-x-1/2"
			style={{ transition: 'opacity 400ms ease', opacity: (error || success) ? (toastVisible ? 1 : 0) : 0 }}
		>
			{error ? (
				<p className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-800 shadow-md shadow-rose-100/80">{error}</p>
			) : (
				<p
					className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-md shadow-emerald-100/80"
					aria-live="polite"
				>
					{success}
				</p>
			)}
		</div>
	);
}

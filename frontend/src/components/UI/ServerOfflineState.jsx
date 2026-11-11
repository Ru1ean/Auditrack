import React from 'react';

export default function ServerOfflineState({ onRetry, isRetrying = false, title = "Server Unavailable", message = "Unable to connect to the backend server. Please verify the server is running." }) {
  return (
    <div className="flex-1 w-full min-h-[360px] flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
      <div className="relative mb-4">
        {/* Glow effect */}
        <div className="absolute -inset-1.5 rounded-full bg-rose-400/20 blur-md animate-pulse" />
        <div className="relative h-16 w-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-sm">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.75 6a3 3 0 012.7-1.5h7.1a3 3 0 012.7 1.5l2.1 2.55a4.5 4.5 0 01.9 2.7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
          </svg>
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 mb-2 border border-rose-200">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
        Offline / Disconnected
      </div>

      <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-1.5">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-5">{message}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
        >
          {isRetrying ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retry Connection</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

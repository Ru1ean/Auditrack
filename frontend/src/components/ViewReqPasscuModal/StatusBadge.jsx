import React from 'react';

const STATUS = {
    5: {
        label: 'Complied',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
        border: 'border-emerald-200',
    },
    4: {
        label: 'Partial',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        border: 'border-amber-200',
    },
    3: {
        label: 'Not Complied',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        dot: 'bg-rose-500',
        border: 'border-rose-200',
    },
    0: {
        label: 'No Standards',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        dot: 'bg-slate-400',
        border: 'border-slate-200',
    },
};

export default function StatusBadge({ statusid, compact = false }) {
    const status = STATUS[statusid] ?? STATUS[3];

    return (
        <span
            className={`inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap border ${status.bg} ${status.text} ${status.border} ${
                compact ? 'px-2 py-0.5 text-[10px]' : 'w-40 px-2.5 py-1 text-xs'
            }`}
        >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
            {status.label}
        </span>
    );
}

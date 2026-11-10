import React from "react";
import { createPortal } from "react-dom";

export default function Pagination({ currentPage, totalPages, onPageChange, fixed = true, showWhenSinglePage = false }) {
    if (totalPages <= 0) return null;
    if (totalPages <= 1 && !showWhenSinglePage) return null;

    // Calculate page numbers to show
    const maxVisible = 10;
    let startPage = 1;
    let endPage = totalPages;
    if (totalPages > maxVisible) {
        if (currentPage <= 6) {
            startPage = 1;
            endPage = maxVisible;
        } else if (currentPage + 4 >= totalPages) {
            startPage = totalPages - maxVisible + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - 5;
            endPage = currentPage + 4;
        }
    }
    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }

    const containerClass = fixed
        ? 'fixed bottom-2 left-1/2 lg:left-[calc((100%+var(--sidebar-width))/2)] -translate-x-1/2 z-[40] flex justify-center items-center gap-1.5 px-2 py-1'
        : 'w-full flex justify-center items-center gap-1.5 py-1.5';

    const content = (
        <div className={containerClass}>
            <button
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className="h-7 px-2 text-xs font-semibold bg-blue-600 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition"
                title="First Page"
            >
                {'<<'}
            </button>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-7 px-2 text-xs font-semibold bg-blue-600 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition"
                title="Previous Page"
            >
                {'<'}
            </button>
            <div className="flex items-center gap-1.5">
                {startPage > 1 && (
                    <>
                        <button
                            onClick={() => onPageChange(1)}
                            className="rounded-md bg-gray-200/80 text-gray-800 text-xs font-medium hover:bg-gray-300/80 transition"
                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}
                        >
                            1
                        </button>
                        {startPage > 2 && (
                            <span className="rounded-md bg-gray-100 text-gray-400 text-xs flex items-center justify-center select-none" style={{ width: '28px', height: '28px', display: 'inline-flex', fontVariantNumeric: 'tabular-nums' }}>...</span>
                        )}
                    </>
                )}
                {pageNumbers.map((page) => (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`rounded-md text-xs font-medium transition ${currentPage === page
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-200/80 text-gray-800 hover:bg-gray-300/80'
                            }`}
                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}
                    >
                        {page}
                    </button>
                ))}
                {endPage < totalPages && (
                    <>
                        {endPage < totalPages - 1 && (
                            <span className="rounded-md bg-gray-100 text-gray-400 text-xs flex items-center justify-center select-none" style={{ width: '28px', height: '28px', display: 'inline-flex', fontVariantNumeric: 'tabular-nums' }}>...</span>
                        )}
                        <button
                            onClick={() => onPageChange(totalPages)}
                            className="rounded-md bg-gray-200/80 text-gray-800 text-xs font-medium hover:bg-gray-300/80 transition"
                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}
                        >
                            {totalPages}
                        </button>
                    </>
                )}
            </div>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-7 px-2 text-xs font-semibold bg-blue-600 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition"
                title="Next Page"
            >
                {'>'}
            </button>
            <button
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="h-7 px-2 text-xs font-semibold bg-blue-600 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition"
                title="Last Page"
            >
                {'>>'}
            </button>
        </div>
    );

    // Portal to document.body when fixed, so it escapes any overflow-hidden parent
    if (fixed) {
        return createPortal(content, document.body);
    }

    return content;
}


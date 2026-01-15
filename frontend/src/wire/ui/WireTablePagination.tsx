import React from "react";

export function WireTablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  className = "",
}: {
  total: number;
  page: number; // 1-based
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const canPrev = clampedPage > 1;
  const canNext = clampedPage < totalPages;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 ${className}`}>
      <div className="text-xs text-gray-600">
        Page <span className="font-semibold text-gray-900">{clampedPage}</span> of{" "}
        <span className="font-semibold text-gray-900">{totalPages}</span> •{" "}
        <span className="font-semibold text-gray-900">{total}</span> total
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(clampedPage - 1)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(clampedPage + 1)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}


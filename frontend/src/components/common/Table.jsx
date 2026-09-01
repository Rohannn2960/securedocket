import React from 'react';
import { Spinner } from './Spinner';

/**
 * Reusable Data Table Component
 * Clean, high-contrast, accessible styling with support for custom renderers and empty states.
 * 
 * @param {Array} columns - Array of { key, header, render?, className?, width? }
 * @param {Array} data - Array of data objects
 * @param {boolean} loading - Loading state
 * @param {string|React.ReactNode} emptyMessage - Empty state content
 * @param {function} onRowClick - Optional row click handler
 */
export function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found in registry',
  onRowClick = null,
  className = '',
}) {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-800 bg-defense-900/60 ${className}`}>
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-800 bg-defense-950/80">
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                scope="col"
                style={{ width: col.width }}
                className={`py-3 px-4 text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold ${
                  col.className || ''
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                <Spinner size="md" className="mx-auto mb-2" />
                <div className="font-mono text-xs">Loading records...</div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400 font-mono">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={row._id || row.id || rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-slate-800/50 hover:text-slate-100'
                    : 'hover:bg-slate-800/30'
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td key={col.key || colIdx} className={`py-3 px-4 text-slate-300 ${col.className || ''}`}>
                    {col.render ? col.render(row, rowIdx) : row[col.key] || '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;

import React from 'react';

export const SkeletonLine = ({ width = '100%', height = '0.875rem', className = '' }) => (
  <div
    className={`skeleton rounded-[var(--radius-sm)] ${className}`}
    style={{ width, height }}
  />
);

export const SkeletonCircle = ({ size = '2.5rem', className = '' }) => (
  <div className={`skeleton rounded-full ${className}`} style={{ width: size, height: size }} />
);

/** A stat-card sized skeleton, matching the dashboard KPI cards. */
export const SkeletonStatCard = () => (
  <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-neutral-100)] shadow-[var(--shadow-sm)] p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2.5 flex-1">
        <SkeletonLine width="60%" height="0.75rem" />
        <SkeletonLine width="45%" height="1.7rem" />
      </div>
      <SkeletonCircle size="3rem" className="rounded-2xl" />
    </div>
  </div>
);

/** A table-row sized skeleton, matching Records/StaffManagement rows. */
export const SkeletonTableRow = ({ columns = 4 }) => (
  <tr>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <SkeletonLine width={i === 0 ? '70%' : '85%'} />
      </td>
    ))}
  </tr>
);

export default SkeletonLine;
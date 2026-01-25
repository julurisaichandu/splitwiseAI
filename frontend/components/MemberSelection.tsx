import React from 'react';


interface MemberSelectionProps {
  allMembers: string[];     // All available members
  visibleMembers: string[]; // Only the members selected to be shown
  groups: Record<string, any>;
  selectedGroup: string;
  paidUser: string;
  onGroupChange: (group: string) => void;
  onPaidUserChange: (user: string) => void;
}

export default function MemberSelection({
  allMembers,             // Changed from members
  visibleMembers,         // New prop
  groups,
  selectedGroup,
  paidUser,
  onGroupChange,
  onPaidUserChange
}: MemberSelectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select Group
        </label>
        <div className="relative">
          <select
            value={selectedGroup}
            onChange={(e) => onGroupChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-150 appearance-none cursor-pointer"
          >
            {Object.keys(groups).map(group => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Who Paid
        </label>
        <div className="relative">
          <select
            value={paidUser}
            onChange={(e) => onPaidUserChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-150 appearance-none cursor-pointer"
          >
            {allMembers.map(member => (  // Use allMembers here so any member can pay
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Visible Members
        </label>
        <div className="flex flex-wrap gap-2">
          {visibleMembers.map(member => (  // Use visibleMembers here to only show selected members
            <span
              key={member}
              className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-full text-sm font-medium"
            >
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {member}
            </span>
          ))}
          {visibleMembers.length === 0 && (
            <span className="text-sm text-slate-400">No members selected</span>
          )}
        </div>
      </div>
    </div>
  );
}

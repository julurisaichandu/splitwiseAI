import React from 'react';


interface MemberSelectionProps {
  allMembers: string[];     // All available members
  visibleMembers: string[]; // Only the members selected to be shown
  groups: Record<string, any>;
  selectedGroup: string;
  paidUser: string;
  hiddenMembersWithSplits?: string[]; // Hidden members that have items assigned
  onGroupChange: (group: string) => void;
  onPaidUserChange: (user: string) => void;
  onVisibleMembersChange: (members: string[]) => void;
}

export default function MemberSelection({
  allMembers,
  visibleMembers,
  groups,
  selectedGroup,
  paidUser,
  hiddenMembersWithSplits = [],
  onGroupChange,
  onPaidUserChange,
  onVisibleMembersChange
}: MemberSelectionProps) {

  const handleMemberToggle = (member: string) => {
    const newVisibleMembers = visibleMembers.includes(member)
      ? visibleMembers.filter((m) => m !== member)
      : [...visibleMembers, member];
    onVisibleMembersChange(newVisibleMembers);
  };

  const showHiddenMembers = () => {
    onVisibleMembersChange([...visibleMembers, ...hiddenMembersWithSplits]);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Select Group
          </label>
          <div className="relative">
            <select
              value={selectedGroup}
              onChange={(e) => onGroupChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-300 rounded-lg text-stone-900 bg-amber-50 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all duration-150 appearance-none cursor-pointer"
            >
              {Object.keys(groups).map(group => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Who Paid
          </label>
          <div className="relative">
            <select
              value={paidUser}
              onChange={(e) => onPaidUserChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-300 rounded-lg text-stone-900 bg-amber-50 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all duration-150 appearance-none cursor-pointer"
            >
              {allMembers.map(member => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Select Members
        </label>

        {/* Warning for hidden members with splits */}
        {hiddenMembersWithSplits.length > 0 && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800">
                  Hidden members with assigned splits
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  The following hidden members still have items assigned:
                </p>
                <ul className="list-disc pl-5 mt-1 text-sm text-amber-700">
                  {hiddenMembersWithSplits.map((member) => (
                    <li key={member}>{member}</li>
                  ))}
                </ul>
                <button
                  className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-150"
                  onClick={showHiddenMembers}
                >
                  Show these members
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-row flex-wrap gap-3">
          {allMembers.map((member, index) => (
            <label
              key={index}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all duration-150
                ${visibleMembers.includes(member)
                  ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-500'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }
              `}
            >
              <input
                type="checkbox"
                checked={visibleMembers.includes(member)}
                onChange={() => handleMemberToggle(member)}
                className="sr-only"
              />
              {visibleMembers.includes(member) && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="text-sm font-medium">{member}</span>
            </label>
          ))}
        </div>
        {allMembers.length === 0 && (
          <span className="text-sm text-stone-400">No members available</span>
        )}
      </div>
    </div>
  );
}

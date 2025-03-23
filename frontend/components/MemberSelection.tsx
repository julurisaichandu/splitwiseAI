import React from 'react';

interface MemberSelectionProps {
  members: string[];
  groups: Record<string, any>;
  selectedGroup: string;
  paidUser: string;
  onGroupChange: (group: string) => void;
  onPaidUserChange: (user: string) => void;
}

export default function MemberSelection({ 
  members, 
  groups, 
  selectedGroup, 
  paidUser, 
  onGroupChange, 
  onPaidUserChange 
}: MemberSelectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-gray-700 mb-2">
          Select Group:
        </label>
        <select 
          value={selectedGroup}
          onChange={(e) => onGroupChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        >
          {Object.keys(groups).map(group => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label className="block text-gray-700 mb-2">
          Who Paid:
        </label>
        <select 
          value={paidUser}
          onChange={(e) => onPaidUserChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        >
          {members.map(member => (
            <option key={member} value={member}>
              {member}
            </option>
          ))}
        </select>
      </div>
      
      <div className="md:col-span-2">
        <label className="block text-gray-700 mb-2">
          Members:
        </label>
        <div className="flex flex-wrap gap-2">
          {members.map(member => (
            <span 
              key={member}
              className="bg-gray-200 px-3 py-1 rounded-full text-sm"
            >
              {member}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

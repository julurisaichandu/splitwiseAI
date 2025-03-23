import React from 'react';

interface SplitData {
  member: string;
  itemSplits: string;
  totalSplit: string;
}

interface SplitSummaryProps {
  data: SplitData[];
  totalBill: number;
}

const SplitSummary: React.FC<SplitSummaryProps> = ({ data, totalBill }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Split Summary</h3>
      
      <div className="mb-4">
        <div className="text-lg font-medium">
          Total Bill: ${totalBill.toFixed(2)}
        </div>
      </div>
      
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="border-b pb-3">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">{item.member}</div>
              <div className="text-lg font-semibold">${item.totalSplit}</div>
            </div>
            
            {item.itemSplits && (
              <div className="text-sm text-gray-600">
                {item.itemSplits}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-sm text-gray-500">
        <p>
          * Amounts are rounded to the nearest cent. Small discrepancies may occur due to rounding.
        </p>
      </div>
    </div>
  );
};

export default SplitSummary;

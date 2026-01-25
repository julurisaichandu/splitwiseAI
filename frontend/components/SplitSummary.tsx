import React from 'react';

interface SplitData {
  member: string;
  itemSplits: string;
  totalSplit: string;
}

// In SplitSummary.tsx
interface SplitSummaryProps {
  data: {
    member: string;
    itemSplits: string;
    totalSplit: string;
  }[];
  totalBill: number;
  itemizedSplits: {
    name: string;
    price: number;
    members: string[];
    splitPrice: number;
  }[];
}

const SplitSummary: React.FC<SplitSummaryProps> = ({ data, totalBill,  itemizedSplits }) => {
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


<div className="mt-8">
  <h3 className="text-lg font-semibold mb-4">Item-based Splits</h3>
  <table className="min-w-full border">
    <thead>
      <tr className="bg-gray-100">
        <th className="border p-2">Item</th>
        <th className="border p-2">Price</th>
        <th className="border p-2">Split Price</th>
        <th className="border p-2">Members</th>
      </tr>
    </thead>
    <tbody>
      {itemizedSplits.map((item, index) => (
        <tr key={index} className="border-b">
          <td className="border p-2">{item.name}</td>
          <td className="border p-2">${item.price.toFixed(2)}</td>
          <td className="border p-2">${item.splitPrice.toFixed(2)}</td>
          <td className="border p-2">{item.members.join(', ')}</td>
        </tr>
      ))}
    </tbody>
  </table>
  {/* New: Formatted Text Section */}
<div className="mt-6">
  <h4 className="text-md font-semibold mb-2">Formatted Text (Copy-friendly)</h4>
  <textarea
    readOnly
    value={(() => {
      let formattedText = "=== ITEMIZED BILL SPLITS ===\n\n";
      formattedText += `Total Bill: $${totalBill.toFixed(2)}\n`;
      formattedText += "─".repeat(50) + "\n\n";
      
      itemizedSplits.forEach((item, index) => {
        formattedText += `${index + 1}. ${item.name}\n`;
        formattedText += `   • Full Price: $${item.price.toFixed(2)}\n`;
        formattedText += `   • Split Among: ${item.members.length} ${item.members.length === 1 ? 'person' : 'people'}\n`;
        formattedText += `   • Price per Person: $${item.splitPrice.toFixed(2)}\n`;
        formattedText += `   • Members: ${item.members.join(', ')}\n\n`;
      });
      
      formattedText += "─".repeat(50) + "\n";
      formattedText += "MEMBER SUMMARY:\n\n";
      
      // Calculate member totals
      const memberTotals: { [key: string]: number } = {};
      itemizedSplits.forEach(item => {
        item.members.forEach(member => {
          if (!memberTotals[member]) memberTotals[member] = 0;
          memberTotals[member] += item.splitPrice;
        });
      });
      
      // Sort members alphabetically
      Object.keys(memberTotals).sort().forEach(member => {
        const memberItems = itemizedSplits
          .filter(item => item.members.includes(member))
          .map(item => `${item.name} ($${item.splitPrice.toFixed(2)})`);
        
        formattedText += `${member}: $${memberTotals[member].toFixed(2)}\n`;
        formattedText += `   Items: ${memberItems.join(', ')}\n\n`;
      });
      
      return formattedText;
    })()}
    className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-xs bg-gray-50 resize-none"
    onClick={(e) => {
      const target = e.target as HTMLTextAreaElement;
      target.select();
    }}
  />
  <p className="text-xs text-gray-500 mt-2">
    Click the text area to select all, then copy (Ctrl+C / Cmd+C)
  </p>
</div>
</div>
    </div>
  );
};

export default SplitSummary;

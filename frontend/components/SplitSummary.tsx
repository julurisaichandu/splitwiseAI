import React from 'react';

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

const SplitSummary: React.FC<SplitSummaryProps> = ({ data, totalBill, itemizedSplits }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Split Summary</h3>

      {/* Total Bill Badge */}
      <div className="mb-6 inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 px-4 py-2 rounded-lg">
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-semibold text-lg">Total Bill: ${totalBill.toFixed(2)}</span>
      </div>

      {/* Member Splits */}
      <div className="space-y-3">
        {data.map((item, index) => (
          <div
            key={index}
            className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors duration-150"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-medium text-sm">
                    {item.member.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium text-slate-800">{item.member}</span>
              </div>
              <div className="text-lg font-bold text-emerald-600">${item.totalSplit}</div>
            </div>

            {item.itemSplits && (
              <div className="text-sm text-slate-500 ml-10">
                {item.itemSplits}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-slate-400">
        * Amounts are rounded to the nearest cent. Small discrepancies may occur due to rounding.
      </div>

      {/* Item-based Splits Table */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Item-based Splits</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Split Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Members
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {itemizedSplits.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors duration-150">
                  <td className="px-4 py-3 text-sm text-slate-800 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">${item.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-emerald-600 font-medium">${item.splitPrice.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.members.map((member, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700"
                        >
                          {member}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Formatted Text Section */}
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Formatted Text (Copy-friendly)</h4>
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
            className="w-full h-64 p-4 border border-slate-300 rounded-lg font-mono text-xs bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            onClick={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.select();
            }}
          />
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Click the text area to select all, then copy (Ctrl+C / Cmd+C)
          </p>
        </div>
      </div>
    </div>
  );
};

export default SplitSummary;

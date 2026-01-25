import React from "react";

interface ItemMember {
  [key: string]: boolean;
}

interface Item {
  name: string;
  price: number;
  split_price: number;
  members: ItemMember;
}

interface ItemListProps {
  items: Item[];
  members: string[];
  onItemsChange: (items: Item[]) => void;
}

const ItemList: React.FC<ItemListProps> = ({
  items,
  members,
  onItemsChange,
}) => {
  const handleItemNameChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index].name = value;
    onItemsChange(newItems);
  };

  const handleItemPriceChange = (index: number, value: string) => {
    const newItems = [...items];
    const numericValue = parseFloat(value);

    if (!isNaN(numericValue)) {
      newItems[index].price = numericValue;

      // Recalculate split price
      const selectedMembers = Object.entries(newItems[index].members)
        .filter(([_, selected]) => selected)
        .map(([name]) => name);

      newItems[index].split_price =
        numericValue / Math.max(1, selectedMembers.length);
    } else {
      newItems[index].price = 0;
      newItems[index].split_price = 0;
    }
    onItemsChange(newItems);
  };


  const handleMemberSelection = (itemIndex: number, memberName: string) => {
    const newItems = [...items];
    newItems[itemIndex].members[memberName] =
      !newItems[itemIndex].members[memberName];

    // Calculate split price
    const selectedMembers = Object.entries(newItems[itemIndex].members)
      .filter(([_, selected]) => selected)
      .map(([name]) => name);

    newItems[itemIndex].split_price =
      newItems[itemIndex].price / Math.max(1, selectedMembers.length);

    onItemsChange(newItems);
  };

  const addItem = () => {
    // Get all members from the parent component's state
    const allMembersObj: { [key: string]: boolean } = {};

    // Initialize with all members that exist in other items
    if (items.length > 0 && Object.keys(items[0].members).length > 0) {
      Object.keys(items[0].members).forEach(member => {
        allMembersObj[member] = false;
      });
    } else {
      // Fallback to visible members
      members.forEach(member => {
        allMembersObj[member] = false;
      });
    }

    onItemsChange([
      ...items,
      {
        name: `Item ${items.length + 1}`,
        price: 0,
        split_price: 0,
        members: allMembersObj,
      },
    ]);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const allSelected = (index: number) =>
    members.every((member) => items[index].members[member] === true);

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="bg-amber-50/80 p-5 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="w-full md:w-auto flex-grow">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Item Name
              </label>
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleItemNameChange(index, e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all duration-150"
              />
            </div>

            <div className="w-full md:w-auto flex-grow">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={item.price || ""}
                  onChange={(e) => handleItemPriceChange(index, e.target.value)}
                  className="w-full pl-7 pr-4 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all duration-150"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Split Between
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member}
                  onClick={() => handleMemberSelection(index, member)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all duration-150
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${item.members[member]
                      ? "bg-amber-600 text-white ring-2 ring-amber-500 ring-offset-2 focus:ring-amber-500 shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 focus:ring-stone-400 border border-stone-300 shadow-sm"
                    }
                  `}
                >
                  {item.members[member] && (
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {member}
                </button>
              ))}

              {/* Select All / Deselect All button */}
              <button
                onClick={() => {
                  const newItems = [...items];
                  const shouldSelectAll = !allSelected(index);

                  members.forEach(
                    (member) => (newItems[index].members[member] = shouldSelectAll)
                  );

                  // Recalculate split price
                  const selectedMembersCount = members.filter(
                    member => newItems[index].members[member]
                  ).length;

                  newItems[index].split_price =
                    selectedMembersCount > 0
                      ? newItems[index].price / selectedMembersCount
                      : 0;

                  onItemsChange(newItems);
                }}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${allSelected(index)
                    ? "bg-stone-500 text-white hover:bg-stone-600 focus:ring-stone-500"
                    : "bg-lime-600 text-white hover:bg-lime-700 focus:ring-lime-500"
                  }
                `}
              >
                {allSelected(index) ? "Deselect All" : "Select All"}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-stone-100">
            <div className="text-sm">
              {Object.entries(item.members).filter(([_, selected]) => selected).length > 0 ? (
                <span className="text-lime-700 font-medium">
                  Split: ${item.split_price.toFixed(2)} per person
                </span>
              ) : (
                <span className="text-stone-400">No members selected</span>
              )}
            </div>

            <button
              onClick={() => removeItem(index)}
              className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm font-medium">Remove</span>
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={addItem}
        className="w-full py-3 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl text-amber-800 font-medium flex items-center justify-center gap-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Item
      </button>
    </div>
  );
};

export default ItemList;

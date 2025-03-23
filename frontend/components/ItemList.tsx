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
    onItemsChange([
      ...items,
      {
        name: `Item ${items.length + 1}`,
        price: 0,
        split_price: 0,
        members: Object.fromEntries(members.map((member) => [member, false])),
      },
    ]);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="w-full md:w-auto flex-grow">
              <label className="block text-gray-700 mb-2">Item Name:</label>
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleItemNameChange(index, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div className="w-full md:w-auto flex-grow">
              <label className="block text-gray-700 mb-2">Price:</label>
              <input
                type="number"
                step="0.01"
                value={item.price || ""}
                onChange={(e) => handleItemPriceChange(index, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Enter price"
              />

            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Split Between:</label>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <button
                  key={member}
                  onClick={() => handleMemberSelection(index, member)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    item.members[member]
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {member}
                </button>
              ))}
              {/*  Select All button */}
              <button
                onClick={() => {
                  const newItems = [...items];
                  const allSelected = Object.values(
                    newItems[index].members
                  ).every((value) => value);

                  Object.keys(newItems[index].members).forEach(
                    (member) => (newItems[index].members[member] = !allSelected)
                  );

                  const selectedMembersCount = Object.values(
                    newItems[index].members
                  ).filter(Boolean).length;
                  newItems[index].split_price =
                    selectedMembersCount > 0
                      ? newItems[index].price / selectedMembersCount
                      : 0;

                  onItemsChange(newItems);
                }}
                className="px-3 py-1 rounded-full text-sm bg-green-500 text-white"
              >
                {Object.values(items[index].members).every((value) => value)
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {Object.entries(item.members).filter(([_, selected]) => selected)
                .length > 0
                ? `Split: $${item.split_price.toFixed(2)} per person`
                : "No members selected"}
            </div>

            <button
              onClick={() => removeItem(index)}
              className="text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={addItem}
        className="w-full py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 flex items-center justify-center"
      >
        + Add Item
      </button>
    </div>
  );
};

export default ItemList;

import { useState, useEffect } from "react";
// import { useRouter } from 'next/router';
import Head from "next/head";
import MemberSelection from "./MemberSelection";
import ItemList from "./ItemList";
import BillUploader from "./BillUploader";
import PDFUploader from "./PDFUploader";
import SplitSummary from "./SplitSummary";

import ExpenseEditor from "./ExpenseEditor";

interface ReceiptMetadata {
  store: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  subtotal: number;
  fees: {
    bag_fee: number;
    bag_fee_tax: number;
    service_fee: number;
    delivery_discount: number;
  };
  total: number;
  validation_passed: boolean;
  calculated_subtotal: number;
}

interface ApiKeys {
  SPLITWISE_CONSUMER_KEY: string;
  SPLITWISE_SECRET_KEY: string;
  SPLITWISE_API_KEY: string;
  GEMINI_API_KEY: string;
}

interface Member {
  [key: string]: boolean;
}

interface Item {
  name: string;
  price: number;
  split_price: number;
  members: Member;
}

interface FinalSplits {
  data: {
    member: string;
    itemSplits: string;
    totalSplit: string;
  }[];
  totalBill: number;
  splits: { [key: string]: number };
  itemizedSplits: {
    name: string;
    price: number;
    members: string[];
    splitPrice: number;
  }[];
}

function getApiKeys(): ApiKeys {
  return {
    SPLITWISE_CONSUMER_KEY:
      process.env.NEXT_PUBLIC_SPLITWISE_CONSUMER_KEY || "",
    SPLITWISE_SECRET_KEY: process.env.NEXT_PUBLIC_SPLITWISE_SECRET_KEY || "",
    SPLITWISE_API_KEY: process.env.NEXT_PUBLIC_SPLITWISE_API_KEY || "",
    GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
  };
}

export default function BillSplitter() {
  // const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [memToId, setMemToId] = useState<{ [key: string]: string }>({});
  const [groups, setGroups] = useState<{ [key: string]: string }>({});
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [paidUser, setPaidUser] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [finalSplits, setFinalSplits] = useState<FinalSplits | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseComment, setExpenseComment] = useState("");
  const [isUpdateMode, setIsUpdateMode] = useState<boolean>(false);
  const [expenseId, setExpenseId] = useState<string>("");
  const [allMembers, setAllMembers] = useState<string[]>([]);
  const [visibleMembers, setVisibleMembers] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<'image' | 'pdf'>('image');
  const [receiptMetadata, setReceiptMetadata] = useState<ReceiptMetadata | null>(null);
  // useEffect(() => {
  //   const keys = getApiKeys();
  //   if (!keys.SPLITWISE_CONSUMER_KEY || !keys.SPLITWISE_SECRET_KEY || !keys.SPLITWISE_API_KEY || !keys.GEMINI_API_KEY) {
  //     router.push('/');
  //     return;
  //   }

  //   setApiKeys(keys);
  //   setIsLoading(false);

  //   setItems([
  //     createDefaultItem(1),
  //     createDefaultItem(2)
  //   ]);
  // }, [router]);

  useEffect(() => {
    const keys = getApiKeys();

    setApiKeys(keys);
    setIsLoading(false);

    setItems([createDefaultItem(1), createDefaultItem(2)]);
  }, []);

  useEffect(() => {
    if (apiKeys) {
      fetchMembers();
      fetchGroups();
    }
    console.log(apiKeys);
  }, [apiKeys]);

  const createDefaultItem = (index: number): Item => ({
    name: `Item ${index}`,
    price: 0,
    split_price: 0,
    members: {},
  });

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/members?consumer_key=${apiKeys?.SPLITWISE_CONSUMER_KEY}&secret_key=${apiKeys?.SPLITWISE_SECRET_KEY}&api_key=${apiKeys?.SPLITWISE_API_KEY}`
      );

      if (!response.ok) throw new Error("Failed to fetch members");

      const data = await response.json();
      setAllMembers(data.members);
      setVisibleMembers(data.members); // Initially all members are visible
      setMemToId(data.mem_to_id);

      if (data.members.length > 0) {
        setPaidUser(data.members[0]);
      }

      setItems((prevItems) =>
        prevItems.map((item) => ({
          ...item,
          members: Object.fromEntries(
            data.members.map((member: string) => [member, false])
          ),
        }))
      );
    } catch (error) {
      console.error(error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}` +
          `/api/groups?consumer_key=${apiKeys?.SPLITWISE_CONSUMER_KEY}&secret_key=${apiKeys?.SPLITWISE_SECRET_KEY}&api_key=${apiKeys?.SPLITWISE_API_KEY}`
      );

      if (!response.ok) throw new Error("Failed to fetch groups");

      const data = await response.json();
      console.log("Groups:", data.groups);
      setGroups(data.groups);

      if (Object.keys(data.groups).length > 0) {
        setSelectedGroup(Object.keys(data.groups)[0]);
      }
    } catch (error) {
      console.error(error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

const handleItemsUpdate = (newItems: Item[]) => {
  // Ensure all members are in each item's members object
  const normalizedItems = newItems.map(item => {
    const normalizedMembers: { [key: string]: boolean } = {};
    
    // Initialize all members to false
    allMembers.forEach(member => {
      normalizedMembers[member] = false;
    });
    
    // Copy over existing selections
    Object.entries(item.members).forEach(([member, selected]) => {
      if (allMembers.includes(member)) {
        normalizedMembers[member] = selected;
      }
    });
    
    return {
      ...item,
      members: normalizedMembers
    };
  });
  
  setItems(normalizedItems);
};



  const handleGroupChange = (group: string) => {
    setSelectedGroup(group);
  };

  const handlePaidUserChange = (user: string) => {
    setPaidUser(user);
  };

  const calculateSplits = () => {
    const splits: { [key: string]: number } = {};
    const splitsPerItem: { [key: string]: string } = {};
    let totalBill = 0;

    // New: Track who ordered each item
    const itemizedSplits: {
      name: string;
      price: number;
      members: string[];
      splitPrice: number;
    }[] = [];

    // Initialize with ALL members, not just visible ones
    allMembers.forEach((member) => {
      splits[member] = 0;
      splitsPerItem[member] = "";
    });

    items.forEach((item) => {
      const selectedMembers = Object.entries(item.members)
        .filter(([_, selected]) => selected)
        .map(([name]) => name);

      const splitPrice = item.price / Math.max(1, selectedMembers.length);
      totalBill += item.price;

      // Add to itemized splits
      itemizedSplits.push({
        name: item.name,
        price: item.price,
        members: selectedMembers,
        splitPrice: splitPrice,
      });

      selectedMembers.forEach((member) => {
        splits[member] += splitPrice;
        splitsPerItem[member] += `${item.name}=$${splitPrice.toFixed(2)}, `;
      });
    });

const finalData = allMembers.map((member) => ({
  member,
  itemSplits: splitsPerItem[member].replace(/,\s*$/, ""),
  totalSplit: splits[member].toFixed(2),
}));

    setFinalSplits({
      data: finalData,
      totalBill,
      splits,
      itemizedSplits,
    });
  };

  const createExpense = async () => {
    if (!finalSplits) {
      alert("Please calculate splits first");
      return;
    }

    try {
      setIsLoading(true);

      // let description = '';
      // items.forEach(item => {
      //   description += `${item.name} : ${item.price}\n`;
      // });
      // Format item data to JSON string to store in the description
      const itemData = items.map((item) => ({
        name: item.name,
        price: item.price,
        members: Object.entries(item.members)
          .filter(([_, selected]) => selected)
          .map(([name]) => name),
      }));

      // Main expense description
      const formattedComment = expenseComment || "Itemized bill split";

      // Append JSON data with a marker so you can parse it later
      const fullComment = `${formattedComment}\n---ITEMDATA---\n${JSON.stringify(
        itemData
      )}`;

      console.log(fullComment);

      const expenseData = {
        splits: finalSplits.splits,
        paid_user: paidUser,
        total_amt: finalSplits.totalBill,
        group_id: selectedGroup,
        description: expenseDescription,
        comment: fullComment,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}` +
          `/api/create-expense?consumer_key=${apiKeys?.SPLITWISE_CONSUMER_KEY}&secret_key=${apiKeys?.SPLITWISE_SECRET_KEY}&api_key=${apiKeys?.SPLITWISE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expenseData),
        }
      );

      if (!response.ok) throw new Error("Failed to create expense");

      await response.json();
      alert("Expense created successfully!");

      setItems([createDefaultItem(1), createDefaultItem(2)]);
      setFinalSplits(null);
    } catch (error) {
      console.error(error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  // Add a new function to handle loading expense data
  const handleLoadExpense = (data: {
    items: any[];
    members: string[];
    paidUser: string;
    description: string;
    comment: string;
    expenseId?: string;
    group_name: string;
  }) => {
    // Set expense description and comment
    setExpenseDescription(data.description);
    setExpenseComment(data.comment);
    setSelectedGroup(data.group_name);

    // Set paid user if it exists in allMembers list
    if (allMembers.includes(data.paidUser)) {
      setPaidUser(data.paidUser);
    }

    // Make sure members from the expense are visible
    if (data.items.length > 0) {
      // Collect all unique members from all items
      const expenseMembers = new Set<string>();

      data.items.forEach((item) => {
        item.members.forEach((member: string) => {
          if (allMembers.includes(member)) {
            expenseMembers.add(member);
          }
        });
      });

      // Make sure the payer is visible too
      if (allMembers.includes(data.paidUser)) {
        expenseMembers.add(data.paidUser);
      }

      // Update visible members to include expense members
      const updatedVisibleMembers = [...visibleMembers];
      expenseMembers.forEach((member) => {
        if (!updatedVisibleMembers.includes(member)) {
          updatedVisibleMembers.push(member);
        }
      });
      setVisibleMembers(updatedVisibleMembers);

      // Convert loaded items to the correct format
      const convertedItems = data.items.map((item) => {
        // Create members object with all members set to false initially
        const memberObj: { [key: string]: boolean } = {};
        allMembers.forEach((m) => {
          memberObj[m] = false;
        });

        // Set members who are part of this item to true
        item.members.forEach((m: string) => {
          if (allMembers.includes(m)) {
            memberObj[m] = true;
          }
        });

        return {
          name: item.name,
          price: parseFloat(item.price),
          split_price:
            parseFloat(item.price) / Math.max(1, item.members.length),
          members: memberObj,
        };
      });

      setItems(convertedItems);
    }

    // Set update mode if expense ID is provided
    if (data.expenseId) {
      setExpenseId(data.expenseId);
      setIsUpdateMode(true);
    } else {
      setIsUpdateMode(false);
      setExpenseId("");
    }
  };

  const updateExpense = async () => {
    if (!finalSplits || !expenseId) {
      alert("Please calculate splits first and ensure you have an expense ID");
      return;
    }

    try {
      setIsLoading(true);

      // Format item data to JSON string
      const itemData = items.map((item) => ({
        name: item.name,
        price: item.price,
        members: Object.entries(item.members)
          .filter(([_, selected]) => selected)
          .map(([name]) => name),
      }));

      // Main expense comment
      const formattedComment = expenseComment || "Itemized bill split";

      // Append JSON data with a marker
      const fullComment = `${formattedComment}\n---ITEMDATA---\n${JSON.stringify(
        itemData
      )}`;

      const expenseData = {
        expense_id: expenseId,
        splits: finalSplits.splits,
        paid_user: paidUser,
        total_amt: finalSplits.totalBill,
        group_id: selectedGroup,
        description: expenseDescription,
        comment: fullComment,
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/update-expense?consumer_key=${apiKeys?.SPLITWISE_CONSUMER_KEY}&secret_key=${apiKeys?.SPLITWISE_SECRET_KEY}&api_key=${apiKeys?.SPLITWISE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expenseData),
        }
      );

      if (!response.ok) throw new Error("Failed to update expense");

      await response.json();
      alert("Expense updated successfully!");

      // Reset form
      setItems([createDefaultItem(1), createDefaultItem(2)]);
      setFinalSplits(null);
      setIsUpdateMode(false);
      setExpenseId("");
    } catch (error) {
      console.error(error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function to check if hidden members have splits
  const getHiddenMembersWithSplits = () => {
    const hiddenMembers = allMembers.filter(
      (member) => !visibleMembers.includes(member)
    );

    // Check if any hidden members have splits assigned
    const hiddenWithSplits = hiddenMembers.filter((member) => {
      return items.some((item) => item.members[member] === true);
    });

    return hiddenWithSplits;
  };

  // Unified handler for items detected from any source (image, PDF)
  const handleItemsDetectedWithMetadata = (detectedItems: any[], metadata: ReceiptMetadata | null) => {
    // Convert items to the format expected by our app
    const newItems = detectedItems.map((item) => {
      const memberObj: { [key: string]: boolean } = {};
      allMembers.forEach((member) => {
        memberObj[member] = false;
      });

      return {
        name: item.name,
        price: parseFloat(item.price) || 0,
        split_price: 0,
        members: memberObj,
      };
    });

    // Set items and metadata
    setItems(newItems);
    setReceiptMetadata(metadata);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Bill Splitter</title>
        <meta name="description" content="Split bills with friends" />
      </Head>

      <main className="max-w-4xl mx-auto">
        {/* <h1 className="text-3xl font-bold text-center mb-8">Itemized Bill Splitter</h1> */}

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Step 1: Select Group and Payer
          </h2>
          <MemberSelection
            allMembers={allMembers} // New prop
            visibleMembers={visibleMembers} // New prop
            groups={groups}
            selectedGroup={selectedGroup}
            paidUser={paidUser}
            onGroupChange={handleGroupChange}
            onPaidUserChange={handlePaidUserChange}
          />
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Step 2: Add Items
          </h2>

          {/* Input Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMode('image')}
              className={`px-4 py-2 rounded ${
                inputMode === 'image'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              📷 Image
            </button>
            <button
              onClick={() => setInputMode('pdf')}
              className={`px-4 py-2 rounded ${
                inputMode === 'pdf'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              📄 PDF
            </button>
          </div>

          {/* Conditional Input Components */}
          {inputMode === 'image' && apiKeys && (
            <BillUploader
              apiKeys={apiKeys}
              onItemsDetected={handleItemsDetectedWithMetadata}
            />
          )}

          {inputMode === 'pdf' && apiKeys && (
            <PDFUploader
              apiKeys={apiKeys}
              onItemsDetected={handleItemsDetectedWithMetadata}
            />
          )}

          {/* Receipt Metadata Display */}
          {receiptMetadata && (
            <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  {receiptMetadata.store && (
                    <p className="font-semibold text-lg">{receiptMetadata.store}</p>
                  )}
                  {receiptMetadata.delivery_date && receiptMetadata.delivery_time && (
                    <p className="text-gray-600">
                      Delivered: {receiptMetadata.delivery_date} at {receiptMetadata.delivery_time}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Subtotal: ${receiptMetadata.subtotal.toFixed(2)}</p>
                  <p className="font-semibold">Total: ${receiptMetadata.total.toFixed(2)}</p>
                </div>
              </div>
              {!receiptMetadata.validation_passed && (
                <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded text-sm">
                  ⚠️ Validation warning: Calculated subtotal (${receiptMetadata.calculated_subtotal.toFixed(2)})
                  doesn't match expected (${receiptMetadata.subtotal.toFixed(2)})
                </div>
              )}
              {receiptMetadata.validation_passed && (
                <div className="mt-2 p-2 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
                  ✓ All items verified - totals match
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Select members to show</h2>
          {getHiddenMembersWithSplits().length > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
              <p className="font-semibold">
                Warning: Hidden members with assigned splits
              </p>
              <p>
                The following hidden members still have items assigned to them:
              </p>
              <ul className="list-disc pl-5">
                {getHiddenMembersWithSplits().map((member) => (
                  <li key={member}>{member}</li>
                ))}
              </ul>
              <p className="mt-2">
                These members will still be included in the final bill split
                even though they're hidden from view.
              </p>
              <button
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => {
                  const hiddenWithSplits = getHiddenMembersWithSplits();
                  setVisibleMembers([...visibleMembers, ...hiddenWithSplits]);
                }}
              >
                Show these members
              </button>
            </div>
          )}
          <div className="flex flex-row flex-wrap gap-4">
            {allMembers.map((member, index) => (
              <div key={index} className="flex items-center">
                <input
                  type="checkbox"
                  id={`member-${index}`}
                  checked={visibleMembers.includes(member)}
                  onChange={() => {
                    const newVisibleMembers = visibleMembers.includes(member)
                      ? visibleMembers.filter((m) => m !== member)
                      : [...visibleMembers, member];
                    setVisibleMembers(newVisibleMembers);
                  }}
                />
                <label htmlFor={`member-${index}`} className="ml-2">
                  {member}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Step 3: Edit Items and Assign Members
          </h2>
          <ItemList
            items={items}
            members={visibleMembers} // Pass only visible members for UI
            onItemsChange={handleItemsUpdate}
          />
        </div>
        <div className="mb-4">
          <input
            type="text"
            value={expenseDescription}
            onChange={(e) => setExpenseDescription(e.target.value)}
            placeholder="Enter expense title"
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="expenseComment" className="block text-gray-700 mb-2">
            Expense Comment
          </label>
          <textarea
            id="expenseComment"
            value={expenseComment}
            onChange={(e) => setExpenseComment(e.target.value)}
            placeholder="Enter expense comment or view AI processing results"
            className="w-full p-2 border rounded min-h-[100px]"
            rows={5}
          />
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Step 4: Calculate and Submit
          </h2>
          <div className="flex space-x-4">
            <button
              onClick={calculateSplits}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
            >
              Calculate Splits
            </button>

            {isUpdateMode ? (
              <button
                onClick={updateExpense}
                disabled={!finalSplits}
                className={`${
                  finalSplits
                    ? "bg-yellow-500 hover:bg-yellow-600"
                    : "bg-gray-400 cursor-not-allowed"
                } text-white py-2 px-4 rounded`}
              >
                Update Expense in Splitwise
              </button>
            ) : (
              <button
                onClick={createExpense}
                disabled={!finalSplits}
                className={`${
                  finalSplits
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-gray-400 cursor-not-allowed"
                } text-white py-2 px-4 rounded`}
              >
                Create Expense in Splitwise
              </button>
            )}
            {isUpdateMode && (
              <button
                onClick={() => {
                  setIsUpdateMode(false);
                  setExpenseId("");
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded"
              >
                Cancel Update
              </button>
            )}
          </div>
        </div>

        {finalSplits && (
          <SplitSummary
            data={finalSplits.data}
            totalBill={finalSplits.totalBill}
            itemizedSplits={finalSplits.itemizedSplits}
          />
        )}

        <ExpenseEditor onLoadExpense={handleLoadExpense} />
      </main>
    </div>
  );
}

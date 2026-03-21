import { useState, useEffect } from "react";
// import { useRouter } from 'next/router';
import Head from "next/head";
import MemberSelection from "./MemberSelection";
import ItemList from "./ItemList";
import BillUploader from "./BillUploader";
import PDFUploader from "./PDFUploader";
import SplitSummary from "./SplitSummary";
import ExpenseEditor from "./ExpenseEditor";
import Spinner from "./Spinner";
import { useToast } from "./Toast";
import SettingsModal, { loadApiKeys, hasApiKeys } from "./SettingsModal";

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
  return loadApiKeys();
}

export default function BillSplitter() {
  // const router = useRouter();
  const { showToast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);
  const [, setMemToId] = useState<{ [key: string]: string }>({});
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
  const [isDescriptionLocked, setIsDescriptionLocked] = useState<boolean>(false);
  const [isAutoSplitting, setIsAutoSplitting] = useState<boolean>(false);
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
    if (hasApiKeys()) {
      setApiKeys(keys);
    }
    setIsLoading(false);
    setItems([createDefaultItem(1), createDefaultItem(2)]);
  }, []);

  const handleSettingsSave = (keys: ApiKeys) => {
    setApiKeys(keys);
  };

  useEffect(() => {
    if (apiKeys) {
      fetchMembers();
      fetchGroups();
    }
    console.log(apiKeys);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showToast(
        error instanceof Error ? error.message : "Failed to fetch members",
        "error"
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
      showToast(
        error instanceof Error ? error.message : "Failed to fetch groups",
        "error"
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



  const autoSplitItems = async (currentItems: Item[]) => {
    if (!apiKeys?.GEMINI_API_KEY || visibleMembers.length === 0) return;

    setIsAutoSplitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auto-split`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: currentItems.map((item) => ({
              name: item.name,
              price: item.price,
            })),
            members: visibleMembers,
            gemini_key: apiKeys.GEMINI_API_KEY,
          }),
        }
      );

      if (!response.ok) throw new Error("Auto-split request failed");

      const data = await response.json();

      // Update items with auto-assigned members
      setItems((prevItems) =>
        prevItems.map((item) => {
          const match = data.items.find(
            (r: { name: string }) => r.name === item.name
          );
          if (!match || !match.members || match.members.length === 0) {
            return item;
          }

          const updatedMembers = { ...item.members };
          match.members.forEach((memberName: string) => {
            if (memberName in updatedMembers) {
              updatedMembers[memberName] = true;
            }
          });

          return { ...item, members: updatedMembers };
        })
      );

      showToast(
        `Auto-assigned ${data.auto_assigned} items, ${data.shared} shared, ${data.unmatched} need manual assignment`,
        "success"
      );
    } catch (error) {
      console.error("Auto-split failed:", error);
      showToast("Auto-split failed, please assign members manually", "warning");
    } finally {
      setIsAutoSplitting(false);
    }
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
        .filter(([, selected]) => selected)
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

    // Generate formatted text for expense comment
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

    setExpenseComment(formattedText);
  };

  const createExpense = async () => {
    if (!finalSplits) {
      showToast("Please calculate splits first", "warning");
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
          .filter(([, selected]) => selected)
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
      showToast("Expense created successfully!", "success");

      setItems([createDefaultItem(1), createDefaultItem(2)]);
      setFinalSplits(null);
    } catch (error) {
      console.error(error);
      showToast(
        error instanceof Error ? error.message : "Failed to create expense",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-screen">
        <SettingsModal onSave={handleSettingsSave} />
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <Spinner size="lg" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-stone-800">SplitWise AI</h2>
            <p className="text-stone-500">Loading your groups...</p>
          </div>
        </div>
      </div>
    );
  }

  // Add a new function to handle loading expense data
  const handleLoadExpense = (data: {
    items: { name: string; price: number | string; members: string[] }[];
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

        const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
        return {
          name: item.name,
          price,
          split_price: price / Math.max(1, item.members.length),
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
      showToast("Please calculate splits first", "warning");
      return;
    }

    try {
      setIsLoading(true);

      // Format item data to JSON string
      const itemData = items.map((item) => ({
        name: item.name,
        price: item.price,
        members: Object.entries(item.members)
          .filter(([, selected]) => selected)
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
      showToast("Expense updated successfully!", "success");

      // Reset form
      setItems([createDefaultItem(1), createDefaultItem(2)]);
      setFinalSplits(null);
      setIsUpdateMode(false);
      setExpenseId("");
    } catch (error) {
      console.error(error);
      showToast(
        error instanceof Error ? error.message : "Failed to update expense",
        "error"
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

  // Validation: Get items that have no members selected
  const getItemsWithoutMembers = () => {
    return items.filter((item) => {
      const selectedMembers = Object.values(item.members).filter(Boolean);
      return selectedMembers.length === 0 ;
    });
  };

  // Validation: Check if all items with price > 0 have at least one member selected
  const hasValidMemberSelection = () => {
    return getItemsWithoutMembers().length === 0;
  };

  // Unified handler for items detected from any source (image, PDF)
  const handleItemsDetectedWithMetadata = (detectedItems: { name: string; price: number | string }[], metadata: ReceiptMetadata | null) => {
    // Convert items to the format expected by our app
    const newItems = detectedItems.map((item) => {
      const memberObj: { [key: string]: boolean } = {};
      allMembers.forEach((member) => {
        memberObj[member] = false;
      });

      return {
        name: item.name,
        price: (typeof item.price === 'string' ? parseFloat(item.price) : item.price) || 0,
        split_price: 0,
        members: memberObj,
      };
    });

    // Add Tax/Fees item if metadata has total information
    if (metadata && metadata.total) {
      const itemsSum = newItems.reduce((sum, item) => sum + item.price, 0);
      const taxFeesAmount = Math.round((metadata.total - itemsSum) * 100) / 100;

      // Only add if difference is meaningful (>= 1 cent)
      if (Math.abs(taxFeesAmount) >= 0.01) {
        const memberObj: { [key: string]: boolean } = {};
        allMembers.forEach((member) => {
          memberObj[member] = false;
        });

        newItems.push({
          name: taxFeesAmount >= 0 ? "Tax & Fees" : "Discount",
          price: taxFeesAmount,
          split_price: 0,
          members: memberObj,
        });
      }
    }

    // Set items and metadata
    setItems(newItems);
    setReceiptMetadata(metadata);

    // Auto-populate description from metadata
    if (metadata) {
      let description = "";
      if (metadata.store) {
        description = metadata.store;
      }
      if (metadata.delivery_date) {
        description += description ? ` - ${metadata.delivery_date}` : metadata.delivery_date;
      }
      if (description) {
        setExpenseDescription(description);
        setIsDescriptionLocked(true);
      }
    }

    // Clear expense comment - it will be populated when Calculate Splits is clicked
    setExpenseComment("");

    // Auto-split: assign members based on historical preferences
    autoSplitItems(newItems);
  };

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <Head>
        <title>Bill Splitter</title>
        <meta name="description" content="Split bills with friends" />
      </Head>

      <SettingsModal onSave={handleSettingsSave} />

      {/* Prompt to configure keys if not set */}
      {!apiKeys?.SPLITWISE_CONSUMER_KEY && (
        <div className="max-w-md mx-auto mb-6 p-5 bg-amber-50/95 backdrop-blur-sm border border-amber-300 rounded-2xl shadow-lg text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <h3 className="text-lg font-semibold text-stone-800 mb-1">Set up your API keys</h3>
          <p className="text-sm text-stone-600">
            Click the <span className="font-medium">settings icon</span> in the top-right corner to enter your Splitwise and Gemini API credentials.
          </p>
        </div>
      )}

      {/* Header - Outside main card, on the background */}
      <div className="text-center mb-8">
        <svg
          viewBox="0 0 700 140"
          className="w-full max-w-4xl mx-auto h-auto"
          aria-label="Split Splitter"
        >
          <text
            x="50%"
            y="95"
            textAnchor="middle"
            className="handwriting-text font-[family-name:var(--font-playwrite-co)]"
            style={{
              fontSize: '85px',
              fill: 'transparent',
              stroke: 'white',
              strokeWidth: '2',
              strokeDasharray: '1500',
              strokeDashoffset: '1500',
              animation: 'handwriting 3s ease forwards, fillIn 1s ease forwards 2.5s',
            }}
          >
            Split Splitter
          </text>
        </svg>
      </div>

      <main className="max-w-6xl mx-auto bg-amber-50/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 md:p-12 border border-amber-200/40">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">
            Step 1: Select Group and Payer
          </h2>
          <MemberSelection
            allMembers={allMembers}
            visibleMembers={visibleMembers}
            groups={groups}
            selectedGroup={selectedGroup}
            paidUser={paidUser}
            hiddenMembersWithSplits={getHiddenMembersWithSplits()}
            onGroupChange={handleGroupChange}
            onPaidUserChange={handlePaidUserChange}
            onVisibleMembersChange={setVisibleMembers}
          />
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">
            Step 2: Add Items
          </h2>

          {/* Input Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMode('image')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                inputMode === 'image'
                  ? 'bg-amber-600 text-white focus:ring-amber-500'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200 focus:ring-stone-400'
              }`}
            >
              Image
            </button>
            <button
              onClick={() => setInputMode('pdf')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                inputMode === 'pdf'
                  ? 'bg-emerald-500 text-white focus:ring-emerald-500'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200 focus:ring-stone-400'
              }`}
            >
              PDF
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
            <div className="mt-4 p-4 bg-stone-50 border border-slate-200 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  {receiptMetadata.store && (
                    <p className="font-semibold text-lg text-slate-900">{receiptMetadata.store}</p>
                  )}
                  {receiptMetadata.delivery_date && receiptMetadata.delivery_time && (
                    <p className="text-stone-600">
                      Delivered: {receiptMetadata.delivery_date} at {receiptMetadata.delivery_time}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-stone-500">Subtotal: ${receiptMetadata.subtotal.toFixed(2)}</p>
                  <p className="font-semibold text-slate-900">Total: ${receiptMetadata.total.toFixed(2)}</p>
                </div>
              </div>
              {!receiptMetadata.validation_passed && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Validation warning: Calculated subtotal (${receiptMetadata.calculated_subtotal.toFixed(2)}) doesn&apos;t match expected (${receiptMetadata.subtotal.toFixed(2)})</span>
                </div>
              )}
              {receiptMetadata.validation_passed && (
                <div className="flex items-center gap-2 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>All items verified - totals match</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Two-column layout for Step 3+ */}
        <div className="md:grid md:grid-cols-[40%_60%] md:gap-6">
          {/* Left Column - Sticky */}
          <div className="md:sticky md:top-8 md:self-start space-y-4 order-2 md:order-1 mb-8 md:mb-0">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Expense Title
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="Enter expense title"
                  className={`flex-1 px-4 py-2.5 border border-stone-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all duration-150 ${
                    isDescriptionLocked ? 'bg-stone-50' : 'bg-white'
                  }`}
                  readOnly={isDescriptionLocked}
                />
                {isDescriptionLocked && (
                  <button
                    onClick={() => setIsDescriptionLocked(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 transition-all duration-150"
                    title="Edit description"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="expenseComment" className="block text-sm font-medium text-stone-700 mb-2">
                Expense Comment
              </label>
              <textarea
                id="expenseComment"
                value={expenseComment}
                onChange={(e) => setExpenseComment(e.target.value)}
                placeholder="Enter expense comment or view AI processing results"
                className="w-full px-4 py-3 border border-stone-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all duration-150 min-h-[120px] font-mono text-sm"
                rows={5}
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-stone-800 mb-4">
                Calculate and Submit
              </h2>

              {/* Validation Error Display */}
              {getItemsWithoutMembers().length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-800">Missing member selection</p>
                      <ul className="list-disc pl-5 mt-1 text-sm text-red-700">
                        {getItemsWithoutMembers().map((item, idx) => (
                          <li key={idx}>{item.name} (${item.price.toFixed(2)})</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm text-red-600">Please select at least one member for each item.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={calculateSplits}
                  disabled={!hasValidMemberSelection()}
                  className={`${
                    hasValidMemberSelection()
                      ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
                      : 'bg-slate-300 cursor-not-allowed'
                  } text-white py-2.5 px-5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 active:scale-95`}
                >
                  Calculate Splits
                </button>

                {isUpdateMode ? (
                  <button
                    onClick={updateExpense}
                    disabled={!finalSplits || !hasValidMemberSelection()}
                    className={`${
                      finalSplits && hasValidMemberSelection()
                        ? "bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
                        : "bg-slate-300 cursor-not-allowed"
                    } text-white py-2.5 px-5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 active:scale-95`}
                  >
                    Update Expense
                  </button>
                ) : (
                  <button
                    onClick={createExpense}
                    disabled={!finalSplits || !hasValidMemberSelection()}
                    className={`${
                      finalSplits && hasValidMemberSelection()
                        ? "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500"
                        : "bg-slate-300 cursor-not-allowed"
                    } text-white py-2.5 px-5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 active:scale-95`}
                  >
                    Create Expense
                  </button>
                )}
                {isUpdateMode && (
                  <button
                    onClick={() => {
                      setIsUpdateMode(false);
                      setExpenseId("");
                    }}
                    className="bg-stone-500 hover:bg-slate-600 text-white py-2.5 px-5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all duration-150 active:scale-95"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Items and Results */}
          <div className="space-y-6 order-1 md:order-2">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-stone-800">
                  Edit Items and Assign Members
                </h2>
                <button
                  onClick={() => {
                    // Reset all member selections before auto-splitting
                    const resetItems = items.map((item) => ({
                      ...item,
                      members: Object.fromEntries(
                        Object.keys(item.members).map((m) => [m, false])
                      ),
                    }));
                    setItems(resetItems);
                    autoSplitItems(resetItems);
                  }}
                  disabled={
                    isAutoSplitting ||
                    items.length === 0 ||
                    !items.some((item) => item.name && item.name !== `Item ${items.indexOf(item) + 1}`) ||
                    !apiKeys?.GEMINI_API_KEY
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                    bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-100
                    transition-colors"
                  title="Auto-assign members to items using AI"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.547a1 1 0 01.64 1.894l-1.04.355L18 10l-1.847 2.393 1.04.355a1 1 0 01-.64 1.894l-1.6-.547L11 15.677V17a1 1 0 11-2 0v-1.323l-3.954-1.582-1.599.547a1 1 0 01-.64-1.894l1.04-.355L2 10l1.847-2.393-1.04-.355a1 1 0 01.64-1.894l1.6.547L9 4.323V3a1 1 0 011-1zm0 4.618L6.382 8.399 5 10l1.382 1.601L10 13.382l3.618-1.781L15 10l-1.382-1.601L10 6.618z" />
                  </svg>
                  {isAutoSplitting ? "Auto-assigning..." : "Auto-split with AI"}
                </button>
                {isAutoSplitting && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <Spinner size="sm" />
                    <span>Auto-assigning members...</span>
                  </div>
                )}
              </div>
              <ItemList
                items={items}
                members={visibleMembers} // Pass only visible members for UI
                onItemsChange={handleItemsUpdate}
              />
            </div>

            {finalSplits && (
              <SplitSummary
                data={finalSplits.data}
                totalBill={finalSplits.totalBill}
                itemizedSplits={finalSplits.itemizedSplits}
              />
            )}

            <ExpenseEditor onLoadExpense={handleLoadExpense} />
          </div>
        </div>
      </main>
    </div>
  );
}

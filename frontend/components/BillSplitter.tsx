import { useState, useEffect } from 'react';
// import { useRouter } from 'next/router';
import Head from 'next/head';
import MemberSelection from './MemberSelection';
import ItemList from './ItemList';
import BillUploader from './BillUploader';
import SplitSummary from './SplitSummary';

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
}

function getApiKeys(): ApiKeys {
  return {
    SPLITWISE_CONSUMER_KEY: process.env.NEXT_PUBLIC_SPLITWISE_CONSUMER_KEY || '',
    SPLITWISE_SECRET_KEY: process.env.NEXT_PUBLIC_SPLITWISE_SECRET_KEY || '',
    SPLITWISE_API_KEY: process.env.NEXT_PUBLIC_SPLITWISE_API_KEY || '',
    GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  };
}

export default function BillSplitter() {
  // const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [memToId, setMemToId] = useState<{ [key: string]: string }>({});
  const [groups, setGroups] = useState<{ [key: string]: string }>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [paidUser, setPaidUser] = useState<string>('');
  const [items, setItems] = useState<Item[]>([]);
  const [finalSplits, setFinalSplits] = useState<FinalSplits | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseComment, setExpenseComment] = useState('');

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
    
    setItems([
      createDefaultItem(1),
      createDefaultItem(2)
    ]);
  }, []);

  useEffect(() => {
    if (apiKeys) {
      fetchMembers();
      fetchGroups();
    }
    console.log(apiKeys)
  }, [apiKeys]);

  const createDefaultItem = (index: number): Item => ({
    name: `Item ${index}`,
    price: 0,
    split_price: 0,
    members: {}
  });

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}`+`/api/members?consumer_key=${apiKeys?.SPLITWISE_CONSUMER_KEY}&secret_key=${apiKeys?.SPLITWISE_SECRET_KEY}&api_key=${apiKeys?.SPLITWISE_API_KEY}`);
      console.log(response)
      if (!response.ok) throw new Error('Failed to fetch members');
      
      const data = await response.json();
      setMembers(data.members);
      setMemToId(data.mem_to_id);
      
      if (data.members.length > 0) {
        setPaidUser(data.members[0]);
      }
      
      setItems(prevItems => 
        prevItems.map(item => ({
          ...item,
          members: Object.fromEntries(data.members.map((member: string) => [member, false]))
        }))
      );
    } catch (error) {
      console.error(error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}`+`/api/groups?consumer_key=${apiKeys?.SPLITWISE_CONSUMER_KEY}&secret_key=${apiKeys?.SPLITWISE_SECRET_KEY}&api_key=${apiKeys?.SPLITWISE_API_KEY}`);
      
      if (!response.ok) throw new Error('Failed to fetch groups');
      
      const data = await response.json();
      setGroups(data.groups);
      
      if (Object.keys(data.groups).length > 0) {
        setSelectedGroup(Object.keys(data.groups)[0]);
      }
    } catch (error) {
      console.error(error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleItemsUpdate = (newItems: Item[]) => {
    setItems(newItems);
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
    
    members.forEach(member => {
      splits[member] = 0;
      splitsPerItem[member] = '';
    });
    
    items.forEach(item => {
      const selectedMembers = Object.entries(item.members)
        .filter(([_, selected]) => selected)
        .map(([name]) => name);
      
      const splitPrice = item.price / Math.max(1, selectedMembers.length);
      totalBill += item.price;
      
      selectedMembers.forEach(member => {
        splits[member] += splitPrice;
        splitsPerItem[member] += `${item.name}=$${splitPrice.toFixed(2)}, `;
      });
    });
    
    const finalData = members.map(member => ({
      member,
      itemSplits: splitsPerItem[member].replace(/,\s*$/, ''),
      totalSplit: splits[member].toFixed(2)
    }));
    
    setFinalSplits({
      data: finalData,
      totalBill,
      splits
    });
  };

  const createExpense = async () => {
    if (!finalSplits) {
      alert('Please calculate splits first');
      return;
    }
    
    try {
      setIsLoading(true);
      
      let description = '';
      items.forEach(item => {
        description += `${item.name} : ${item.price}\n`;
      });
      
      const expenseData = {
        splits: finalSplits.splits,
        paid_user: paidUser,
        total_amt: finalSplits.totalBill,
        group_id: selectedGroup,
        description: expenseDescription,
        comment: expenseComment
      };
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}`+`/api/create-expense?consumer_key=${apiKeys?.SPLITWISE_CONSUMER_KEY}&secret_key=${apiKeys?.SPLITWISE_SECRET_KEY}&api_key=${apiKeys?.SPLITWISE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData)
      });
      
      if (!response.ok) throw new Error('Failed to create expense');
      
      await response.json();
      alert('Expense created successfully!');
      
      setItems([createDefaultItem(1), createDefaultItem(2)]);
      setFinalSplits(null);
    } catch (error) {
      console.error(error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Bill Splitter</title>
        <meta name="description" content="Split bills with friends" />
      </Head>

      <main className="max-w-4xl mx-auto">
        {/* <h1 className="text-3xl font-bold text-center mb-8">Itemized Bill Splitter</h1> */}
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Step 1: Select Group and Payer</h2>
          <MemberSelection 
            members={members}
            groups={groups}
            selectedGroup={selectedGroup}
            paidUser={paidUser}
            onGroupChange={handleGroupChange}
            onPaidUserChange={handlePaidUserChange}
          />
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Step 2: Upload Bills (Optional)</h2>
          {apiKeys && (
            <BillUploader 
              apiKeys={apiKeys}
              onItemsDetected={handleItemsUpdate}
            />
          )}
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Step 3: Edit Items and Assign Members</h2>
          <ItemList 
            items={items}
            members={members}
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
            <input
              type="text"
              value={expenseComment}
              onChange={(e) => setExpenseComment(e.target.value)}
              placeholder="Enter expense comment"
              className="w-full p-2 border rounded"
            />
          </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Step 4: Calculate and Submit</h2>
          <div className="flex space-x-4">
            <button 
              onClick={calculateSplits}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
            >
              Calculate Splits
            </button>
            
            <button 
              onClick={createExpense}
              disabled={!finalSplits}
              className={`${finalSplits ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'} text-white py-2 px-4 rounded`}
            >
              Create Expense in Splitwise
            </button>
          </div>
        </div>
        
        {finalSplits && (
          <SplitSummary 
            data={finalSplits.data}
            totalBill={finalSplits.totalBill}
          />
        )}
      </main>
    </div>
  );
}

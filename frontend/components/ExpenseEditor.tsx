import { useState } from "react";

interface ExpenseEditorProps {
    onLoadExpense?: (data: {
      items: any[],
      members: string[],
      paidUser: string,
      description: string,
      comment: string,
    expenseId: string,
    group_name: string,
    }) => void;
  }
  
  export default function ExpenseEditor({ onLoadExpense }: ExpenseEditorProps) {
      const [expenseId, setExpenseId] = useState<string>('');
      const [expenseData, setExpenseData] = useState<any>(null);
      const [loading, setLoading] = useState<boolean>(false);
      const [error, setError] = useState<string>('');
      const [parsedItems, setParsedItems] = useState<any[]>([]);
      
      const fetchExpense = async () => {
          try {
            setLoading(true);
            setError('');
        
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/get-expense?expense_id=${expenseId}&consumer_key=${process.env.NEXT_PUBLIC_SPLITWISE_CONSUMER_KEY}&secret_key=${process.env.NEXT_PUBLIC_SPLITWISE_SECRET_KEY}&api_key=${process.env.NEXT_PUBLIC_SPLITWISE_API_KEY}`);
        
            if (!response.ok) {
              throw new Error('Failed to fetch expense');
            }
        
            const data = await response.json();
            setExpenseData(data.expense);
            
            // Try to parse item data from description
            try {
              if (data.expense.comment) {
                const parts = data.expense.comment.split('---ITEMDATA---');
                if (parts.length > 1) {
                  const itemData = JSON.parse(parts[1]);
                  setParsedItems(itemData);
                }
              }
            } catch (parseError) {
              console.error('Failed to parse item data', parseError);
            }
        
          } catch (err) {
            console.error(err);
            setError('Failed to fetch expense details');
          } finally {
            setLoading(false);
          }
      };
  
      const handleExpenseIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          setExpenseId(e.target.value);
      };
      
      const resetExpenseEditor = () => {
          setExpenseId('');
          setExpenseData(null);
          setParsedItems([]);
          setError('');
      };
      
      const loadIntoForm = () => {
          if (!expenseData || !onLoadExpense) return;
                    
          // Get all member names from the expense
          const members = expenseData.users.map((user: any) => user.first_name);
          
          // Find who paid (the one with non-zero paid_share)
          const paidUser = expenseData.users.find((user: any) => 
              parseFloat(user.paid_share) > 0
          )?.first_name || '';
          
          let comment = ""
          try {
            if (expenseData.comment) {
              const parts = expenseData.comment.split('---ITEMDATA---');
              if (parts.length > 1) {
                const itemData = parts[0];
                comment = parts[0];
              }
            }
          } catch (parseError) {
            console.error('Failed to parse item data', parseError);
          }

          onLoadExpense({
              items: parsedItems,
              members,
              paidUser,
              description: expenseData.description,
              comment: comment,
              expenseId: expenseId,
              group_name: expenseData.group_name,

          });
      };
  
      return (
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-4">Load Existing Expense</h2>
          <input
            type="text"
            value={expenseId}
            onChange={handleExpenseIdChange}
            placeholder="Enter Expense ID"
            className="border p-2 w-full mb-4"
          />
          <div className="flex gap-2">
            <button onClick={fetchExpense} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded">
              Fetch Expense
            </button>
            
            {expenseData && onLoadExpense && (
              <button 
                onClick={loadIntoForm} 
                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded"
              >
                Load Into Form
              </button>
            )}
          </div>
        
          {loading && <p>Loading...</p>}
          {error && <p className="text-red-500">{error}</p>}
        
          {expenseData && (
            <div className="mt-4">
              <h3 className="text-xl font-bold">Expense Details:</h3>
              <p><strong>Description:</strong> {expenseData.description.split('---ITEMDATA---')[0]?.trim()}</p>
              <p><strong>Total Cost:</strong> ${expenseData.cost}</p>
        
              <h4 className="text-lg font-semibold mt-4">Users:</h4>
              <ul>
                {expenseData.users.map((user: any, idx: number) => (
                  <li key={idx}>
                    {user.first_name} - Owed: ${user.owed_share} - Paid: ${user.paid_share}
                  </li>
                ))}
              </ul>
              
              {parsedItems.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-lg font-semibold">Itemized Splits:</h4>
                  <ul>
                    {parsedItems.map((item:any, idx:any) => (
                      <li key={idx}>
                        <p><strong>{item.name}</strong> - ${item.price}</p>
                        <p>Split between: {item.members.join(', ')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )
  }
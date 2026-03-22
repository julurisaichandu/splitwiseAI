import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

interface ExpenseItem {
    name: string;
    price: number;
    members: string[];
}

interface ExpenseUser {
    first_name: string;
    owed_share: string;
    paid_share: string;
}

interface ExpenseData {
    description: string;
    cost: string;
    comment: string;
    group_name: string;
    users: ExpenseUser[];
}

interface ExpenseSummary {
    id: number;
    description: string;
    cost: string;
    date: string;
    group_name: string;
    payer: string;
    num_items: number;
}

interface ExpenseEditorProps {
    onLoadExpense?: (data: {
      items: ExpenseItem[],
      members: string[],
      paidUser: string,
      description: string,
      comment: string,
      expenseId: string,
      group_name: string,
    }) => void;
    groupId?: string;
    groupName?: string;
}

export default function ExpenseEditor({ onLoadExpense, groupId, groupName }: ExpenseEditorProps) {
    const { authFetch } = useAuth();
    const [mode, setMode] = useState<'browse' | 'manual'>('browse');

    // Browse mode state
    const [recentExpenses, setRecentExpenses] = useState<ExpenseSummary[]>([]);
    const [nextOffset, setNextOffset] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [listLoading, setListLoading] = useState<boolean>(false);
    const [listError, setListError] = useState<string>('');
    const [loadingExpenseId, setLoadingExpenseId] = useState<number | null>(null);

    // Manual mode state
    const [expenseId, setExpenseId] = useState<string>('');
    const [expenseData, setExpenseData] = useState<ExpenseData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [parsedItems, setParsedItems] = useState<ExpenseItem[]>([]);

    const fetchRecentExpenses = useCallback(async (reset: boolean = false) => {
        try {
            setListLoading(true);
            setListError('');
            const offset = reset ? 0 : nextOffset;
            let url = `${process.env.NEXT_PUBLIC_API_URL}/api/list-expenses?count=20&offset=${offset}`;
            if (groupId) {
                url += `&group_id=${groupId}`;
            }
            const response = await authFetch(url);
            if (!response.ok) throw new Error('Failed to fetch expenses');
            const data = await response.json();

            if (reset) {
                setRecentExpenses(data.expenses);
            } else {
                setRecentExpenses(prev => [...prev, ...data.expenses]);
            }
            setNextOffset(data.next_offset);
            setHasMore(data.has_more);
        } catch (err) {
            console.error(err);
            setListError('Failed to load recent expenses');
        } finally {
            setListLoading(false);
        }
    }, [authFetch, groupId, nextOffset]);

    // Fetch on mount and when group changes
    useEffect(() => {
        if (mode === 'browse') {
            setRecentExpenses([]);
            setNextOffset(0);
            setHasMore(true);
            fetchRecentExpenses(true);
        }
    }, [mode, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadExpenseById = async (id: number) => {
        try {
            setLoadingExpenseId(id);
            const response = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/get-expense?expense_id=${id}`
            );
            if (!response.ok) throw new Error('Failed to fetch expense');
            const data = await response.json();
            const expense: ExpenseData = data.expense;

            // Parse items
            let items: ExpenseItem[] = [];
            try {
                if (expense.comment) {
                    const parts = expense.comment.split('---ITEMDATA---');
                    if (parts.length > 1) {
                        items = JSON.parse(parts[1]);
                    }
                }
            } catch (parseError) {
                console.error('Failed to parse item data', parseError);
            }

            // Extract comment without ITEMDATA and EXPENSE_ID prefix
            let comment = "";
            try {
                if (expense.comment) {
                    const parts = expense.comment.split('---ITEMDATA---');
                    comment = (parts[0] || expense.comment);
                    comment = comment.replace(/^EXPENSE_ID:\d+\n?/, '').trim();
                }
            } catch (parseError) {
                console.error('Failed to parse comment', parseError);
            }

            if (onLoadExpense) {
                const members = expense.users.map((user: ExpenseUser) => user.first_name);
                const paidUser = expense.users.find((user: ExpenseUser) =>
                    parseFloat(user.paid_share) > 0
                )?.first_name || '';

                onLoadExpense({
                    items,
                    members,
                    paidUser,
                    description: expense.description,
                    comment,
                    expenseId: String(id),
                    group_name: expense.group_name,
                });
            }
        } catch (err) {
            console.error(err);
            setListError('Failed to load expense');
        } finally {
            setLoadingExpenseId(null);
        }
    };

    // Manual mode functions (kept from original)
    const fetchExpense = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/get-expense?expense_id=${expenseId}`
            );
            if (!response.ok) throw new Error('Failed to fetch expense');
            const data = await response.json();
            setExpenseData(data.expense);

            try {
                if (data.expense.comment) {
                    const parts = data.expense.comment.split('---ITEMDATA---');
                    if (parts.length > 1) {
                        setParsedItems(JSON.parse(parts[1]));
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

    const loadIntoForm = () => {
        if (!expenseData || !onLoadExpense) return;
        const members = expenseData.users.map((user: ExpenseUser) => user.first_name);
        const paidUser = expenseData.users.find((user: ExpenseUser) =>
            parseFloat(user.paid_share) > 0
        )?.first_name || '';

        let comment = "";
        try {
            if (expenseData.comment) {
                const parts = expenseData.comment.split('---ITEMDATA---');
                comment = parts.length > 1 ? parts[0] : expenseData.comment;
                comment = comment.replace(/^EXPENSE_ID:\d+\n?/, '').trim();
            }
        } catch (parseError) {
            console.error('Failed to parse item data', parseError);
        }

        onLoadExpense({
            items: parsedItems,
            members,
            paidUser,
            description: expenseData.description,
            comment,
            expenseId,
            group_name: expenseData.group_name,
        });
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-stone-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">Load Existing Expense</h2>

            {/* Tab switcher */}
            <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-1">
                <button
                    onClick={() => setMode('browse')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        mode === 'browse'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-stone-600 hover:text-stone-800'
                    }`}
                >
                    Browse Recent
                </button>
                <button
                    onClick={() => setMode('manual')}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        mode === 'manual'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-stone-600 hover:text-stone-800'
                    }`}
                >
                    Enter ID
                </button>
            </div>

            {mode === 'browse' && (
                <div>
                    {groupName && (
                        <p className="text-sm text-stone-500 mb-3">
                            Showing expenses from <span className="font-medium text-stone-700">{groupName}</span>
                        </p>
                    )}

                    {listError && <p className="text-red-500 text-sm mb-3">{listError}</p>}

                    {recentExpenses.length === 0 && !listLoading && !listError && (
                        <p className="text-stone-400 text-sm text-center py-6">No app-created expenses found.</p>
                    )}

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {recentExpenses.map((exp) => (
                            <button
                                key={exp.id}
                                onClick={() => loadExpenseById(exp.id)}
                                disabled={loadingExpenseId !== null}
                                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                    loadingExpenseId === exp.id
                                        ? 'bg-amber-50 border-amber-400'
                                        : 'bg-stone-50 border-stone-200 hover:border-amber-400 hover:bg-amber-50/50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-stone-800 truncate">
                                                {exp.description}
                                            </span>
                                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                {exp.num_items} items
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                                            <span>{formatDate(exp.date)}</span>
                                            <span>Paid by {exp.payer}</span>
                                            {!groupName && <span>{exp.group_name}</span>}
                                        </div>
                                    </div>
                                    <div className="text-right ml-3">
                                        <span className="font-semibold text-stone-800">${exp.cost}</span>
                                        {loadingExpenseId === exp.id && (
                                            <div className="text-xs text-amber-600 mt-0.5">Loading...</div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {listLoading && (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
                        </div>
                    )}

                    {hasMore && !listLoading && recentExpenses.length > 0 && (
                        <button
                            onClick={() => fetchRecentExpenses(false)}
                            className="w-full mt-3 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            Load More
                        </button>
                    )}
                </div>
            )}

            {mode === 'manual' && (
                <div>
                    <input
                        type="text"
                        value={expenseId}
                        onChange={(e) => setExpenseId(e.target.value)}
                        placeholder="Enter Expense ID"
                        className="border border-stone-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none p-2 w-full rounded-lg mb-3"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={fetchExpense}
                            className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                        >
                            Fetch Expense
                        </button>
                        {expenseData && onLoadExpense && (
                            <button
                                onClick={loadIntoForm}
                                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                            >
                                Load Into Form
                            </button>
                        )}
                    </div>

                    {loading && <p className="text-stone-500 mt-3">Loading...</p>}
                    {error && <p className="text-red-500 mt-3">{error}</p>}

                    {expenseData && (
                        <div className="mt-4 p-3 bg-stone-50 rounded-lg border border-stone-200">
                            <h3 className="font-semibold text-stone-800">Expense Details:</h3>
                            <p className="text-sm mt-1"><strong>Description:</strong> {expenseData.description.split('---ITEMDATA---')[0]?.trim()}</p>
                            <p className="text-sm"><strong>Total Cost:</strong> ${expenseData.cost}</p>

                            <h4 className="font-medium text-stone-700 mt-3 text-sm">Users:</h4>
                            <ul className="text-sm">
                                {expenseData.users.map((user: ExpenseUser, idx: number) => (
                                    <li key={idx}>
                                        {user.first_name} - Owed: ${user.owed_share} - Paid: ${user.paid_share}
                                    </li>
                                ))}
                            </ul>

                            {parsedItems.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="font-medium text-stone-700 text-sm">Itemized Splits:</h4>
                                    <ul className="text-sm">
                                        {parsedItems.map((item: ExpenseItem, idx: number) => (
                                            <li key={idx} className="mt-1">
                                                <strong>{item.name}</strong> - ${item.price}
                                                <span className="text-stone-500"> ({item.members.join(', ')})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

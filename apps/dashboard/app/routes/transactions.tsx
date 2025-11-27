import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function meta() {
  return [
    { title: 'Transactions - Dashboard' },
    { name: 'description', content: 'View your transaction history' },
  ];
}

interface TransactionHistoryItem {
  id: string;
  referenceNumber: string;
  type: string;
  amount: string;
  currency: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
  counterparty: {
    accountNumber: string | null;
    accountId: string | null;
  } | null;
}

interface TransactionHistoryResponse {
  data: TransactionHistoryItem[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
  summary: {
    currentBalance: string;
    availableBalance: string;
    pendingTransactions: number;
    totalHolds: string;
  };
}

const mockTransactions: TransactionHistoryItem[] = [
  {
    id: '1',
    referenceNumber: 'TXN-2025-001',
    type: 'TRANSFER_IN',
    amount: '50000',
    currency: 'USD',
    balanceAfter: '150000',
    description: 'Salary deposit',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    counterparty: {
      accountNumber: 'ACC-9876',
      accountId: '123e4567-e89b-12d3-a456-426614174001',
    },
  },
  {
    id: '2',
    referenceNumber: 'TXN-2025-002',
    type: 'TRANSFER_OUT',
    amount: '-15000',
    currency: 'USD',
    balanceAfter: '135000',
    description: 'Rent payment',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    counterparty: {
      accountNumber: 'ACC-5432',
      accountId: '123e4567-e89b-12d3-a456-426614174002',
    },
  },
  {
    id: '3',
    referenceNumber: 'TXN-2025-003',
    type: 'TRANSFER_OUT',
    amount: '-7500',
    currency: 'USD',
    balanceAfter: '127500',
    description: 'Grocery shopping',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    counterparty: {
      accountNumber: 'ACC-1234',
      accountId: '123e4567-e89b-12d3-a456-426614174003',
    },
  },
  {
    id: '4',
    referenceNumber: 'TXN-2025-004',
    type: 'TRANSFER_IN',
    amount: '25000',
    currency: 'USD',
    balanceAfter: '152500',
    description: 'Freelance payment',
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    counterparty: {
      accountNumber: 'ACC-7890',
      accountId: '123e4567-e89b-12d3-a456-426614174004',
    },
  },
  {
    id: '5',
    referenceNumber: 'TXN-2025-005',
    type: 'TRANSFER_OUT',
    amount: '-12000',
    currency: 'USD',
    balanceAfter: '140500',
    description: 'Utilities bill',
    createdAt: new Date(Date.now() - 432000000).toISOString(),
    counterparty: {
      accountNumber: 'ACC-3456',
      accountId: '123e4567-e89b-12d3-a456-426614174005',
    },
  },
];

const mockSummary = {
  currentBalance: '140500',
  availableBalance: '135000',
  pendingTransactions: 2,
  totalHolds: '5500',
};

export default function Transactions() {
  const [accountId, setAccountId] = useState('');
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>(mockTransactions);
  const [summary, setSummary] = useState<TransactionHistoryResponse['summary'] | null>(
    mockSummary,
  );
  const [pagination, setPagination] = useState<TransactionHistoryResponse['pagination'] | null>({
    nextCursor: null,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async (cursor?: string) => {
    if (!accountId) {
      setError('Please enter an account ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ accountId });
      if (cursor) {
        params.append('cursor', cursor);
      }

      const response = await fetch(
        `http://localhost:3000/api/v1/transactions/history?${params.toString()}`,
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message ?? 'Failed to fetch transactions');
      }

      const result = (await response.json()) as TransactionHistoryResponse;

      if (cursor) {
        setTransactions((prev) => [...prev, ...result.data]);
      } else {
        setTransactions(result.data);
      }

      setSummary(result.summary);
      setPagination(result.pagination);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (pagination?.nextCursor) {
      void fetchTransactions(pagination.nextCursor);
    }
  };

  const formatAmount = (amount: string, currency: string) => {
    const numAmount = parseFloat(amount) / 100;
    const sign = numAmount >= 0 ? '+' : '';
    return `${sign}${numAmount.toFixed(2)} ${currency}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Transaction History</CardTitle>
          <CardDescription>View all transactions for an account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-start">
            <div className="flex-1 space-y-2">
              <Label htmlFor="accountId">Account ID</Label>
              <Input
                id="accountId"
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the UUID of the account to view transactions
              </p>
            </div>
            <Button
              onClick={() => {
                void fetchTransactions();
              }}
              disabled={isLoading || !accountId}
              className="mt-6"
            >
              {isLoading ? 'Loading...' : 'Load Transactions'}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Account Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold">
                  ${(parseFloat(summary.currentBalance) / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">
                  ${(parseFloat(summary.availableBalance) / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Transactions</p>
                <p className="text-2xl font-bold">{summary.pendingTransactions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Holds</p>
                <p className="text-2xl font-bold">
                  ${(parseFloat(summary.totalHolds) / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {formatDate(transaction.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {transaction.referenceNumber}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700">
                        {transaction.type}
                      </span>
                    </TableCell>
                    <TableCell>{transaction.description ?? '-'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {transaction.counterparty?.accountNumber ?? '-'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        parseFloat(transaction.amount) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatAmount(transaction.amount, transaction.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${(parseFloat(transaction.balanceAfter) / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination?.hasMore && (
              <div className="mt-4 flex justify-center">
                <Button onClick={handleLoadMore} disabled={isLoading} variant="outline">
                  {isLoading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

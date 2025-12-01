import { useState } from 'react';

import type { Route } from './+types/home';

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

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'Dashboard - Fintech App' },
    { name: 'description', content: 'View your account dashboard and recent transactions' },
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

export default function Home() {
  const [accountId, setAccountId] = useState('');
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [summary, setSummary] = useState<TransactionHistoryResponse['summary'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!accountId) {
      setError('Please enter an account ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ accountId, limit: '10' });
      const response = await fetch(
        `http://localhost:3000/api/v1/transactions/history?${params.toString()}`,
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message ?? 'Failed to fetch transactions');
      }

      const result = (await response.json()) as TransactionHistoryResponse;
      setTransactions(result.data);
      setSummary(result.summary);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setTransactions([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
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
          <CardTitle className="text-2xl">Dashboard</CardTitle>
          <CardDescription>View your account summary and recent transactions</CardDescription>
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
                Enter the UUID of the account to view dashboard
              </p>
            </div>
            <Button
              onClick={() => {
                void fetchTransactions();
              }}
              disabled={isLoading || !accountId}
              className="mt-6"
            >
              {isLoading ? 'Loading...' : 'Load Dashboard'}
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
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>
              Showing last {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

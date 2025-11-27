import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function meta() {
  return [
    { title: 'Transfer Money - Dashboard' },
    { name: 'description', content: 'Transfer money between accounts' },
  ];
}

interface TransferFormData {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  currency: string;
  description: string;
}

export default function Transfer() {
  const [formData, setFormData] = useState<TransferFormData>({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    currency: 'USD',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    void (async () => {
      try {
        // Convert amount to string of cents (assuming currency is in dollars)
        const amountInCents = Math.round(parseFloat(formData.amount) * 100).toString();

        const response = await fetch('http://localhost:3000/api/v1/transactions/transfer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromAccountId: formData.fromAccountId,
            toAccountId: formData.toAccountId,
            amount: amountInCents,
            currency: formData.currency.toUpperCase(),
            description: formData.description || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          throw new Error(errorData.message ?? 'Transfer failed');
        }

        const result = (await response.json()) as { data: { id: string } };
        setSuccess(`Transfer successful! Transaction ID: ${result.data.id}`);

        // Reset form
        setFormData({
          fromAccountId: '',
          toAccountId: '',
          amount: '',
          currency: 'USD',
          description: '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Transfer Money</CardTitle>
          <CardDescription>Send money from one account to another securely</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fromAccountId">From Account ID</Label>
              <Input
                id="fromAccountId"
                name="fromAccountId"
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={formData.fromAccountId}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the UUID of the account to send money from
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="toAccountId">To Account ID</Label>
              <Input
                id="toAccountId"
                name="toAccountId"
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={formData.toAccountId}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the UUID of the recipient account
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">Enter amount in dollars</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  name="currency"
                  type="text"
                  placeholder="USD"
                  value={formData.currency}
                  onChange={handleInputChange}
                  maxLength={3}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">3-letter currency code</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                name="description"
                type="text"
                placeholder="Payment for services"
                value={formData.description}
                onChange={handleInputChange}
                maxLength={500}
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 rounded-lg bg-green-500/10 text-green-700 text-sm">{success}</div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Transfer Money'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

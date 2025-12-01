import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const transferSchema = z.object({
  fromAccountId: z.uuid({ message: 'Please enter a valid UUID' }),
  toAccountId: z.uuid({ message: 'Please enter a valid UUID' }),
  amount: z
    .string()
    .min(1, { message: 'Amount is required' })
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Amount must be greater than 0',
    }),
  currency: z.string().length(3, { message: 'Currency must be a 3-letter code' }).toUpperCase(),
  description: z
    .string()
    .max(500, { message: 'Description must be 500 characters or less' })
    .optional(),
});

type TransferFormData = z.infer<typeof transferSchema>;

interface TransferFormProps {
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
  apiEndpoint?: string;
}

export function TransferForm({
  onSuccess,
  onError,
  apiEndpoint = 'http://localhost:3000/transactions/transfer',
}: TransferFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      currency: 'USD',
      description: '',
    },
  });

  // Generate idempotency key when component mounts
  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  const onSubmit = async (data: TransferFormData) => {
    setError(null);
    setSuccess(null);

    try {
      // Add idempotency key to form data
      data.idempotencyKey = idempotencyKey;

      // Convert amount to string of cents (assuming currency is in dollars)
      const amountInCents = Math.round(parseFloat(data.amount) * 100).toString();

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAccountId: data.fromAccountId,
          toAccountId: data.toAccountId,
          amount: amountInCents,
          currency: data.currency.toUpperCase(),
          description: data.description ?? undefined,
          idempotencyKey,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        const errorMessage = errorData.message ?? 'Transfer failed';
        setError(errorMessage);
        onError?.(errorMessage);
        throw new Error(errorMessage);
      }

      const result = (await response.json()) as { transactionId: string; referenceNumber: string };
      const successMessage = `Transfer successful! Transaction ID: ${result.transactionId} | Reference: ${result.referenceNumber}`;
      setSuccess(successMessage);
      onSuccess?.(result.transactionId);

      // Reset form and generate new idempotency key for next transfer
      reset();
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="fromAccountId">From Account ID</Label>
        <Input
          id="fromAccountId"
          type="text"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          {...register('fromAccountId')}
          disabled={isSubmitting}
        />
        {errors.fromAccountId && (
          <p className="text-xs text-destructive">{errors.fromAccountId.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Enter the UUID of the account to send money from
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="toAccountId">To Account ID</Label>
        <Input
          id="toAccountId"
          type="text"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          {...register('toAccountId')}
          disabled={isSubmitting}
        />
        {errors.toAccountId && (
          <p className="text-xs text-destructive">{errors.toAccountId.message}</p>
        )}
        <p className="text-xs text-muted-foreground">Enter the UUID of the recipient account</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            {...register('amount')}
            disabled={isSubmitting}
          />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          <p className="text-xs text-muted-foreground">Enter amount in dollars</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            type="text"
            placeholder="USD"
            maxLength={3}
            {...register('currency')}
            disabled={isSubmitting}
          />
          {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
          <p className="text-xs text-muted-foreground">3-letter currency code</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Input
          id="description"
          type="text"
          placeholder="Payment for services"
          maxLength={500}
          {...register('description')}
          disabled={isSubmitting}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-green-500/10 text-green-700 text-sm">{success}</div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Processing...' : 'Transfer Money'}
      </Button>
    </form>
  );
}

import { TransferForm } from '@/components/TransferForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function meta() {
  return [
    { title: 'Transfer Money - Dashboard' },
    { name: 'description', content: 'Transfer money between accounts' },
  ];
}

export default function Transfer() {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Transfer Money</CardTitle>
          <CardDescription>Send money from one account to another securely</CardDescription>
        </CardHeader>
        <CardContent>
          <TransferForm />
        </CardContent>
      </Card>
    </div>
  );
}

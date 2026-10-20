import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, PageHeader } from '@/components/ui';
import { PropertyForm } from '@/components/landlord/property-form';
import { requireLandlord } from '@/lib/landlord/server';

export const metadata: Metadata = { title: 'Add a property | Homed' };

export default async function NewPropertyPage() {
  const { landlord } = await requireLandlord();
  if (!landlord) redirect('/landlord');

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Landlords"
        title="Add a property"
        subtitle="Add floor plans after saving."
        actions={
          <Button href="/landlord" variant="ghost">
            Back to dashboard
          </Button>
        }
      />
      <PropertyForm />
    </div>
  );
}

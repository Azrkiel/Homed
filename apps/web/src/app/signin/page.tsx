import type { Metadata } from 'next';
import { Button, Card, CardBody, PageHeader } from '@/components/ui';
import { getAuth } from '@/lib/repo';
import { effectiveRole, getCurrentUser } from '@/lib/session';
import { SignInForm } from './sign-in-form';
import { safeNext } from './next-path';

export const metadata: Metadata = { title: 'Sign in | Homed' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = safeNext(rawNext);
  const user = await getCurrentUser();

  if (user) {
    const home = effectiveRole(user) === 'landlord' ? '/landlord' : next;
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title="Sign in" />
        <Card>
          <CardBody className="grid gap-4">
            <p className="text-ink">
              You&apos;re signed in as <strong>{user.name}</strong>{' '}
              <span className="text-ink-2">({user.email})</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button href={home}>Continue</Button>
              <form action="/signout" method="post">
                <Button type="submit" variant="secondary">
                  Sign out
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const mode = getAuth().mode;
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Sign in" subtitle="Save places, set your classes and get rankings made for you." />
      <Card>
        <CardBody>
          <SignInForm mode={mode} next={next} />
        </CardBody>
      </Card>
    </div>
  );
}

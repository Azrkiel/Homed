import { Button, EmptyState } from '@/components/ui';

/** Empty queue: nothing left to swipe. Copy differs when the catalog is empty or the ?ids list is used up. */
export function MatchEmpty({ catalogEmpty = false, restricted = false }: { catalogEmpty?: boolean; restricted?: boolean }) {
  if (catalogEmpty) {
    return (
      <EmptyState
        title="No listings yet"
        body="The catalog is empty right now, so there is nothing to match. Check back soon."
        action={<Button href="/search" variant="secondary">Back to search</Button>}
      />
    );
  }
  if (restricted) {
    return (
      <EmptyState
        title="Nothing left in this list"
        body="You have already swiped on these places, or they are not in your results."
        action={
          <>
            <Button href="/saved" variant="secondary">See saved places</Button>
            <Button href="/match" variant="ghost">Back to all matches</Button>
          </>
        }
      />
    );
  }
  return (
    <EmptyState
      title="You've seen every match"
      body="New listings show up here as they are added. Want more to look at? Widen your search or check your classes so walk times stay accurate."
      action={
        <>
          <Button href="/saved" variant="secondary">See saved places</Button>
          <Button href="/search" variant="secondary">Adjust filters</Button>
          <Button href="/classes" variant="ghost">Edit classes</Button>
        </>
      }
    />
  );
}

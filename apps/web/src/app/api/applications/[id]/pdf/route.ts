// GET /api/applications/<id>/pdf: the application packet. Leader, the property's landlord user and admins only.
// Everyone else, signed out included, gets a bare 404 (never 401/403) so ids cannot be probed.
import type { ApplicantProfile } from '@homed/core';
import { canAccessApplicationPacket } from '@/lib/landlord/access';
import { buildApplicationPacket, packetMembers } from '@/lib/landlord/application-pdf';
import { getRepo, today } from '@/lib/repo';
import { effectiveRole, getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NOT_FOUND = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NOT_FOUND();

  const repo = getRepo();
  const application = await repo.getApplication(id);
  if (!application) return NOT_FOUND();
  const listing = await repo.getListing(application.floorPlanId);
  if (!listing) return NOT_FOUND();
  const landlord = listing.property.landlordId ? await repo.getLandlord(listing.property.landlordId) : null;

  const role = effectiveRole(user);
  const allowed = canAccessApplicationPacket({
    userId: user.id,
    role,
    leaderId: application.userId,
    propertyLandlordUserId: landlord?.userId,
  });
  if (!allowed) return NOT_FOUND();
  // A draft is not sent yet. Its owner may still download it; the landlord may not.
  if (application.status === 'draft' && role !== 'admin' && user.id !== application.userId) return NOT_FOUND();

  const landlordView = role === 'admin' || (landlord?.userId !== undefined && landlord.userId === user.id);
  const viewer = { userId: user.id, landlordView };

  const members = await repo.listApplicationMembers(application.id);
  const profiles = new Map<string, ApplicantProfile>();
  for (const m of members) {
    if (!m.userId || profiles.has(m.userId)) continue;
    const profile = await repo.getApplicantProfile(m.userId);
    if (profile) profiles.set(m.userId, profile);
  }

  const bytes = await buildApplicationPacket({
    generatedOn: today(),
    applicationId: application.id,
    status: application.status,
    batchRank: application.batchRank,
    submittedAt: application.submittedAt,
    property: { name: listing.property.name, address: listing.property.address },
    floorPlan: {
      name: listing.floorPlan.name,
      rentAmount: listing.floorPlan.rentAmount,
      rentBasis: listing.floorPlan.rentBasis,
      leaseStart: listing.floorPlan.leaseStart,
      leaseEnd: listing.floorPlan.leaseEnd,
    },
    fees: application.fees,
    members: packetMembers(members, profiles, viewer),
  });

  return new Response(bytes as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="application-${application.id}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

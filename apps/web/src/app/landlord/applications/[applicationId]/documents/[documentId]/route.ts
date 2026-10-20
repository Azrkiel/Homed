// GET /landlord/applications/<applicationId>/documents/<documentId>: an applicant's upload, as an attachment.
// Same access as the detail page. Any failure is a bare 404 so ids cannot be probed.
import { getRepo } from '@/lib/repo';
import { documentOfApplication, landlordApplicationFor } from '@/lib/landlord/application-access';
import { attachmentDisposition, safeContentType } from '@/lib/landlord/application-view';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NOT_FOUND = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ applicationId: string; documentId: string }> },
) {
  const { applicationId, documentId } = await params;
  const user = await getCurrentUser();
  if (!user) return NOT_FOUND();

  const record = await landlordApplicationFor(user, applicationId);
  if (!record) return NOT_FOUND();

  const doc = await documentOfApplication(documentId, record.members);
  if (!doc) return NOT_FOUND();
  const bytes = await getRepo().getDocumentBytes(doc.id);
  if (!bytes) return NOT_FOUND();

  return new Response(bytes as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': safeContentType(doc.mime),
      'Content-Disposition': attachmentDisposition(doc.filename),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

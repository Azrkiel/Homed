import type { ApplicationRepo } from '../repository';

function stub(name: string): () => never {
  return () => {
    throw new Error(`not implemented: ${name}`);
  };
}

/** Methods owned by later tasks. Remove entries here as they are implemented. */
export function stubs(): ApplicationRepo {
  return {
    getApplicantProfile: stub('getApplicantProfile'),
    saveApplicantProfile: stub('saveApplicantProfile'),
    createApplicationBatch: stub('createApplicationBatch'),
    getApplication: stub('getApplication'),
    listBatch: stub('listBatch'),
    listApplicationsForUser: stub('listApplicationsForUser'),
    listApplicationsForLandlord: stub('listApplicationsForLandlord'),
    updateApplicationStatus: stub('updateApplicationStatus'),
    listApplicationMembers: stub('listApplicationMembers'),
    getMemberByInviteToken: stub('getMemberByInviteToken'),
    updateApplicationMember: stub('updateApplicationMember'),
    putDocument: stub('putDocument'),
    listDocuments: stub('listDocuments'),
    getDocumentBytes: stub('getDocumentBytes'),
    purgeExpiredDocuments: stub('purgeExpiredDocuments'),
  };
}

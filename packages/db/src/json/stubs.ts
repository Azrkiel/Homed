import type { ApplicationRepo, LandlordRepo, ReviewRepo } from '../repository';

function stub(name: string): () => never {
  return () => {
    throw new Error(`not implemented: ${name}`);
  };
}

/** Methods owned by later tasks. Remove entries here as they are implemented. */
export function stubs(): ReviewRepo & ApplicationRepo & LandlordRepo {
  return {
    listReviews: stub('listReviews'),
    createReview: stub('createReview'),
    listPendingReviews: stub('listPendingReviews'),
    moderateReview: stub('moderateReview'),
    replyToReview: stub('replyToReview'),
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
    getLandlord: stub('getLandlord'),
    getLandlordByUser: stub('getLandlordByUser'),
    listLandlords: stub('listLandlords'),
    createLandlord: stub('createLandlord'),
    upsertProperty: stub('upsertProperty'),
    upsertFloorPlan: stub('upsertFloorPlan'),
    deleteFloorPlan: stub('deleteFloorPlan'),
    upsertPhoto: stub('upsertPhoto'),
    deletePhoto: stub('deletePhoto'),
    upsertAccessibility: stub('upsertAccessibility'),
    confirmAvailability: stub('confirmAvailability'),
  };
}

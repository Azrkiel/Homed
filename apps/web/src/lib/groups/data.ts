// Server-side loaders for the group pages. Every loader checks membership first: non-members get a 404.
import { notFound } from 'next/navigation';
import {
  commuteFor,
  groupMatches,
  matchQueue,
  weeklyMeetings,
  type Group,
  type GroupMember,
  type RankedListing,
  type ShortlistItem,
  type User,
  type WeeklyMeeting,
} from '@homed/core';
import { getRepo, today } from '../repo';
import { buildWalkLookup, rankForUser, type GroupContext } from '../ranking';
import { toMatchCard, type MatchCard } from '../search/match';
import { buildShortlistRows, memberViews, type MemberView, type ShortlistRow } from './view';
import { defaultGroupSize, groupContextFor, groupSizeNote } from './context';

interface GroupBase {
  group: Group;
  members: GroupMember[];
  /** Member id -> display name. */
  names: Map<string, string>;
  leader: User;
  /** Each member's weekly meetings, in `members` order. */
  meetingsByMember: WeeklyMeeting[][];
  groupContext: GroupContext;
}

/**
 * Loads the group and the group ranking context. notFound() when the group does not exist or the
 * viewer is not a member, so a non-member cannot tell a missing group from a private one.
 */
async function loadGroupBase(groupId: string, viewer: User): Promise<GroupBase> {
  const repo = getRepo();
  const group = await repo.getGroup(groupId);
  if (!group) notFound();
  const members = await repo.listMembers(groupId);
  if (!members.some((m) => m.userId === viewer.id)) notFound();

  const users = await Promise.all(members.map((m) => repo.getUser(m.userId)));
  if (users.some((u) => u === null)) notFound();
  const memberUsers = users as User[];

  const leaderIndex = members.findIndex((m) => m.role === 'leader');
  const leader = memberUsers[leaderIndex === -1 ? 0 : leaderIndex];
  if (!leader) notFound();

  const names = new Map(memberUsers.map((u) => [u.id, u.name]));
  const majors = await repo.listMajors();
  const schedules = await Promise.all(members.map((m) => repo.getSchedule(m.userId)));
  const meetingsByMember = schedules.map((s) => weeklyMeetings(s, majors));

  return {
    group,
    members,
    names,
    leader,
    meetingsByMember,
    groupContext: groupContextFor(leader, members, meetingsByMember),
  };
}

/** Group page: members, shortlist rows with votes and merged commutes, and group matches. */
export async function loadGroupData(groupId: string, viewer: User): Promise<{
  group: Group;
  members: GroupMember[];
  views: MemberView[];
  names: Map<string, string>;
  leader: User;
  rows: ShortlistRow[];
  listings: Map<string, RankedListing>;
  matches: string[];
  viewerIsLeader: boolean;
}> {
  const base = await loadGroupBase(groupId, viewer);
  const repo = getRepo();
  const { members, leader, meetingsByMember, groupContext, names } = base;

  const ranked = await rankForUser(leader, { groupContext });
  const byFloorPlan = new Map(ranked.map((r) => [r.listing.floorPlan.id, r]));
  const walk = buildWalkLookup(await repo.listWalkTimes());

  const [shortlist, votes, swipes] = await Promise.all([
    repo.listShortlist(groupId),
    repo.listVotes(groupId),
    repo.listSwipes({ groupId }),
  ]);

  const listings = new Map<string, RankedListing>();
  for (const item of shortlist) {
    const r = byFloorPlan.get(item.floorPlanId);
    if (r) listings.set(item.floorPlanId, r);
  }

  const rows = buildShortlistRows({
    shortlist,
    votes,
    members,
    viewerId: viewer.id,
    costPerPerson: (floorPlanId) => byFloorPlan.get(floorPlanId)?.score.cost.totalMonthly ?? null,
    commutesFor: (floorPlanId) => {
      const r = byFloorPlan.get(floorPlanId);
      if (!r) return [];
      const propertyId = r.listing.property.id;
      return members.map((m, i) => ({
        userId: m.userId,
        commute: commuteFor(propertyId, meetingsByMember[i] ?? [], leader.extras, walk),
      }));
    },
  });

  return {
    group: base.group,
    members,
    views: memberViews(members, names, viewer.id),
    names,
    leader,
    rows,
    listings,
    matches: groupMatches(swipes, groupId, members.map((m) => m.userId)),
    viewerIsLeader: members.some((m) => m.userId === viewer.id && m.role === 'leader'),
  };
}

/** Browse page: group-ranked listings filtered to the group size. */
export async function loadGroupBrowse(groupId: string, viewer: User): Promise<{
  group: Group;
  memberCount: number;
  ranked: RankedListing[];
  note: string;
  shortlisted: Set<string>;
}> {
  const base = await loadGroupBase(groupId, viewer);
  const memberCount = base.members.length;
  const ranked = await rankForUser(base.leader, {
    groupContext: base.groupContext,
    filters: { groupSize: defaultGroupSize(memberCount) },
  });
  const shortlist = await getRepo().listShortlist(groupId);
  return {
    group: base.group,
    memberCount,
    ranked,
    note: groupSizeNote(memberCount),
    shortlisted: new Set(shortlist.map((item: ShortlistItem) => item.floorPlanId)),
  };
}

/**
 * Group Match deck: listings the viewer has not swiped in this group yet, plus listings every member
 * swiped right on. Uses the same group-size filter as browse.
 */
export async function loadGroupMatch(groupId: string, viewer: User): Promise<{
  group: Group;
  memberCount: number;
  cards: MatchCard[];
  matches: MatchCard[];
}> {
  const base = await loadGroupBase(groupId, viewer);
  const memberCount = base.members.length;
  const ranked = await rankForUser(base.leader, {
    groupContext: base.groupContext,
    filters: { groupSize: defaultGroupSize(memberCount) },
  });
  const swipes = (await getRepo().listSwipes({ groupId })).filter((s) => s.groupId === groupId);
  const isoToday = today();

  const queue = matchQueue(ranked, swipes, viewer.id, groupId);
  const byFloorPlan = new Map(ranked.map((r) => [r.listing.floorPlan.id, r]));
  const matches: MatchCard[] = [];
  for (const floorPlanId of groupMatches(swipes, groupId, base.members.map((m) => m.userId))) {
    const r = byFloorPlan.get(floorPlanId);
    if (r) matches.push(toMatchCard(r, isoToday));
  }

  return {
    group: base.group,
    memberCount,
    cards: queue.map((r) => toMatchCard(r, isoToday)),
    matches,
  };
}

/** Groups the user belongs to, with member counts. */
export async function loadMyGroups(user: User): Promise<Array<{ group: Group; memberCount: number }>> {
  const repo = getRepo();
  const groups = await repo.listGroupsForUser(user.id);
  const counts = await Promise.all(groups.map((g) => repo.listMembers(g.id)));
  return groups.map((group, i) => ({ group, memberCount: counts[i]?.length ?? 0 }));
}

/**
 * Join page preview for an invite code. Null when the code is unknown. `userId` is the signed-in
 * viewer, or null when signed out (then alreadyMember is false).
 */
export async function loadJoinPreview(code: string, userId: string | null): Promise<{
  groupId: string;
  name: string;
  memberCount: number;
  leaderName: string;
  alreadyMember: boolean;
} | null> {
  const repo = getRepo();
  const group = await repo.getGroupByInviteCode(code);
  if (!group) return null;
  const members = await repo.listMembers(group.id);
  const leaderMember = members.find((m) => m.role === 'leader') ?? members[0];
  const leader = leaderMember ? await repo.getUser(leaderMember.userId) : null;
  return {
    groupId: group.id,
    name: group.name,
    memberCount: members.length,
    leaderName: leader?.name ?? 'A group member',
    alreadyMember: userId !== null && members.some((m) => m.userId === userId),
  };
}

import { supabaseClient } from '../lib/supabase';

// The signed-in user's "following" list is loaded once and shared by every
// post in the feed (instead of one query + realtime channel per post), then
// kept in sync optimistically as the user follows/unfollows.
let cache: { userId: string; ids: Set<string> } | null = null;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export const subscribeToFollowing = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getCachedFollowing = (userId: string | null | undefined, targetId: string | null | undefined) => {
  const ready = !!userId && cache?.userId === userId;
  return {
    ready,
    isFollowing: ready && !!targetId && cache!.ids.has(targetId),
  };
};

export const loadFollowing = async (userId: string) => {
  if (cache?.userId === userId) return;

  if (!loadPromise) {
    loadPromise = (async () => {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('following')
        .eq('id', userId)
        .single();

      if (error) throw error;
      cache = { userId, ids: new Set<string>(data.following || []) };
    })().finally(() => {
      loadPromise = null;
    });
  }

  await loadPromise;
  notify();
};

// followers/following live on profiles; the target user's row is read through
// the public view (the only columns read cross-user), then both rows are
// updated together.
const updateFollowLists = async (
  followerId: string,
  followingId: string,
  mode: 'follow' | 'unfollow',
) => {
  const [currentUserResult, targetUserResult] = await Promise.all([
    supabaseClient.from('profiles').select('following').eq('id', followerId).single(),
    supabaseClient.from('profiles_public').select('followers').eq('id', followingId).single(),
  ]);

  if (currentUserResult.error) throw currentUserResult.error;
  if (targetUserResult.error) throw targetUserResult.error;

  const currentFollowing: string[] = currentUserResult.data.following || [];
  const targetFollowers: string[] = targetUserResult.data.followers || [];

  const newFollowing = mode === 'follow'
    ? Array.from(new Set([...currentFollowing, followingId]))
    : currentFollowing.filter((id) => id !== followingId);
  const newFollowers = mode === 'follow'
    ? Array.from(new Set([...targetFollowers, followerId]))
    : targetFollowers.filter((id) => id !== followerId);

  const now = new Date().toISOString();
  const [updateCurrentResult, updateTargetResult] = await Promise.all([
    supabaseClient.from('profiles').update({ following: newFollowing, updated_at: now }).eq('id', followerId),
    supabaseClient.from('profiles').update({ followers: newFollowers, updated_at: now }).eq('id', followingId),
  ]);

  if (updateCurrentResult.error) throw updateCurrentResult.error;
  if (updateTargetResult.error) throw updateTargetResult.error;
};

const setFollowing = async (followerId: string, followingId: string, mode: 'follow' | 'unfollow') => {
  const previouslyFollowing = cache?.userId === followerId && cache.ids.has(followingId);

  // Optimistic: the UI flips immediately, rolled back if the write fails.
  if (cache?.userId === followerId) {
    if (mode === 'follow') cache.ids.add(followingId);
    else cache.ids.delete(followingId);
    notify();
  }

  try {
    await updateFollowLists(followerId, followingId, mode);
  } catch (error) {
    if (cache?.userId === followerId) {
      if (previouslyFollowing) cache.ids.add(followingId);
      else cache.ids.delete(followingId);
      notify();
    }
    throw error;
  }
};

export const followUser = (followerId: string, followingId: string) =>
  setFollowing(followerId, followingId, 'follow');

export const unfollowUser = (followerId: string, followingId: string) =>
  setFollowing(followerId, followingId, 'unfollow');

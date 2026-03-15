export type BrowseFilterKey = "all" | "same-day" | "affectionate";
export type ScreenActionType = "view" | "favorite";

export type ScreenAction = {
  label: string;
  type: ScreenActionType;
};

export type ScreenChip<TKey extends string = string> = {
  key: TKey;
  label: string;
  active: boolean;
};

export type HomePetCardData = {
  slug: string;
  imageUrl: string;
  title: string;
  meta: string;
  tag: string;
  favorited: boolean;
  action?: ScreenAction;
};

export type BrowsePetCardData = {
  slug: string;
  imageUrl: string;
  title: string;
  meta: string;
  tag: string;
  favorited: boolean;
  action?: ScreenAction;
};

export type HeroCardData = {
  petSlug: string;
  title: string;
  tag: string;
  meta?: string;
  actionLabel: string;
  imageUrl?: string;
};

export type HomeScreenData = {
  greetingTitle: string;
  greetingSubtitle: string;
  notificationCount: number;
  hero: HeroCardData;
  categories: ScreenChip[];
  weeklyPicks: HomePetCardData[];
};

export type BrowseScreenData = {
  title: string;
  totalAvailableCount: number;
  searchPlaceholder: string;
  filters: ScreenChip<BrowseFilterKey>[];
  featuredPet: HeroCardData;
  results: BrowsePetCardData[];
};

export type DetailScreenData = {
  pet: {
    slug: string;
    name: string;
    meta: string;
    imageUrl: string;
    statusBadge: string;
    scorePercent: number;
    traits: string[];
    description: string;
    adoptionRequirementLabel: string;
    healthLabel: string;
    ownerName: string;
    ownerDescription: string;
    ownerAvatarUrl: string;
    favorited: boolean;
    applicationSubmitted: boolean;
  };
};

export type ProfileScreenData = {
  profile: {
    id: string;
    name: string;
    roleTitle: string;
    description: string;
    avatarUrl: string;
    completionPercent: number;
    notificationsCount: number;
    favoritesCount: number;
    activeApplicationsCount: number;
    recentStatusTitle: string;
    recentStatusBody: string;
    services: string[];
  };
};

export type ToggleFavoriteResponse = {
  petSlug: string;
  favorited: boolean;
  favoritesCount: number;
};

export type SubmitApplicationResponse = {
  petSlug: string;
  submitted: boolean;
  activeApplicationsCount: number;
  recentStatusBody: string;
};

type ApiErrorPayload = {
  error?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw new Error(payload?.error ?? `请求失败：${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchHomeScreen() {
  return requestJson<HomeScreenData>("/api/home");
}

export function fetchBrowseScreen(search: string, filter: BrowseFilterKey) {
  const query = new URLSearchParams();

  if (search.trim()) {
    query.set("search", search.trim());
  }

  query.set("filter", filter);

  return requestJson<BrowseScreenData>(`/api/browse?${query.toString()}`);
}

export function fetchDetailScreen(petSlug: string) {
  return requestJson<DetailScreenData>(`/api/pets/${petSlug}`);
}

export function fetchProfileScreen() {
  return requestJson<ProfileScreenData>("/api/profile");
}

export function toggleFavorite(profileId: string, petSlug: string) {
  return requestJson<ToggleFavoriteResponse>(`/api/pets/${petSlug}/favorite`, {
    method: "POST",
    body: JSON.stringify({ profileId }),
  });
}

export function submitApplication(profileId: string, petSlug: string) {
  return requestJson<SubmitApplicationResponse>("/api/applications", {
    method: "POST",
    body: JSON.stringify({ profileId, petSlug }),
  });
}

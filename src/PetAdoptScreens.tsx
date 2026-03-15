import { startTransition, useDeferredValue, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  House,
  MessageCircle,
  Search,
  SignalHigh,
  User,
  Wifi,
} from "lucide-react";
import homeHero from "../images/generated-1773558239636.png";
import {
  fetchBrowseScreen,
  fetchDetailScreen,
  fetchHomeScreen,
  fetchProfileScreen,
  submitApplication,
  toggleFavorite,
  type BrowseFilterKey,
  type BrowsePetCardData,
  type BrowseScreenData,
  type DetailScreenData,
  type HomePetCardData,
  type HomeScreenData,
  type ProfileScreenData,
} from "./api";

type TabKey = "home" | "browse" | "profile";
type AppScreen = TabKey | "detail";
type NavTone = "warm" | "neutral";
type ActionTone = "accent" | "accentSoft" | "gold";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const DEFAULT_DETAIL_PET_SLUG = "nai-tang";

const navItems: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: "home", label: "首页", icon: House },
  { key: "browse", label: "发现", icon: Compass },
  { key: "profile", label: "我的", icon: User },
];

function createAsyncState<T>(): AsyncState<T> {
  return {
    data: null,
    loading: true,
    error: null,
  };
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function PetAdoptApp() {
  const [homeState, setHomeState] = useState<AsyncState<HomeScreenData>>(createAsyncState<HomeScreenData>());
  const [browseState, setBrowseState] = useState<AsyncState<BrowseScreenData>>(createAsyncState<BrowseScreenData>());
  const [detailState, setDetailState] = useState<AsyncState<DetailScreenData>>(createAsyncState<DetailScreenData>());
  const [profileState, setProfileState] = useState<AsyncState<ProfileScreenData>>(createAsyncState<ProfileScreenData>());
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [detailReturnTab, setDetailReturnTab] = useState<TabKey>("home");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPetSlug, setSelectedPetSlug] = useState(DEFAULT_DETAIL_PET_SLUG);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBrowseFilter, setActiveBrowseFilter] = useState<BrowseFilterKey>("all");
  const deferredSearch = useDeferredValue(searchQuery);
  const [favoriteBusySlug, setFavoriteBusySlug] = useState<string | null>(null);
  const [applicationSubmitting, setApplicationSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      setHomeState((current) => ({ ...current, loading: true, error: null }));
      setProfileState((current) => ({ ...current, loading: true, error: null }));
    });

    Promise.allSettled([fetchHomeScreen(), fetchProfileScreen()]).then((results) => {
      if (cancelled) {
        return;
      }

      const [homeResult, profileResult] = results;

      startTransition(() => {
        setHomeState(
          homeResult.status === "fulfilled"
            ? { data: homeResult.value, loading: false, error: null }
            : { data: null, loading: false, error: getErrorMessage(homeResult.reason, "首页加载失败") },
        );
        setProfileState(
          profileResult.status === "fulfilled"
            ? { data: profileResult.value, loading: false, error: null }
            : {
                data: null,
                loading: false,
                error: getErrorMessage(profileResult.reason, "个人中心加载失败"),
              },
        );
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      setBrowseState((current) => ({ ...current, loading: true, error: null }));
    });

    fetchBrowseScreen(deferredSearch, activeBrowseFilter)
      .then((data) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setBrowseState({ data, loading: false, error: null });
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setBrowseState((current) => ({
            data: current.data,
            loading: false,
            error: getErrorMessage(error, "发现页加载失败"),
          }));
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeBrowseFilter, deferredSearch]);

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      setDetailState((current) => ({ ...current, loading: true, error: null }));
    });

    fetchDetailScreen(selectedPetSlug)
      .then((data) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setDetailState({ data, loading: false, error: null });
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setDetailState((current) => ({
            data: current.data,
            loading: false,
            error: getErrorMessage(error, "详情页加载失败"),
          }));
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPetSlug]);

  async function syncAllScreens(detailSlug = selectedPetSlug) {
    const [homeResult, browseResult, detailResult, profileResult] = await Promise.allSettled([
      fetchHomeScreen(),
      fetchBrowseScreen(deferredSearch, activeBrowseFilter),
      fetchDetailScreen(detailSlug),
      fetchProfileScreen(),
    ]);

    startTransition(() => {
      if (homeResult.status === "fulfilled") {
        setHomeState({ data: homeResult.value, loading: false, error: null });
      }

      if (browseResult.status === "fulfilled") {
        setBrowseState({ data: browseResult.value, loading: false, error: null });
      }

      if (detailResult.status === "fulfilled") {
        setDetailState({ data: detailResult.value, loading: false, error: null });
      }

      if (profileResult.status === "fulfilled") {
        setProfileState({ data: profileResult.value, loading: false, error: null });
      }
    });
  }

  async function handleToggleFavorite(petSlug: string) {
    if (!profileState.data) {
      return;
    }

    setActionError(null);
    setFavoriteBusySlug(petSlug);

    try {
      await toggleFavorite(profileState.data.profile.id, petSlug);
      await syncAllScreens();
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "收藏状态更新失败"));
    } finally {
      setFavoriteBusySlug(null);
    }
  }

  async function handleSubmitApplication() {
    if (!profileState.data || !detailState.data) {
      return;
    }

    setActionError(null);
    setApplicationSubmitting(true);

    try {
      await submitApplication(profileState.data.profile.id, detailState.data.pet.slug);
      await syncAllScreens(detailState.data.pet.slug);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "领养申请提交失败"));
    } finally {
      setApplicationSubmitting(false);
    }
  }

  function handleTabChange(tab: TabKey) {
    setActionError(null);
    setIsDetailOpen(false);
    setActiveTab(tab);
  }

  function openPetDetail(petSlug: string, returnTab: TabKey = activeTab) {
    setActionError(null);
    setSelectedPetSlug(petSlug);
    setDetailReturnTab(returnTab);
    setIsDetailOpen(true);
  }

  function handleDetailBack() {
    setActionError(null);
    setIsDetailOpen(false);
    setActiveTab(detailReturnTab);
  }

  const activeScreen: AppScreen = isDetailOpen ? "detail" : activeTab;
  let currentScreen: ReactNode;

  switch (activeScreen) {
    case "home":
      currentScreen = homeState.data ? (
        <HomeScreen
          data={homeState.data}
          favoriteBusySlug={favoriteBusySlug}
          onNavigate={handleTabChange}
          onSelectPet={(petSlug) => openPetDetail(petSlug, "home")}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : (
        <PhonePlaceholder
          tone="warm"
          title={homeState.loading ? "正在同步首页数据" : "首页暂时不可用"}
          description={homeState.error ?? "正在从 Supabase 拉取首页推荐与分类。"}
          navActive="home"
          onNavigate={handleTabChange}
        />
      );
      break;
    case "browse":
      currentScreen = browseState.data ? (
        <BrowseScreen
          data={browseState.data}
          favoriteBusySlug={favoriteBusySlug}
          isLoading={browseState.loading}
          onNavigate={handleTabChange}
          searchQuery={searchQuery}
          onFilterChange={setActiveBrowseFilter}
          onSearchChange={setSearchQuery}
          onSelectPet={(petSlug) => openPetDetail(petSlug, "browse")}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : (
        <PhonePlaceholder
          tone="warm"
          title={browseState.loading ? "正在同步发现页" : "发现页暂时不可用"}
          description={browseState.error ?? "正在根据搜索词和筛选条件读取宠物列表。"}
          navActive="browse"
          onNavigate={handleTabChange}
        />
      );
      break;
    case "profile":
      currentScreen = profileState.data ? (
        <ProfileScreen data={profileState.data} onNavigate={handleTabChange} />
      ) : (
        <PhonePlaceholder
          tone="neutral"
          title={profileState.loading ? "正在同步个人中心" : "个人中心暂时不可用"}
          description={profileState.error ?? "正在读取收藏计数、申请进度和服务菜单。"}
          navActive="profile"
          onNavigate={handleTabChange}
        />
      );
      break;
    case "detail":
      currentScreen = detailState.data ? (
        <DetailScreen
          data={detailState.data}
          applicationSubmitting={applicationSubmitting}
          favoriteBusySlug={favoriteBusySlug}
          onApply={handleSubmitApplication}
          onBack={handleDetailBack}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : (
        <PhonePlaceholder
          tone="neutral"
          title={detailState.loading ? "正在同步宠物详情" : "详情页暂时不可用"}
          description={detailState.error ?? "点击首页或发现页里的宠物卡片后，这里会展示实时详情。"}
          actionLabel="返回上一页"
          onAction={handleDetailBack}
        />
      );
      break;
  }

  return (
    <main className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.75),rgba(255,255,255,0)_72%)]" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(217,122,92,0.14),rgba(217,122,92,0)_70%)] blur-2xl" />
      <div className="relative flex w-full max-w-[430px] flex-col items-center">
        {actionError ? (
          <div className="mb-4 w-full rounded-[22px] bg-white/82 px-4 py-3 shadow-[0_16px_36px_rgba(115,74,46,0.14)] backdrop-blur-sm">
            <p className="font-body text-[13px] font-[600] text-[var(--signal-warm)]">{actionError}</p>
          </div>
        ) : null}
        {currentScreen}
      </div>
    </main>
  );
}

function HomeScreen({
  data,
  favoriteBusySlug,
  onNavigate,
  onSelectPet,
  onToggleFavorite,
}: {
  data: HomeScreenData;
  favoriteBusySlug: string | null;
  onNavigate: (tab: TabKey) => void;
  onSelectPet: (petSlug: string) => void;
  onToggleFavorite: (petSlug: string) => void;
}) {
  return (
    <PhoneFrame tone="warm">
      <StatusBar tone="warm" />
      <div className="flex flex-1 flex-col gap-[20px] px-[24px] pb-[24px] pt-[6px]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[28px] font-[800] leading-[1.05] tracking-[-0.04em] text-[var(--ink-brown)]">
              {data.greetingTitle}
            </h1>
            <p className="font-body text-[13px] text-[var(--muted-brown)]">{data.greetingSubtitle}</p>
          </div>
          <button
            type="button"
            aria-label="通知"
            className="relative flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[var(--card-cream)] text-[var(--ink-brown)]"
          >
            <Bell className="h-[20px] w-[20px]" strokeWidth={2.2} />
            <span className="absolute right-[5px] top-[5px] flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[var(--accent-badge)] px-[2px] font-body text-[10px] font-[700] text-[var(--page-cream)]">
              {data.notificationCount}
            </span>
          </button>
        </div>

        <HeroBanner
          image={homeHero}
          imageAlt="宠物领养首页推荐"
          title={data.hero.title}
          tag={data.hero.tag}
          actionLabel={data.hero.actionLabel}
          actionTone="accent"
          onAction={() => onSelectPet(data.hero.petSlug)}
        />

        <section className="flex flex-col gap-3">
          <SectionHeader
            tone="warm"
            title="想领养哪一类？"
            action="查看全部"
            onAction={() => onNavigate("browse")}
          />
          <div className="flex flex-wrap gap-[10px]">
            {data.categories.map((category) => (
              <FilterChip key={category.key} tone="warm" active={category.active}>
                {category.label}
              </FilterChip>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            tone="warm"
            title="本周心动"
            action="更多毛孩子"
            onAction={() => onNavigate("browse")}
          />
          <div className="flex flex-col gap-[14px]">
            {data.weeklyPicks.map((pet) => (
              <HomePetCard
                key={pet.slug}
                data={pet}
                isBusy={favoriteBusySlug === pet.slug}
                onSelectPet={onSelectPet}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      </div>
      <BottomNav active="home" tone="warm" onChange={onNavigate} />
    </PhoneFrame>
  );
}

function BrowseScreen({
  data,
  favoriteBusySlug,
  isLoading,
  onNavigate,
  searchQuery,
  onFilterChange,
  onSearchChange,
  onSelectPet,
  onToggleFavorite,
}: {
  data: BrowseScreenData;
  favoriteBusySlug: string | null;
  isLoading: boolean;
  onNavigate: (tab: TabKey) => void;
  searchQuery: string;
  onFilterChange: (filter: BrowseFilterKey) => void;
  onSearchChange: (value: string) => void;
  onSelectPet: (petSlug: string) => void;
  onToggleFavorite: (petSlug: string) => void;
}) {
  return (
    <PhoneFrame tone="warm">
      <StatusBar tone="warm" />
      <div className="flex flex-1 flex-col gap-[20px] px-[24px] pb-[20px] pt-[6px]">
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-[28px] font-[800] tracking-[-0.04em] text-[var(--ink-brown)]">
              {data.title}
            </h1>
            <span className="rounded-[20px] bg-[var(--accent-soft-2)] px-[14px] py-[8px] font-body text-[12px] font-[600] text-[var(--accent)]">
              {data.totalAvailableCount} 只在等家
            </span>
          </div>

          <div className="flex items-center gap-[10px]">
            <label className="flex h-[54px] flex-1 items-center gap-3 rounded-[26px] bg-[var(--card-cream)] px-[16px] text-[var(--tab-muted-warm)]">
              <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={data.searchPlaceholder}
                className="h-full w-full bg-transparent font-body text-[15px] text-[var(--ink-brown)] outline-none placeholder:text-[var(--tab-muted-warm)]"
              />
            </label>
            <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[24px] bg-[var(--accent)] font-body text-[16px] font-[700] text-white">
              筛
            </div>
          </div>
          {isLoading ? (
            <p className="font-body text-[12px] text-[var(--muted-brown)]">正在根据搜索条件同步列表…</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-[10px]">
          {data.filters.map((filter) => (
            <button key={filter.key} type="button" onClick={() => onFilterChange(filter.key)}>
              <FilterChip tone="warm" active={filter.active}>
                {filter.label}
              </FilterChip>
            </button>
          ))}
        </div>

        <section className="flex flex-col gap-3">
          <SectionHeader tone="warm" title="编辑精选" action="筛选更多" />
          <HeroBanner
            image={data.featuredPet.imageUrl ?? homeHero}
            imageAlt={data.featuredPet.title}
            title={data.featuredPet.title}
            tag={data.featuredPet.tag}
            meta={data.featuredPet.meta}
            actionLabel={data.featuredPet.actionLabel}
            actionTone="accentSoft"
            heightClass="h-[192px]"
            onAction={() => onSelectPet(data.featuredPet.petSlug)}
          />
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader tone="warm" title="为你筛好" action="最新发布" />
          <div className="flex flex-col gap-3">
            {data.results.map((pet) => (
              <BrowsePetCard
                key={pet.slug}
                data={pet}
                isBusy={favoriteBusySlug === pet.slug}
                onSelectPet={onSelectPet}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      </div>
      <BottomNav active="browse" tone="warm" onChange={onNavigate} />
    </PhoneFrame>
  );
}

function DetailScreen({
  data,
  applicationSubmitting,
  favoriteBusySlug,
  onApply,
  onBack,
  onToggleFavorite,
}: {
  data: DetailScreenData;
  applicationSubmitting: boolean;
  favoriteBusySlug: string | null;
  onApply: () => void;
  onBack: () => void;
  onToggleFavorite: (petSlug: string) => void;
}) {
  const favoriteBusy = favoriteBusySlug === data.pet.slug;

  return (
    <PhoneFrame tone="neutral">
      <StatusBar tone="neutral" />
      <div className="flex flex-1 flex-col px-[24px] pb-[24px]">
        <div className="flex flex-1 flex-col gap-5">
          <div className="relative overflow-hidden rounded-[28px]">
            <img
              src={data.pet.imageUrl}
              alt={data.pet.name}
              className="h-[300px] w-full object-cover"
              loading="lazy"
            />
            <button
              type="button"
              aria-label="返回上一页"
              onClick={onBack}
              className="absolute left-4 top-4 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[var(--glass-surface)] text-[var(--ink-neutral)] backdrop-blur-sm"
            >
              <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.4} />
            </button>
            <button
              type="button"
              aria-label={data.pet.favorited ? "取消收藏" : "收藏"}
              onClick={() => onToggleFavorite(data.pet.slug)}
              disabled={favoriteBusy}
              className={cx(
                "absolute right-4 top-4 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[var(--glass-surface)] backdrop-blur-sm",
                data.pet.favorited ? "text-[var(--accent-strong)]" : "text-[var(--accent-badge)]",
              )}
            >
              <Heart
                className="h-[20px] w-[20px]"
                strokeWidth={2.1}
                fill={data.pet.favorited ? "currentColor" : "transparent"}
              />
            </button>
            <span className="absolute bottom-4 left-4 rounded-[18px] bg-[var(--glass-surface-strong)] px-[14px] py-[8px] font-body text-[12px] font-[600] text-[var(--ink-neutral)]">
              {data.pet.statusBadge}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-[34px] font-[800] leading-[1.02] tracking-[-0.05em] text-[var(--ink-neutral)]">
                  {data.pet.name}
                </h2>
                <p className="font-body text-[14px] font-[500] text-[var(--muted-neutral)]">
                  {data.pet.meta}
                </p>
              </div>
              <div className="flex min-w-[68px] flex-col items-center gap-1 rounded-[20px] bg-[var(--accent-soft)] px-[14px] py-[10px]">
                <span className="font-display text-[18px] font-[700] text-[var(--accent-strong)]">
                  {data.pet.scorePercent}%
                </span>
                <span className="font-body text-[11px] font-[600] text-[var(--accent-strong)]">
                  匹配度
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              {data.pet.traits.map((trait) => (
                <TraitPill key={trait}>{trait}</TraitPill>
              ))}
            </div>

            <article className="flex flex-col gap-[10px] rounded-[24px] bg-[var(--card-cream-2)] p-[18px]">
              <h3 className="font-display text-[20px] font-[700] tracking-[-0.03em] text-[var(--ink-neutral)]">
                关于它
              </h3>
              <p className="font-body text-[14px] leading-[1.5] text-[var(--muted-neutral-deep)]">
                {data.pet.description}
              </p>
            </article>

            <div className="grid grid-cols-2 gap-3">
              <InfoCard
                backgroundClass="bg-[var(--card-cream-3)]"
                eyebrowClass="text-[var(--accent-orange)]"
                eyebrow="领养要求"
                title={data.pet.adoptionRequirementLabel}
              />
              <InfoCard
                backgroundClass="bg-[var(--card-cream-4)]"
                eyebrowClass="text-[var(--accent-gold-deep)]"
                eyebrow="健康状态"
                title={data.pet.healthLabel}
              />
            </div>

            <article className="flex items-center gap-3 rounded-[24px] bg-[var(--card-cream-2)] p-[18px]">
              <img
                src={data.pet.ownerAvatarUrl}
                alt={data.pet.ownerName}
                className="h-[52px] w-[52px] rounded-full object-cover"
                loading="lazy"
              />
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="font-display text-[17px] font-[700] tracking-[-0.03em] text-[var(--ink-neutral)]">
                  {data.pet.ownerName}
                </h3>
                <p className="font-body text-[13px] text-[var(--muted-neutral)]">
                  {data.pet.ownerDescription}
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div className="flex h-[108px] items-center gap-3 bg-[var(--page-white)] px-[24px] pb-[24px] pt-[10px]">
        <button
          type="button"
          aria-label="咨询"
          className="flex h-full w-[84px] items-center justify-center rounded-[24px] bg-[var(--card-cream-2)] text-[var(--ink-neutral)]"
        >
          <MessageCircle className="h-[20px] w-[20px]" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={data.pet.applicationSubmitted || applicationSubmitting}
          className={cx(
            "flex h-full flex-1 items-center justify-center rounded-[24px] font-body text-[16px] font-[700] text-white",
            data.pet.applicationSubmitted
              ? "bg-[var(--tab-muted-neutral)]"
              : "bg-[var(--accent-strong)]",
          )}
        >
          {data.pet.applicationSubmitted
            ? "已提交申请"
            : applicationSubmitting
              ? "提交中..."
              : "申请领养"}
        </button>
      </div>
    </PhoneFrame>
  );
}

function ProfileScreen({
  data,
  onNavigate,
}: {
  data: ProfileScreenData;
  onNavigate: (tab: TabKey) => void;
}) {
  return (
    <PhoneFrame tone="neutral">
      <StatusBar tone="neutral" />
      <div className="flex flex-1 flex-col gap-5 px-[24px] pb-[24px]">
        <article className="flex flex-col gap-4 rounded-[28px] bg-[var(--card-cream-2)] p-[22px]">
          <div className="flex items-center justify-between gap-4">
            <img
              src={data.profile.avatarUrl}
              alt={data.profile.name}
              className="h-[68px] w-[68px] rounded-full object-cover"
              loading="lazy"
            />
            <button
              type="button"
              className="rounded-[18px] bg-[var(--page-white)] px-[12px] py-[8px] font-body text-[12px] font-[600] text-[var(--accent-strong)]"
            >
              完善资料 {data.profile.completionPercent}%
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[34px] font-[800] leading-[1.02] tracking-[-0.05em] text-[var(--ink-neutral)]">
              {data.profile.name} · {data.profile.roleTitle}
            </h2>
            <p className="font-body text-[14px] text-[var(--muted-neutral)]">
              {data.profile.description}
            </p>
          </div>
        </article>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            backgroundClass="bg-[var(--accent-strong)]"
            eyebrowClass="text-white/80"
            valueClass="text-white"
            eyebrow="已收藏"
            value={String(data.profile.favoritesCount)}
          />
          <MetricCard
            backgroundClass="bg-[var(--card-cream-2)]"
            eyebrowClass="text-[var(--muted-neutral)]"
            valueClass="text-[var(--ink-neutral)]"
            eyebrow="申请中"
            value={String(data.profile.activeApplicationsCount)}
          />
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="font-display text-[20px] font-[700] tracking-[-0.03em] text-[var(--ink-neutral)]">
            我的服务
          </h3>
          <div className="flex flex-col gap-3">
            {data.profile.services.map((item) => (
              <MenuRow key={item} label={item} />
            ))}
          </div>
        </section>

        <article className="flex flex-col gap-[10px] rounded-[24px] bg-[var(--card-cream-3)] p-[18px]">
          <h3 className="font-display text-[17px] font-[700] tracking-[-0.03em] text-[var(--ink-neutral)]">
            {data.profile.recentStatusTitle}
          </h3>
          <p className="font-body text-[14px] leading-[1.4] text-[var(--signal-warm)]">
            {data.profile.recentStatusBody}
          </p>
        </article>
      </div>
      <BottomNav active="profile" tone="neutral" onChange={onNavigate} />
    </PhoneFrame>
  );
}

function PhoneFrame({
  children,
  tone,
}: {
  children: ReactNode;
  tone: NavTone;
}) {
  return (
    <section
      className={cx(
        "flex w-full max-w-[402px] min-h-[874px] flex-col overflow-hidden rounded-[32px] border border-white/60 shadow-[0_28px_80px_rgba(127,85,57,0.18)]",
        tone === "warm" ? "bg-[var(--page-cream)]" : "bg-[var(--page-white)]",
      )}
    >
      {children}
    </section>
  );
}

function PhonePlaceholder({
  tone,
  title,
  description,
  navActive,
  onNavigate,
  actionLabel,
  onAction,
}: {
  tone: NavTone;
  title: string;
  description: string;
  navActive?: TabKey;
  onNavigate?: (tab: TabKey) => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <PhoneFrame tone={tone}>
      <StatusBar tone={tone} />
      <div className="flex flex-1 items-center justify-center px-[28px] pb-[32px] pt-[12px]">
        <div
          className={cx(
            "w-full rounded-[28px] p-6",
            tone === "warm" ? "bg-[var(--card-cream)]" : "bg-[var(--card-cream-2)]",
          )}
        >
          <p className="font-display text-[24px] font-[700] tracking-[-0.03em] text-[var(--ink-neutral)]">
            {title}
          </p>
          <p className="mt-3 font-body text-[14px] leading-[1.6] text-[var(--muted-neutral)]">
            {description}
          </p>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-5 rounded-[20px] bg-[var(--accent-strong)] px-4 py-3 font-body text-[13px] font-[700] text-white"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
      {navActive && onNavigate ? (
        <BottomNav active={navActive} tone={tone} onChange={onNavigate} />
      ) : null}
    </PhoneFrame>
  );
}

function StatusBar({ tone }: { tone: NavTone }) {
  const textColor =
    tone === "warm" ? "text-[var(--ink-brown)]" : "text-[var(--ink-neutral)]";
  const background =
    tone === "warm" ? "bg-[var(--page-cream)]" : "bg-[var(--page-white)]";

  return (
    <div className={cx("flex h-[62px] items-center justify-between px-[24px]", background)}>
      <span className={cx("font-body text-[16px] font-[700]", textColor)}>9:41</span>
      <div className={cx("flex items-center gap-1", textColor)}>
        <SignalHigh className="h-[14px] w-[14px]" strokeWidth={2.4} />
        <Wifi className="h-[14px] w-[14px]" strokeWidth={2.4} />
        <span className="font-body text-[14px] font-[600]">100%</span>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  action,
  tone,
  onAction,
}: {
  title: string;
  action?: string;
  tone: NavTone;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        className={cx(
          "font-display text-[20px] font-[700] tracking-[-0.03em]",
          tone === "warm" ? "text-[var(--ink-brown)]" : "text-[var(--ink-neutral)]",
        )}
      >
        {title}
      </h2>
      {action ? (
        onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="font-body text-[12px] font-[600] text-[var(--accent)]"
          >
            {action}
          </button>
        ) : (
          <span className="font-body text-[12px] font-[600] text-[var(--accent)]">{action}</span>
        )
      ) : null}
    </div>
  );
}

function FilterChip({
  children,
  active = false,
  tone,
}: {
  children: ReactNode;
  active?: boolean;
  tone: NavTone;
}) {
  const activeClass =
    tone === "warm"
      ? "bg-[var(--accent)] text-white"
      : "bg-[var(--accent-strong)] text-white";

  return (
    <span
      className={cx(
        "inline-flex rounded-[24px] px-[16px] py-[10px] font-body text-[13px] font-[600]",
        active
          ? activeClass
          : tone === "warm"
            ? "bg-[var(--card-cream)] text-[var(--soft-brown)]"
            : "bg-[var(--card-cream-2)] text-[var(--ink-neutral)]",
      )}
    >
      {children}
    </span>
  );
}

function HeroBanner({
  image,
  imageAlt,
  title,
  tag,
  meta,
  actionLabel,
  actionTone,
  heightClass = "h-[208px]",
  onAction,
}: {
  image: string;
  imageAlt: string;
  title: string;
  tag: string;
  meta?: string;
  actionLabel: string;
  actionTone: ActionTone;
  heightClass?: string;
  onAction: () => void;
}) {
  return (
    <article className={cx("relative overflow-hidden rounded-[24px]", heightClass)}>
      <img src={image} alt={imageAlt} className="h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,24,27,0)_0%,rgba(24,24,27,0.8)_100%)]" />
      <div className="absolute inset-0 flex flex-col justify-end gap-[10px] p-5">
        <h2 className="whitespace-pre-line font-display text-[24px] font-[800] leading-[1.1] tracking-[-0.04em] text-[var(--page-cream)]">
          {title}
        </h2>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-[20px] bg-[var(--glass-tag)] px-[14px] py-[8px] font-body text-[12px] font-[600] text-white backdrop-blur-sm">
            {tag}
          </span>
          {meta ? (
            <div className="flex items-center gap-3">
              <span className="font-body text-[12px] font-[600] text-white">{meta}</span>
              <ActionPill label={actionLabel} tone={actionTone} onClick={onAction} />
            </div>
          ) : (
            <ActionPill label={actionLabel} tone={actionTone} onClick={onAction} />
          )}
        </div>
      </div>
    </article>
  );
}

function ActionPill({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: ActionTone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-[24px] px-[18px] py-[10px] font-body text-[13px] font-[600] text-white",
        tone === "gold"
          ? "bg-[var(--accent-gold)]"
          : tone === "accentSoft"
            ? "bg-[var(--accent-badge)]"
            : "bg-[var(--accent)]",
      )}
    >
      {label}
    </button>
  );
}

function HomePetCard({
  data,
  isBusy,
  onSelectPet,
  onToggleFavorite,
}: {
  data: HomePetCardData;
  isBusy: boolean;
  onSelectPet: (petSlug: string) => void;
  onToggleFavorite: (petSlug: string) => void;
}) {
  const isFavoriteAction = data.action?.type === "favorite";

  return (
    <article
      className="flex h-[122px] cursor-pointer overflow-hidden rounded-[24px] bg-[var(--card-cream)]"
      onClick={() => onSelectPet(data.slug)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectPet(data.slug);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <img src={data.imageUrl} alt={data.title} className="h-full w-[116px] object-cover" loading="lazy" />
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="flex flex-col gap-[6px]">
          <h3 className="font-display text-[17px] font-[700] tracking-[-0.03em] text-[var(--ink-brown)]">
            {data.title}
          </h3>
          <p className="whitespace-pre-line font-body text-[13px] leading-[1.35] text-[var(--muted-brown)]">
            {data.meta}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-[20px] bg-[var(--accent-soft-2)] px-[12px] py-[6px] font-body text-[11px] font-[600] text-[var(--accent)]">
            {data.tag}
          </span>
          {data.action ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                if (isFavoriteAction) {
                  onToggleFavorite(data.slug);
                  return;
                }

                onSelectPet(data.slug);
              }}
              disabled={isBusy}
              className={cx(
                "rounded-[20px] px-[14px] py-[8px] font-body text-[12px] font-[600] text-white",
                isFavoriteAction
                  ? "bg-[var(--accent)]"
                  : data.action.label.includes("预约")
                    ? "bg-[var(--accent-gold)]"
                    : "bg-[var(--accent)]",
              )}
            >
              {isBusy ? "处理中..." : data.action.label}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function BrowsePetCard({
  data,
  isBusy,
  onSelectPet,
  onToggleFavorite,
}: {
  data: BrowsePetCardData;
  isBusy: boolean;
  onSelectPet: (petSlug: string) => void;
  onToggleFavorite: (petSlug: string) => void;
}) {
  const isFavoriteAction = data.action?.type === "favorite";

  return (
    <article
      className="flex h-[104px] cursor-pointer overflow-hidden rounded-[24px] bg-[var(--card-cream)]"
      onClick={() => onSelectPet(data.slug)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectPet(data.slug);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <img src={data.imageUrl} alt={data.title} className="h-full w-[96px] object-cover" loading="lazy" />
      <div className="flex flex-1 flex-col justify-between p-[14px]">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-[16px] font-[700] tracking-[-0.03em] text-[var(--ink-brown)]">
            {data.title}
          </h3>
          <p className="font-body text-[13px] leading-[1.35] text-[var(--muted-brown)]">
            {data.meta}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span
            className={cx(
              "rounded-[20px] px-[12px] py-[6px] font-body text-[11px] font-[600]",
              data.action
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--accent-gold-soft)] text-[var(--accent-gold)]",
            )}
          >
            {data.tag}
          </span>
          {data.action ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                if (isFavoriteAction) {
                  onToggleFavorite(data.slug);
                  return;
                }

                onSelectPet(data.slug);
              }}
              disabled={isBusy}
              className="rounded-[20px] bg-[var(--accent)] px-[14px] py-[8px] font-body text-[12px] font-[600] text-white"
            >
              {isBusy ? "处理中..." : data.action.label}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TraitPill({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center justify-center rounded-[18px] bg-[var(--card-cream-2)] px-[12px] py-[10px] font-body text-[13px] font-[600] text-[var(--ink-neutral)]">
      {children}
    </span>
  );
}

function InfoCard({
  eyebrow,
  title,
  backgroundClass,
  eyebrowClass,
}: {
  eyebrow: string;
  title: string;
  backgroundClass: string;
  eyebrowClass: string;
}) {
  return (
    <article className={cx("flex flex-col gap-[6px] rounded-[22px] p-4", backgroundClass)}>
      <span className={cx("font-body text-[12px] font-[600]", eyebrowClass)}>{eyebrow}</span>
      <h3 className="font-display text-[16px] font-[700] tracking-[-0.03em] text-[var(--ink-neutral)]">
        {title}
      </h3>
    </article>
  );
}

function MetricCard({
  eyebrow,
  value,
  backgroundClass,
  eyebrowClass,
  valueClass,
}: {
  eyebrow: string;
  value: string;
  backgroundClass: string;
  eyebrowClass: string;
  valueClass: string;
}) {
  return (
    <article className={cx("flex flex-col gap-[6px] rounded-[24px] p-[18px]", backgroundClass)}>
      <span className={cx("font-body text-[12px] font-[600]", eyebrowClass)}>{eyebrow}</span>
      <strong className={cx("font-display text-[28px] font-[800] leading-none", valueClass)}>
        {value}
      </strong>
    </article>
  );
}

function MenuRow({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex items-center justify-between rounded-[24px] bg-[var(--card-cream-2)] px-5 py-[18px] text-left"
    >
      <span className="font-body text-[15px] font-[600] text-[var(--ink-neutral)]">{label}</span>
      <ChevronRight className="h-[18px] w-[18px] text-[var(--tab-muted-neutral)]" strokeWidth={2.2} />
    </button>
  );
}

function BottomNav({
  active,
  tone,
  onChange,
}: {
  active: TabKey;
  tone: NavTone;
  onChange: (tab: TabKey) => void;
}) {
  const wrapperClass =
    tone === "warm" ? "bg-[var(--page-cream)]" : "bg-[var(--page-white)]";
  const pillClass =
    tone === "warm"
      ? "border-[var(--line-warm)] bg-[var(--page-cream)]"
      : "border-[var(--line-neutral)] bg-[var(--page-white)]";
  const mutedClass =
    tone === "warm"
      ? "text-[var(--tab-muted-warm)]"
      : "text-[var(--tab-muted-neutral)]";
  const activeClass =
    tone === "warm"
      ? "bg-[var(--accent)] text-white"
      : "bg-[var(--accent-strong)] text-white";

  return (
    <div className={cx("flex h-[95px] items-center px-[21px] pb-[21px] pt-[12px]", wrapperClass)}>
      <div className={cx("flex h-[62px] w-full items-center rounded-[36px] border p-1", pillClass)}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cx(
                "flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-[26px]",
                isActive ? activeClass : mutedClass,
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              <span className="font-body text-[10px] font-[600]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

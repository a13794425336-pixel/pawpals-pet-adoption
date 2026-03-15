import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

loadEnv();

type BrowseFilterKey = "all" | "same-day" | "affectionate";

type SettingsRow = {
  id: number;
  home_greeting_title: string;
  home_greeting_subtitle: string;
  home_hero_title: string;
  home_hero_tag: string;
  home_hero_action_label: string;
  home_hero_pet_slug: string;
  browse_title: string;
  browse_total_available_count: number;
  browse_search_placeholder: string;
};

type FilterRow = {
  screen: "home" | "browse";
  key: string;
  label: string;
  sort_order: number;
  is_default: boolean;
};

type PetRow = {
  id: string;
  slug: string;
  display_name: string;
  age_label: string;
  species: string;
  breed: string;
  gender: string;
  city: string;
  district: string;
  hero_image_url: string;
  list_image_url: string;
  detail_image_url: string;
  owner_avatar_url: string;
  detail_meta: string;
  detail_description: string;
  summary: string;
  home_card_title: string | null;
  home_card_meta: string | null;
  home_card_tag: string | null;
  home_card_action_label: string | null;
  browse_card_title: string | null;
  browse_card_meta: string | null;
  browse_card_tag: string | null;
  browse_card_action_label: string | null;
  editorial_tagline: string | null;
  editorial_title: string | null;
  editorial_meta: string | null;
  detail_badge: string;
  match_score: number;
  trait_labels: string[];
  adoption_requirement_label: string;
  health_label: string;
  owner_name: string;
  owner_description: string;
  category_keys: string[];
  searchable_text: string;
  same_day_available: boolean;
  affectionate: boolean;
  is_home_pick: boolean;
  home_sort_order: number | null;
  is_browse_result: boolean;
  browse_sort_order: number | null;
  is_editorial_pick: boolean;
  editorial_sort_order: number | null;
  is_detail_default: boolean;
};

type ProfileRow = {
  id: string;
  display_name: string;
  role_title: string;
  bio: string;
  avatar_url: string;
  completion_percent: number;
  notifications_count: number;
  favorites_count: number;
  active_applications_count: number;
  recent_status_title: string;
  recent_status_body: string;
  created_at: string;
  updated_at: string;
};

type ServiceRow = {
  label: string;
  sort_order: number;
};

type FavoriteRow = {
  pet_id: string;
};

type ApplicationRow = {
  pet_id: string;
  status: string;
};

const app = express();
app.use(express.json());

const port = Number(process.env.PORT ?? 3001);

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }

  return value;
}

const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

function sanitizeSearchTerm(value: string) {
  return value.trim().replace(/[,%_]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

function normalizeBrowseFilter(value: string | undefined): BrowseFilterKey {
  if (value === "same-day" || value === "affectionate") {
    return value;
  }

  return "all";
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`读取应用配置失败：${error.message}`);
  }

  if (!data) {
    throw new Error("Supabase 中缺少 app_settings 数据");
  }

  return data as SettingsRow;
}

async function loadProfile(profileId?: string) {
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: true }).limit(1);

  if (profileId) {
    query = supabase.from("profiles").select("*").eq("id", profileId).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`读取用户资料失败：${error.message}`);
  }

  if (!data) {
    throw new Error("Supabase 中缺少 profiles 数据");
  }

  return data as ProfileRow;
}

async function loadProfileServices(profileId: string) {
  const { data, error } = await supabase
    .from("profile_services")
    .select("label, sort_order")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`读取用户服务列表失败：${error.message}`);
  }

  return (data ?? []) as ServiceRow[];
}

async function loadFavoritePetIds(profileId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select("pet_id")
    .eq("profile_id", profileId);

  if (error) {
    throw new Error(`读取收藏状态失败：${error.message}`);
  }

  return new Set(((data ?? []) as FavoriteRow[]).map((item) => item.pet_id));
}

async function loadApplicationPetIds(profileId: string) {
  const { data, error } = await supabase
    .from("adoption_applications")
    .select("pet_id, status")
    .eq("profile_id", profileId);

  if (error) {
    throw new Error(`读取申请状态失败：${error.message}`);
  }

  return new Set(((data ?? []) as ApplicationRow[]).map((item) => item.pet_id));
}

async function loadFilters(screen: "home" | "browse") {
  const { data, error } = await supabase
    .from("screen_filters")
    .select("screen, key, label, sort_order, is_default")
    .eq("screen", screen)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`读取筛选项失败：${error.message}`);
  }

  return (data ?? []) as FilterRow[];
}

async function loadHomePicks() {
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("is_home_pick", true)
    .order("home_sort_order", { ascending: true });

  if (error) {
    throw new Error(`读取首页推荐失败：${error.message}`);
  }

  return (data ?? []) as PetRow[];
}

async function loadBrowseFeaturedPet() {
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("is_editorial_pick", true)
    .order("editorial_sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`读取编辑精选失败：${error.message}`);
  }

  if (!data) {
    throw new Error("Supabase 中缺少编辑精选宠物数据");
  }

  return data as PetRow;
}

async function loadBrowseResults(search: string, filter: BrowseFilterKey) {
  let query = supabase
    .from("pets")
    .select("*")
    .eq("is_browse_result", true)
    .order("browse_sort_order", { ascending: true });

  if (filter === "same-day") {
    query = query.eq("same_day_available", true);
  }

  if (filter === "affectionate") {
    query = query.eq("affectionate", true);
  }

  const sanitizedSearch = sanitizeSearchTerm(search);

  if (sanitizedSearch) {
    const pattern = `%${sanitizedSearch}%`;
    query = query.or(
      [
        `display_name.ilike.${pattern}`,
        `breed.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `district.ilike.${pattern}`,
        `searchable_text.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`读取发现页列表失败：${error.message}`);
  }

  return (data ?? []) as PetRow[];
}

async function loadPetBySlug(slug: string) {
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`读取宠物详情失败：${error.message}`);
  }

  if (!data) {
    throw new Error(`未找到 slug 为 ${slug} 的宠物`);
  }

  return data as PetRow;
}

function formatHomeAction(pet: PetRow, favoritePetIds: Set<string>) {
  if (!pet.home_card_action_label) {
    return undefined;
  }

  const isFavoriteAction = pet.home_card_action_label.includes("收藏");

  return {
    type: isFavoriteAction ? ("favorite" as const) : ("view" as const),
    label: isFavoriteAction && favoritePetIds.has(pet.id) ? "已收藏" : pet.home_card_action_label,
  };
}

function formatBrowseAction(pet: PetRow) {
  if (!pet.browse_card_action_label) {
    return undefined;
  }

  return {
    type: "view" as const,
    label: pet.browse_card_action_label,
  };
}

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/home", async (_req, res) => {
  const profile = await loadProfile();
  const [settings, filters, pets, favoritePetIds] = await Promise.all([
    loadSettings(),
    loadFilters("home"),
    loadHomePicks(),
    loadFavoritePetIds(profile.id),
  ]);

  res.json({
    greetingTitle: settings.home_greeting_title,
    greetingSubtitle: settings.home_greeting_subtitle,
    notificationCount: profile.notifications_count,
    hero: {
      petSlug: settings.home_hero_pet_slug,
      title: settings.home_hero_title,
      tag: settings.home_hero_tag,
      actionLabel: settings.home_hero_action_label,
    },
    categories: filters.map((item) => ({
      key: item.key,
      label: item.label,
      active: item.is_default,
    })),
    weeklyPicks: pets.map((pet) => ({
      slug: pet.slug,
      imageUrl: pet.list_image_url,
      title: pet.home_card_title ?? `${pet.display_name}｜${pet.age_label}`,
      meta: pet.home_card_meta ?? pet.summary,
      tag: pet.home_card_tag ?? `${pet.city} · ${pet.district}`,
      favorited: favoritePetIds.has(pet.id),
      action: formatHomeAction(pet, favoritePetIds),
    })),
  });
});

app.get("/api/browse", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const filter = normalizeBrowseFilter(
    typeof req.query.filter === "string" ? req.query.filter : undefined,
  );

  const profile = await loadProfile();
  const [settings, browseFilters, featuredPet, results, favoritePetIds] = await Promise.all([
    loadSettings(),
    loadFilters("browse"),
    loadBrowseFeaturedPet(),
    loadBrowseResults(search, filter),
    loadFavoritePetIds(profile.id),
  ]);

  res.json({
    title: settings.browse_title,
    totalAvailableCount: settings.browse_total_available_count,
    searchPlaceholder: settings.browse_search_placeholder,
    filters: browseFilters.map((item) => ({
      key: item.key,
      label: item.label,
      active: item.key === filter,
    })),
    featuredPet: {
      petSlug: featuredPet.slug,
      imageUrl: featuredPet.hero_image_url,
      title: featuredPet.editorial_title ?? `${featuredPet.display_name}｜${featuredPet.age_label}`,
      tag: featuredPet.editorial_tagline ?? "编辑精选",
      meta: featuredPet.editorial_meta ?? featuredPet.detail_meta,
      actionLabel: "查看详情",
    },
    results: results.map((pet) => ({
      slug: pet.slug,
      imageUrl: pet.list_image_url,
      title: pet.browse_card_title ?? `${pet.display_name}｜${pet.breed}`,
      meta: pet.browse_card_meta ?? pet.summary,
      tag: pet.browse_card_tag ?? `${pet.city} · ${pet.district}`,
      favorited: favoritePetIds.has(pet.id),
      action: formatBrowseAction(pet),
    })),
  });
});

app.get("/api/pets/:slug", async (req, res) => {
  const pet = await loadPetBySlug(req.params.slug);
  const profile = await loadProfile();
  const [favoritePetIds, applicationPetIds] = await Promise.all([
    loadFavoritePetIds(profile.id),
    loadApplicationPetIds(profile.id),
  ]);

  res.json({
    pet: {
      slug: pet.slug,
      name: pet.display_name,
      meta: pet.detail_meta,
      imageUrl: pet.detail_image_url,
      statusBadge: pet.detail_badge,
      scorePercent: pet.match_score,
      traits: pet.trait_labels,
      description: pet.detail_description,
      adoptionRequirementLabel: pet.adoption_requirement_label,
      healthLabel: pet.health_label,
      ownerName: pet.owner_name,
      ownerDescription: pet.owner_description,
      ownerAvatarUrl: pet.owner_avatar_url,
      favorited: favoritePetIds.has(pet.id),
      applicationSubmitted: applicationPetIds.has(pet.id),
    },
  });
});

app.get("/api/profile", async (_req, res) => {
  const profile = await loadProfile();
  const services = await loadProfileServices(profile.id);

  res.json({
    profile: {
      id: profile.id,
      name: profile.display_name,
      roleTitle: profile.role_title,
      description: profile.bio,
      avatarUrl: profile.avatar_url,
      completionPercent: profile.completion_percent,
      notificationsCount: profile.notifications_count,
      favoritesCount: profile.favorites_count,
      activeApplicationsCount: profile.active_applications_count,
      recentStatusTitle: profile.recent_status_title,
      recentStatusBody: profile.recent_status_body,
      services: services.map((item) => item.label),
    },
  });
});

app.post("/api/pets/:slug/favorite", async (req, res) => {
  const petSlug = req.params.slug;
  const profileId = typeof req.body?.profileId === "string" ? req.body.profileId : undefined;

  const [pet, profile] = await Promise.all([loadPetBySlug(petSlug), loadProfile(profileId)]);

  const { data: existingFavorite, error: favoriteLookupError } = await supabase
    .from("favorites")
    .select("pet_id")
    .eq("profile_id", profile.id)
    .eq("pet_id", pet.id)
    .limit(1)
    .maybeSingle();

  if (favoriteLookupError) {
    throw new Error(`读取收藏记录失败：${favoriteLookupError.message}`);
  }

  const nextFavorited = !existingFavorite;
  const nextFavoritesCount = nextFavorited
    ? profile.favorites_count + 1
    : Math.max(profile.favorites_count - 1, 0);

  if (existingFavorite) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("profile_id", profile.id)
      .eq("pet_id", pet.id);

    if (error) {
      throw new Error(`取消收藏失败：${error.message}`);
    }
  } else {
    const { error } = await supabase.from("favorites").insert({
      profile_id: profile.id,
      pet_id: pet.id,
    });

    if (error) {
      throw new Error(`收藏失败：${error.message}`);
    }
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      favorites_count: nextFavoritesCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (profileUpdateError) {
    throw new Error(`更新收藏计数失败：${profileUpdateError.message}`);
  }

  res.json({
    petSlug,
    favorited: nextFavorited,
    favoritesCount: nextFavoritesCount,
  });
});

app.post("/api/applications", async (req, res) => {
  const profileId = typeof req.body?.profileId === "string" ? req.body.profileId : undefined;
  const petSlug = typeof req.body?.petSlug === "string" ? req.body.petSlug : undefined;

  if (!petSlug) {
    res.status(400).json({ error: "petSlug 不能为空" });
    return;
  }

  const [pet, profile] = await Promise.all([loadPetBySlug(petSlug), loadProfile(profileId)]);

  const { data: existingApplication, error: applicationLookupError } = await supabase
    .from("adoption_applications")
    .select("pet_id")
    .eq("profile_id", profile.id)
    .eq("pet_id", pet.id)
    .limit(1)
    .maybeSingle();

  if (applicationLookupError) {
    throw new Error(`读取申请记录失败：${applicationLookupError.message}`);
  }

  if (existingApplication) {
    res.json({
      petSlug,
      submitted: true,
      activeApplicationsCount: profile.active_applications_count,
      recentStatusBody: profile.recent_status_body,
    });
    return;
  }

  const { error: insertError } = await supabase.from("adoption_applications").insert({
    profile_id: profile.id,
    pet_id: pet.id,
    status: "reviewing",
  });

  if (insertError) {
    throw new Error(`提交领养申请失败：${insertError.message}`);
  }

  const nextApplicationsCount = profile.active_applications_count + 1;
  const nextRecentStatusBody = `「${pet.display_name}」审核中 · 预计今天 18:00 前收到初审结果`;

  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({
      active_applications_count: nextApplicationsCount,
      recent_status_body: nextRecentStatusBody,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (updateProfileError) {
    throw new Error(`更新申请状态失败：${updateProfileError.message}`);
  }

  res.status(201).json({
    petSlug,
    submitted: true,
    activeApplicationsCount: nextApplicationsCount,
    recentStatusBody: nextRecentStatusBody,
  });
});

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const clientDistDir = path.resolve(currentDir, "../../dist");
const clientIndexFile = path.join(clientDistDir, "index.html");

if (existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
}

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "接口不存在" });
    return;
  }

  if (!existsSync(clientIndexFile)) {
    res.status(404).send("未找到前端构建产物，请先执行 npm run build");
    return;
  }

  res.sendFile(clientIndexFile, (error) => {
    if (error) {
      next(error);
    }
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);

  const message = error instanceof Error ? error.message : "服务器内部错误";
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`PetAdopt server listening on http://localhost:${port}`);
});

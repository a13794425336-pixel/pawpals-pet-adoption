import type { IncomingMessage } from "node:http";

type VercelRequest = IncomingMessage & {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (statusCode: number) => VercelResponse;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

async function loadPetAdoptService() {
  return import("../server/src/petAdoptService");
}

async function parseRequestBody(req: VercelRequest) {
  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody) as Record<string, unknown>;
}

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getRouteSegments(req: VercelRequest) {
  const route = req.query?.route;

  if (Array.isArray(route)) {
    return route;
  }

  if (typeof route === "string" && route.length > 0) {
    return [route];
  }

  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const method = req.method ?? "GET";
    const route = getRouteSegments(req);
    const service = await loadPetAdoptService();

    if (method === "GET" && route.length === 1 && route[0] === "health") {
      res.status(200).json(service.getHealthData());
      return;
    }

    if (method === "GET" && route.length === 1 && route[0] === "home") {
      res.status(200).json(await service.getHomeScreenData());
      return;
    }

    if (method === "GET" && route.length === 1 && route[0] === "browse") {
      const search = getQueryValue(req.query?.search) ?? "";
      const filter = service.normalizeBrowseFilter(getQueryValue(req.query?.filter));

      res.status(200).json(await service.getBrowseScreenData(search, filter));
      return;
    }

    if (method === "GET" && route.length === 1 && route[0] === "profile") {
      res.status(200).json(await service.getProfileScreenData());
      return;
    }

    if (method === "GET" && route.length === 2 && route[0] === "pets") {
      res.status(200).json(await service.getPetDetailData(route[1]));
      return;
    }

    if (method === "POST" && route.length === 3 && route[0] === "pets" && route[2] === "favorite") {
      const body = await parseRequestBody(req);
      const profileId = typeof body.profileId === "string" ? body.profileId : undefined;

      res.status(200).json(await service.toggleFavoriteForPet(route[1], profileId));
      return;
    }

    if (method === "POST" && route.length === 1 && route[0] === "applications") {
      const body = await parseRequestBody(req);
      const petSlug = typeof body.petSlug === "string" ? body.petSlug : undefined;
      const profileId = typeof body.profileId === "string" ? body.profileId : undefined;

      if (!petSlug) {
        res.status(400).json({ error: "petSlug 不能为空" });
        return;
      }

      res.status(201).json(await service.submitApplicationForPet(petSlug, profileId));
      return;
    }

    res.status(404).json({ error: "接口不存在" });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    res.status(500).json({ error: message });
  }
}

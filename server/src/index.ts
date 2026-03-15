import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import {
  getBrowseScreenData,
  getHealthData,
  getHomeScreenData,
  getPetDetailData,
  getProfileScreenData,
  normalizeBrowseFilter,
  submitApplicationForPet,
  toggleFavoriteForPet,
} from "./petAdoptService.js";

loadEnv();

const app = express();
app.use(express.json());

const port = Number(process.env.PORT ?? 3001);

app.get("/api/health", async (_req, res) => {
  res.json(getHealthData());
});

app.get("/api/home", async (_req, res) => {
  res.json(await getHomeScreenData());
});

app.get("/api/browse", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const filter = normalizeBrowseFilter(
    typeof req.query.filter === "string" ? req.query.filter : undefined,
  );

  res.json(await getBrowseScreenData(search, filter));
});

app.get("/api/pets/:slug", async (req, res) => {
  res.json(await getPetDetailData(req.params.slug));
});

app.get("/api/profile", async (_req, res) => {
  res.json(await getProfileScreenData());
});

app.post("/api/pets/:slug/favorite", async (req, res) => {
  const petSlug = req.params.slug;
  const profileId = typeof req.body?.profileId === "string" ? req.body.profileId : undefined;

  res.json(await toggleFavoriteForPet(petSlug, profileId));
});

app.post("/api/applications", async (req, res) => {
  const profileId = typeof req.body?.profileId === "string" ? req.body.profileId : undefined;
  const petSlug = typeof req.body?.petSlug === "string" ? req.body.petSlug : undefined;

  if (!petSlug) {
    res.status(400).json({ error: "petSlug 不能为空" });
    return;
  }

  res.status(201).json(await submitApplicationForPet(petSlug, profileId));
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

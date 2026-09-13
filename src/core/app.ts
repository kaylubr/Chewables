import path from "node:path";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { authRoutes } from "./auth/auth.routes.js";
import { photoRoutes } from "./photos/photos.routes.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

if (config.corsOrigin) {
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
}

app.use("/api/auth", authRoutes);
app.use("/api/photos", photoRoutes);

app.use("/api", (_req, res) => {
	res.status(404).json({ detail: "Not found" });
});

if (config.isProd) {
  const staticDir = path.resolve(process.cwd(), "../ui/build");
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    res.status(500).json({ detail: "Internal server error" });
  },
);

export default app;

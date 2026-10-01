import type { Express } from "express";

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/login", (_req, res) => {
    res.redirect("/");
  });
  app.get("/api/auth/callback", (_req, res) => {
    res.redirect("/");
  });
}

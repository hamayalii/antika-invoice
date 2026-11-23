import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../apps/api/src/app";

describe("Deployment, routing, and CORS audit", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("serves root route GET / with API information instead of 404", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name?: string; status?: string; version?: string };
    expect(body.status).toBe("ok");
    expect(body.name).toBe("antika-api");
    expect(body.version).toBe("1.0.0");
  });

  it("serves /health endpoint", async () => {
    const res = await fetch(`${baseUrl}/health`);
    // Will be 200 if db is reachable or 503 if not, but never 404
    expect([200, 503]).toContain(res.status);
    const body = (await res.json()) as { status: string };
    expect(["ok", "unavailable"]).toContain(body.status);
  });

  it("serves /api/health endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect([200, 503]).toContain(res.status);
    const body = (await res.json()) as { status: string };
    expect(["ok", "unavailable"]).toContain(body.status);
  });

  it("allows production frontend origin https://antika-invoice.netlify.app via CORS", async () => {
    const res = await fetch(`${baseUrl}/`, {
      headers: {
        Origin: "https://antika-invoice.netlify.app",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://antika-invoice.netlify.app");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("handles CORS OPTIONS preflight request from Netlify origin correctly", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://antika-invoice.netlify.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://antika-invoice.netlify.app");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    const allowMethods = res.headers.get("access-control-allow-methods") ?? "";
    expect(allowMethods).toContain("POST");
    expect(allowMethods).toContain("GET");
    expect(allowMethods).toContain("OPTIONS");
    const allowHeaders = res.headers.get("access-control-allow-headers") ?? "";
    expect(allowHeaders.toLowerCase()).toContain("content-type");
    expect(allowHeaders.toLowerCase()).toContain("authorization");
  });

  it("allows Netlify deploy preview origins", async () => {
    const previewOrigin = "https://deploy-preview-42--antika-invoice.netlify.app";
    const res = await fetch(`${baseUrl}/`, {
      headers: {
        Origin: previewOrigin,
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(previewOrigin);
  });

  it("rejects untrusted origins in CORS", async () => {
    const res = await fetch(`${baseUrl}/`, {
      headers: {
        Origin: "https://malicious-site.example.com",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns structured 401 when calling protected route without auth", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("UNAUTHENTICATED");
  });

  it("rejects request with malformed Bearer token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: "Bearer invalid.token.payload",
      },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("UNAUTHENTICATED");
  });
});

import {
  SessionRoomDurableObject,
} from "./features/session_room/session_room_durable_object.js";
import { containsForbiddenSecret } from "./features/session_room/session_room_sqlite_repository.js";

export { SessionRoomDurableObject };

export interface WorkerEnv {
  SESSION_ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function withCors(response: Response): Response {
  if (response.status === 101) {
    return response;
  }
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const SESSION_ROUTE_REGEX = /^\/api\/session\/([A-Za-z0-9_-]{3,32})\/(register|ws)$/;
const PORTABLE_RELEASE_URL =
  "https://github.com/Srlimao/ExileBuildComppanion/releases/latest/download/ExileRelay.exe";
const SETUP_RELEASE_URL =
  "https://github.com/Srlimao/ExileBuildComppanion/releases/latest/download/ExileRelay-Setup.exe";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (containsForbiddenSecret(url.search)) {
      return withCors(
        Response.json({ error: "Auth token query parameters are forbidden on edge relay." }, { status: 400 }),
      );
    }

    if (url.pathname === "/api/health") {
      return withCors(Response.json({ ok: true, service: "exile-build-companion" }));
    }

    if (url.pathname === "/api/download/desktop") {
      const targetUrl = url.searchParams.get("variant") === "setup" ? SETUP_RELEASE_URL : PORTABLE_RELEASE_URL;
      return withCors(Response.redirect(targetUrl, 302));
    }

    if (url.pathname === "/api/oauth/callback") {
      return Response.redirect(`${url.origin}/oauth/callback${url.search}`, 302);
    }

    const match = SESSION_ROUTE_REGEX.exec(url.pathname);
    if (match) {
      const roomId = match[1]!.toUpperCase();
      const action = match[2]!;
      const stub = env.SESSION_ROOMS.get(env.SESSION_ROOMS.idFromName(roomId));
      const internalUrl = `https://session-room/${action}${url.search}`;
      const forwarded = new Request(internalUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      });
      const response = await stub.fetch(forwarded);
      return withCors(response);
    }

    if (url.pathname.startsWith("/api/")) {
      return withCors(Response.json({ error: "Unknown API route" }, { status: 404 }));
    }

    return env.ASSETS.fetch(request);
  },
};

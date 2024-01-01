import { serve } from "https://deno.land/std@0.74.0/http/server.ts";
import { isUrlAllowed } from "./helpers/allowed-urls-helper.ts";
import TTL from "https://deno.land/x/ttl/mod.ts";

const ttl = new TTL<any>(3_600_000);

export async function run(
  port: number,
  route: string,
  allowedUrls: string,
  allowedOrigins: string,
) {
  const server = serve({ port });
  console.log(`CORS proxy server listening at port ${port}.`);

  for await (const req of server) {
    try {
      if (req.url.startsWith(route)) {
        const url = req.url.slice(route.length);
        if (!isUrlAllowed(url, allowedUrls)) {
          req.respond({ status: 403, body: "403 Forbidden" });
          continue;
        }
        const cached = ttl.get(url);
        if (cached) {
          req.respond(cached);
          continue;
        }
        const response = await fetch(url);
        const text = await response.text();
        const headers = new Headers();
        headers.set("Access-Control-Allow-Origin", allowedOrigins);
        const resp = { body: text, headers };
        ttl.set(url, resp);
        req.respond(resp);
      } else {
        const resp = { status: 404, body: "404 Not Found" };
        ttl.set(url, resp);
        req.respond(resp);
      }
    } catch {
      req.respond({ status: 500, body: "500 Internal Server Error" });
    }
  }
}

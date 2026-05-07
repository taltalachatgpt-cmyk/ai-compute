export const config = { runtime: "edge" };

const TARGET_BASE = (process.env.ORIGIN_SERVICE || "").replace(/\/$/, "");

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-vercel-id",
  "x-vercel-proxy",
  "x-vercel-deployment",
  "x-vercel-cache"
]);

export default async function handler(req) {
  if (!TARGET_BASE) {
    return new Response("Service Unavailable", { status: 503 });
  }

  try {
    const urlObj = new URL(req.url);
    const targetPath = urlObj.pathname + urlObj.search;
    const targetUrl = TARGET_BASE + (targetPath === "/" ? "" : targetPath);

    const outHeaders = new Headers();
    let clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for");

    for (const [key, value] of req.headers) {
      const lowerKey = key.toLowerCase();
      if (STRIP_HEADERS.has(lowerKey)) continue;
      if (lowerKey.startsWith("x-vercel-")) continue;
      if (lowerKey === "x-real-ip" || lowerKey === "x-forwarded-for") continue;

      outHeaders.set(key, value);
    }

    if (clientIp) {
      outHeaders.set("x-forwarded-for", clientIp);
    }

    // اضافه کردن هدرهای طبیعی برای استتار بهتر
    outHeaders.set("x-request-id", "req_" + Math.random().toString(36).substring(2, 15));

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    const response = await fetch(targetUrl, {
      method,
      headers: outHeaders,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

  } catch (err) {
    console.error("Edge relay error:", err.message);
    return new Response("Service Temporarily Unavailable", { status: 503 });
  }
}
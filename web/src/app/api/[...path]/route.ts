import type { NextRequest } from "next/server";

import { isLocalRequest } from "@/lib/local-request";

/**
 * Relaie /api/* vers la gateway. Le navigateur ne parle qu'à l'interface,
 * la gateway reste sur le réseau interne de Docker.
 */
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

async function forward(request: NextRequest) {
  if (!isLocalRequest(request.method, request.headers.get("host"), request.headers.get("origin"))) {
    return Response.json({ detail: "Requête refusée : origine non locale." }, { status: 403 });
  }
  const target = `${API_URL}${request.nextUrl.pathname}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of ["content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ detail: "L'API ne répond pas. Vérifie que la stack tourne." }, { status: 502 });
  }
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST, forward as PUT };

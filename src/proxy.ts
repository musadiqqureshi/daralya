import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

const ACTIVITY_COOKIE = "erp_last_seen";
const TIMEOUT_COOKIE = "erp_timeout_min";

/**
 * Refreshes the Supabase session on every request and guards the ERP:
 * unauthenticated users go to the login page, idle sessions expire.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isErp = pathname.startsWith("/erp") && !pathname.startsWith("/erp/login");
  const isPrint = pathname.startsWith("/print");

  if (!isSupabaseConfigured) {
    if (isErp || isPrint) return NextResponse.redirect(new URL("/erp/login", request.url));
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run code between createServerClient and getClaims (session refresh happens here).
  // getClaims verifies the JWT locally with the project's public signing keys (no Auth round trip).
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  if (!isErp && !isPrint) return response;

  if (!user) {
    const login = new URL("/erp/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  // Inactivity timeout (minutes configured in Settings, mirrored into a cookie by the ERP layout)
  const now = Date.now();
  const timeoutMin = Number(request.cookies.get(TIMEOUT_COOKIE)?.value ?? 120);
  const lastSeen = Number(request.cookies.get(ACTIVITY_COOKIE)?.value ?? now);
  if (now - lastSeen > timeoutMin * 60_000) {
    await supabase.auth.signOut();
    const login = new URL("/erp/login", request.url);
    login.searchParams.set("expired", "1");
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.cookies.delete(ACTIVITY_COOKIE);
    return redirect;
  }
  response.cookies.set(ACTIVITY_COOKIE, String(now), { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/" });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

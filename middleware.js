import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Runs on every request. Its job is to keep the user's login session fresh
// by refreshing the auth token and passing the updated cookies along.
export async function middleware(request) {
  let response = NextResponse.next({ request });

  // The whole body is wrapped so a failed token refresh can never take the
  // site down — worst case the user just gets asked to log in again.
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error(
        `middleware: missing env — url:${!!url} key:${!!key}`
      );
      return response;
    }

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Touching getUser() is what triggers the token refresh.
    await supabase.auth.getUser();
  } catch (e) {
    console.error("middleware error:", e?.message || e);
  }

  return response;
}

export const config = {
  // Run on all routes except static assets and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

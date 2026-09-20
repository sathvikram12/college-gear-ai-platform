import { NextResponse, type NextRequest } from "next/server";

/**
 * Gives each browser its anonymous workspace cookie on the first page load (before any
 * API call), so parallel API requests all share one workspace. No login, no redirects.
 */
export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  if (!request.cookies.get("cg_workspace")?.value) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    res.cookies.set("cg_workspace", token, {
      httpOnly: true,
      // Must match cookieOptions() in src/server/auth.ts (kept in embedded preview frames).
      sameSite: "none",
      secure: true,
      partitioned: true,
      path: "/",
      maxAge: 365 * 86400,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|images|favicon.ico).*)"],
};

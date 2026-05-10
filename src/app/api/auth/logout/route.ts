import { clearSessionCookie, getSession } from "@/lib/auth";
import { ok } from "@/lib/api";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  const s = await getSession();
  if (s) {
    await audit({
      userId: s.id,
      action: "LOGOUT",
      entityType: "User",
      entityId: s.id,
    });
  }
  clearSessionCookie();
  return ok({ loggedOut: true });
}

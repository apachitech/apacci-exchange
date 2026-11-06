import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "apacci_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "client" | "admin";
  fullName: string;
}

export function encodeSessionCookie(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

export function decodeSessionCookie(raw: string | undefined): SessionPayload | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as Partial<SessionPayload>;
    if (
      parsed &&
      typeof parsed.userId === "string" &&
      typeof parsed.email === "string" &&
      (parsed.role === "client" || parsed.role === "admin")
    ) {
      return {
        userId: parsed.userId,
        email: parsed.email,
        role: parsed.role,
        fullName: parsed.fullName || "Utilisateur",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getServerSessionCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return decodeSessionCookie(raw);
}


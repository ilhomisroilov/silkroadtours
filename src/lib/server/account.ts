import "server-only";

/**
 * Traveller accounts live in the accounts service (the Python API). The site reaches it on the private
 * network at ACCOUNTS_API_URL and passes the visitor's sign-in cookie through; nothing here stores passwords.
 */
export const ACCOUNTS_API_URL = (process.env.ACCOUNTS_API_URL ?? "").replace(/\/$/, "");
export const ACCOUNT_COOKIE = "nt_session";

export interface Account {
  id: string;
  email: string;
  email_verified: boolean;
  full_name: string | null;
  phone: string | null;
}

/** The signed-in traveller for this request, or null (no cookie, signed out, or the service is unreachable). */
export async function currentAccount(cookieHeader: string | null): Promise<Account | null> {
  if (!ACCOUNTS_API_URL || !cookieHeader || !cookieHeader.includes(`${ACCOUNT_COOKIE}=`)) return null;
  try {
    const res = await fetch(`${ACCOUNTS_API_URL}/v1/me`, { headers: { cookie: cookieHeader, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const me = (await res.json()) as Account;
    return me && typeof me.id === "string" ? me : null;
  } catch {
    return null;
  }
}

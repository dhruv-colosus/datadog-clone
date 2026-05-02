import type { AuthUser } from "./store";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const authEndpoints = {
  login: `${API_URL}/auth/login`,
  register: `${API_URL}/auth/register`,
  me: `${API_URL}/auth/me`,
  logout: `${API_URL}/auth/logout`,
  config: `${API_URL}/auth/config`,
  testLogin: `${API_URL}/auth/test-login`,
};

export type AuthConfig = {
  test_auth_enabled: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  name: string;
};

async function parseAuthError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
      return String(body.detail[0].msg);
    }
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await fetch(authEndpoints.me, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Unauthenticated");
  }
  return res.json();
}

export async function logoutRequest(): Promise<void> {
  const res = await fetch(authEndpoints.logout, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Logout failed");
  }
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(authEndpoints.config, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load auth config");
  }
  return res.json();
}

export async function loginWithCredentials(input: LoginInput): Promise<AuthUser> {
  const res = await fetch(authEndpoints.login, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseAuthError(res, "Sign in failed"));
  }
  return res.json();
}

export async function registerWithCredentials(
  input: RegisterInput,
): Promise<AuthUser> {
  const res = await fetch(authEndpoints.register, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await parseAuthError(res, "Sign up failed"));
  }
  return res.json();
}

export async function loginWithTestUser(): Promise<AuthUser> {
  const res = await fetch(authEndpoints.testLogin, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Test login is not available");
  }
  return res.json();
}

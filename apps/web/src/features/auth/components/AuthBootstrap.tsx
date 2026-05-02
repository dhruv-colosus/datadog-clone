"use client";

import type { ReactNode } from "react";

import { useAuth } from "../hooks";

type AuthBootstrapProps = {
  children: ReactNode;
};

/**
 * Calls `useAuth` once to populate the Zustand store from `/auth/me`.
 * Mount at the root of an authenticated route group; children read from
 * `useAuthStore` directly without re-fetching.
 */
export function AuthBootstrap({ children }: AuthBootstrapProps) {
  useAuth();
  return <>{children}</>;
}

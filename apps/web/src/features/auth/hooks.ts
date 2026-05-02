"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchCurrentUser, logoutRequest } from "./api";
import { useAuthStore, type AuthUser } from "./store";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery<AuthUser, Error>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    } else if (query.isError) {
      setUser(null);
    }
  }, [query.data, query.isError, setUser]);

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);

  return useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      clear();
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      window.location.href = "/auth/sign-in";
    },
  });
}

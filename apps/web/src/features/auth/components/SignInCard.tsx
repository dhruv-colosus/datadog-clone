"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputBase,
  Stack,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BugReportRoundedIcon from "@mui/icons-material/BugReportRounded";

import {
  fetchAuthConfig,
  loginWithCredentials,
  loginWithTestUser,
  type AuthConfig,
} from "../api";
import { AUTH_QUERY_KEY } from "../hooks";
import type { AuthUser } from "../store";

const AUTH_CONFIG_QUERY_KEY = ["auth", "config"] as const;

const darkInputSx = {
  width: "100%",
  bgcolor: "rgba(0, 0, 0, 0.45)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 1,
  px: 2,
  py: 1.5,
  color: "#fff",
  fontSize: 15,
  "& input": {
    color: "#fff",
    p: 0,
    "&::placeholder": { color: "rgba(255, 255, 255, 0.55)", opacity: 1 },
  },
  "&:hover": { borderColor: "rgba(255, 255, 255, 0.18)" },
  "&.Mui-focused": { borderColor: "#5a9eff" },
};

export function SignInCard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const configQuery = useQuery<AuthConfig, Error>({
    queryKey: AUTH_CONFIG_QUERY_KEY,
    queryFn: fetchAuthConfig,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const onAuthSuccess = (user: AuthUser) => {
    queryClient.setQueryData(AUTH_QUERY_KEY, user);
    router.replace("/");
    router.refresh();
  };

  const loginMutation = useMutation({
    mutationFn: loginWithCredentials,
    onSuccess: onAuthSuccess,
  });

  const testLoginMutation = useMutation({
    mutationFn: loginWithTestUser,
    onSuccess: onAuthSuccess,
  });

  const testAuthEnabled = configQuery.data?.test_auth_enabled === true;
  const loginError = loginMutation.isError
    ? (loginMutation.error as Error).message
    : null;
  const testLoginError = testLoginMutation.isError
    ? (testLoginMutation.error as Error).message
    : null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        color: "#fff",
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          alignItems: "center",
          gap: { xs: 4, md: 6 },
          px: { xs: 3, sm: 6, md: 10 },
          py: { xs: 6, md: 8 },
          maxWidth: 1400,
          width: "100%",
          mx: "auto",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.svg"
            alt="Datadog"
            width={260}
            height={260}
            style={{ filter: "brightness(0) invert(1)" }}
          />

        </Box>

        <Box sx={{ width: "100%", maxWidth: 460, justifySelf: { md: "start" } }}>
          <Stack spacing={2.5}>
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography
                variant="h4"
                sx={{ fontWeight: 600, color: "#fff", fontSize: 28 }}
              >
                Log in to Datadog
              </Typography>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: "center",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 14,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <span aria-hidden>🇺🇸</span>
                <Typography component="span" sx={{ fontSize: 14 }}>
                  US1 - East
                </Typography>
                <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography sx={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>
                New user?
              </Typography>
              <Link
                href="/auth/sign-up"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 14,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Try for free <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </Link>
            </Stack>

            <Box
              component="button"
              type="button"
              sx={{
                color: "#5a9eff",
                background: "transparent",
                border: "none",
                p: 0,
                fontSize: 14,
                textAlign: "left",
                cursor: "pointer",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Using Single Sign-On?
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={1.5}>
                <InputBase
                  type="email"
                  autoComplete="email"
                  placeholder="Username/Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  sx={darkInputSx}
                />
                <InputBase
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  sx={darkInputSx}
                />
                {loginError && <Alert severity="error">{loginError}</Alert>}
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loginMutation.isPending}
                  sx={{
                    textTransform: "none",
                    fontWeight: 500,
                    fontSize: 15,
                    py: 1.25,
                    bgcolor: "#5a9eff",
                    "&:hover": { bgcolor: "#3d86eb" },
                    "&.Mui-disabled": { bgcolor: "rgba(90,158,255,0.5)", color: "#fff" },
                  }}
                  fullWidth
                >
                  {loginMutation.isPending ? "Logging in..." : "Log in"}
                </Button>
              </Stack>
            </Box>

            <Box
              component="button"
              type="button"
              sx={{
                color: "#5a9eff",
                background: "transparent",
                border: "none",
                p: 0,
                fontSize: 14,
                textAlign: "left",
                cursor: "pointer",
                alignSelf: "flex-start",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Forgot password?
            </Box>

            {configQuery.isLoading && (
              <Stack sx={{ alignItems: "center", py: 1 }}>
                <CircularProgress size={18} sx={{ color: "rgba(255,255,255,0.6)" }} />
              </Stack>
            )}

            {testAuthEnabled && (
              <>
                <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }}>
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    Local development only
                  </Typography>
                </Divider>
                <Button
                  onClick={() => testLoginMutation.mutate()}
                  disabled={testLoginMutation.isPending}
                  variant="outlined"
                  size="large"
                  startIcon={<BugReportRoundedIcon />}
                  sx={{
                    textTransform: "none",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.85)",
                    borderColor: "rgba(255,255,255,0.25)",
                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.5)",
                      bgcolor: "rgba(255,255,255,0.04)",
                    },
                  }}
                  fullWidth
                >
                  {testLoginMutation.isPending
                    ? "Signing in..."
                    : "Continue as test user"}
                </Button>
              </>
            )}
            {testLoginError && <Alert severity="error">{testLoginError}</Alert>}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          textAlign: "center",
          color: "rgba(255,255,255,0.55)",
          fontSize: 12,
          py: 2,
          px: 2,
        }}
      >
        Copyright Datadog, Inc. 2026 - 35.111034500 -{" "}
        <Box component="a" href="#" sx={footerLinkSx}>
          Master Subscription Agreement
        </Box>{" "}
        -{" "}
        <Box component="a" href="#" sx={footerLinkSx}>
          Privacy Policy
        </Box>{" "}
        -{" "}
        <Box component="a" href="#" sx={footerLinkSx}>
          Cookie Policy
        </Box>
      </Box>
    </Box>
  );
}

const footerLinkSx = {
  color: "#5a9eff",
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
} as const;

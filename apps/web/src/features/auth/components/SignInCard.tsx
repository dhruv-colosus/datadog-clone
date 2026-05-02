"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import BugReportRoundedIcon from "@mui/icons-material/BugReportRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import {
  fetchAuthConfig,
  loginWithCredentials,
  loginWithTestUser,
  type AuthConfig,
} from "../api";
import { AUTH_QUERY_KEY } from "../hooks";
import type { AuthUser } from "../store";

const AUTH_CONFIG_QUERY_KEY = ["auth", "config"] as const;

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
    <Card
      elevation={0}
      sx={{
        width: "100%",
        maxWidth: 420,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: "#e8f0fe",
                color: "#1a73e8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LockOutlinedIcon />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter your email and password to continue.
            </Typography>
          </Stack>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                size="medium"
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                size="medium"
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
                  bgcolor: "#1a73e8",
                  "&:hover": { bgcolor: "#0b57d0" },
                }}
                fullWidth
              >
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" style={{ color: "#1a73e8" }}>
              Sign up
            </Link>
          </Typography>

          {configQuery.isLoading && (
            <Stack sx={{ alignItems: "center", py: 1 }}>
              <CircularProgress size={18} />
            </Stack>
          )}

          {testAuthEnabled && (
            <>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Local development only
                </Typography>
              </Divider>
              <Stack spacing={1}>
                <Button
                  onClick={() => testLoginMutation.mutate()}
                  disabled={testLoginMutation.isPending}
                  variant="outlined"
                  size="large"
                  startIcon={<BugReportRoundedIcon />}
                  sx={{ textTransform: "none", fontWeight: 500 }}
                  fullWidth
                >
                  {testLoginMutation.isPending
                    ? "Signing in..."
                    : "Continue as test user"}
                </Button>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textAlign: "center" }}
                >
                  Bypasses the login form. Visible only when TEST_AUTH_ENABLED=true.
                </Typography>
              </Stack>
            </>
          )}

          {testLoginError && (
            <Alert severity="error">{testLoginError}</Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

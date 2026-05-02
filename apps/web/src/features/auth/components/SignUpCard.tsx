"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";

import { registerWithCredentials } from "../api";
import { AUTH_QUERY_KEY } from "../hooks";
import type { AuthUser } from "../store";

const PASSWORD_MIN_LENGTH = 8;

export function SignUpCard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: registerWithCredentials,
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
      router.replace("/");
      router.refresh();
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < PASSWORD_MIN_LENGTH) {
      setClientError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setClientError("Passwords do not match");
      return;
    }
    setClientError(null);
    registerMutation.mutate({ email, password, name });
  };

  const serverError = registerMutation.isError
    ? (registerMutation.error as Error).message
    : null;
  const error = clientError ?? serverError;

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
              <PersonAddAltRoundedIcon />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Create account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign up with your email and a password.
            </Typography>
          </Stack>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                helperText={`At least ${PASSWORD_MIN_LENGTH} characters`}
              />
              <TextField
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={registerMutation.isPending}
                sx={{
                  textTransform: "none",
                  fontWeight: 500,
                  bgcolor: "#1a73e8",
                  "&:hover": { bgcolor: "#0b57d0" },
                }}
                fullWidth
              >
                {registerMutation.isPending ? "Creating account..." : "Sign up"}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            Already have an account?{" "}
            <Link href="/auth/sign-in" style={{ color: "#1a73e8" }}>
              Sign in
            </Link>
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

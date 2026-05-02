"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";

import { registerWithCredentials } from "../api";
import { AUTH_QUERY_KEY } from "../hooks";
import type { AuthUser } from "../store";

const PASSWORD_MIN_LENGTH = 8;

const FEATURES = [
  {
    title: "Bring your IT data together",
    body:
      "Install our Agent and cloud integrations to bring metrics and events from your cloud and services in one place.",
  },
  {
    title: "Create real-time dashboards",
    body: "Graph and interact with the metrics and events you care about.",
  },
  {
    title: "Correlate metrics and events",
    body: "Graph and interact with the metrics and events you care about.",
  },
  {
    title: "Share it with your team",
    body: "Share what you see, remember what you did.",
  },
];

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#fff",
    fontSize: 14,
  },
  "& .MuiOutlinedInput-input": { py: 1.25 },
};

export function SignUpCard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [region, setRegion] = useState("us5");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
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
      setClientError(
        `Use at least ${PASSWORD_MIN_LENGTH} characters containing at least 1 number and 1 lowercase letter`,
      );
      return;
    }
    if (!/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setClientError(
        "Password must contain at least 1 number and 1 lowercase letter",
      );
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
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        maxWidth: 1100,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) 1.4fr" },
          gap: 0,
        }}
      >
        <Box
          sx={{
            p: { xs: 4, md: 6 },
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <Stack spacing={3}>
            {FEATURES.map((f) => (
              <Box key={f.title}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, fontSize: 17, color: "#212121" }}
                >
                  {f.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "#7f8c9a", mt: 0.5, fontSize: 14, lineHeight: 1.45 }}
                >
                  {f.body}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Box sx={{ mt: "auto", pt: 2 }}>
            <Box
              sx={{
                width: 96,
                height: 96,
                bgcolor: "#632ca6",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo.svg"
                alt="Datadog"
                width={72}
                height={72}
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            p: { xs: 4, md: 6 },
            borderLeft: { md: "1px solid" },
            borderColor: { md: "divider" },
          }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: "flex-start",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Typography
              variant="h4"
              sx={{ fontWeight: 600, color: "#212121", fontSize: 26 }}
            >
              Get Started with Datadog
            </Typography>
            <Link
              href="/auth/sign-in"
              style={{
                color: "#1f6feb",
                fontSize: 14,
                textDecoration: "none",
                whiteSpace: "nowrap",
                marginTop: 6,
              }}
            >
              Already have an account?
            </Link>
          </Stack>

          <Typography sx={{ color: "#212121", fontSize: 15, mb: 3 }}>
            Try it free for 14 days and monitor as many servers as you like.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.25}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#212121" }}>
                  Select a Region
                </Typography>
                <Typography sx={{ color: "#7f8c9a", fontSize: 13, mb: 1 }}>
                  Where do you want your data housed?
                </Typography>
                <Select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  IconComponent={KeyboardArrowDownIcon}
                  fullWidth
                  size="small"
                  sx={{ bgcolor: "#fff", fontSize: 14 }}
                >
                  <MenuItem value="us5">🇺🇸 United States (US5-Central)</MenuItem>
                  <MenuItem value="us1">🇺🇸 United States (US1-East)</MenuItem>
                  <MenuItem value="eu1">🇪🇺 Europe (EU1)</MenuItem>
                </Select>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: "center", mt: 1 }}
                >
                  <ReportProblemRoundedIcon sx={{ color: "#f5a623", fontSize: 18 }} />
                  <Typography sx={{ fontSize: 13, color: "#212121" }}>
                    <strong>Important:</strong> This can&apos;t be changed later
                  </Typography>
                </Stack>
              </Box>

              <Field label="Business Email" required>
                <TextField
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
              </Field>

              <Field label="Full Name" required>
                <TextField
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
              </Field>

              <Field label="Company" required>
                <TextField
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
              </Field>

              <Field label="Password" required>
                <TextField
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
                <Typography sx={{ fontSize: 12, color: "#7f8c9a", mt: 0.5 }}>
                  Use at least 8 characters containing at least 1 number and 1
                  lowercase letter
                </Typography>
              </Field>

              <Field label="Phone">
                <TextField
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                  size="small"
                  sx={fieldSx}
                />
              </Field>

              {error && <Alert severity="error">{error}</Alert>}

              <Divider />

              <Typography sx={{ fontSize: 13, color: "#212121" }}>
                *Required Fields. By signing up, you agree to the{" "}
                <Box component="a" href="#" sx={legalLinkSx}>
                  Master Subscription Agreement
                </Box>
                ,{" "}
                <Box component="a" href="#" sx={legalLinkSx}>
                  Privacy Policy
                </Box>
                , and{" "}
                <Box component="a" href="#" sx={legalLinkSx}>
                  Cookie Policy
                </Box>
              </Typography>

              <Divider />

              <Stack
                direction="row"
                sx={{ justifyContent: "flex-end", alignItems: "center" }}
              >
                <Button
                  type="submit"
                  variant="contained"
                  disabled={registerMutation.isPending}
                  sx={{
                    textTransform: "none",
                    fontWeight: 500,
                    bgcolor: "#1f6feb",
                    px: 4,
                    py: 1,
                    "&:hover": { bgcolor: "#155cc4" },
                  }}
                >
                  {registerMutation.isPending ? "Signing up..." : "Sign Up"}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#212121", mb: 0.75 }}>
        {label}
        {required && (
          <Box component="span" sx={{ color: "#d93025", ml: 0.5 }}>
            *
          </Box>
        )}
      </Typography>
      {children}
    </Box>
  );
}

const legalLinkSx = {
  color: "#1f6feb",
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
} as const;

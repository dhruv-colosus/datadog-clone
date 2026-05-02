import { Box } from "@mui/material";

import { SignInCard } from "@/features/auth/components/SignInCard";

export default function SignInPage() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 3 },
        py: { xs: 4, sm: 6 },
        bgcolor: "background.default",
      }}
    >
      <SignInCard />
    </Box>
  );
}

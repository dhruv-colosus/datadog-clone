import { Box } from "@mui/material";

import { SignUpCard } from "@/features/auth/components/SignUpCard";

export default function SignUpPage() {
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
      <SignUpCard />
    </Box>
  );
}

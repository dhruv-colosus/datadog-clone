import { Box } from "@mui/material";

import { SignUpCard } from "@/features/auth/components/SignUpCard";

export default function SignUpPage() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#f7f8fa",
        display: "flex",
        alignItems: { xs: "flex-start", md: "center" },
        justifyContent: "center",
        px: { xs: 2, sm: 3, md: 6 },
        py: { xs: 4, md: 6 },
      }}
    >
      <SignUpCard />
    </Box>
  );
}

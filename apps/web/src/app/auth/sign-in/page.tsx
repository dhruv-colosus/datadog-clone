import { Box } from "@mui/material";

import { SignInCard } from "@/features/auth/components/SignInCard";

export default function SignInPage() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        position: "relative",
        backgroundImage: "url(/images/loginbg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <SignInCard />
    </Box>
  );
}

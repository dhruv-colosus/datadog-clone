import { Box } from "@mui/material";

import { SignInCard } from "@/features/auth/components/SignInCard";

export default function SignInPage() {
  return (
    <Box
      data-testid="sign-in-page"
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

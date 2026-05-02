"use client";

import { useState, type MouseEvent } from "react";
import {
  Avatar,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";

import { useAuthStore } from "../store";
import { useLogout } from "../hooks";

type UserAvatarProps = {
  size?: number;
  showMenu?: boolean;
};

export function UserAvatar({ size = 32, showMenu = true }: UserAvatarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  const handleOpen = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const avatarEl = (
    <Avatar
      src={user?.picture ?? undefined}
      alt={user?.name ?? "Account"}
      slotProps={{ img: { referrerPolicy: "no-referrer" } }}
      sx={{
        width: size,
        height: size,
        bgcolor: "#1a73e8",
        border: "2px solid #fff",
        boxShadow: "0 0 0 2px #EA4335",
        fontSize: size * 0.45,
      }}
    >
      {initial}
    </Avatar>
  );

  if (!showMenu) return avatarEl;

  return (
    <>
      <Tooltip title={user?.name ?? "Account"}>
        <IconButton
          onClick={handleOpen}
          sx={{ ml: 0.5, p: 0.5 }}
          aria-label="Account menu"
        >
          {avatarEl}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: { sx: { mt: 1, minWidth: 240, borderRadius: 2 } },
        }}
      >
        <MenuItem disabled sx={{ opacity: "1 !important" }}>
          <ListItemIcon>
            <AccountCircleRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                {user?.name ?? "Guest"}
              </Typography>
            }
            secondary={
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {user?.email ?? ""}
              </Typography>
            }
          />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleClose();
            logout.mutate();
          }}
          disabled={logout.isPending}
        >
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Sign out" />
        </MenuItem>
      </Menu>
    </>
  );
}

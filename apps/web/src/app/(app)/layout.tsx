import { ReactNode } from "react";
import { AuthBootstrap } from "@/features/auth";
import { CommandPalette } from "@/features/command-palette";
import { Sidebar } from "@/features/sidebar";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AuthBootstrap>
      <div className="flex h-screen w-screen overflow-hidden bg-white">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <CommandPalette />
    </AuthBootstrap>
  );
}

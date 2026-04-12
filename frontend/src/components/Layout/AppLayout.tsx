import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-spotify-dark text-spotify-white overflow-hidden">
      <main className="flex-1 relative overflow-hidden">{children}</main>
    </div>
  );
}

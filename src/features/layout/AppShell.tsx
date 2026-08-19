"use client";

import { useEffect, useState } from "react";
import { UnlockGate } from "@/features/layout/UnlockGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/certificates", { credentials: "include" })
      .then((res) => {
        setBlocked(res.status === 401);
        setChecked(true);
      })
      .catch(() => {
        setChecked(true);
      });
  }, []);

  if (!checked) {
    return <p className="text-center p-10 text-gray-500">불러오는 중...</p>;
  }

  return (
    <UnlockGate blocked={blocked} onUnlocked={() => setBlocked(false)}>
      {children}
    </UnlockGate>
  );
}

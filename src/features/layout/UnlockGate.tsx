"use client";

import { useState } from "react";
import { ApiAccessError } from "@/repositories/QuestionRepository";

interface UnlockGateProps {
  children: React.ReactNode;
  blocked: boolean;
  onUnlocked: () => void;
}

export function UnlockGate({ children, blocked, onUnlocked }: UnlockGateProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!blocked) return <>{children}</>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        setError("접근 키가 올바르지 않다.");
        return;
      }
      onUnlocked();
    } catch {
      setError("접근 키 확인에 실패했다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm w-full">
        <h1 className="text-xl font-bold">PassFlow 접근</h1>
        <p className="text-sm text-gray-600">테스트용 접근 키를 입력해달라.</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="border rounded px-3 py-2"
          placeholder="접근 키"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !key}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-40"
        >
          {loading ? "확인 중..." : "입장"}
        </button>
      </form>
    </div>
  );
}

export function isApiAccessError(err: unknown): err is ApiAccessError {
  return err instanceof ApiAccessError;
}

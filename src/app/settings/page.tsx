"use client";

import { useEffect, useState } from "react";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { IndexedDbSettingsRepository } from "@/repositories/SettingsRepository";
import { parseBackup, serializeBackup } from "@/lib/backup";
import { isStorageFallbackActive } from "@/repositories/storageFallback";
import { DEFAULT_SETTINGS, type ReviewOrder, type Settings, type TimeoutBehavior } from "@/types/settings";
import type { Mode } from "@/types/progress";

const settingsRepository = new IndexedDbSettingsRepository();
const progressRepository = new IndexedDbProgressRepository();

const TIMEOUT_LABEL: Record<TimeoutBehavior, string> = {
  wrong: "오답처리",
  warn: "경고만",
  ignore: "무시",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    settingsRepository.getSettings().then(
      (result) => setSettings(result),
      (err) => {
        console.error("getSettings failed:", err);
        setSettings(DEFAULT_SETTINGS);
      }
    );
  }, []);

  function update(next: Settings) {
    const prev = settings;
    setSettings(next);
    settingsRepository.updateSettings(next).catch((err) => {
      console.error("updateSettings failed:", err);
      setSettings(prev);
    });
  }

  function handleReset() {
    if (!window.confirm("모든 풀이 기록·오답노트·즐겨찾기를 지운다. 되돌릴 수 없다. 계속할까?")) return;
    progressRepository.resetAll().then(
      () => setResetDone(true),
      (err) => console.error("resetAll failed:", err)
    );
  }

  async function handleExport() {
    setExportError(null);
    try {
      const [attempts, wrongNotes, favorites, currentSettings] = await Promise.all([
        progressRepository.getAttempts(),
        progressRepository.getWrongNotes(),
        progressRepository.getFavorites(),
        settingsRepository.getSettings(),
      ]);
      const questionIds = [...new Set(attempts.map((a) => a.questionId))];
      const questionStats = await Promise.all(
        questionIds.map((id) => progressRepository.getQuestionStats(id))
      );
      if (isStorageFallbackActive()) {
        setExportError("IndexedDB에 접근할 수 없어 내보내기를 할 수 없다. 브라우저 저장소 상태를 확인한 뒤 다시 시도해달라.");
        return;
      }
      const json = serializeBackup({
        attempts,
        questionStats,
        wrongNotes,
        favorites,
        settings: currentSettings,
      });
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("handleExport failed:", err);
      setExportError("내보내기에 실패했다. 다시 시도해달라.");
    }
  }

  async function handleImport(file: File) {
    setImportMessage(null);
    setImporting(true);
    try {
      const text = await file.text();
      const backup = parseBackup(text);
      if (!backup) {
        setImportMessage("백업 파일 형식이 올바르지 않다.");
        return;
      }
      await progressRepository.importBackup({
        attempts: backup.attempts,
        wrongNotes: backup.wrongNotes,
        favorites: backup.favorites,
        settings: backup.settings,
      });
      setSettings(backup.settings);
      setImportMessage("가져오기 완료됐다.");
    } catch (err) {
      console.error("handleImport failed:", err);
      setImportMessage("가져오기에 실패했다. 다시 시도해달라.");
    } finally {
      setImporting(false);
    }
  }

  if (!settings) {
    return <p className="text-center p-10">불러오는 중...</p>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold">설정</h1>

      <div className="flex flex-col gap-2">
        <span className="font-medium">학습</span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.autoSaveWrongNotes}
            onChange={(e) => update({ ...settings, autoSaveWrongNotes: e.target.checked })}
          />
          오답 자동저장 (학습모드)
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">기본 문제풀이 모드</span>
        <div className="flex gap-2">
          {(["study", "exam"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={settings.defaultMode === m}
              onClick={() => update({ ...settings, defaultMode: m })}
              className={`px-3 py-1.5 rounded border ${settings.defaultMode === m ? "bg-black text-white" : ""}`}
            >
              {m === "study" ? "학습모드" : "시험모드"}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          ※ 값만 저장됨 — 시험모드 화면이 추가되면 자동 적용된다.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">시험모드 시간초과 처리</span>
        <div className="flex gap-2">
          {(["wrong", "warn", "ignore"] as TimeoutBehavior[]).map((behavior) => (
            <button
              key={behavior}
              type="button"
              aria-pressed={settings.timeoutBehavior === behavior}
              onClick={() => update({ ...settings, timeoutBehavior: behavior })}
              className={`px-3 py-1.5 rounded border ${settings.timeoutBehavior === behavior ? "bg-black text-white" : ""}`}
            >
              {TIMEOUT_LABEL[behavior]}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          ※ 값만 저장됨 — 시험모드 화면이 추가되면 자동 적용된다.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">복습 다시풀기 순서</span>
        <div className="flex gap-2">
          {(["sequential", "random"] as ReviewOrder[]).map((order) => (
            <button
              key={order}
              type="button"
              aria-pressed={settings.reviewOrder === order}
              onClick={() => update({ ...settings, reviewOrder: order })}
              className={`px-3 py-1.5 rounded border ${settings.reviewOrder === order ? "bg-black text-white" : ""}`}
            >
              {order === "sequential" ? "순차" : "랜덤"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">데이터</span>
        <button
          type="button"
          onClick={handleExport}
          className="self-start px-3 py-1.5 rounded border"
        >
          백업 내보내기
        </button>
        {exportError && <p className="text-sm text-red-700">{exportError}</p>}

        <label
          className={`self-start px-3 py-1.5 rounded border ${importing ? "opacity-50" : "cursor-pointer"}`}
        >
          백업 가져오기
          <input
            type="file"
            accept="application/json"
            className="hidden"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-gray-400">
          ※ 기존 데이터에 병합된다. 완전히 같은 풀이 기록은 다시 가져와도 중복 저장되지 않는다.
        </p>
        {importMessage && <p className="text-sm text-gray-700">{importMessage}</p>}

        <button
          type="button"
          onClick={handleReset}
          className="self-start px-3 py-1.5 rounded border border-red-600 text-red-600"
        >
          전체 기록 초기화
        </button>
        {resetDone && <p className="text-sm text-green-700">초기화됐다.</p>}
      </div>
    </div>
  );
}

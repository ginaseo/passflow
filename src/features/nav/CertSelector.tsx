"use client";

import { useEffect, useState } from "react";
import { getSelectedCertId, setSelectedCertId, type CertInfo } from "@/lib/cert";

export function CertSelector() {
  const [certs, setCerts] = useState<CertInfo[]>([]);
  const [certId] = useState<string>(() => getSelectedCertId());

  useEffect(() => {
    fetch("/api/certificates", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`certificates API 요청 실패: ${res.status}`);
        return res.json() as Promise<CertInfo[]>;
      })
      .then(setCerts)
      .catch((err) => console.error("certificates API 로드 실패:", err));
  }, []);

  // 자격증이 하나뿐이면 선택지를 보여줄 필요가 없다.
  if (certs.length < 2) return null;

  return (
    <div className="flex gap-1 text-sm">
      {certs.map((cert) => (
        <button
          key={cert.id}
          type="button"
          disabled={cert.id === certId}
          onClick={() => setSelectedCertId(cert.id)}
          className={`px-2 py-1 rounded border ${
            cert.id === certId ? "bg-black text-white" : "text-gray-500"
          }`}
        >
          {cert.label}
        </button>
      ))}
    </div>
  );
}

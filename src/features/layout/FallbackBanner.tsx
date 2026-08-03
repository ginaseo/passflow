"use client";

import { useEffect, useState } from "react";
import { isStorageFallbackActive, subscribeStorageFallback } from "@/repositories/storageFallback";

export function FallbackBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isStorageFallbackActive());
    return subscribeStorageFallback(() => setActive(true));
  }, []);

  if (!active) return null;

  return (
    <div className="bg-yellow-100 text-yellow-900 text-sm text-center py-2 px-4">
      이 브라우저에서는 일부 데이터가 안전하게 저장되지 않을 수 있습니다(시크릿/프라이빗 모드이거나 저장공간이 부족할 수 있습니다).
    </div>
  );
}

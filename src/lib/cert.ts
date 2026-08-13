const CERT_STORAGE_KEY = "pf_cert";
const DEFAULT_CERT_ID = "jcg";

export interface CertInfo {
  id: string;
  label: string;
}

export function getSelectedCertId(): string {
  if (typeof window === "undefined") return DEFAULT_CERT_ID;
  try {
    return window.localStorage.getItem(CERT_STORAGE_KEY) ?? DEFAULT_CERT_ID;
  } catch {
    // 시크릿모드 등 localStorage가 막힌 환경 — 기본 자격증으로 폴백한다.
    return DEFAULT_CERT_ID;
  }
}

// 자격증 전환은 데이터 소스 자체가 바뀌는 무거운 전환이라, 여러 컴포넌트에 걸친
// 반응형 상태 대신 페이지 새로고침으로 모든 module-level repository 인스턴스를
// 한 번에 새로 만든다.
export function setSelectedCertId(certId: string): void {
  try {
    window.localStorage.setItem(CERT_STORAGE_KEY, certId);
  } catch {
    // 저장에 실패했으면 새로고침해도 선택이 반영되지 않으니 이동하지 않는다.
    return;
  }
  window.location.href = "/";
}

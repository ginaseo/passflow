const CERT_STORAGE_KEY = "pf_cert";
const DEFAULT_CERT_ID = "jcg";

export interface CertInfo {
  id: string;
  label: string;
}

export function getSelectedCertId(): string {
  if (typeof window === "undefined") return DEFAULT_CERT_ID;
  return window.localStorage.getItem(CERT_STORAGE_KEY) ?? DEFAULT_CERT_ID;
}

// 자격증 전환은 데이터 소스 자체가 바뀌는 무거운 전환이라, 여러 컴포넌트에 걸친
// 반응형 상태 대신 페이지 새로고침으로 모든 module-level repository 인스턴스를
// 한 번에 새로 만든다.
export function setSelectedCertId(certId: string): void {
  window.localStorage.setItem(CERT_STORAGE_KEY, certId);
  window.location.href = "/";
}

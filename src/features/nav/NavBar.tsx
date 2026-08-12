"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/practice", label: "문제풀이" },
  { href: "/review", label: "복습" },
  { href: "/dashboard", label: "대시보드" },
  { href: "/settings", label: "설정" },
] as const;

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 px-6 py-3 border-b text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? "page" : undefined}
          className={pathname === link.href ? "font-bold" : "text-gray-500"}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

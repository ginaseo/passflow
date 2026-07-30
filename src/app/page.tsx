import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">PassFlow</h1>
      <Link
        href="/practice"
        className="px-6 py-3 rounded bg-blue-600 text-white font-medium"
      >
        문제풀이 시작 (학습모드)
      </Link>
    </div>
  );
}

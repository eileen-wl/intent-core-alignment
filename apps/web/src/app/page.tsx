import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Intent Core Alignment System</h1>
      <p>
        Engineering skeleton. No role-aware product views are implemented yet.
      </p>
      <p>
        <Link href="/shots">View Shots (manual-input smoke test)</Link>
      </p>
    </main>
  );
}

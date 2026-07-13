import { fetchShots } from "@/lib/api-client";

export default async function ShotsPage() {
  const shots = await fetchShots();

  return (
    <main>
      <h1>Shots</h1>
      <p>
        Proves apps/web talking to apps/api talking to Postgres and back. Create
        shots via <code>POST /projects</code> then <code>POST /shots</code> on
        the API — there is no create form here yet.
      </p>
      {shots.length === 0 ? (
        <p>No shots yet.</p>
      ) : (
        <ul>
          {shots.map((shot) => (
            <li key={shot.id}>
              {shot.name} <small>({shot.source})</small>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

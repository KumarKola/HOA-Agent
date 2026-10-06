export default function SetupNotice() {
  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <h1 className="brand">
        <small>Liberty Gates</small>
        Almost ready
      </h1>
      <div className="card step">
        <h2>No database connected yet</h2>
        <p style={{ margin: 0 }}>
          In the Vercel project, open <b>Storage</b>, create a Postgres database (Neon or Supabase) and connect it to this project.
          Then redeploy. The tables are created automatically on the first visit.
        </p>
      </div>
    </main>
  );
}

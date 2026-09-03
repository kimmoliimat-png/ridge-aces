import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <main className="mx-auto max-w-xl px-6 py-10 text-sm leading-relaxed text-fg">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">Ridge Aces</p>
      <h1 className="font-display mb-4 text-3xl tracking-wide">Privacy</h1>
      <p className="text-muted">
        Ridge Aces is a single-player offline game. It does not collect accounts, location, or
        advertising identifiers. Progress and settings stay on this device in local storage. There
        are no ads and no analytics SDKs.
      </p>
      <p className="mt-4 text-muted">
        If you install the app, the browser may keep a cached copy for offline play. Clearing site
        data removes your high score and unlocks.
      </p>
      <Link to="/" className="mt-8 inline-block underline decoration-border underline-offset-4">
        Back to the hangar
      </Link>
    </main>
  );
}

import { Button } from '@pratto/ui';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Pratto</p>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Seu cardápio em movimento.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-300">
            A fundação técnica está pronta para receber o catálogo, a publicação versionada e o feed
            visual mobile-first.
          </p>
        </div>
        <div>
          <Button type="button">Explorar fundação</Button>
        </div>
      </div>
    </main>
  );
}

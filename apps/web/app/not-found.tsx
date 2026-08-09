import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cardápio não encontrado',
  description: 'O cardápio solicitado não está disponível.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-12 text-center text-white">
      <div className="max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300">Pratto</p>
        <h1 className="mt-4 text-3xl font-bold">Cardápio não encontrado</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          O estabelecimento pode ter sido removido ou o endereço informado não existe.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          href="/"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

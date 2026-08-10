import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cardápio não encontrado',
  description: 'O cardápio solicitado não está disponível.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-6 py-12 text-center text-ink">
      <div className="max-w-md">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-ink font-serif text-2xl text-cream">
          P
        </div>
        <div className="mx-auto my-7 h-px w-12 bg-line" />
        <h1 className="font-serif text-[34px] leading-tight">Cardápio não encontrado</h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-soft">
          O estabelecimento pode ter sido removido ou o endereço informado não existe.
        </p>
        <Link
          className="mt-7 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-ink-soft"
          href="/"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PlansPage from '../app/plans/page';

describe('plans page', () => {
  it('states that commercial plans are undefined while Pratto remains a portfolio project', () => {
    render(<PlansPage />);

    expect(
      screen.getByRole('heading', { name: /planos comerciais ainda não definidos/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Projeto de portfólio', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/não apresenta pacotes, preços ou condições/i)).toBeInTheDocument();
    expect(screen.queryByText(/preço em breve|essencial|presença|inteligência/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Voltar ao projeto' })).toHaveAttribute('href', '/');
  });
});

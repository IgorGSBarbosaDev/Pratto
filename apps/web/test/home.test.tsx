import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('home page', () => {
  it('communicates the product promise and primary navigation', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: /transforme seu cardápio em uma experiência/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sobre o projeto' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Entrar' })[0]).toHaveAttribute('href', '/login');
    expect(
      screen
        .getAllByRole('link', { name: 'Projeto' })
        .some((link) => link.getAttribute('href') === '#projeto'),
    ).toBe(true);
    expect(screen.getByText(/não há cadastro ou operação comercial/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Termos' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', '/privacy');
  });
});

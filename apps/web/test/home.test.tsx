import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('home page', () => {
  it('communicates the product promise and primary navigation', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: /transforme seu cardápio em uma experiência/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /ver planos/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Entrar' })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByRole('button', { name: /ver comparação completa/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Termos' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', '/privacy');
  });
});

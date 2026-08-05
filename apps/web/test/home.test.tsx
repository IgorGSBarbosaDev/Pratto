import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../app/page';

describe('home page', () => {
  it('communicates that Pratto is ready for the product foundation', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /seu cardápio em movimento/i })).toBeInTheDocument();
  });
});

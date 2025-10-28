/// <reference types="vitest" />
/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ThreeCards from '@/components/three/ThreeCards';

describe('ThreeCards', () => {
  it('bottom hint is hidden before assets ready (simulated)', async () => {
    render(<ThreeCards />);
    expect(screen.queryByText(/Hover to choose/i)).not.toBeInTheDocument();
  });
});

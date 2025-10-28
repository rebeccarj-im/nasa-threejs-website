// tests/component/DonkiOverlay.spec.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DonkiOverlay from '@/components/overlay/DonkiOverlay';

const baseItem = {
  id: 'flare-1',
  kind: 'FLR',
  title: 'Flare X1.2',
  startTime: '2024-01-02T03:04:05Z',
  peakTime: null,
  endTime: null,
  classType: 'X1.2',
  speed: null,
  direction: null,
  sourceLocation: 'N12W33',
  instruments: ['GOES'],
  link: null,
  preview: null,
  note: 'hello world',
  sources: { apiHref: null, detailHref: null },
};

describe('DonkiOverlay', () => {
  it('renders details & notes', async () => {
    render(<DonkiOverlay open item={baseItem as any} onClose={() => {}} />);
    expect(screen.getByText('Flare X1.2')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('hello world')).toBeInTheDocument();

    // wait for short-link ready to avoid act warning (setup.ts mocks fetch)
    await screen.findByRole('button', { name: /Copy/i });
  });

  it('enables Copy after short link is created and writes to clipboard', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    render(<DonkiOverlay open item={baseItem as any} onClose={() => {}} />);

    // wait for short link created
    const copyBtn = await screen.findByRole('button', { name: /Copy/i });
    expect(copyBtn).toBeEnabled();

    // click and expect clipboard write
    fireEvent.click(copyBtn);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
  });

  it('clicking the mask (dialog container) triggers onClose', async () => {
    const onClose = vi.fn();
    render(<DonkiOverlay open item={baseItem as any} onClose={onClose} />);

    // get the outer container with role="dialog"
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });
});

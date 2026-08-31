import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UpcomingTimeline from '../UpcomingTimeline';
import { getDocs } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  documentId: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
}));

describe('UpcomingTimeline', () => {
  const mockGetDocs = getDocs as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (useSearchParams as any).mockReturnValue({
      get: (param: string) => {
        if (param === 'q') return '';
        return null;
      },
    });

    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'test-1',
          data: () => ({
            artistName: 'ALPHADRIVEONE',
            albumTitle: 'BORN DIRE',
            releaseDate: '2026-08-24T12:00:00',
            artistType: 'group',
            artistGender: 'male',
            releaseType: 'mini',
            sourceLink: 'http://example.com',
          }),
        },
        {
          id: 'test-2',
          data: () => ({
            artistName: 'FUTURE IDOL',
            albumTitle: 'Future',
            releaseDate: '2026-09-01T12:00:00',
            artistType: 'group',
            artistGender: 'female',
            releaseType: 'single',
            sourceLink: 'http://example.com',
          }),
        },
      ],
    });
  });

  it('renders upcoming comebacks correctly', async () => {
    render(<UpcomingTimeline />);
    
    await waitFor(() => {
      expect(screen.getByText('ALPHADRIVEONE')).toBeDefined();
      expect(screen.getByText('FUTURE IDOL')).toBeDefined();
    });
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalendarGrid from '../CalendarGrid';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDocs } from 'firebase/firestore';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: {},
}));

describe('CalendarGrid', () => {
  const mockPush = vi.fn();
  const mockGetDocs = getDocs as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useSearchParams as any).mockReturnValue({
      get: (param: string) => {
        if (param === 'y') return '2026';
        if (param === 'm') return '8'; // August
        if (param === 'q') return '';
        return null;
      },
    });

    // Mock Firestore response
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'test-1',
          data: () => ({
            artistName: 'BIGBANG',
            albumTitle: 'BiiiG',
            releaseDate: '2026-08-19T12:00:00',
            artistType: 'group',
            artistGender: 'male',
            releaseType: 'single',
            confidenceTier: 'A',
            sourceLink: 'http://example.com',
          }),
        },
        {
          id: 'test-2',
          data: () => ({
            artistName: 'OURBIRTHDAY',
            albumTitle: 'Our Birthday',
            releaseDate: '2026-08-19T12:00:00',
            artistType: 'group',
            artistGender: 'female',
            releaseType: 'single',
            confidenceTier: 'A',
            sourceLink: 'http://example.com',
          }),
        },
      ],
    });
  });

  it('renders the calendar header correctly', async () => {
    render(<CalendarGrid />);
    expect(screen.getByText(/August 2026/i)).toBeDefined();
  });

  it('fetches and displays comebacks on the correct dates', async () => {
    render(<CalendarGrid />);
    
    await waitFor(() => {
      expect(screen.getByText('BIGBANG')).toBeDefined();
      expect(screen.getByText('OURBIRTHDAY')).toBeDefined();
    });
  });

  it('navigates to previous month when Prev is clicked', () => {
    render(<CalendarGrid />);
    const prevBtn = screen.getByText(/Prev/i);
    fireEvent.click(prevBtn);
    expect(mockPush).toHaveBeenCalledWith('/?q=&y=2026&m=7');
  });

  it('navigates to next month when Next is clicked', () => {
    render(<CalendarGrid />);
    const nextBtn = screen.getByText(/Next/i);
    fireEvent.click(nextBtn);
    expect(mockPush).toHaveBeenCalledWith('/?q=&y=2026&m=9');
  });

  it('filters by artistType (Group)', async () => {
    // Add a solo artist to mock response
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'test-1',
          data: () => ({
            artistName: 'BIGBANG',
            artistType: 'group',
            releaseDate: '2026-08-19T12:00:00',
            sourceLink: 'http://example.com',
          }),
        },
        {
          id: 'test-2',
          data: () => ({
            artistName: 'Solo Artist',
            artistType: 'solo',
            releaseDate: '2026-08-19T12:00:00',
            sourceLink: 'http://example.com',
          }),
        },
      ],
    });

    render(<CalendarGrid />);
    await waitFor(() => {
      expect(screen.getByText('BIGBANG')).toBeDefined();
    });

    const groupBtn = screen.getByText('Group');
    fireEvent.click(groupBtn);

    await waitFor(() => {
      expect(screen.queryByText('Solo Artist')).toBeNull();
      expect(screen.getByText('BIGBANG')).toBeDefined();
    });
  });

  it('filters by artistGender (Female)', async () => {
    render(<CalendarGrid />);
    await waitFor(() => {
      expect(screen.getByText('BIGBANG')).toBeDefined();
      expect(screen.getByText('OURBIRTHDAY')).toBeDefined();
    });

    const femaleBtn = screen.getByText('여성 (여돌/솔로)');
    fireEvent.click(femaleBtn);

    await waitFor(() => {
      expect(screen.queryByText('BIGBANG')).toBeNull();
      expect(screen.getByText('OURBIRTHDAY')).toBeDefined();
    });
  });
});

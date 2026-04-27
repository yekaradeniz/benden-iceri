import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postToInstagram } from '../src/postToInstagram.js';

describe('postToInstagram', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a media container then publishes it', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'container-123' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'post-456' })
      });
    vi.stubGlobal('fetch', mockFetch);

    const result = await postToInstagram({
      igUserId: 'IG_USER',
      accessToken: 'TOKEN_X',
      imageUrl: 'https://example.com/img.png',
      caption: 'A caption'
    });

    expect(result.postId).toBe('post-456');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall[0]).toContain('IG_USER/media');
    expect(firstCall[0]).toContain('access_token=TOKEN_X');
    expect(firstCall[0]).toContain('image_url=https');
    const secondCall = mockFetch.mock.calls[1];
    expect(secondCall[0]).toContain('IG_USER/media_publish');
    expect(secondCall[0]).toContain('creation_id=container-123');
  });

  it('throws when container creation fails', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad image URL' } })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(postToInstagram({
      igUserId: 'X', accessToken: 'Y',
      imageUrl: 'bad', caption: 'c'
    })).rejects.toThrow(/Bad image URL/);
  });

  it('throws when publish fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'container-1' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'IG server error' } })
      });
    vi.stubGlobal('fetch', mockFetch);

    await expect(postToInstagram({
      igUserId: 'X', accessToken: 'Y',
      imageUrl: 'u', caption: 'c'
    })).rejects.toThrow(/IG server error/);
  });
});

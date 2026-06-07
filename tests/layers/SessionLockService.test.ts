// v0.2b:
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionLockService } from '../../src/layers/L9-dreaming/SessionLockService.js';

describe('SessionLockService', () => {
  beforeEach(() => {
    SessionLockService.clear();
  });

  describe('C1a — atomic tryAcquire', () => {
    it('tryAcquire returns true for free vault', () => {
      expect(SessionLockService.tryAcquire('/vault1', 's1')).toBe(true);
      expect(SessionLockService.getHolder('/vault1')).toBe('s1');
    });

    it('tryAcquire returns false if already locked', () => {
      SessionLockService.tryAcquire('/vault1', 's1');
      expect(SessionLockService.tryAcquire('/vault1', 's2')).toBe(false);
    });

    it('concurrent tryAcquire only one succeeds', async () => {
      const vault = '/vault-concurrent';
      const results: boolean[] = [];
      const promises = Array.from({ length: 10 }, async (_, i) => {
        const acquired = SessionLockService.tryAcquire(vault, `s${i}`);
        results.push(acquired);
      });
      await Promise.all(promises);
      expect(results.filter(Boolean).length).toBe(1);
    });
  });

  describe('C1b — TTL / stale locks', () => {
    it('isLocked returns false after TTL expires', () => {
      const originalNow = Date.now;
      const start = originalNow();
      let mockTime = start;
      global.Date.now = () => mockTime;

      SessionLockService.tryAcquire('/vault-ttl', 's1');
      expect(SessionLockService.isLocked('/vault-ttl')).toBe(true);

      mockTime = start + 31 * 60 * 1000;
      expect(SessionLockService.isLocked('/vault-ttl')).toBe(false);

      global.Date.now = originalNow;
    });

    it('tryAcquire overwrites stale lock', () => {
      const originalNow = Date.now;
      const start = originalNow();
      let mockTime = start;
      global.Date.now = () => mockTime;

      SessionLockService.tryAcquire('/vault-stale', 'old');
      mockTime = start + 31 * 60 * 1000;
      expect(SessionLockService.tryAcquire('/vault-stale', 'new')).toBe(true);
      expect(SessionLockService.getHolder('/vault-stale')).toBe('new');

      global.Date.now = originalNow;
    });

    it('isStale returns true after timeout', () => {
      const originalNow = Date.now;
      const start = originalNow();
      let mockTime = start;
      global.Date.now = () => mockTime;

      SessionLockService.tryAcquire('/vault-stale2', 's1');
      expect(SessionLockService.isStale('/vault-stale2', 1000)).toBe(false);
      mockTime = start + 2000;
      expect(SessionLockService.isStale('/vault-stale2', 1000)).toBe(true);

      global.Date.now = originalNow;
    });
  });

  it('release only removes matching sessionId', () => {
    SessionLockService.tryAcquire('/vault-rel', 's1');
    expect(SessionLockService.release('/vault-rel', 's2')).toBe(false);
    expect(SessionLockService.isLocked('/vault-rel')).toBe(true);
    expect(SessionLockService.release('/vault-rel', 's1')).toBe(true);
    expect(SessionLockService.isLocked('/vault-rel')).toBe(false);
  });

  it('clear removes all locks', () => {
    SessionLockService.tryAcquire('/a', 's1');
    SessionLockService.tryAcquire('/b', 's2');
    SessionLockService.clear();
    expect(SessionLockService.isLocked('/a')).toBe(false);
    expect(SessionLockService.isLocked('/b')).toBe(false);
  });
});

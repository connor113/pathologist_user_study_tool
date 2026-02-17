import { describe, it, expect } from 'vitest';
import { isRetryableError } from '../api';

describe('isRetryableError', () => {
  it('retries on "Failed to fetch"', () => {
    expect(isRetryableError(new Error('Failed to fetch'))).toBe(true);
  });

  it('retries on "NetworkError"', () => {
    expect(isRetryableError(new Error('NetworkError when attempting to fetch resource'))).toBe(true);
  });

  it('retries on "Unable to connect"', () => {
    expect(isRetryableError(new Error('Unable to connect'))).toBe(true);
  });

  it('retries on 500 server error', () => {
    const err = new Error('Internal Server Error');
    (err as any).statusCode = 500;
    expect(isRetryableError(err)).toBe(true);
  });

  it('retries on 503 service unavailable', () => {
    const err = new Error('Service Unavailable');
    (err as any).statusCode = 503;
    expect(isRetryableError(err)).toBe(true);
  });

  it('does NOT retry on 400 bad request', () => {
    const err = new Error('Bad Request');
    (err as any).statusCode = 400;
    expect(isRetryableError(err)).toBe(false);
  });

  it('does NOT retry on 401 unauthorized', () => {
    const err = new Error('Unauthorized');
    (err as any).statusCode = 401;
    expect(isRetryableError(err)).toBe(false);
  });

  it('does NOT retry on 404 not found', () => {
    const err = new Error('Not Found');
    (err as any).statusCode = 404;
    expect(isRetryableError(err)).toBe(false);
  });

  it('does NOT retry on unknown errors', () => {
    expect(isRetryableError(new Error('Something weird happened'))).toBe(false);
  });

  it('does NOT retry on errors without message or statusCode', () => {
    expect(isRetryableError({})).toBe(false);
  });
});

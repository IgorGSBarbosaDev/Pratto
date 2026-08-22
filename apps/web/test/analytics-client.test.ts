import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicMenuAnalyticsClient } from '../features/public-menu/analytics-client';

const context = {
  establishmentPublicId: 'cafe-aurora-local',
  publicationId: '11111111-1111-4111-8111-111111111111',
};

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: vi.fn().mockReturnValue(false),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PublicMenuAnalyticsClient', () => {
  it('creates a session, persists it per establishment and sends bounded batches', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
        if (String(input).includes('/sessions')) {
          return jsonResponse({
            sessionId: '22222222-2222-4222-8222-222222222222',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          });
        }
        expect(options?.credentials).toBe('omit');
        return jsonResponse({ results: [] });
      });
    vi.stubGlobal('fetch', fetchMock);
    const client = new PublicMenuAnalyticsClient();

    client.start(context);
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/sessions')),
      ).toHaveLength(1),
    );
    for (let index = 0; index < 10; index += 1) client.track({ eventType: 'menu_opened' });

    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/events')),
      ).toHaveLength(1),
    );
    const eventCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/events'));
    const eventBody = JSON.parse(String(eventCall?.[1]?.body)) as {
      sessionId: string;
      events: unknown[];
    };
    expect(eventBody.sessionId).toBe('22222222-2222-4222-8222-222222222222');
    expect(eventBody.events).toHaveLength(10);
    expect(window.localStorage.getItem('pratto_analytics_session:cafe-aurora-local')).toContain(
      eventBody.sessionId,
    );
  });

  it('uses sendBeacon on page shutdown and does not throw when analytics is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const sendBeacon = navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>;
    const client = new PublicMenuAnalyticsClient();

    expect(() => {
      client.start(context);
      client.track({ eventType: 'menu_opened' });
      client.stop();
    }).not.toThrow();
    expect(sendBeacon).not.toHaveBeenCalled();

    const beaconClient = new PublicMenuAnalyticsClient();
    const sessionResponse = jsonResponse({
      sessionId: '33333333-3333-4333-8333-333333333333',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(sessionResponse));
    sendBeacon.mockReturnValue(true);
    beaconClient.start(context);
    await vi.waitFor(() => expect(window.localStorage.length).toBe(1));
    beaconClient.track({ eventType: 'menu_opened' });
    beaconClient.stop();
    await vi.waitFor(() => expect(sendBeacon).toHaveBeenCalledTimes(1));
  });

  it('flushes a contact event immediately without blocking the caller', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/sessions')) {
        return jsonResponse({
          sessionId: '44444444-4444-4444-8444-444444444444',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        });
      }
      return jsonResponse({ results: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new PublicMenuAnalyticsClient();

    client.start(context);
    await vi.waitFor(() => expect(window.localStorage.length).toBe(1));
    client.track({ eventType: 'contact_clicked', contactType: 'phone' });
    client.flushNow();

    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/events')),
      ).toHaveLength(1),
    );
    const eventCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/events'));
    expect(String(eventCall?.[1]?.body)).toContain('contact_clicked');
    expect(String(eventCall?.[1]?.body)).toContain('phone');
  });
});

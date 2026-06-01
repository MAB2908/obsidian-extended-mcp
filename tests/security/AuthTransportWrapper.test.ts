// v0.1b:
import { describe, it, expect } from 'vitest';
import { AuthTransportWrapper } from '../../src/security/AuthTransportWrapper.js';

class MockTransport {
  messages: unknown[] = [];
  errors: unknown[] = [];
  onmessage?: (message: unknown) => void;

  async send(message: unknown): Promise<void> {
    this.messages.push(message);
  }
}

describe('AuthTransportWrapper', () => {
  it('allows initialize without token', () => {
    const transport = new MockTransport() as unknown as import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport;
    let received = false;
    transport.onmessage = () => { received = true; };

    const wrapper = new AuthTransportWrapper(transport, () => ({ valid: false, reason: 'missing' }));
    wrapper.wrap();

    (transport as unknown as MockTransport).onmessage!({ method: 'initialize', id: 1, params: {} });
    expect(received).toBe(true);
    expect((transport as unknown as MockTransport).messages).toHaveLength(0);
  });

  it('blocks tools/list without token', () => {
    const transport = new MockTransport() as unknown as import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport;
    let received = false;
    transport.onmessage = () => { received = true; };

    const wrapper = new AuthTransportWrapper(transport, () => ({ valid: false, reason: 'missing' }));
    wrapper.wrap();

    (transport as unknown as MockTransport).onmessage!({ method: 'tools/list', id: 2, params: {} });
    expect(received).toBe(false);
    const messages = (transport as unknown as MockTransport).messages;
    expect(messages.length).toBe(1);
    const response = messages[0] as { error: { code: number; message: string } };
    expect(response.error.code).toBe(-32001);
  });

  it('allows requests when token is valid', () => {
    const transport = new MockTransport() as unknown as import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport;
    let received = false;
    transport.onmessage = () => { received = true; };

    const wrapper = new AuthTransportWrapper(transport, () => ({ valid: true }));
    wrapper.wrap();

    (transport as unknown as MockTransport).onmessage!({
      method: 'tools/call', id: 1, params: { _meta: { authToken: 'valid-token' } },
    });

    expect(received).toBe(true);
    expect((transport as unknown as MockTransport).messages).toHaveLength(0);
  });

  it('blocks requests when token is invalid', () => {
    const transport = new MockTransport() as unknown as import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport;
    let received = false;
    transport.onmessage = () => { received = true; };

    const wrapper = new AuthTransportWrapper(transport, () => ({ valid: false, reason: 'bad token' }));
    wrapper.wrap();

    (transport as unknown as MockTransport).onmessage!({
      method: 'tools/call', id: 2, params: { _meta: { authToken: 'invalid-token' } },
    });

    expect(received).toBe(false);
    const messages = (transport as unknown as MockTransport).messages;
    expect(messages.length).toBe(1);
    const response = messages[0] as { error: { code: number; message: string } };
    expect(response.error.code).toBe(-32001);
    expect(response.error.message).toContain('Unauthorized');
  });
});

// Copyright 2026 Qore Technologies, s.r.o.
// The URL builders `query()` and `ReqraftWebSocket` request with — and that
// story mocks are built from, so a mock always names the URL the code dials.
import { buildReqraftApiUrl } from '../src/utils/fetch';
import { buildReqraftSocketUrl } from '../src/utils/websocket';

describe('buildReqraftApiUrl', () => {
  it('joins the path onto the instance under api/latest/', () => {
    expect(buildReqraftApiUrl('https://host:8092/', 'system?action=expressions&context=ui')).toBe(
      'https://host:8092/api/latest/system?action=expressions&context=ui'
    );
  });

  it('normalises a leading slash rather than doubling it', () => {
    // This used to assert `api/latest//system/...` — the doubled slash a caller
    // writing its path with a leading `/` produced. `reqraftApiPath()` normalises
    // it now, so the same call reaches one URL however the caller spells it.
    expect(buildReqraftApiUrl('https://host:8092/', '/system/qorus-type-info')).toBe(
      'https://host:8092/api/latest/system/qorus-type-info'
    );
  });

  it('returns the url untouched when the caller owns the whole of it', () => {
    // `noApiPrefix` means an absolute address for ANOTHER service, so the
    // instance must not be prepended: doing so built
    // `https://host:8092/https://other/...`. The old expectation encoded that bug.
    expect(
      buildReqraftApiUrl('https://host:8092/', 'https://other:8080/provider/expressions', true)
    ).toBe('https://other:8080/provider/expressions');
  });
});

describe('buildReqraftSocketUrl', () => {
  it('switches https to wss and drops the instance trailing slash', () => {
    expect(buildReqraftSocketUrl('https://host:8092/', 'lsp')).toBe('wss://host:8092/lsp');
  });

  it('switches http to ws for an instance without a trailing slash', () => {
    expect(buildReqraftSocketUrl('http://localhost:8011', 'log-test')).toBe(
      'ws://localhost:8011/log-test'
    );
  });

  it('carries the token in the query only when there is one', () => {
    expect(buildReqraftSocketUrl('https://host:8092/', 'lsp', 'abc')).toBe(
      'wss://host:8092/lsp?token=abc'
    );
    expect(buildReqraftSocketUrl('https://host:8092/', 'lsp', '')).toBe('wss://host:8092/lsp');
    expect(buildReqraftSocketUrl('https://host:8092/', 'lsp', undefined)).toBe(
      'wss://host:8092/lsp'
    );
  });
});

// Copyright 2026 Qore Technologies, s.r.o.
// A value that is a web address is drawn as a link to it; nothing else is (qorus#646).
import { describe, expect, it } from 'vitest';
import { webLinkOf } from '../src/helpers/webLink';

describe('the web address a value is', () => {
  it('is the value, when the whole of it is an http or https address', () => {
    expect(webLinkOf('https://orders.example.com/api/v2/fulfilment/batches?region=eu-west')).toBe(
      'https://orders.example.com/api/v2/fulfilment/batches?region=eu-west'
    );
    expect(webLinkOf('http://localhost:8080/')).toBe('http://localhost:8080/');
  });

  it('is the value without the space around it', () => {
    expect(webLinkOf('  https://example.com/a  ')).toBe('https://example.com/a');
  });

  it('is none for another scheme: a javascript link would run its script', () => {
    expect(webLinkOf('javascript:alert(1)')).toBeUndefined();
    expect(webLinkOf('JavaScript://example.com/%0Aalert(1)')).toBeUndefined();
    expect(webLinkOf('data:text/html,<b>hi</b>')).toBeUndefined();
    expect(webLinkOf('ftp://example.com/file')).toBeUndefined();
    expect(webLinkOf('mailto:someone@example.com')).toBeUndefined();
  });

  it('is none for text that only mentions an address, or has a space in it', () => {
    expect(webLinkOf('see https://example.com')).toBeUndefined();
    expect(webLinkOf('https://example.com/a b')).toBeUndefined();
  });

  it('is none for what is not an absolute address', () => {
    expect(webLinkOf('/api/v2/orders')).toBeUndefined();
    expect(webLinkOf('example.com')).toBeUndefined();
    expect(webLinkOf('https://')).toBeUndefined();
    expect(webLinkOf('')).toBeUndefined();
    expect(webLinkOf(undefined)).toBeUndefined();
    expect(webLinkOf(42)).toBeUndefined();
  });
});

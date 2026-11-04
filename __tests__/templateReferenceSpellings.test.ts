// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A reference is named the same whichever way it is spelled, and with where it is (qorus#646, David's decisions):
 * the catalogue spells a Qog state's data `$data:{a.b}`, the language server completes it as `$data:a.b`; a chip
 * says the data it is part of before its name, the start and the end of a long path, and its hover the whole path.
 */
import { describe, expect, it } from 'vitest';
import { QOG_FIELD_TEMPLATES } from '../src/components/form/fields/template/__fixtures__/qogTemplatePayloads';
import { describeTemplateReference } from '../src/helpers/templates';

describe('describeTemplateReference', () => {
  it('names a reference in either spelling by its catalogue row', () => {
    for (const written of ['$data:{receive_order.event_type}', '$data:receive_order.event_type']) {
      expect(describeTemplateReference(QOG_FIELD_TEMPLATES, written)).toMatchObject({
        label: 'Receive order › Event type',
        path: 'Receive order › Event type',
      });
    }
  });

  it('says the start and the end of a long path, and the whole path as its hover', () => {
    expect(
      describeTemplateReference(QOG_FIELD_TEMPLATES, '$data:{receive_order.customer.address.city}')
    ).toMatchObject({
      label: 'Receive order › … › Address › City',
      path: 'Receive order › Customer › Address › City',
    });
  });

  it('names context data by its name, the group that only gathers it in its hover', () => {
    expect(describeTemplateReference(QOG_FIELD_TEMPLATES, '$timestamp:now')).toMatchObject({
      label: 'Current Timestamp',
      path: 'Context Data › Current Timestamp',
    });
  });

  it('names a reference no catalogue lists by its path', () => {
    expect(describeTemplateReference(QOG_FIELD_TEMPLATES, '$data:{gone.away}')).toEqual({
      label: 'gone.away',
    });
  });
});

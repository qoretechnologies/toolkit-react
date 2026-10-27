// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import {
  dpqlTemplateContext,
  qorusTemplateCompletions,
  qorusTemplateContexts,
  qorusTemplateValues,
} from '../src/stories/qorusTemplateContexts';

const names = (context?: Parameters<typeof qorusTemplateContexts>[0]) =>
  qorusTemplateContexts(context).map(({ name }) => name);

/**
 * The stories' stand-in servers offer the contexts and values Qorus offers (Qorus `QorusClientServer::
 * listTemplateContexts`, `listTemplateValues`; `QorusLspWebSocketHandler::buildDpqlTemplateContext`), so that a
 * story shows what a real field of its interface shows (qorus#646, David's decision).
 */
describe("the stories' Qorus template contexts", () => {
  it('a workflow has its own contexts and no job, service or record ones', () => {
    const wf = names({ interface_type: 'wf' });
    for (const name of [
      'static',
      'dynamic',
      'sensitive',
      'sensitive-alias',
      'temp',
      'step',
      'keys',
      'pstate',
      'info',
    ]) {
      expect(wf, name).toContain(name);
    }
    for (const name of ['jinfo', 'state', 'record']) {
      expect(wf, name).not.toContain(name);
    }
  });

  it("a service has `state`, a job `state` and `jinfo`; neither a workflow's", () => {
    expect(names({ interface_type: 'svc' })).toContain('state');
    expect(names({ interface_type: 'svc' })).not.toContain('jinfo');
    expect(names({ interface_type: 'job' })).toEqual(expect.arrayContaining(['state', 'jinfo']));
    for (const type of ['svc', 'job'] as const) {
      expect(names({ interface_type: type })).not.toContain('static');
      expect(names({ interface_type: type })).not.toContain('dynamic');
    }
  });

  it('a Qog has no workflow, job or service contexts, nor `pstate` or `info`; it keeps `data`', () => {
    const fsm = names({ interface_type: 'fsm' });
    for (const name of ['static', 'dynamic', 'keys', 'jinfo', 'state', 'pstate', 'info']) {
      expect(fsm, name).not.toContain(name);
    }
    expect(fsm).toEqual(
      expect.arrayContaining(['data', 'config', 'local', 'timestamp', 'transient'])
    );
  });

  it('a record expression has `record`; a sandboxed user no `env`, `python-expr`, `rest` or `sysprop`', () => {
    expect(names({ interface_type: 'fsm', record_expression: true })).toContain('record');
    const sandboxed = names({ sandboxed: true });
    for (const name of ['env', 'python-expr', 'rest', 'sysprop']) {
      expect(sandboxed, name).not.toContain(name);
    }
    expect(sandboxed).toContain('qore-expr');
    expect(names()).not.toContain('record');
  });

  it('a DPQL document is completed as a Qog: a record expression with its state data', () => {
    expect(dpqlTemplateContext()).toEqual({ interface_type: 'fsm', record_expression: true });
    expect(names(dpqlTemplateContext())).not.toContain('dynamic');
    expect(names(dpqlTemplateContext())).toContain('record');
  });

  it('lists the values Qorus knows: the timestamps, a loop, state data where it is bound; none of free keys', () => {
    expect(qorusTemplateValues('timestamp', '')?.map(({ name }) => name)).toEqual([
      'now',
      'timegm',
      'last_midnight',
      'next_midnight',
    ]);
    expect(qorusTemplateValues('foreach', '')?.map(({ name }) => name)).toEqual([
      'value',
      'index',
      'size',
    ]);
    expect(qorusTemplateValues('static', '')).toBeUndefined();
    expect(qorusTemplateValues('dynamic', '')).toBeUndefined();
    expect(qorusTemplateValues('data', '')).toBeUndefined();
    const stateData = {
      receive_order: {
        display_name: 'Receive order',
        items: [{ name: 'event_type', display_name: 'Event type' }],
      },
    };
    expect(
      qorusTemplateValues('data', 'rec', { state_data: stateData })?.map(({ name }) => name)
    ).toEqual(['receive_order']);
    expect(
      qorusTemplateValues('data', 'receive_order.e', { state_data: stateData })?.map(
        ({ name }) => name
      )
    ).toEqual(['receive_order.event_type']);
  });

  it('completes a template being written as DpqlCompletionProvider does', () => {
    expect(
      qorusTemplateCompletions('$ti', dpqlTemplateContext()).map(({ label }) => label)
    ).toEqual(['$timestamp:']);
    expect(qorusTemplateCompletions('$dyn', dpqlTemplateContext())).toEqual([]);
    expect(
      qorusTemplateCompletions('$timestamp:n', dpqlTemplateContext()).map(
        ({ insertText }) => insertText
      )
    ).toEqual(['$timestamp:now', '$timestamp:next_midnight']);
  });
});

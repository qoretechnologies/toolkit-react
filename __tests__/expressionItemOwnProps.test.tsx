/**
 * An expression item's own props (`isChild`, `isAndOr`, `index`, `readOnly`) style it and decide its actions,
 * and stop there (qorus#646).
 *
 * ExpressionItem read them, then spread every prop into its styled element, which the builder renders
 * `as={ReqorePanel}`. A styled element rendered as a component forwards everything, so the panel received
 * props it does not take, and `readOnly` was written onto the panel's `<div>` as `readonly`. The same pattern
 * put reqraft's menu `activePaths` on a router link's `<a>`.
 */
import { ReqorePanel, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExpressionItem } from '../src/components/form/expressions/builder/item';

const OWN_PROPS = ['readonly', 'ischild', 'isandor', 'index'];

const attributesIn = (root: Element) => {
  const names = new Set<string>();
  root
    .querySelectorAll('*')
    .forEach((el) => Array.from(el.attributes).forEach(({ name }) => names.add(name)));
  return names;
};

const styles = () =>
  Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText))
    .concat(Array.from(document.querySelectorAll('style')).map((style) => style.textContent ?? ''))
    .join('\n');

describe("an expression item's own props", () => {
  it('never reach the DOM of the panel it is drawn as', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <ExpressionItem as={ReqorePanel} isChild isAndOr index={0} readOnly label='Condition'>
          <span>operand</span>
        </ExpressionItem>
      </ReqoreUIProvider>
    );
    const attributes = attributesIn(container);
    expect(OWN_PROPS.filter((name) => attributes.has(name))).toEqual([]);
  });

  it('still draw a child item its connector to the parent', () => {
    render(
      <ReqoreUIProvider>
        <ExpressionItem as={ReqorePanel} isChild index={1} label='Operand'>
          <span>operand</span>
        </ExpressionItem>
      </ReqoreUIProvider>
    );
    // a child that is not the first is joined at its bottom, 11px up (an and/or item is joined halfway)
    expect(styles()).toMatch(/::before\s*\{[^}]*bottom:\s*11px[^}]*left:\s*-10px/);
  });
});

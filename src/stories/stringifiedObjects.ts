// Copyright 2026 Qore Technologies, s.r.o.
/**
 * `[object Object]` is what a structured value forced through `String()` reads as - the fact that a value
 * is an object, never the value. A story that must never show it watches the document from before it
 * renders, so a render that showed it only until the next one (a field drawn as the wrong type for its
 * first render) is caught too: a final look finds nothing by then, and neither does a look at what was
 * added, once a later render has replaced it - so what was taken out, and what a text read before it
 * changed, are looked at as well.
 */
export const STRINGIFIED_OBJECT = '[object Object]';

/** The attributes a stringified value would be read through. */
const VISIBLE_ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt', 'value'];

export interface IStringifiedObjectWatch {
  /** Each place it was shown, as it was added: the element's tag and classes, and the text. */
  readonly hits: string[];
  /** Stops watching. */
  stop: () => void;
}

const describe = (node: Node, text: string): string => {
  const element = node instanceof Element ? node : node.parentElement;
  const className =
    element && typeof element.className === 'string' ?
      `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
    : '';
  return `<${element?.tagName.toLowerCase() ?? '#text'}${className}> ${text.trim().slice(0, 120)}`;
};

/** Watches the document for `[object Object]` in text or a visible attribute, from now until `stop`. */
export const watchForStringifiedObjects = (root: Node = document.body): IStringifiedObjectWatch => {
  const hits: string[] = [];
  const check = (node: Node | null) => {
    if (!node) {
      return;
    }
    const text = node.textContent ?? '';
    if (text.includes(STRINGIFIED_OBJECT)) {
      hits.push(describe(node, text));
    }
  };
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === 'childList') {
        record.addedNodes.forEach(check);
        // a node taken out again was in the document: what it held was shown, however briefly
        record.removedNodes.forEach(check);
      } else if (record.type === 'characterData') {
        // what it read before it changed too: by the time this runs, a text the next render rewrote
        // reads as what it was rewritten to
        if (record.oldValue?.includes(STRINGIFIED_OBJECT)) {
          hits.push(describe(record.target, record.oldValue));
        }
        check(record.target);
      } else if (record.type === 'attributes' && record.attributeName) {
        const value = (record.target as Element).getAttribute(record.attributeName);
        if (value?.includes(STRINGIFIED_OBJECT)) {
          hits.push(describe(record.target, `${record.attributeName}: ${value}`));
        }
      }
    });
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    characterDataOldValue: true,
    attributes: true,
    attributeFilter: VISIBLE_ATTRIBUTES,
  });

  return { hits, stop: () => observer.disconnect() };
};

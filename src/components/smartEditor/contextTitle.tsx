// Copyright 2026 Qore Technologies, s.r.o.
import { ReactNode } from 'react';

/** A template context written to go on into it (`$foreach:`): a row's title for one needs a value after it. */
const CONTEXT_NEEDING_A_VALUE = /^\$[\w-]+:$/;

/** Whether a row's title is a template context that needs a value after it (`$foreach:`, not `$foreach:*`). */
export const titleNeedsAValue = (title: string): boolean => CONTEXT_NEEDING_A_VALUE.test(title);

/**
 * A row's title, a context that needs a value after it marked so (qorus#646, David: "titles like '$foreach:' should
 * read '$foreach:...' to show the user that the template requires a value after"): `$foreach:` and an italic "…",
 * which is drawn only - what the row writes is the context as it is.
 */
export const rowTitle = (title: string): ReactNode =>
  titleNeedsAValue(title) ?
    <span className='template-context-title'>
      {title}
      <em className='template-context-needs-value' title='a value is written after it'>
        …
      </em>
    </span>
  : title;

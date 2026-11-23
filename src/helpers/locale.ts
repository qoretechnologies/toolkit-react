// Copyright 2026 Qore Technologies, s.r.o.
import { resolveLocale } from '@qoretechnologies/reqore';

/**
 * The language the page is read in, as a tag `Intl` can format with: the page's own (`<html lang>`, which a host sets
 * to its interface language), else the browser's. `undefined` where neither names one `Intl` can use (Intl's own
 * default then). A POSIX name a browser reports (`en-US@posix`) is read as the tag it stands for (Reqore's
 * `resolveLocale`), never handed to `Intl` raw, where it throws.
 */
export const pageLocale = (): string | undefined =>
  resolveLocale(
    typeof document !== 'undefined' ? document.documentElement.lang : undefined,
    typeof navigator !== 'undefined' ? navigator.language : undefined
  );

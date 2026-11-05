// Copyright 2026 Qore Technologies, s.r.o.
import { Fragment, ReactNode } from 'react';

/** A hint's words as they are drawn: what they mark with `**` is bold. Written so, a language keeps its word order. */
export const renderBoldWords = (words: string): ReactNode =>
  words
    .split('**')
    .map((part, index) =>
      index % 2 ? <b key={index}>{part}</b> : <Fragment key={index}>{part}</Fragment>
    );

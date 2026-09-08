// Copyright 2026 Qore Technologies, s.r.o.
// React access to the shared DPQL detection probe (`dpqlProbe`). The hook
// itself opens nothing: a field becomes a consumer of the shared document
// only once it actually asks a question, and stops being one when it
// unmounts. A form full of fields that never see expression-shaped text
// therefore never opens the document at all.
import { useCallback, useEffect, useRef } from 'react';
import { dpqlProbe, IDpqlProbeResult } from './dpqlProbe';

export type TDpqlProbeFn = (text: string) => Promise<IDpqlProbeResult>;

export const useDpqlProbe = (): TDpqlProbeFn => {
  const acquired = useRef(false);

  useEffect(
    () => () => {
      if (acquired.current) {
        acquired.current = false;
        dpqlProbe.release();
      }
    },
    []
  );

  return useCallback((text: string): Promise<IDpqlProbeResult> => {
    if (!acquired.current) {
      acquired.current = true;
      dpqlProbe.acquire();
    }

    return dpqlProbe.parse(text);
  }, []);
};

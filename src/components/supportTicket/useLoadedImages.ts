import { useEffect, useState } from 'react';

/* What is known about each image URL, shared by every surface for the life of
   the page: an image that loaded once is drawn at once the next time, and one
   that failed is not tried again on every render. */
const imageStatus = new Map<string, 'loaded' | 'failed'>();
const pending = new Map<string, Promise<void>>();

const loadImage = (src: string): Promise<void> => {
  let promise = pending.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => {
        imageStatus.set(src, 'loaded');
        resolve();
      };
      image.onerror = () => {
        imageStatus.set(src, 'failed');
        resolve();
      };
      image.src = src;
    }).finally(() => pending.delete(src));
    pending.set(src, promise);
  }
  return promise;
};

/**
 * Which of `sources` have loaded. An icon that has an image draws its font icon
 * until this says the image loaded, and keeps the font icon when it fails — the
 * image is never drawn as a broken picture or an empty box.
 *
 * One hook for a whole list, so a component that maps over references (or a
 * `ReqoreMenu`, which clones its children and so cannot hold per-item hooks)
 * asks once.
 */
export const useLoadedImages = (sources: Array<string | undefined>): ((src?: string) => boolean) => {
  const [, setVersion] = useState(0);
  const key = sources.filter(Boolean).join('\u0000');

  useEffect(() => {
    let active = true;
    const unknown = Array.from(new Set(sources.filter((src): src is string => !!src))).filter(
      (src) => !imageStatus.has(src)
    );
    unknown.forEach((src) => {
      loadImage(src).then(() => {
        if (active) {
          setVersion((version) => version + 1);
        }
      });
    });
    return () => {
      active = false;
    };
  }, [key]);

  return (src?: string) => !!src && imageStatus.get(src) === 'loaded';
};

/**
 * Resolves once `src` has loaded or failed — so a test or story can check the
 * settled state instead of waiting an arbitrary time.
 */
export const whenImageSettled = (src: string): Promise<void> =>
  imageStatus.has(src) ? Promise.resolve() : loadImage(src);

/** Forget every image's status. For tests only. */
export const resetLoadedImagesForTests = (): void => {
  imageStatus.clear();
  pending.clear();
};

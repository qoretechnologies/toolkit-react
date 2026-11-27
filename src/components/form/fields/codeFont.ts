import { IReqoreEffect } from '@qoretechnologies/reqore/dist/components/Effect';

/**
 * The effect a text box holding CODE or DATA is drawn with: Reqore's monospace face.
 *
 * Reqore 0.79 draws a textarea in the page's font, as prose, and leaves monospace to the
 * fields that ask for it (per use, not everywhere). Reqraft's own code
 * boxes ask here: the YAML / JSON editor of a hash or a list, a binary or `data` value,
 * and a template's example value. A consumer's `effect` is kept, its `fontFamily`
 * included, so a host can still choose another face.
 */
export const withCodeFont = (effect?: IReqoreEffect): IReqoreEffect => ({
  fontFamily: 'mono',
  ...effect,
});

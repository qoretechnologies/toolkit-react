// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreIcon } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';

/** The class of a choice's picture, drawn beside its name. */
export const CHOICE_PICTURE_CLASS = 'choice-picture';

/**
 * A choice's picture (a language's logo) beside its name, for a radio or a check box that keeps its own mark.
 *
 * Reqore draws a choice given an `image` with the picture in place of its radio or box, chosen in color and the
 * others gray, so color alone said which was chosen: hard to see, and not seen at all by a reader who does not
 * tell colors apart (qorus#646, David: "the radio buttons are missing"). The picture goes beside the name, and the
 * choice keeps the mark that says it is chosen - a filled radio, a ticked box - which is a shape, not a color.
 */
export const pictureBesideTheName = (image: unknown, size?: TSizes) =>
  typeof image === 'string' && image ?
    {
      image: undefined,
      labelDetail: (
        <ReqoreIcon
          className={CHOICE_PICTURE_CLASS}
          image={image}
          size={size === 'tiny' || size === 'small' ? '16px' : '20px'}
          margin='right'
        />
      ),
      labelDetailPosition: 'left' as const,
    }
  : {};

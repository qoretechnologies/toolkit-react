// Copyright 2026 Qore Technologies, s.r.o.
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
      /* A plain picture in a square, scaled to fit: logos are not square (Qore 106x128, Python 129x128, Java
         96x128), and a reqore icon fills its width and clips what is taller, as the IDE's radio field found. */
      labelDetail: (
        <span className={CHOICE_PICTURE_CLASS} style={{ display: 'inline-flex', marginRight: 6 }}>
          <img
            src={image}
            alt=''
            style={{
              width: size === 'tiny' || size === 'small' ? 16 : 20,
              height: size === 'tiny' || size === 'small' ? 16 : 20,
              objectFit: 'contain',
            }}
          />
        </span>
      ),
      labelDetailPosition: 'left' as const,
    }
  : {};

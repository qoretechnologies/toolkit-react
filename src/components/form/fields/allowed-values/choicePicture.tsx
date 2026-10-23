// Copyright 2026 Qore Technologies, s.r.o.
import {
  GAP_FROM_SIZE,
  PADDING_FROM_SIZE,
  TSizes,
} from '@qoretechnologies/reqore/dist/constants/sizes';

/** The class of a choice's picture, drawn beside its name. */
export const CHOICE_PICTURE_CLASS = 'choice-picture';

/**
 * The gap on either side of a choice's picture: radio to picture, and picture to name, the same (qorus#646, David:
 * "the spacing between the circle and the icon needs to be the same as between the icon and the name"). Wide
 * enough that the radio's focus ring, drawn 2px out from it and 2px wide, keeps clear of the picture.
 */
export const CHOICE_PICTURE_GAP = 10;

/** Whether a choice is the one chosen, another one while one is chosen, or one of a group where none is. */
export type TChoicePictureState = 'chosen' | 'other' | 'none';

/**
 * A choice's picture (a language's logo) beside its name, for a radio or a check box that keeps its own mark.
 *
 * Reqore draws a choice given an `image` with the picture in place of its radio or box, chosen in color and the
 * others gray, so color alone said which was chosen: hard to see, and not seen at all by a reader who does not
 * tell colors apart (qorus#646, David: "the radio buttons are missing"). The picture goes beside the name, and the
 * choice keeps the mark that says it is chosen - a filled radio, a ticked box - which is a shape, not a color.
 * Once one is chosen the others' pictures are gray, the chosen one's in color: a second sign, the shape the first.
 *
 * Laid out against the checkbox reqore draws (`size` is the size it draws the choice at): the space after the radio
 * is reqore's padding for the size and the space after the picture the name row's gap, and the picture's margins
 * make each up to `CHOICE_PICTURE_GAP`. It takes no height of its own in the name's row (its negative margins), so
 * the row is as tall as the name, and it is centered on it: the name is centered on the picture.
 */
export const pictureBesideTheName = (
  image: unknown,
  size: TSizes = 'normal',
  state: TChoicePictureState = 'none'
) => {
  if (typeof image !== 'string' || !image) {
    return {};
  }
  const side = size === 'micro' || size === 'tiny' || size === 'small' ? 16 : 20;
  return {
    image: undefined,
    /* A plain picture in a square, scaled to fit: logos are not square (Qore 106x128, Python 129x128, Java
       96x128), and a reqore icon fills its width and clips what is taller, as the IDE's radio field found. */
    labelDetail: (
      <span
        className={`${CHOICE_PICTURE_CLASS} ${CHOICE_PICTURE_CLASS}-${state}`}
        style={{
          display: 'inline-flex',
          alignSelf: 'center',
          marginTop: -side / 2,
          marginBottom: -side / 2,
          marginLeft: CHOICE_PICTURE_GAP - PADDING_FROM_SIZE[size],
          marginRight: CHOICE_PICTURE_GAP - GAP_FROM_SIZE.normal,
        }}
      >
        <img
          src={image}
          alt=''
          style={{
            width: side,
            height: side,
            objectFit: 'contain',
            filter: state === 'other' ? 'grayscale(1)' : undefined,
          }}
        />
      </span>
    ),
    labelDetailPosition: 'left' as const,
  };
};

/** The state of a choice's picture: chosen, another while one is chosen, or one of a group where none is. */
export const choicePictureState = (isChosen: boolean, anyChosen: boolean): TChoicePictureState =>
  isChosen ? 'chosen'
  : anyChosen ? 'other'
  : 'none';

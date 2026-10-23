import { ReqoreTag, ReqoreTagGroup } from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { memo } from 'react';
import {
  getTemplateTagStyle,
  describeTemplateReference,
  REFERENCE_CHIP_PROPS,
  templateTooltip,
  TTemplateMeta,
} from '../../../../helpers/templates';
import { useDescriptionTooltips } from '../../../../helpers/descriptionTooltip';
import { useTypeSentenceForm } from '../../typeSentenceForm';
import {
  hostSaysOf,
  referenceStanding,
  unlistedReferenceChipProps,
  useTemplateReferenceNames,
} from './referenceNames';

export interface IReadOnlyTemplateTagProps {
  /** The template reference value, e.g. `$local:test`. */
  value: string;
  /** Template catalogue, for resolving the display name + image + metadata. */
  templates?: IReqoreFormTemplates;
  /**
   * What the chip says, where the surface names a reference its own way: in the Visual tab an operand's chip
   * says `record: orders` (`templateChipLabel`), and a field path drawn among them says it the same way. By
   * default, the name the catalogue gives the reference, else its path.
   */
  label?: string;
}

/**
 * The read-only representation of a selected template — a picker-shaped chip:
 * the `$`-dollar icon, the resolved display name (and what the value IS in the
 * tooltip, not the reference that names it, drawn by the host's markdown
 * renderer as the template list draws it, and opened by a tap on a touch
 * screen), the
 * app image when present, colored by qorus-ide's scheme (info / qorus purple /
 * success — see `getTemplateTagStyle`). Shared by `TemplateField`'s disabled
 * branch and the compact read-first row so a template reads identically wherever
 * it's shown non-editably.
 */
export const ReadOnlyTemplateTag = memo(
  ({ value, templates, label: givenLabel }: IReadOnlyTemplateTagProps) => {
    const { label: described, item } = describeTemplateReference(templates, value);
    // a reference nothing names says so; one the host knows wears its name (`referenceStanding`)
    const names = useTemplateReferenceNames();
    const standing = referenceStanding(templates, value, names);
    const unlisted = standing.unlisted ? unlistedReferenceChipProps(names) : undefined;
    const label = givenLabel ?? standing.label ?? described;
    const metadata = item?.metadata as TTemplateMeta | undefined;
    const descriptions = useDescriptionTooltips();
    const getTypeSentenceForm = useTypeSentenceForm();
    return (
      // The same chip the read summary (`TemplateText`) and the expression editor draw: a `tiny` box whose
      // label takes the font of the text it sits in, so a reference is the same size in every view.
      <ReqoreTagGroup size='tiny'>
        <ReqoreTag
          icon='ExchangeDollarLine'
          leftIconProps={{ image: metadata?.image }}
          label={label}
          className={unlisted?.className}
          tooltip={
            unlisted?.tooltip ??
            templateTooltip(
              templates,
              value,
              descriptions,
              getTypeSentenceForm,
              hostSaysOf(value, names)
            )
          }
          {...REFERENCE_CHIP_PROPS}
          {...getTemplateTagStyle(metadata)}
          {...(unlisted ? { intent: unlisted.intent } : {})}
        />
      </ReqoreTagGroup>
    );
  }
);

ReadOnlyTemplateTag.displayName = 'ReadOnlyTemplateTag';

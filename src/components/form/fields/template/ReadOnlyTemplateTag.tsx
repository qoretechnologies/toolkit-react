import { ReqoreTag, ReqoreTagGroup } from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { memo } from 'react';
import {
  getTemplateTagStyle,
  describeTemplateReference,
  templateTooltip,
  TTemplateMeta,
} from '../../../../helpers/templates';
import { useDescriptionTooltips } from '../../../../helpers/descriptionTooltip';

export interface IReadOnlyTemplateTagProps {
  /** The template reference value, e.g. `$local:test`. */
  value: string;
  /** Template catalogue, for resolving the display name + image + metadata. */
  templates?: IReqoreFormTemplates;
  size?: TSizes;
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
  ({ value, templates, size }: IReadOnlyTemplateTagProps) => {
    const { label, item } = describeTemplateReference(templates, value);
    const metadata = item?.metadata as TTemplateMeta | undefined;
    const descriptions = useDescriptionTooltips();
    return (
      <ReqoreTagGroup size={size}>
        <ReqoreTag
          icon='ExchangeDollarLine'
          leftIconProps={{ image: metadata?.image }}
          label={label}
          tooltip={templateTooltip(templates, value, descriptions)}
          {...getTemplateTagStyle(metadata)}
        />
      </ReqoreTagGroup>
    );
  }
);

ReadOnlyTemplateTag.displayName = 'ReadOnlyTemplateTag';

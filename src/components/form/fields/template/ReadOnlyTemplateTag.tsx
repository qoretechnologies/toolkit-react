import { ReqoreTag, ReqoreTagGroup } from '@qoretechnologies/reqore';
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { memo } from 'react';
import { findTemplate, getTemplateTagStyle, TTemplateMeta } from '../../../../helpers/templates';

export interface IReadOnlyTemplateTagProps {
  /** The template reference value, e.g. `$local:test`. */
  value: string;
  /** Template catalogue, for resolving the display name + image + metadata. */
  templates?: IReqoreFormTemplates;
  size?: TSizes;
}

/**
 * The read-only representation of a selected template — a picker-shaped chip:
 * the `$`-dollar icon, the resolved display name (raw value in the tooltip), the
 * app image when present, coloured by qorus-ide's scheme (info / qorus purple /
 * success — see `getTemplateTagStyle`). Shared by `TemplateField`'s disabled
 * branch and the compact read-first row so a template reads identically wherever
 * it's shown non-editably.
 */
export const ReadOnlyTemplateTag = memo(
  ({ value, templates, size }: IReadOnlyTemplateTagProps) => {
    const template = templates ? findTemplate(templates, value) : undefined;
    const metadata = template?.metadata as TTemplateMeta | undefined;
    return (
      <ReqoreTagGroup size={size}>
        <ReqoreTag
          icon='ExchangeDollarLine'
          leftIconProps={{ image: metadata?.image }}
          label={template?.label || value}
          tooltip={value}
          {...getTemplateTagStyle(metadata)}
        />
      </ReqoreTagGroup>
    );
  }
);

ReadOnlyTemplateTag.displayName = 'ReadOnlyTemplateTag';

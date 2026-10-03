import { ReqoreControlGroup, ReqoreP, ReqoreTag } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { ComponentProps } from 'react';
import {
  defaultInterfaceIcon,
  IInterfaceReference,
  toInterfaceKindMark,
  TResolveInterfaceIcon,
} from './meta';
import { useLoadedImages } from './useLoadedImages';

export interface IInterfaceReferenceTagsProps {
  references?: IInterfaceReference[];
  /** Optional leading label, e.g. "References" in a ticket header. Omitted (the
   *  default) inside the thread, where the chips sit under a message. */
  label?: string;
  /** Resolve a per-kind icon: a font icon, or a mark `{ icon, image }` whose image
   *  (e.g. the Qog logo) is drawn once it loads, with the font icon before that and
   *  instead of it if it fails. Consumers with their own icon vocabulary (the IDE)
   *  pass one; when omitted the built-in per-kind default is used. */
  resolveInterfaceIcon?: TResolveInterfaceIcon;
  /** Open a referenced interface; chips are static (informational) when omitted —
   *  e.g. the staff view, which can't reach the customer's instance. */
  onInterfaceClick?: (reference: IInterfaceReference) => void;
  /**
   * Detach a reference. Each chip grows an "×" when given — for the composer,
   * where the chips are the references you're about to send and so are still
   * editable. Omitted everywhere the chips are a record of what WAS sent (the
   * thread, the ticket header, the Qonsole card): those aren't editable, and an
   * × on them would offer to undo something that already happened.
   */
  onRemove?: (reference: IInterfaceReference) => void;
  size?: TSizes;
  /** Chip styling — pass `intent`/`customTheme` (e.g. `{ main: 'custom1' }`) to tint
   *  the reference chips to a surface's accent (the Qonsole/helpdesk composer does). */
  intent?: ComponentProps<typeof ReqoreTag>['intent'];
  customTheme?: ComponentProps<typeof ReqoreTag>['customTheme'];
  /** Resolve a per-reference image — e.g. a qog's trigger-app logo, the way the
   *  qogs list does. When this (or the reference's own `logo`) returns a value, the
   *  chip shows the image in place of the kind icon. */
  resolveInterfaceImage?: (reference: IInterfaceReference) => string | undefined;
  /**
   * Which image a chip draws when there is more than one:
   *
   * - `false` (the default): the reference's own image first — its stored `logo`,
   *   then `resolveInterfaceImage` — and the kind's image (from
   *   `resolveInterfaceIcon`) only when it has neither. This is how chips have
   *   always looked: an app-triggered Qog shows its trigger app's logo.
   * - `true`: the kind's image first, then the reference's own. For a host that
   *   draws every interface of a kind with one mark (the IDE's green Qog), so a
   *   Qog reads as a Qog whatever app triggers it.
   *
   * Either way the kind's font icon shows until the chosen image loads, and
   * instead of it if it cannot.
   */
  preferKindImage?: boolean;
}

/**
 * The chips for the Qorus interfaces a ticket or message references, as
 * `{kind, name}` snapshots. The single renderer for interface references across
 * every support surface — the ticket header (with a "References" label), the
 * thread (per message, no label), and the Qonsole card — so a reference looks
 * identical everywhere. Renders nothing when there are no references.
 */
export const InterfaceReferenceTags = ({
  references,
  label,
  resolveInterfaceIcon,
  onInterfaceClick,
  onRemove,
  size = 'small',
  intent,
  customTheme,
  resolveInterfaceImage,
  preferKindImage = false,
}: IInterfaceReferenceTagsProps) => {
  const resolveIcon = resolveInterfaceIcon ?? defaultInterfaceIcon;
  const marks = (references ?? []).map((reference) => {
    const mark = toInterfaceKindMark(resolveIcon(reference.interface_kind));
    const own = reference.logo ?? resolveInterfaceImage?.(reference);
    return {
      reference,
      icon: mark.icon,
      image: preferKindImage ? (mark.image ?? own) : (own ?? mark.image),
    };
  });
  const isLoaded = useLoadedImages(marks.map(({ image }) => image));
  if (!references?.length) {
    return null;
  }
  return (
    <ReqoreControlGroup verticalAlign='center' wrap gapSize='small'>
      {label ? (
        <ReqoreP size='small' effect={{ opacity: 0.6 }}>
          {label}
        </ReqoreP>
      ) : null}
      {marks.map(({ reference, icon, image }) => {
        // The chosen image (see `preferKindImage`) once it has loaded; the kind's
        // font icon until then, and if it fails.
        const loaded = isLoaded(image);
        return (
          <ReqoreTag
            key={
              reference.reference_id ??
              `${reference.interface_kind}:${reference.interface_name}`
            }
            icon={icon}
            leftIconProps={loaded ? { image } : undefined}
            labelKey={reference.interface_kind}
            label={reference.interface_name}
            size={size}
            intent={intent}
            customTheme={customTheme}
            tooltip={
              onInterfaceClick
                ? `Open ${reference.interface_kind} ${reference.interface_name}`
                : `${reference.interface_kind}: ${reference.interface_name}`
            }
            onClick={onInterfaceClick ? () => onInterfaceClick(reference) : undefined}
            onRemoveClick={onRemove ? () => onRemove(reference) : undefined}
            removeTooltip={`Remove ${reference.interface_kind} ${reference.interface_name}`}
          />
        );
      })}
    </ReqoreControlGroup>
  );
};

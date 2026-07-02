import { ReqoreControlGroup, ReqoreP, ReqoreTag } from '@qoretechnologies/reqore';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { defaultInterfaceIcon, IInterfaceReference } from './meta';

export interface IInterfaceReferenceTagsProps {
  references?: IInterfaceReference[];
  /** Optional leading label, e.g. "References" in a ticket header. Omitted (the
   *  default) inside the thread, where the chips sit under a message. */
  label?: string;
  /** Resolve a per-kind icon. Consumers with their own icon vocabulary (the IDE)
   *  pass one; when omitted the built-in per-kind default is used. */
  resolveInterfaceIcon?: (kind: string) => IReqoreIconName;
  /** Open a referenced interface; chips are static (informational) when omitted —
   *  e.g. the staff view, which can't reach the customer's instance. */
  onInterfaceClick?: (reference: IInterfaceReference) => void;
  size?: TSizes;
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
  size = 'small',
}: IInterfaceReferenceTagsProps) => {
  if (!references?.length) {
    return null;
  }
  const resolveIcon = resolveInterfaceIcon ?? defaultInterfaceIcon;
  return (
    <ReqoreControlGroup verticalAlign='center' wrap gapSize='small'>
      {label ? (
        <ReqoreP size='small' effect={{ opacity: 0.6 }}>
          {label}
        </ReqoreP>
      ) : null}
      {references.map((reference) => (
        <ReqoreTag
          key={reference.reference_id ?? `${reference.interface_kind}:${reference.interface_name}`}
          icon={resolveIcon(reference.interface_kind)}
          labelKey={reference.interface_kind}
          label={reference.interface_name}
          size={size}
          tooltip={
            onInterfaceClick
              ? `Open ${reference.interface_kind} ${reference.interface_name}`
              : `${reference.interface_kind}: ${reference.interface_name}`
          }
          onClick={onInterfaceClick ? () => onInterfaceClick(reference) : undefined}
        />
      ))}
    </ReqoreControlGroup>
  );
};

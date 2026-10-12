// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreButton, ReqoreControlGroup } from '@qoretechnologies/reqore';
import { IReqorePanelAction } from '@qoretechnologies/reqore/dist/components/Panel';
import { TReqoreTooltipProp } from '@qoretechnologies/reqore/dist/types/global';
import { cloneElement, Key, memo, ReactElement } from 'react';
import { descriptionTooltip, IDescriptionTooltipOptions } from '../../helpers/descriptionTooltip';

/** What the ⓘ is called, for a screen reader: the thing it explains. */
export const describedControlInfoLabel = (name: string) => `About ${name}`;

export interface IDescriptionInfoButtonProps {
  /** The description it opens: the server's markdown, drawn as every description card is. */
  description: string;
  /** What it describes: the card's title and the button's accessible name. */
  name: string;
  descriptions: IDescriptionTooltipOptions;
}

/**
 * A finger's way to a control's description: a small ⓘ beside the control that opens its card on a tap. A tap on
 * the control itself does what the control does, and only that.
 */
export const DescriptionInfoButton = memo(
  ({ description, name, descriptions }: IDescriptionInfoButtonProps) => (
    <ReqoreButton
      className='reqraft-description-info'
      icon='InformationLine'
      // a finger's size: Reqore's big control is 48px
      size='big'
      minimal
      flat
      fixed
      aria-label={describedControlInfoLabel(name)}
      tooltip={descriptionTooltip(description, { ...descriptions, tapToOpen: true }, name)}
    />
  )
);

DescriptionInfoButton.displayName = 'DescriptionInfoButton';

export interface IDescribedControl {
  /** The control's own hover, with a mouse. None on a touch screen, where a tap is the control's own. */
  tooltip?: TReqoreTooltipProp;
  /** The ⓘ to put beside the control, on a touch screen. */
  info?: ReactElement;
  /** The same ⓘ as a panel's header action, for a control that is a panel. */
  infoAction?: IReqorePanelAction;
}

/**
 * How a control that does something when tapped - a checkbox, a tab, a collapsible section - shows its description.
 *
 * With a mouse, as its hover card. On a touch screen (`descriptions.tapToOpen`), never on the control: a tap there
 * ticked the box or switched the tab and opened the card at once. The card opens from an ⓘ beside the control
 * instead (`info`, or `infoAction` for a panel's header). A control with no description gets neither.
 */
export const describedControl = (
  description: unknown,
  descriptions: IDescriptionTooltipOptions,
  name: string
): IDescribedControl => {
  if (!descriptions.tapToOpen) {
    return { tooltip: descriptionTooltip(description, descriptions) };
  }
  if (typeof description !== 'string' || !description.trim()) {
    return {};
  }
  return {
    info: <DescriptionInfoButton description={description} name={name} descriptions={descriptions} />,
    infoAction: {
      className: 'reqraft-description-info',
      icon: 'InformationLine',
      size: 'big',
      minimal: true,
      flat: true,
      'aria-label': describedControlInfoLabel(name),
      tooltip: descriptionTooltip(description, { ...descriptions, tapToOpen: true }, name),
    } as IReqorePanelAction,
  };
};

/**
 * A control with its ⓘ beside it, in one row, keyed as the control was; the control alone where there is no ⓘ
 * (a mouse, or no description).
 */
export const besideItsInfo = (
  control: ReactElement,
  info: ReactElement | undefined,
  key: Key
): ReactElement =>
  info ?
    <ReqoreControlGroup key={key} className='reqraft-described-control' gapSize='tiny'>
      {control}
      {info}
    </ReqoreControlGroup>
  : cloneElement(control, { key });

/**
 * A collapsible section's description, as props for its `ReqorePanel`: with a mouse its header's hover, on a touch
 * screen an ⓘ among its header's actions, so a tap on the header only opens or closes it.
 */
export const describedPanelProps = (
  description: unknown,
  descriptions: IDescriptionTooltipOptions,
  name: string
): { tooltip?: TReqoreTooltipProp; actions?: IReqorePanelAction[] } => {
  const { tooltip, infoAction } = describedControl(description, descriptions, name);
  return { tooltip, ...(infoAction ? { actions: [infoAction] } : {}) };
};

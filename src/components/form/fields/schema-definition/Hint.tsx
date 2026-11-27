/**
 * Lightweight stand-in for qorus-ide's dismissible `Hint`. Renders an
 * inline info callout — the toolkit has no per-user "remembered hint"
 * persistence, so the `id` is accepted for API parity and ignored.
 */
import { ReqoreMessage } from '@qoretechnologies/reqore';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { ReactNode } from 'react';
import { TSchemaDefinitionHintText } from './labels';

export interface IHintProps {
  /** Stable id — accepted for parity with the app's `Hint`; unused here. */
  id?: string;
  title?: string;
  icon?: IReqoreIconName;
  /** The hint's words (`ISchemaDefinitionLabels`): what they set apart is drawn bold. */
  text: TSchemaDefinitionHintText;
}

/** Draws a hint's words, each part they set apart bold and keyed by its place. */
const drawText = (text: TSchemaDefinitionHintText): ReactNode => {
  let key = 0;
  return text((part) => {
    key += 1;
    return <b key={key}>{part}</b>;
  });
};

export const Hint = ({ title, icon, text }: IHintProps) => (
  <ReqoreMessage intent='info' icon={icon} flat minimal size='small' title={title}>
    {drawText(text)}
  </ReqoreMessage>
);

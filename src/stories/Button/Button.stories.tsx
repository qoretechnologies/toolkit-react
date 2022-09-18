import { ComponentMeta, ComponentStory } from '@storybook/react';
import ReqoreButton from '../../components/Button';
import { ReqoreControlGroup } from '../../index';
import { IconArg } from '../utils/args';

export default {
  title: 'Components/Button',
  parameters: {
    jest: ['button.test.tsx'],
  },
  argTypes: {
    ...IconArg('icon', 'Icon'),
    ...IconArg('rightIcon', 'Right Icon'),
  },
} as ComponentMeta<typeof ReqoreButton>;

const Template: ComponentStory<typeof ReqoreButton> = (buttonProps) => {
  return (
    <>
      <ReqoreControlGroup size={buttonProps.size}>
        <ReqoreButton {...buttonProps}>Default</ReqoreButton>
        <ReqoreButton {...buttonProps} disabled>
          Disabled
        </ReqoreButton>
        <ReqoreButton {...buttonProps} active tooltip='hello'>
          Active
        </ReqoreButton>
        <ReqoreButton {...buttonProps} flat>
          Flat
        </ReqoreButton>
        <ReqoreButton {...buttonProps} minimal>
          Minimal
        </ReqoreButton>
        <ReqoreButton {...buttonProps} readOnly onClick={alert}>
          Read only
        </ReqoreButton>
      </ReqoreControlGroup>
      <br />
      <ReqoreControlGroup fluid>
        <ReqoreButton {...buttonProps} fluid>
          Fluid button
        </ReqoreButton>
      </ReqoreControlGroup>
    </>
  );
};

export const Default = Template.bind({});
export const Info = Template.bind({});
Info.args = {
  intent: 'info',
};
export const Success = Template.bind({});
Success.args = {
  intent: 'success',
};
export const Warning = Template.bind({});
Warning.args = {
  intent: 'warning',
};
export const Pending = Template.bind({});
Pending.args = {
  intent: 'pending',
};
export const Danger = Template.bind({});
Danger.args = {
  intent: 'danger',
};
export const Muted = Template.bind({});
Muted.args = {
  intent: 'muted',
};

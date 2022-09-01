import { Meta, Story } from '@storybook/react/types-6-0';
import { noop } from 'lodash';
import { IReqoreTreeProps, ReqoreTree } from '../../components/Tree';
import MockObject from '../../mock/object.json';
import { argManager } from '../utils/args';

const { createArg } = argManager<IReqoreTreeProps>();

export default {
  title: 'Components/Tree',
  argTypes: {
    ...createArg('withLabelCopy', {
      name: 'With label copy',
      description: 'With label copy',
      control: 'boolean',
      defaultValue: true,
    }),
    ...createArg('showTypes', {
      name: 'Show types',
      description: 'Show types',
      control: 'boolean',
      defaultValue: true,
    }),
    ...createArg('expanded', {
      name: 'Expanded',
      description: 'Expanded',
      control: 'boolean',
      defaultValue: false,
    }),
  },
} as Meta<IReqoreTreeProps>;

const data = MockObject;

const Template: Story<IReqoreTreeProps> = (args: IReqoreTreeProps) => {
  return <ReqoreTree data={data} onItemClick={noop} {...args} />;
};

export const Basic = Template.bind({});
export const TextView = Template.bind({});
TextView.args = {
  mode: 'copy',
};

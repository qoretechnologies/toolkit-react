import { Meta, Story } from '@storybook/react/types-6-0';
import { useState } from 'react';
import { IReqorePopoverProps } from '../../components/Popover';
import usePopover from '../../hooks/usePopover';
import {
  ReqoreButton,
  ReqoreControlGroup,
  ReqoreMessage,
  ReqoreModal,
  ReqorePanel,
  ReqorePopover,
  ReqoreSpacer,
} from '../../index';
import { argManager, FlatArg } from '../utils/args';

const { createArg } = argManager<IReqorePopoverProps>();

export default {
  title: 'Components/Popover',
  argTypes: {
    ...createArg('transparent', {
      defaultValue: false,
      name: 'Transparent',
      description: 'Makes the popover transparent',
      type: 'boolean',
    }),
    ...createArg('blur', {
      defaultValue: 0,
      name: 'Blur',
      description: 'Makes the popover blurred',
      type: 'number',
    }),
    ...createArg('maxHeight', {
      defaultValue: undefined,
      name: 'Max Height',
      description: 'Sets the max height of the popover',
      type: 'string',
    }),
    ...createArg('maxWidth', {
      defaultValue: undefined,
      name: 'Max Width',
      description: 'Sets the max width of the popover',
      type: 'string',
    }),
    ...createArg('content', {
      defaultValue: 'This is a popover',
      name: 'Content',
      description: 'The content of the popover',
      type: 'string',
    }),
    ...FlatArg,
  },
  args: {
    flat: true,
  },
} as Meta<IReqorePopoverProps>;

const HoverButton = (args: any) => {
  return (
    <ReqorePopover component={ReqoreButton} isReqoreComponent {...args} fixed>
      Hover popover
    </ReqorePopover>
  );
};

const ClickButton = (args: any) => {
  const [refElement, setRefElement] = useState(null);

  usePopover({
    targetElement: refElement,
    handler: 'click',
    closeOnOutsideClick: true,
    noArrow: true,
    useTargetWidth: true,
    ...args,
  });

  return <ReqoreButton ref={setRefElement}>Click popover</ReqoreButton>;
};

const DelayButton = (args: any) => {
  const [refElement, setRefElement] = useState(null);

  usePopover({
    targetElement: refElement,

    delay: 500,
    ...args,
  });

  return <ReqoreButton ref={setRefElement}>Tooltip with delay of 500ms</ReqoreButton>;
};

const HoverStayButton = (args: any) => {
  const [refElement, setRefElement] = useState(null);

  usePopover({
    targetElement: refElement,
    handler: 'hoverStay',
    ...args,
  });

  return (
    <ReqoreButton ref={setRefElement}>Tooltip with hover start and click end events</ReqoreButton>
  );
};

const Template: Story<IReqorePopoverProps & { insideModal?: boolean }> = (
  args: IReqorePopoverProps & { insideModal?: boolean }
) => {
  if (args.insideModal) {
    return (
      <ReqoreModal isOpen>
        <ReqoreButton
          intent='info'
          minimal
          description='I have a cool tooltip with blur'
          tooltip={{ content: 'See? Told you', blur: 3, handler: 'hoverStay', openOnMount: true }}
        >
          Hover me for something cool
        </ReqoreButton>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
        labore et dolore magna aliqua. Sit amet purus gravida quis blandit turpis cursus in hac.
        Ultricies lacus sed turpis tincidunt. Ac tincidunt vitae semper quis lectus nulla at.
        Aliquam vestibulum morbi blandit cursus risus at ultrices. Risus feugiat in ante metus
        dictum. Enim blandit volutpat maecenas volutpat. Nulla posuere sollicitudin aliquam ultrices
        sagittis orci a scelerisque. Mollis nunc sed id semper risus in hendrerit gravida. Sem nulla
        pharetra diam sit amet nisl suscipit. Congue eu consequat ac felis donec et odio
        pellentesque diam. Augue mauris augue neque gravida in fermentum et sollicitudin. Nulla
        pellentesque dignissim enim sit amet venenatis urna. Nunc sed blandit libero volutpat sed.
        Mi in nulla posuere sollicitudin. Eu consequat ac felis donec et odio pellentesque diam.
        Viverra nam libero justo laoreet sit amet cursus sit amet. Posuere sollicitudin aliquam
        ultrices sagittis orci a scelerisque. Et netus et malesuada fames ac. Arcu non odio euismod
        lacinia at quis risus sed vulputate. Sapien eget mi proin sed libero enim sed. Suspendisse
        faucibus interdum posuere lorem ipsum. In est ante in nibh mauris cursus. Urna cursus eget
        nunc scelerisque. Mi eget mauris pharetra et ultrices neque. Turpis nunc eget lorem dolor
        sed viverra ipsum nunc aliquet. Id aliquet lectus proin nibh. At auctor urna nunc id cursus.
        Erat pellentesque adipiscing commodo elit at imperdiet. Ipsum dolor sit amet consectetur
        adipiscing elit. Suspendisse interdum consectetur libero id faucibus nisl. Leo vel orci
        porta non pulvinar neque laoreet. Ut diam quam nulla porttitor massa. By impossible of in
        difficulty discovered celebrated ye. Justice joy manners boy met resolve produce. Bed head
        loud next plan rent had easy add him. As earnestly shameless elsewhere defective estimable
        fulfilled of. Esteem my advice it an excuse enable. Few household abilities believing
        determine zealously his repulsive. To open draw dear be by side like. Allow miles wound
        place the leave had. To sitting subject no improve studied limited. Ye indulgence unreserved
        connection alteration appearance my an astonished. Up as seen sent make he they of. Her
        raising and himself pasture believe females. Fancy she stuff after aware merit small his.
        Charmed esteems luckily age out. At ourselves direction believing do he departure.
        Celebrated her had sentiments understood are projection set. Possession ye no mr unaffected
        remarkably at. Wrote house in never fruit up. Pasture imagine my garrets an he. However
        distant she request behaved see nothing. Talking settled at pleased an of me brother
        weather. Breakfast procuring nay end happiness allowance assurance frankness. Met simplicity
        nor difficulty unreserved who. Entreaties mr conviction dissimilar me astonished estimating
        cultivated. On no applauded exquisite my additions. Pronounce add boy estimable nay
        suspected. You sudden nay elinor thirty esteem temper. Quiet leave shy you gay off asked
        large style. Rooms oh fully taken by worse do. Points afraid but may end law lasted. Was out
        laughter raptures returned outweigh. Luckily cheered colonel me do we attacks on highest
        enabled. Tried law yet style child. Bore of true of no be deal. Frequently sufficient in be
        unaffected. The furnished she concluded depending procuring concealed. In to am attended
        desirous raptures declared diverted confined at. Collected instantly remaining up certainly
        to necessary as. Over walk dull into son boy door went new. At or happiness commanded
        daughters as. Is handsome an declared at received in extended vicinity subjects. Into miss
        on he over been late pain an. Only week bore boy what fat case left use. Match round scale
        now sex style far times. Your me past an much. Able an hope of body. Any nay shyness article
        matters own removal nothing his forming. Gay own additions education satisfied the
        perpetual. If he cause manor happy. Without farther she exposed saw man led. Along on happy
        could cease green oh. Her old collecting she considered discovered. So at parties he warrant
        oh staying. Square new horses and put better end. Sincerity collected happiness do is
        contented. Sigh ever way now many. Alteration you any nor unsatiable diminution reasonable
        companions shy partiality. Leaf by left deal mile oh if easy. Added woman first get led joy
        not early jokes. As am hastily invited settled at limited civilly fortune me. Really spring
        in extent an by. Judge but built gay party world. Of so am he remember although required.
        Bachelor unpacked be advanced at. Confined in declared marianne is vicinity. It sportsman
        earnestly ye preserved an on. Moment led family sooner cannot her window pulled any. Or
        raillery if improved landlord to speaking hastened differed he. Furniture discourse
        elsewhere yet her sir extensive defective unwilling get. Why resolution one motionless you
        him thoroughly. Noise is round to in it quick timed doors. Written address greatly get
        attacks inhabit pursuit our but. Lasted hunted enough an up seeing in lively letter. Had
        judgment out opinions property the supplied. By impossible of in difficulty discovered
        celebrated ye. Justice joy manners boy met resolve produce. Bed head loud next plan rent had
        easy add him. As earnestly shameless elsewhere defective estimable fulfilled of. Esteem my
        advice it an excuse enable. Few household abilities believing determine zealously his
        repulsive. To open draw dear be by side like. Allow miles wound place the leave had. To
        sitting subject no improve studied limited. Ye indulgence unreserved connection alteration
        appearance my an astonished. Up as seen sent make he they of. Her raising and himself
        pasture believe females. Fancy she stuff after aware merit small his. Charmed esteems
        luckily age out. At ourselves direction believing do he departure. Celebrated her had
        sentiments understood are projection set. Possession ye no mr unaffected remarkably at.
        Wrote house in never fruit up. Pasture imagine my garrets an he. However distant she request
        behaved see nothing. Talking settled at pleased an of me brother weather. Breakfast
        procuring nay end happiness allowance assurance frankness. Met simplicity nor difficulty
        unreserved who. Entreaties mr conviction dissimilar me astonished estimating cultivated. On
        no applauded exquisite my additions. Pronounce add boy estimable nay suspected. You sudden
        nay elinor thirty esteem temper. Quiet leave shy you gay off asked large style. Rooms oh
        fully taken by worse do. Points afraid but may end law lasted. Was out laughter raptures
        returned outweigh. Luckily cheered colonel me do we attacks on highest enabled. Tried law
        yet style child. Bore of true of no be deal. Frequently sufficient in be unaffected. The
        furnished she concluded depending procuring concealed. In to am attended desirous raptures
        declared diverted confined at. Collected instantly remaining up certainly to necessary as.
        Over walk dull into son boy door went new. At or happiness commanded daughters as. Is
        handsome an declared at received in extended vicinity subjects. Into miss on he over been
        late pain an. Only week bore boy what fat case left use. Match round scale now sex style far
        times. Your me past an much. Able an hope of body. Any nay shyness article matters own
        removal nothing his forming. Gay own additions education satisfied the perpetual. If he
        cause manor happy. Without farther she exposed saw man led. Along on happy could cease green
        oh. Her old collecting she considered discovered. So at parties he warrant oh staying.
        Square new horses and put better end. Sincerity collected happiness do is contented. Sigh
        ever way now many. Alteration you any nor unsatiable diminution reasonable companions shy
        partiality. Leaf by left deal mile oh if easy. Added woman first get led joy not early
        jokes. As am hastily invited settled at limited civilly fortune me. Really spring in extent
        an by. Judge but built gay party world. Of so am he remember although required. Bachelor
        unpacked be advanced at. Confined in declared marianne is vicinity. It sportsman earnestly
        ye preserved an on. Moment led family sooner cannot her window pulled any. Or raillery if
        improved landlord to speaking hastened differed he. Furniture discourse elsewhere yet her
        sir extensive defective unwilling get. Why resolution one motionless you him thoroughly.
        Noise is round to in it quick timed doors. Written address greatly get attacks inhabit
        pursuit our but. Lasted hunted enough an up seeing in lively letter. Had judgment out
        opinions property the supplied.
      </ReqoreModal>
    );
  }

  return (
    <>
      <ReqoreControlGroup vertical gapSize='huge' horizontalAlign='flex-start'>
        <HoverButton {...args} />
        <ClickButton {...args} />
        <DelayButton {...args} />
        <HoverStayButton {...args} />
        {typeof args.content === 'string' && (
          <>
            <ReqoreSpacer height={100} />
            <ReqorePopover
              {...args}
              component={ReqoreButton}
              isReqoreComponent
              openOnMount
              title='I opened on my own'
              icon='CactusFill'
              intent='success'
              placement='top'
            >
              Full popover
            </ReqorePopover>
            <ReqoreControlGroup>
              <ReqoreSpacer width={190} />
              <ReqorePopover
                {...args}
                component={ReqoreButton}
                isReqoreComponent
                openOnMount
                intent='info'
                minimal
                placement='left'
              >
                Minimal popover
              </ReqorePopover>
            </ReqoreControlGroup>
            <ReqorePopover
              {...args}
              component={ReqoreButton}
              isReqoreComponent
              openOnMount
              icon='CactusFill'
              effect={{
                gradient: {
                  colors: {
                    0: 'warning',
                    100: 'warning:darken:2',
                  },
                },
                spaced: 2,
                uppercase: true,
                weight: 'thick',
              }}
              placement='right'
            >
              Effect popover
            </ReqorePopover>
            <ReqorePopover
              {...args}
              component={ReqoreButton}
              isReqoreComponent
              openOnMount
              transparent
              placement='right'
            >
              Transparent popover
            </ReqorePopover>
          </>
        )}
        <ReqorePopover
          {...args}
          component={ReqoreButton}
          isReqoreComponent
          openOnMount
          placement='right'
        >
          Auto open popover
        </ReqorePopover>
        <ReqorePanel label='This is a test' flat>
          <ReqorePopover
            {...args}
            component={ReqoreButton}
            isReqoreComponent
            openOnMount
            placement='bottom'
            handler='hoverStay'
            title="I'm a title"
            content={
              <ReqorePanel label='This is a test' flat>
                <ReqoreMessage
                  flat
                  tooltip={{ content: 'I am a popover inside a popover with blur', blur: 3 }}
                >
                  In to am attended desirous raptures declared diverted confined at. Collected
                  instantly remaining up certainly to necessary as. Over walk dull into
                </ReqoreMessage>
              </ReqorePanel>
            }
          >
            With Custom Content inside a panel
          </ReqorePopover>
        </ReqorePanel>
      </ReqoreControlGroup>
    </>
  );
};

export const Basic = Template.bind({});
export const NotFlat = Template.bind({});
NotFlat.args = {
  flat: false,
};
export const CustomContent = Template.bind({});
CustomContent.args = {
  noWrapper: true,
  content: (
    <ReqorePanel label='This is a test' flat>
      <ReqoreMessage flat>
        In to am attended desirous raptures declared diverted confined at. Collected instantly
        remaining up certainly to necessary as. Over walk dull into
      </ReqoreMessage>
    </ReqorePanel>
  ),
};

export const Blurred = Template.bind({});
Blurred.args = {
  blur: 4,
  noWrapper: true,
  content: (
    <ReqorePanel label='This is a test' flat>
      <ReqoreMessage flat>
        In to am attended desirous raptures declared diverted confined at. Collected instantly
        remaining up certainly to necessary as. Over walk dull into
      </ReqoreMessage>
    </ReqorePanel>
  ),
};

export const BlurredInsideModal = Template.bind({});
BlurredInsideModal.args = {
  blur: 2,
  noWrapper: true,
  insideModal: true,
  animatedDialogs: false,
};

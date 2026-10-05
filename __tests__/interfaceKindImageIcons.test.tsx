// Copyright 2026 Qore Technologies, s.r.o.
// The support surfaces draw an interface kind with an image when the host gives
// one (the IDE's green Qog), with the kind's font icon while it loads and instead
// of it when it fails.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render } from '@testing-library/react';
import { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InterfaceReferenceTags } from '../src/components/supportTicket/InterfaceReferenceTags';
import { IInterfaceReference, TInterfaceKindIcon } from '../src/components/supportTicket/meta';
import { ReferencePicker } from '../src/components/supportTicket/ReferencePicker';
import { resetLoadedImagesForTests } from '../src/components/supportTicket/useLoadedImages';
import { TicketReferences } from '../src/components/ticketReferences/TicketReferences';
import { TicketThread } from '../src/components/ticketThread/TicketThread';

const QOG_IMAGE = 'https://example.test/Qog.svg';
const APP_LOGO = 'https://example.test/app-logo.svg';
const BROKEN = 'https://example.test/missing.svg';

/* jsdom loads no images, so the test decides when each one loads or fails. */
const images: Array<{ src: string; onload?: () => void; onerror?: () => void }> = [];
class FakeImage {
  onload?: () => void;
  onerror?: () => void;
  private _src = '';
  set src(value: string) {
    this._src = value;
    images.push(this as never);
  }
  get src() {
    return this._src;
  }
}
const settle = async (src: string, outcome: 'load' | 'error') => {
  await act(async () => {
    images.filter((image) => image.src === src).forEach((image) =>
      outcome === 'load' ? image.onload?.() : image.onerror?.()
    );
  });
};

beforeEach(() => {
  images.length = 0;
  resetLoadedImagesForTests();
  vi.stubGlobal('Image', FakeImage);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = (element: ReactElement) => render(<ReqoreUIProvider>{element}</ReqoreUIProvider>);

const qogMark = (kind: string): TInterfaceKindIcon =>
  kind === 'fsm' ? { icon: 'FlowChart', image: QOG_IMAGE } : 'ServerLine';

const QOG: IInterfaceReference = { interface_kind: 'fsm', interface_name: 'order-flow' };
const APP_QOG: IInterfaceReference = { ...QOG, interface_name: 'app-flow', logo: APP_LOGO };
const SERVICE: IInterfaceReference = { interface_kind: 'service', interface_name: 'billing' };

const imgs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
const iconCount = (container: HTMLElement) => container.querySelectorAll('.reqore-icon').length;

describe('InterfaceReferenceTags with an image icon', () => {
  it('shows the font icon while the image loads, then the image', async () => {
    const { container } = mount(
      <InterfaceReferenceTags references={[QOG]} resolveInterfaceIcon={qogMark} />
    );
    expect(imgs(container)).toEqual([]);
    expect(iconCount(container)).toBe(1);

    await settle(QOG_IMAGE, 'load');

    expect(imgs(container)).toEqual([QOG_IMAGE]);
  });

  it('keeps the font icon when the image cannot load', async () => {
    const { container } = mount(
      <InterfaceReferenceTags
        references={[QOG]}
        resolveInterfaceIcon={() => ({ icon: 'FlowChart', image: BROKEN })}
      />
    );
    await settle(BROKEN, 'error');

    expect(imgs(container)).toEqual([]);
    expect(iconCount(container)).toBe(1);
  });

  it('shows the font icon, and loads nothing, when the kind has no image', () => {
    const { container } = mount(
      <InterfaceReferenceTags references={[SERVICE]} resolveInterfaceIcon={qogMark} />
    );
    expect(imgs(container)).toEqual([]);
    expect(iconCount(container)).toBe(1);
    expect(images).toHaveLength(0);
  });

  it("draws a reference's stored logo ahead of the kind's image by default", async () => {
    const { container } = mount(
      <InterfaceReferenceTags references={[APP_QOG]} resolveInterfaceIcon={qogMark} />
    );
    await settle(APP_LOGO, 'load');
    await settle(QOG_IMAGE, 'load');

    expect(imgs(container)).toEqual([APP_LOGO]);
  });

  it("draws the kind's image ahead of the stored logo when the host asks", async () => {
    const { container } = mount(
      <InterfaceReferenceTags
        references={[APP_QOG]}
        resolveInterfaceIcon={qogMark}
        preferKindImage
      />
    );
    await settle(APP_LOGO, 'load');
    await settle(QOG_IMAGE, 'load');

    expect(imgs(container)).toEqual([QOG_IMAGE]);
  });

  it("falls back to the stored logo when the kind has no image, even when preferred", async () => {
    const { container } = mount(
      <InterfaceReferenceTags
        references={[APP_QOG]}
        resolveInterfaceIcon={() => 'FlowChart'}
        preferKindImage
      />
    );
    await settle(APP_LOGO, 'load');

    expect(imgs(container)).toEqual([APP_LOGO]);
  });

  it('still takes a plain font icon from the resolver', () => {
    const { container } = mount(
      <InterfaceReferenceTags references={[SERVICE]} resolveInterfaceIcon={() => 'ServerLine'} />
    );
    expect(iconCount(container)).toBe(1);
    expect(imgs(container)).toEqual([]);
  });
});

describe('ReferencePicker with an image icon', () => {
  const picker = () =>
    mount(
      <ReferencePicker
        kinds={['fsm', 'service']}
        kind='fsm'
        onKindChange={vi.fn()}
        items={[{ name: 'order-flow' }]}
        picked={[]}
        onAdd={vi.fn()}
        resolveInterfaceIcon={qogMark}
      />
    );

  it('draws the kind image on the kind and its interfaces once loaded', async () => {
    const { container } = picker();
    expect(imgs(container)).toEqual([]);

    await settle(QOG_IMAGE, 'load');

    // The Qogs kind row and the order-flow row; the services row keeps its font icon.
    expect(imgs(container).filter((src) => src === QOG_IMAGE).length).toBe(2);
  });

  it('keeps the font icons when the image fails', async () => {
    const { container } = picker();
    await settle(QOG_IMAGE, 'error');

    expect(imgs(container)).toEqual([]);
  });
});

describe('TicketReferences with an image icon', () => {
  it('draws the image once loaded, and keeps the font icon when it fails', async () => {
    const { container } = mount(
      <TicketReferences
        references={[QOG, { interface_kind: 'job', interface_name: 'nightly' }]}
        resolveInterfaceIcon={(kind) =>
          kind === 'fsm' ? { icon: 'FlowChart', image: QOG_IMAGE } : { icon: 'CalendarLine', image: BROKEN }
        }
      />
    );
    expect(imgs(container)).toEqual([]);

    await settle(QOG_IMAGE, 'load');
    await settle(BROKEN, 'error');

    expect(imgs(container)).toEqual([QOG_IMAGE]);
  });
});

describe('TicketThread with an image icon', () => {
  const thread = (preferKindImage?: boolean) =>
    mount(
      <TicketThread
        messages={[
          {
            message_id: 'm1',
            author_type: 'customer',
            author_id: 'acme',
            body: 'See these',
            created: '2026-10-01T10:00:00Z',
            referenced_interfaces: [QOG, APP_QOG],
          },
        ]}
        resolveInterfaceIcon={qogMark}
        preferKindImage={preferKindImage}
      />
    );

  it("hands the host's mark to a message's reference chips", async () => {
    const { container } = thread();
    await settle(QOG_IMAGE, 'load');
    await settle(APP_LOGO, 'load');

    // The plain Qog shows the Qog image; the app-triggered one keeps its app logo.
    expect(imgs(container).sort()).toEqual([APP_LOGO, QOG_IMAGE].sort());
  });

  it('passes preferKindImage through to the chips', async () => {
    const { container } = thread(true);
    await settle(QOG_IMAGE, 'load');
    await settle(APP_LOGO, 'load');

    expect(imgs(container)).toEqual([QOG_IMAGE, QOG_IMAGE]);
  });
});

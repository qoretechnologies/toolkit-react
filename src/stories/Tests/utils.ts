import { expect, fireEvent, screen, userEvent, waitFor } from '@storybook/test';

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export async function _testsScrollElementIntoView(selector: string, nth: number = 1) {
  await waitFor(() => expect(document.querySelectorAll(selector)[nth - 1]).toBeInTheDocument(), {
    timeout: 10000,
  });
  await document.querySelectorAll(selector)[nth - 1].scrollIntoView();
}

export async function _testsChangeRichText(value: string, nth: number = 1) {
  await _testsScrollElementIntoView('div.system-option [contenteditable="true"]', nth);

  const element = document.querySelectorAll('div.system-option [contenteditable="true"]')[nth - 1];

  await sleep(500);

  await userEvent.click(element);

  await sleep(500);

  await userEvent.click(element);

  await sleep(500);

  await userEvent.keyboard(value);

  await sleep(500);
}

export async function _testsConfirmDialog() {
  await waitFor(async () => screen.getAllByText('Confirm')[0], {
    timeout: 5000,
  });
  await fireEvent.click(screen.getAllByText('Confirm')[0]);
  await sleep(200);
}

export async function _testsOpenTemplateMenu(nth: number = 1) {
  await _testsClickButton({ selector: '.template-more', nth: nth - 1 });
}

export async function _testsSetTemplate(nth: number = 1) {
  await _testsOpenTemplateMenu(nth);
  await _testsClickButton({ selector: '.template-toggle' });
}

export async function _testsOpenTemplates(nth: number = 1) {
  await waitFor(
    async () => {
      await expect(
        document.querySelectorAll('.template-selector.reqore-control')[nth - 1],
        'Waiting for .template-selector in _testsOpenTemplates'
      ).toBeInTheDocument();
    },
    { timeout: 10000 }
  );

  await sleep(1500);

  await _testsClickButton({
    selector: '.template-selector.reqore-control',
    wait: 15000,
    nth: nth - 1,
  });

  await waitFor(
    () =>
      expect(
        document.querySelector('.reqore-popover-content'),
        'Waiting for popover content in _testsOpenTemplate'
      ).toBeInTheDocument(),
    { timeout: 10000 }
  );
}

// Storybook's iframe shell keeps hidden skeleton markup in the DOM at all
// times (the `.sb-wrapper` preparing-story/docs blocks, whose args table
// carries headers like "Name" and "Description"). It sorts BEFORE the story
// root, so an unscoped text query can match the chrome instead of the story.
function _queryAllByStoryText(text: string | number | RegExp, selector?: string) {
  return screen
    .queryAllByText(text, { selector })
    .filter((element) => !element.closest('.sb-wrapper'));
}

export async function _testsWaitForText(
  text: string | number | RegExp,
  selector?: string,
  nth: number = 1,
  exist: boolean = true
) {
  await waitFor(
    () => {
      const element = _queryAllByStoryText(text, selector)[nth - 1];

      if (!exist) {
        return expect(element, `Expected text ${text} to not exist`).toBeUndefined();
      }

      return expect(element, `Expected text ${text}`).toBeInTheDocument();
    },
    {
      timeout: 10000,
    }
  );
}

export async function _testsWaitForInputValue(
  value: string | number,
  selector?: string,
  nth: number = 1,
  exist: boolean = true
) {
  await waitFor(
    () => {
      const elements = screen
        .queryAllByDisplayValue(value)
        .filter((el) => (selector ? el.matches(selector) : true));

      const element = elements[nth - 1];

      if (!exist) {
        return expect(element, `Expected input value ${value} to not exist`).toBeUndefined();
      }

      return expect(element, `Expected input value ${value}`).toBeInTheDocument();
    },
    {
      timeout: 10000,
    }
  );
}

export async function _testsClickText(text: string, selector?: string, nth: number = 1) {
  await _testsWaitForText(text, selector, nth);

  await fireEvent.click(_queryAllByStoryText(text, selector)[nth - 1]);
}

export async function _testsWaitForTextsCount(text: string, selector?: string, count: number = 1) {
  await waitFor(
    () => {
      const texts = _queryAllByStoryText(text, selector);

      return expect(texts, `Expected text ${text} with count ${count}`).toHaveLength(count);
    },
    {
      timeout: 10000,
    }
  );
}

export async function _testsWaitForTextToNotExist(
  text: string,
  selector?: string,
  nth: number = 1
) {
  await _testsWaitForText(text, selector, nth, false);
}

export async function _testsChangeStringField({
  selector,
  nth = 1,
  value,
}: {
  selector: string;
  nth?: number;
  value: string | number;
}) {
  await waitFor(() => expect(document.querySelectorAll(selector)[nth - 1]).toBeInTheDocument(), {
    timeout: 10000,
  });
  await fireEvent.change(document.querySelectorAll(selector)[nth - 1], {
    target: { value },
  });
}

export async function _testsClickButton({
  label,
  selector,
  nth = 0,
  wait = 7000,
  parent = '.reqore-button',
}: {
  label?: string;
  selector?: string;
  nth?: number;
  wait?: number;
  parent?: string;
}) {
  console.log('Waiting for button:', label, selector, nth, wait);
  if (!label) {
    await waitFor(
      () =>
        expect(
          document.querySelectorAll(selector)[nth],
          `Waited for button ${selector} ${nth}`
        ).toBeInTheDocument(),
      {
        timeout: wait,
      }
    );
    await waitFor(
      () =>
        expect(
          document.querySelectorAll(selector)[nth],
          `Waited for button ${selector} ${nth} to be enabled`
        ).toBeEnabled(),
      {
        timeout: wait,
      }
    );
    console.log('Clicking button:', label, selector, nth, wait);
    await userEvent.click(document.querySelectorAll(selector)[nth]);
  } else {
    await waitFor(
      () => expect(screen.queryAllByText(label, { selector })[nth]).toBeInTheDocument(),
      { timeout: wait }
    );
    await waitFor(
      () => expect(screen.queryAllByText(label, { selector })[nth].closest(parent)).toBeEnabled(),
      { timeout: wait }
    );
    console.log('Clicking button:', label, selector, nth, wait);
    await userEvent.click(screen.queryAllByText(label, { selector })[nth]);
  }
  console.log('Clicked button:', label, selector, nth, wait);
}

export async function _testsDoubleClickButton({
  label,
  selector,
  nth = 0,
  wait = 7000,
  parent = '.reqore-button',
}: {
  label?: string;
  selector?: string;
  nth?: number;
  wait?: number;
  parent?: string;
}) {
  console.log('Waiting for button:', label, selector, nth, wait);
  if (!label) {
    await waitFor(
      () =>
        expect(
          document.querySelectorAll(selector)[nth],
          `Waited for button ${selector} ${nth}`
        ).toBeInTheDocument(),
      {
        timeout: wait,
      }
    );
    await waitFor(
      () =>
        expect(
          document.querySelectorAll(selector)[nth],
          `Waited for button ${selector} ${nth} to be enabled`
        ).toBeEnabled(),
      {
        timeout: wait,
      }
    );
    console.log('Clicking button:', label, selector, nth, wait);
    await userEvent.dblClick(document.querySelectorAll(selector)[nth]);
  } else {
    await waitFor(
      () => expect(screen.queryAllByText(label, { selector })[nth]).toBeInTheDocument(),
      { timeout: wait }
    );
    await waitFor(
      () => expect(screen.queryAllByText(label, { selector })[nth].closest(parent)).toBeEnabled(),
      { timeout: wait }
    );
    console.log('Clicking button:', label, selector, nth, wait);
    await userEvent.dblClick(screen.queryAllByText(label, { selector })[nth]);
  }
  console.log('Clicked button:', label, selector, nth, wait);
}

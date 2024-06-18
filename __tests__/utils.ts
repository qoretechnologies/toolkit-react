import { expect, fireEvent, screen, waitFor } from '@storybook/test';

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export async function testsWaitForText(text: string, selector?: string) {
  await waitFor(() => expect(screen.queryAllByText(text, { selector })[0]).toBeInTheDocument(), {
    timeout: 10000,
  });
}

export async function testsClickButton({
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
  if (!label) {
    await waitFor(() => expect(document.querySelectorAll(selector)[nth]).toBeInTheDocument(), {
      timeout: wait,
    });
    await fireEvent.click(document.querySelectorAll(selector)[nth]);
  } else {
    await waitFor(
      () => expect(screen.queryAllByText(label, { selector })[nth]).toBeInTheDocument(),
      { timeout: wait }
    );
    await waitFor(
      () => expect(screen.queryAllByText(label, { selector })[nth].closest(parent)).toBeEnabled(),
      { timeout: wait }
    );
    await fireEvent.click(screen.queryAllByText(label, { selector })[nth]);
  }
}

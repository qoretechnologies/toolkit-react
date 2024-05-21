import { expect, screen, waitFor } from '@storybook/test';

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export async function testsWaitForText(text: string, selector?: string) {
  await waitFor(() => expect(screen.queryAllByText(text, { selector })[0]).toBeInTheDocument(), {
    timeout: 10000,
  });
}

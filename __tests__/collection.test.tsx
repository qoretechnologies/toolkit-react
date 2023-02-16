import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { ReqoreCollection, ReqoreLayoutContent, ReqoreUIProvider } from '../src';
import items from '../src/mock/collectionData';

test('Renders basic <Collection /> properly', () => {
  render(
    <ReqoreUIProvider>
      <ReqoreLayoutContent>
        <ReqoreCollection items={items} />
      </ReqoreLayoutContent>
    </ReqoreUIProvider>
  );

  expect(document.querySelectorAll('.reqore-collection').length).toBe(1);
  expect(document.querySelectorAll('.reqore-collection-item').length).toBe(9);
});

test('<Collection /> items can be filtered', () => {
  const fn = jest.fn();
  jest.useFakeTimers();

  render(
    <ReqoreUIProvider>
      <ReqoreLayoutContent>
        <ReqoreCollection items={items} filterable onQueryChange={fn} />
      </ReqoreLayoutContent>
    </ReqoreUIProvider>
  );

  fireEvent.change(document.querySelector('.reqore-input')!, {
    target: { value: 'I have' },
  });

  expect(fn).not.toHaveBeenCalled();

  jest.advanceTimersByTime(500);

  expect(fn).toHaveBeenCalledWith('I have');

  expect(document.querySelectorAll('.reqore-collection-item').length).toBe(2);

  fireEvent.change(document.querySelector('.reqore-input')!, {
    target: { value: 'asg' },
  });

  jest.runAllTimers();

  expect(document.querySelectorAll('.reqore-collection-item').length).toBe(0);
  expect(document.querySelectorAll('.reqore-message').length).toBe(1);

  fireEvent.change(document.querySelector('.reqore-input')!, {
    target: { value: 'secret' },
  });

  jest.runAllTimers();

  expect(document.querySelectorAll('.reqore-collection-item').length).toBe(1);
  expect(document.querySelectorAll('.reqore-message').length).toBe(0);
});

test('<Collection /> shows no data message when empty', () => {
  render(
    <ReqoreUIProvider>
      <ReqoreLayoutContent>
        <ReqoreCollection items={[]} filterable />
      </ReqoreLayoutContent>
    </ReqoreUIProvider>
  );

  expect(document.querySelectorAll('.reqore-message').length).toBe(1);
});

test('<Collection /> can be sorted', () => {
  render(
    <ReqoreUIProvider>
      <ReqoreLayoutContent>
        <ReqoreCollection items={items} sortable />
      </ReqoreLayoutContent>
    </ReqoreUIProvider>
  );

  const firstItem = document.querySelector('.reqore-collection-item');
  // Expect the title of the first item to be "Expandable item"
  expect(firstItem?.querySelector('h3')?.textContent).toBe(undefined);

  fireEvent.click(document.querySelectorAll('.reqore-button')[1]);

  const firstNewItem = document.querySelector('.reqore-collection-item');

  expect(firstNewItem?.querySelector('h3')?.textContent).toBe('This item is not flat');
});

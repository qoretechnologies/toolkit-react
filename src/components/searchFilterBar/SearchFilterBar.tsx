import { ReqoreControlGroup, ReqoreDropdown, ReqoreInput } from '@qoretechnologies/reqore';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import styled, { css } from 'styled-components';

/*
 * A search box with filter dropdowns beside it — the strip that sits above a list
 * and narrows it.
 *
 * This existed twice, built independently either side of the package boundary: the
 * ticket list in qorus-ide and the References tab here in reqraft. Same
 * composition (ReqoreControlGroup > ReqoreInput + N ReqoreDropdowns), but they had
 * drifted — one sized the group, the other sized each control; one wrapped, the
 * other stacked; one moved the dropdown caret to the right slot and suppressed the
 * default, the other did not. Two strips that should be indistinguishable ended up
 * visibly different, and any fix had to be made twice.
 *
 * It lives in reqraft rather than Reqore because it is a composition of Reqore
 * primitives, not a new primitive — there is nothing here Reqore is missing.
 *
 * The frosted container is part of the component, not the caller's job. Extracting
 * only the controls left the two surfaces still looking different: one bar sat in a
 * bordered, blurred card, the other bare on the page. If the bar is meant to read
 * the same everywhere then its own chrome has to travel with it.
 */

const Container = styled.div<{ $sticky?: boolean }>`
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(6px);

  ${({ $sticky }) =>
    $sticky &&
    css`
      position: sticky;
      top: 0;
      z-index: 2;
    `}
`;

export interface ISearchFilterOption {
  label: string;
  icon?: IReqoreIconName;
  selected?: boolean;
  onClick: () => void;
}

export interface ISearchFilter {
  /** Icon for the trigger — usually the selected option's. */
  icon?: IReqoreIconName;
  /** Trigger label — usually the selected option's. */
  label: string;
  items: ISearchFilterOption[];
}

export interface ISearchFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  filters?: ISearchFilter[];
  /**
   * Stack the search over its filters. On a phone the box and two dropdowns
   * cannot share a row without the input collapsing to a few characters, so the
   * caller passes its own breakpoint result rather than this guessing.
   */
  stacked?: boolean;
  /**
   * Pin the bar to the top of its scroll container. For a bar inside a scrolling
   * panel (the References tab); a bar above a page-level list does not need it.
   */
  sticky?: boolean;
}

export const SearchFilterBar = ({
  value,
  onChange,
  placeholder,
  filters = [],
  stacked,
  sticky,
}: ISearchFilterBarProps) => (
  <Container $sticky={sticky}>
    {/* `size='small'` on the GROUP, not per control: the bar filters the content, it
        is not content — at the default size the dropdowns read as primary actions and
        crowd the search field. */}
    <ReqoreControlGroup
      fluid
      wrap
      gapSize='small'
      size='small'
      vertical={stacked}
      verticalAlign={stacked ? undefined : 'center'}
    >
      <ReqoreInput
        icon='Search2Line'
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange((event.currentTarget as HTMLInputElement).value)}
        onClearClick={value ? () => onChange('') : undefined}
        minimal
        fluid
      />
      {filters.length ?
        <ReqoreControlGroup gapSize='small' size='small' fluid={stacked}>
          {filters.map((filter, index) => (
            <ReqoreDropdown
              key={index}
              icon={filter.icon}
              label={filter.label}
              minimal
              flat
              /* stretch to share the row when stacked; hug the label otherwise */
              fixed={!stacked}
              /* the caret defaults to the LEFT slot, where the filter's own icon
               already sits — without this each trigger shows two glyphs */
              rightIcon='ArrowDownSLine'
              showCaret={false}
              items={filter.items.map((item) => ({
                label: item.label,
                icon: item.icon,
                selected: item.selected,
                onClick: item.onClick,
              }))}
            />
          ))}
        </ReqoreControlGroup>
      : null}
    </ReqoreControlGroup>
  </Container>
);

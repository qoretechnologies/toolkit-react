import {
  ReqoreButton,
  ReqoreCollection,
  ReqoreControlGroup,
  ReqoreMessage,
  ReqoreModal,
  ReqoreP,
} from '@qoretechnologies/reqore';
import { IReqoreCollectionItemProps } from '@qoretechnologies/reqore/dist/components/Collection/item';
import { TReqoreBadge } from '@qoretechnologies/reqore/dist/components/Button';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { capitalize, isEqual, size } from 'lodash';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

const PositiveColorEffect = {
  gradient: {
    colors: {
      0: 'success' as const,
      100: 'success' as const,
    },
  },
};

export interface ISelectFieldCollectionItem {
  value?: unknown;
  display_name?: string;
  desc?: string;
  short_desc?: string;
  icon?: IReqoreIconName;
  image?: string;
  badge?: TReqoreBadge;
  intent?: TReqoreIntent;
  disabled?: boolean;
  groups?: string[];
  actions?: { as?: React.ElementType; props?: Record<string, unknown> }[];
  messages?: { intent?: TReqoreIntent; title?: string; content: string }[];
  [key: string]: unknown;
}

export interface ISelectFieldCollectionProps {
  onClose: () => void;
  items: ISelectFieldCollectionItem[];
  getItemDescription: (value: unknown) => string;
  value?: unknown;
  onItemSelect: (item: ISelectFieldCollectionItem) => void;
  filters?: string[];
}

export const getSelectItemDescription = (
  item: Pick<ISelectFieldCollectionItem, 'desc' | 'short_desc'>
): string | undefined => {
  const desc = typeof item.desc === 'string' && item.desc.trim() ? item.desc.trim() : undefined;
  const shortDesc =
    typeof item.short_desc === 'string' && item.short_desc.trim()
      ? item.short_desc.trim()
      : undefined;

  return desc ?? shortDesc;
};

export const SelectFieldCollection = ({
  onClose,
  items,
  getItemDescription,
  value,
  onItemSelect,
  filters,
}: ISelectFieldCollectionProps) => {
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      let isMatch = true;

      if (appliedFilters.length > 0) {
        isMatch = appliedFilters.some((filter) => item[filter]);
      }

      return isMatch;
    });
  }, [items, appliedFilters]);

  return (
    <ReqoreModal
      isOpen
      icon='ListOrdered'
      onClose={onClose}
      label='Select from items'
      badge={size(items)}
      width='700px'
      customTheme={{ main: '#010811' }}
    >
      <ReqoreCollection
        filterable
        sortable
        responsiveTitle={false}
        showSelectedFirst
        selectedIcon='CheckLine'
        fill
        columnsGap='5px'
        minColumnWidth='300px'
        inputProps={{
          rightIcon: 'KeyboardFill',
          focusRules: {
            type: 'auto',
            clearOnFocus: true,
          },
        }}
        customTheme={{ main: '#010811' }}
        transparent={false}
        size='tiny'
        showLayoutSwitch={false}
        items={filteredItems.map((item): IReqoreCollectionItemProps => {
          const description = getSelectItemDescription(item);

          return {
            label: item.display_name || item.value?.toString(),
            size: 'tiny',
            groups: item.groups,
            customTheme: { main: '#08182d' },
            responsiveTitle: false,
            content: (
              <ReqoreControlGroup vertical fluid>
                {description && <ReqoreP size='small'>{description}</ReqoreP>}
                {item.actions?.map(({ as: Component = ReqoreButton, props, ...rest }, index) => (
                  <Component
                    key={index}
                    {...rest}
                    {...props}
                    fixed
                    size='tiny'
                  />
                ))}
                {(item.messages || []).map(({ intent, title, content }, index) => (
                  <ReqoreMessage
                    flat
                    intent={intent}
                    title={title}
                    key={title || index}
                    size='small'
                    opaque={false}
                  >
                    {content}
                  </ReqoreMessage>
                ))}
              </ReqoreControlGroup>
            ),
            flat: false,
            minimal: true,
            selected: item.value !== undefined && item.value !== null && isEqual(item.value, value),
            intent:
              item.value !== undefined && item.value !== null && isEqual(item.value, value)
                ? 'info'
                : item.intent,
            badge: item.badge,
            icon: item.icon,
            iconImage: item.image,
            iconProps: {
              size: '20px',
              rounded: true,
            },
            tooltip: !!item.desc
              ? {
                  delay: 800,
                  content: <ReactMarkdown>{getItemDescription(item.value)}</ReactMarkdown>,
                  maxWidth: '70vw',
                }
              : undefined,
            onClick: !item.disabled
              ? (e) => {
                  if (e.currentTarget.contains(e.target as Node)) {
                    onItemSelect(item);
                    onClose?.();
                  }
                }
              : undefined,
          };
        })}
        actions={filters?.map((filter) => ({
          label: capitalize(filter.replace('_', ' ')),
          badge: items.filter((item) => item[filter]).length,
          active: appliedFilters.includes(filter),
          effect: appliedFilters.includes(filter) ? PositiveColorEffect : undefined,
          size: 'tiny' as const,
          onClick: () => {
            if (!appliedFilters.includes(filter)) {
              setAppliedFilters([...appliedFilters, filter]);
            } else {
              setAppliedFilters(appliedFilters.filter((appliedFilter) => appliedFilter !== filter));
            }
          },
        }))}
      />
    </ReqoreModal>
  );
};

import { ReqoreButton, ReqoreControlGroup, ReqorePanel } from '@qoretechnologies/reqore';
import { memo } from 'react';
import { IExpression, IExpressionSchema, IExpressionSchemaArg } from '../types';
import { ExpressionBuilderArgumentLabel } from './argumentLabel';

export interface IExpressionBuilderArgumentWrapperProps {
  children: React.ReactNode;
  schema?: IExpressionSchemaArg;
  arg?: IExpression;
  onTypeChange?: (type: string | 'context') => void;
  onRemoveArgClick?: () => void;
  hasMultipleArgs?: boolean;
  expressions: IExpressionSchema[];
  label?: string;
  readOnly?: boolean;
}

export const ExpressionBuilderArgumentWrapper = memo(
  ({
    children,
    schema,
    arg,
    onRemoveArgClick,
    hasMultipleArgs,
    expressions,
    label,
    readOnly,
  }: IExpressionBuilderArgumentWrapperProps) => {
    const type = arg?.type || schema?.ui_type || 'context';

    if (arg?.is_expression) {
      return (
        <ReqoreControlGroup vertical fluid gapSize='small'>
          <ExpressionBuilderArgumentLabel
            arg={arg}
            schema={schema}
            label={label || ''}
            expressions={expressions}
            type={type}
          />
          <ReqorePanel
            minimal
            fluid
            wrapperPadding='top'
            responsiveTitle={false}
            responsiveActions={false}
            size='small'
            flat
            padded={false}
            transparent
          >
            {children}
          </ReqorePanel>
        </ReqoreControlGroup>
      );
    }

    return (
      <ReqoreControlGroup vertical wrap style={{ flexShrink: 1 }} size='small'>
        <ExpressionBuilderArgumentLabel
          arg={arg}
          schema={schema}
          label={label}
          expressions={expressions}
        />
        <ReqoreControlGroup verticalAlign='flex-start' wrap fluid>
          {children}
          {hasMultipleArgs && (
            <ReqoreButton
              compact
              intent='danger'
              minimal
              fixed
              className='expression-remove-arg'
              icon='DeleteBinLine'
              flat
              transparent
              tooltip='Remove argument'
              onClick={onRemoveArgClick}
              disabled={readOnly}
            />
          )}
        </ReqoreControlGroup>
      </ReqoreControlGroup>
    );
  }
);

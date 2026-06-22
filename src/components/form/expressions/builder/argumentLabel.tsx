import { ReqoreIcon, ReqoreP, ReqoreSpan } from '@qoretechnologies/reqore';
import { uniq } from 'lodash';
import { argumentMatchesType, getArgumentType } from '../../../../helpers/expressions';
import { validateFieldWithResult } from '../../../../helpers/validations';
import { useQorusTypes } from '../../../../hooks/useQorusTypes';
import { IExpression, IExpressionSchema, IExpressionSchemaArg } from '../types';

export interface IExpressionBuilderArgumentLabelProps {
  label: string;
  arg?: IExpression;
  expressions: IExpressionSchema[];
  schema?: IExpressionSchemaArg;
  type?: string;
}

export const ExpressionBuilderArgumentLabel = ({
  label,
  arg,
  schema,
  expressions,
  type,
}: IExpressionBuilderArgumentLabelProps) => {
  const types = useQorusTypes();

  if (!schema) {
    return (
      <ReqoreP
        size='tiny'
        effect={{
          uppercase: true,
          spaced: 1,
          weight: 'thick',
          opacity: 0.6,
        }}
      >
        {label}
      </ReqoreP>
    );
  }

  const matchesType = argumentMatchesType(expressions, arg, schema);

  const argumentType = getArgumentType(expressions, arg, schema);
  const matchesTypeExactly =
    types.getExactMatches(schema.ui_type).includes(argumentType) ||
    types.getExactMatches(schema.ui_type).includes('any') ||
    type === 'any';
  const acceptedTypes = uniq([
    ...types.getExactMatches(schema.ui_type),
    ...types.getAcceptedTypes(schema.ui_type),
  ]);
  const { isValid, reason } = arg.is_expression
    ? validateFieldWithResult('expression', arg, { expressions })
    : validateFieldWithResult(argumentType, arg.value, schema, !schema.required);

  return (
    <ReqoreP
      size='tiny'
      effect={{
        uppercase: true,
        spaced: 1,
        weight: 'thick',
      }}
    >
      {!isValid && <ReqoreIcon icon='ErrorWarningLine' color='danger' size='10px' margin='right' />}
      {schema.display_name && (
        <ReqoreSpan
          effect={{
            opacity: 1,
            underline: !isValid || !matchesType ? 'underline solid red' : undefined,
          }}
          tooltip={
            isValid
              ? !matchesType
                ? `This arguments type does not match the required type (${acceptedTypes.join(', ')}) and has to wrapped`
                : undefined
              : reason
          }
        >
          {schema.display_name}
        </ReqoreSpan>
      )}{' '}
      {schema.required && <ReqoreIcon icon='Asterisk' color='danger' size='10px' />} {label}
      <ReqoreSpan
        effect={{
          italic: true,
          weight: 'light',
          opacity: 0.5,
        }}
      >
        {'['}
        {types.getTypeDisplayName(schema.ui_type)}
      </ReqoreSpan>
      {!matchesType ? (
        <ReqoreIcon icon='ErrorWarningLine' color='warning' size='10px' margin='both' />
      ) : null}
      {(argumentType || (arg.is_expression && arg.value?.exp)) &&
      types.getTypeDisplayName(argumentType) !== types.getTypeDisplayName(schema.ui_type) &&
      !matchesTypeExactly ? (
        <>
          {matchesType ? (
            <ReqoreIcon
              icon='CheckLine'
              color='pending'
              size='10px'
              margin='both'
              tooltip='Type matches, but a transformation may be applied'
            />
          ) : null}

          <ReqoreSpan
            effect={{
              italic: true,
              weight: 'light',
              opacity: 1,
              underline: 'underline 1px dotted',
            }}
            intent={matchesType ? 'pending' : 'warning'}
            tooltip={
              matchesType
                ? 'Type matches, but a transformation may be applied'
                : `Type does not match expected type of ${acceptedTypes?.join(' or ')}`
            }
          >
            {types.getTypeDisplayName(argumentType)}
          </ReqoreSpan>
        </>
      ) : null}
      <ReqoreSpan
        effect={{
          italic: true,
          weight: 'light',
          opacity: 0.5,
        }}
      >
        {']'}
      </ReqoreSpan>
    </ReqoreP>
  );
};

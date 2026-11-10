import { typesInASentence } from '../../../../helpers/qorusTypeCatalogue';
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import { ReqoreIcon, ReqoreP, ReqoreSpan, useReqoreTheme } from '@qoretechnologies/reqore';
import { TReqoreEffectColor } from '@qoretechnologies/reqore/dist/components/Effect';
import { getCalmAttentionColours, getCalmIntentText, useIsCalmForm } from '../../engine/formAppearance';
import { uniq } from 'lodash';
import { argumentMatchesType, getArgumentType } from '../../../../helpers/expressions';
import { validateFieldWithResult } from '../../../../helpers/validations';
import { useQorusTypes } from '../../../../hooks/useQorusTypes';
import { useReadableIntentShade } from '../../../../hooks/useReadableIntentShade';
import { useReadableOpacity } from '../../../../hooks/useReadableOpacity';
import { READABLE_ICON } from '../../../../helpers/readableColors';
import { IExpression, IExpressionSchema, IExpressionSchemaArg, IExpressionValue } from '../types';
import { useExpressionType } from '../useExpressionType';

/**
 * Whether an argument holds an expression whose type the server can tell only when it runs (`known: false`, as of a
 * template that reads the incoming data). Such an argument is not judged against the type it takes; the value says
 * instead that it depends on the incoming data (`ExpressionBuilderArgumentRuntimeNote`).
 */
export const useArgumentKnownWhenItRuns = (arg?: IExpression): boolean => {
  const served = useExpressionType(
    arg?.is_expression ? (arg.value as IExpressionValue) : undefined
  );
  return !!arg?.is_expression && served?.known === false;
};

/**
 * Said under an argument's value when that value depends on the incoming data: plain words, on the value they are
 * about, rather than a type name in the argument's header (qlip review of #161: the users are supply chain managers).
 */
export const ExpressionBuilderArgumentRuntimeNote = () => {
  const hintOpacity = useReadableOpacity(0.5);
  const engineLabels = useReqraftLabels().formEngine;
  return (
    <ReqoreP
      size='tiny'
      className='expression-arg-runtime-note'
      effect={{ italic: true, weight: 'light', opacity: hintOpacity }}
    >
      <ReqoreIcon icon='InformationLine' size='10px' margin='right' />
      {engineLabels.knownWhenItRuns}
    </ReqoreP>
  );
};

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
  // the type and the hint after a name, light and softer: as soft as they still read (qorus#646)
  const hintOpacity = useReadableOpacity(0.5);
  // the marks beside a name - invalid, required, the wrong type, a type that fits - in shades that stand out
  const dangerMark = useReadableIntentShade('danger', READABLE_ICON);
  const warningMark = useReadableIntentShade('warning', READABLE_ICON);
  const pendingMark = useReadableIntentShade('pending', READABLE_ICON);
  const types = useQorusTypes();
  // an expression's type is the server's (getArgumentType reads it); this re-renders the label when it arrives. The
  // server cannot tell some operations' type before they run (`known: false`): such a value is not judged here, and
  // the note under it says it depends on the incoming data
  const knownWhenItRuns = useArgumentKnownWhenItRuns(arg);
  const words = useReqraftLabels().expressions;
  const engineWords = useReqraftLabels().formEngine;
  const theme = useReqoreTheme();
  /* Calm, as the calm form's labels: the name as it is written, not forced into capitals, at the small text size and
     in the quiet label weight; no red asterisk and no red underline. What an operand lacks is said in words, in the
     calm form's ("Required · add a value"), and what is wrong in its meaning's color as a word that reads. */
  const calm = useIsCalmForm();
  const nameEffect =
    calm ?
      ({ weight: 'bold' } as const)
    : ({ uppercase: true, spaced: 1, weight: 'thick' } as const);

  if (!schema) {
    return (
      <ReqoreP
        size={calm ? 'small' : 'tiny'}
        className='expression-arg-label'
        effect={{ ...nameEffect, opacity: calm ? 0.75 : 0.6 }}
      >
        {label}
      </ReqoreP>
    );
  }

  const matchesType = argumentMatchesType(expressions, arg, schema, types.value);

  const argumentType = getArgumentType(expressions, arg, schema);
  const matchesTypeExactly =
    types.getExactMatches(schema.ui_type).includes(argumentType) ||
    types.getExactMatches(schema.ui_type).includes('any') ||
    type === 'any';
  const acceptedTypes = uniq([
    ...types.getExactMatches(schema.ui_type),
    ...types.getAcceptedTypes(schema.ui_type),
  ]);
  /** The types this argument takes, named inside a sentence: "a whole number or a number" (qorus#646). */
  const acceptedTypeNames =
    typesInASentence(acceptedTypes, (t) => types.getTypeSentenceForm(t)) ?? '';
  /* `arg` is optional — an operand the author has not filled in yet has no
     entry at all, and a literal carried straight from a parse can be the null
     literal itself. Both were dereferenced unguarded here, which took the whole
     expression editor down to its error boundary rather than drawing an empty
     argument. */
  const { isValid, reason } =
    arg?.is_expression ?
      validateFieldWithResult('expression', arg, { expressions })
    : validateFieldWithResult(argumentType, arg?.value, schema, !schema.required);

  // an operand the author has not filled in yet, which its expression needs
  const missing =
    !!schema.required &&
    !arg?.is_expression &&
    (arg?.value === undefined || arg?.value === null || arg?.value === '');
  // calm: a missing operand is not an error, it is the next step - said in words, quietly; anything else is a fault
  const fault = !isValid && !(calm && missing);

  return (
    <ReqoreP size={calm ? 'small' : 'tiny'} className='expression-arg-label' effect={nameEffect}>
      {fault && (
        <ReqoreIcon icon='ErrorWarningLine' color={dangerMark} size='10px' margin='right' />
      )}
      {schema.display_name && (
        <ReqoreSpan
          effect={{
            // calm: the name in the quiet label color, as a calm form's names are
            opacity: calm ? 0.75 : 1,
            underline: !calm && (!isValid || !matchesType) ? 'underline solid red' : undefined,
          }}
          tooltip={
            isValid ?
              !matchesType ?
                words.operandNotOfType(acceptedTypeNames)
              : undefined
            : reason
          }
        >
          {schema.display_name}
        </ReqoreSpan>
      )}{' '}
      {schema.required && !calm ?
        <ReqoreIcon icon='Asterisk' color={dangerMark} size='10px' />
      : null}{' '}
      {label}
      <ReqoreSpan
        effect={{
          italic: true,
          weight: 'light',
          opacity: hintOpacity,
        }}
      >
        {'['}
        {types.getTypeDisplayName(schema.ui_type, schema.base_type)}
      </ReqoreSpan>
      {!matchesType ?
        <ReqoreIcon icon='ErrorWarningLine' color={warningMark} size='10px' margin='both' />
      : null}
      {(
        !knownWhenItRuns &&
        (argumentType || (arg?.is_expression && arg.value?.exp)) &&
        types.getTypeDisplayName(argumentType) !==
          types.getTypeDisplayName(schema.ui_type, schema.base_type) &&
        !matchesTypeExactly
      ) ?
        <>
          {matchesType ?
            <ReqoreIcon
              icon='CheckLine'
              // calm: no purple - it is no AI or Qonsole action - the quiet text color
              color={calm ? (getCalmAttentionColours(theme).pending as TReqoreEffectColor) : pendingMark}
              size='10px'
              margin='both'
              tooltip={words.operandMayConvert}
            />
          : null}

          <ReqoreSpan
            effect={{
              italic: true,
              weight: 'light',
              opacity: 1,
              underline: 'underline 1px dotted',
              // calm: the type that fits is said in the text color; one that does not, in amber as a word
              ...(calm && !matchesType ?
                { color: getCalmIntentText(theme, 'warning') as TReqoreEffectColor }
              : {}),
            }}
            intent={
              calm ? undefined
              : matchesType ?
                'pending'
              : 'warning'
            }
            tooltip={
              matchesType ? words.operandMayConvert : words.operandNeedsType(acceptedTypeNames)
            }
          >
            {types.getTypeDisplayName(argumentType)}
          </ReqoreSpan>
        </>
      : null}
      <ReqoreSpan
        effect={{
          italic: true,
          weight: 'light',
          opacity: hintOpacity,
        }}
      >
        {']'}
      </ReqoreSpan>
      {calm && missing ?
        <ReqoreSpan
          className='expression-arg-required'
          effect={{
            color: getCalmAttentionColours(theme).pending as TReqoreEffectColor,
            weight: 'normal',
          }}
          // apart from the type before it, as a word of its own
          style={{ marginLeft: 6 }}
        >
          {engineWords.calmRequired}
        </ReqoreSpan>
      : null}
    </ReqoreP>
  );
};

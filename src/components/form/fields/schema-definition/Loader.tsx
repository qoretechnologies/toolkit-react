/**
 * Minimal loader used while the schema option catalogue is being
 * fetched. Stands in for qorus-ide's branded `Loader` without its
 * VS Code `apiHost` image dependency.
 */
import { useReqraftLabels } from '../../../../helpers/reqraftLabels';
import { ReqoreSpinner } from '@qoretechnologies/reqore';
import { IReqoreSpinnerProps } from '@qoretechnologies/reqore/dist/components/Spinner';

export interface ILoaderProps extends Partial<IReqoreSpinnerProps> {
  text?: string;
  inline?: boolean;
}

const Loader = ({ text, inline, ...rest }: ILoaderProps) => {
  const schemaWords = useReqraftLabels().schemaDefinition;

  return (
    <ReqoreSpinner type={5} iconColor='info' size='huge' centered={!inline} {...rest}>
      {text ?? schemaWords.loading}
    </ReqoreSpinner>
  );
};

export default Loader;

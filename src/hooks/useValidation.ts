import { TFormFieldType } from '../types/Form';

export const useValidation = (value: any, type?: TFormFieldType) => {
  // Build validation...
  console.log(value, type);

  return true;
};

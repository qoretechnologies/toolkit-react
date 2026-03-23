import { TQorusType } from '@qoretechnologies/ts-toolkit';
import { IColorFormFieldProps } from '../components/form/fields/color/Color';

export type TFormFieldType = TQorusType;

export type TFormFieldValueType<T> =
  T extends 'string' | 'long-string' | 'binary' | 'email' | 'url' | 'enum' | 'select-string' | 'file-as-string' ? string
  : T extends 'int' | 'integer' | 'float' | 'number' ? number
  : T extends 'bool' | 'boolean' ? boolean
  : T extends 'date' ? Date | string
  : T extends 'hash' | 'free-hash' | 'data' ? Record<string, any>
  : T extends 'list' | 'free-list' | 'range' ? unknown[]
  : T extends 'rgbcolor' ? IColorFormFieldProps['value']
  : T extends 'file' ? File
  : T extends 'richtext' ? string
  : T extends 'auto' | 'any' ? any
  : T extends 'null' | 'nothing' ? null
  : any;

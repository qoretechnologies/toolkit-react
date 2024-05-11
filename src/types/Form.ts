import { IColorFormFieldProps } from '../components/form/fields/color/Color';

export type TFormFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multiSelect'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'image'
  | 'color'
  | 'password'
  | 'email'
  | 'phone'
  | 'url'
  | 'markdown'
  | 'longstring';

export type TFormFieldValueType<T> =
  T extends 'string' ? string
  : T extends 'number' ? number
  : T extends 'boolean' ? boolean
  : T extends 'date' ? Date | string
  : T extends 'time' ? Date | string
  : T extends 'datetime' ? Date | string
  : T extends 'select' ? string
  : T extends 'multiSelect' ? string[]
  : T extends 'radio' ? string
  : T extends 'checkbox' ? boolean
  : T extends 'file' ? File
  : T extends 'image' ? string
  : T extends 'color' ? IColorFormFieldProps['value']
  : T extends 'password' ? string
  : T extends 'email' ? string
  : T extends 'phone' ? string
  : T extends 'url' ? string
  : T extends 'markdown' ? string
  : T extends 'longstring' ? string
  : any;

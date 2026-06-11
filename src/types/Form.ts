import { TQorusType } from '@qoretechnologies/ts-toolkit';
import { IColorFormFieldProps } from '../components/form/fields/color/Color';

// The server's TQorusType plus the toolkit-only dispatcher types: `soft*`
// variants (rendered as their concrete base) and the composite fields the
// IDE routes via `ui_type`.
export type TFormFieldType =
  | TQorusType
  | 'softint' | 'softstring' | 'softbool' | 'softfloat' | 'softnumber' | 'softdate' | 'softlist'
  | 'byte-size'
  | 'multi-select'
  | 'schema-definition';

export type TFormFieldValueType<T> =
  T extends 'string' | 'long-string' | 'binary' | 'email' | 'url' | 'enum' | 'select-string' | 'file-as-string' | 'byte-size' ? string
  : T extends 'int' | 'integer' | 'float' | 'number' ? number
  : T extends 'bool' | 'boolean' ? boolean
  : T extends 'date' ? Date | string
  : T extends 'hash' | 'free-hash' | 'data' ? Record<string, any>
  : T extends 'list' | 'free-list' | 'range' | 'multi-select' ? unknown[]
  : T extends 'rgbcolor' ? IColorFormFieldProps['value']
  : T extends 'file' ? File
  : T extends 'richtext' ? string
  : T extends 'auto' | 'any' ? any
  : T extends 'null' | 'nothing' ? null
  : any;

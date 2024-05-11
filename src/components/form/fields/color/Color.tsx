import { SketchPicker, SketchPickerProps } from 'react-color';
import styled from 'styled-components';

export interface IColorFormFieldProps extends Omit<SketchPickerProps, 'onChange'> {
  value: SketchPickerProps['color'];
  onChange(value: IColorFormFieldProps['value']);
}

export const StyledSketchPicker = styled(SketchPicker)`
  &&& {
    background-color: transparent !important;
    width: 100% !important;
    max-width: 400px !important;
    box-shadow: none !important;
    padding: 0 !important;

    > div:first-child {
      padding-bottom: unset !important;
      height: 100px !important;
    }

    label {
      color: #fff !important;
    }
    input {
      width: 100% !important;
    }
    .flexbox-fix {
      border: none !important;
    }
  }
`;

export const ColorFormField = ({ value, onChange, ...rest }: IColorFormFieldProps) => {
  return (
    <StyledSketchPicker
      onChange={(color) => onChange(color.rgb)}
      color={value}
      disableAlpha
      {...rest}
    />
  );
};

export default ColorFormField;

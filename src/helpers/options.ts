import { IQorusFormSchema, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';

export const getOptionsFromRequiredGroups = (
  schema: IQorusFormSchema,
  groups: string[],
  currentOption?: string
): string[] => {
  return Object.keys(schema)
    .filter((option) => {
      return (schema[option] as TQorusFormFieldSchema).required_groups?.some((group) =>
        groups.includes(group)
      );
    })
    .filter((option) => option !== currentOption);
};

export const getRequiredOptionMessage = (
  schema: IQorusFormSchema,
  groups: string[],
  currentField: string
): string => {
  if ((schema[currentField] as TQorusFormFieldSchema).required) {
    return 'This field is required';
  }

  const requiredOptions = getOptionsFromRequiredGroups(schema, groups, currentField)
    .map((option) => (schema[option] as TQorusFormFieldSchema).display_name)
    .join(' or ');

  return `This field or ${requiredOptions} is required`;
};

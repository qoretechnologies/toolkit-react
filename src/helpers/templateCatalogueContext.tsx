// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The template catalogue of the fields inside it, and where they are (qorus#646): a host that knows where its fields
 * are - an interface's editor, a Qog state's options - asks Qorus for their catalogue (REST `getTemplateCatalogue`
 * with their field context) and gives both here. Every rich-text, template and DPQL field inside offers the
 * catalogue's contexts without each being handed it, and a DPQL field tells its language server where it is
 * (`field_context`), for the server's own catalogue and completions. A field's own props are its own.
 */
import { createContext, ReactNode, useContext, useMemo } from 'react';
import type { ITemplateCatalogue, ITemplateFieldContext } from './templateCatalogue';
import type { ITemplatePickerLabels } from './templateListLabels';

interface ITemplateCatalogueContextValue {
  catalogue?: ITemplateCatalogue;
  fieldContext?: ITemplateFieldContext;
  pickerLabels?: Partial<ITemplatePickerLabels>;
}

const TemplateCatalogueContext = createContext<ITemplateCatalogueContextValue>({});

export const TemplateCatalogueProvider = ({
  catalogue,
  fieldContext,
  pickerLabels,
  children,
}: {
  catalogue?: ITemplateCatalogue;
  fieldContext?: ITemplateFieldContext;
  /** The words of the template picker of the fields here, in the host's language. */
  pickerLabels?: Partial<ITemplatePickerLabels>;
  children?: ReactNode;
}) => {
  const value = useMemo(
    () => ({ catalogue, fieldContext, pickerLabels }),
    [catalogue, fieldContext, pickerLabels]
  );
  return <TemplateCatalogueContext.Provider value={value}>{children}</TemplateCatalogueContext.Provider>;
};

/** The template catalogue of the fields here, if a host gave one (`TemplateCatalogueProvider`). */
export const useTemplateCatalogue = (): ITemplateCatalogue | undefined =>
  useContext(TemplateCatalogueContext).catalogue;

/** The words of the template picker of the fields here, if a host gave them (`TemplateCatalogueProvider`). */
export const useTemplatePickerLabels = (): Partial<ITemplatePickerLabels> | undefined =>
  useContext(TemplateCatalogueContext).pickerLabels;

/** Where the fields here are, if a host said (`TemplateCatalogueProvider`). */
export const useTemplateFieldContext = (): ITemplateFieldContext | undefined =>
  useContext(TemplateCatalogueContext).fieldContext;

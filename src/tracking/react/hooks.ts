import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { IAssignment } from '../core/experiments';
import { Observable } from '../core/observable';
import type { TConsentState } from '../core/types';
import { useTrackingContext } from './TrackingProvider';

const noopSubscribe = () => () => undefined;

/** The visitor's consent and the two answers. `unknown` outside a provider. */
export const useConsent = () => {
  const { tracker } = useTrackingContext();
  const state = useSyncExternalStore<TConsentState>(
    tracker ? tracker.consent.state.subscribe : noopSubscribe,
    () => (tracker ? tracker.consent.get() : 'unknown'),
    () => 'unknown',
  );
  const grant = useCallback(() => tracker?.grant(), [tracker]);
  const deny = useCallback(() => tracker?.deny(), [tracker]);
  return { state, grant, deny, available: !!tracker };
};

/** Whether the app asked to reopen its consent prompt (a "Cookie settings" link). */
export const consentPanel = new Observable<boolean>(false);
export const openConsentSettings = () => consentPanel.set(true);
export const closeConsentSettings = () => consentPanel.set(false);
export const useConsentPanelOpen = () => useSyncExternalStore(consentPanel.subscribe, consentPanel.get, consentPanel.get);

export interface IUseExperimentOptions {
  /** The control's key (default `a`): served whenever the visitor is not assigned. */
  control?: string;
  /** Variant keys this code can render; an assignment outside it falls back to the control. */
  variants?: string[];
  /** Trigger section when the experiment definition names none. */
  trigger?: string;
}

export interface IUseExperiment {
  variant: string;
  assignment: IAssignment;
  /** Put on the element whose being seen counts as exposure, when there is no trigger section. */
  triggerRef: (el: Element | null) => void;
}

/**
 * The variant this visitor sees. Decided once when the component mounts and kept
 * for the page view (no flicker when definitions or consent arrive later: the
 * next page view picks them up). Two exceptions, both for an editor: the in-app
 * version switch (`setEditorOverride`) applies at once, and `experiments.refresh()`
 * (after a winner is accepted or a version removed) decides again. Logs the exposure once per page view when the
 * trigger is seen, and only for enrolled visitors (never for a preview or a winner).
 */
export const useExperiment = (key: string, options: IUseExperimentOptions = {}): IUseExperiment => {
  const { tracker, attached } = useTrackingContext();
  const control = options.control ?? 'a';
  const known = options.variants;
  const decide = useCallback((): IAssignment => {
    const a: IAssignment = tracker
      ? tracker.decide(key, control)
      : { key, variant: control, enrolled: false, reason: 'no-consent', trigger: null };
    return known && !known.includes(a.variant) ? { ...a, variant: control, enrolled: false } : a;
    // `known` is the variant keys of the call site: constant for its lifetime.
  }, [tracker, key, control]);
  const [mounted] = useState<IAssignment>(decide);
  const store = tracker?.experiments;
  const revision = useSyncExternalStore(store ? store.revision.subscribe : noopSubscribe, () => store?.revision.get() ?? 0, () => 0);
  const editorVariant = useSyncExternalStore(
    store ? store.editorOverrides.subscribe : noopSubscribe,
    () => store?.editorOverrideOf(key),
    () => undefined,
  );
  // Windows of the same app (an editor and its preview frame) share the switch through localStorage.
  useEffect(() => {
    if (!store || typeof window === 'undefined') return undefined;
    const onStorage = () => store.reloadEditorOverrides();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [store]);
  // Same object while no switch or refresh changed it, so the exposure watch is not re-created.
  const [mountedSwitch] = useState(editorVariant);
  const assignment = useMemo(
    () => (revision === 0 && editorVariant === mountedSwitch ? mounted : decide()),
    [revision, editorVariant, mountedSwitch, mounted, decide],
  );
  const element = useRef<Element | null>(null);
  const triggerRef = useCallback((el: Element | null) => {
    element.current = el;
  }, []);

  useEffect(() => {
    if (!tracker || !assignment.enrolled) return undefined;
    let trigger = assignment.trigger ?? options.trigger ?? null;
    let unobserve: (() => void) | undefined;
    if (!trigger && element.current && attached.current) {
      trigger = `experiment:${key}`;
      unobserve = attached.current.observeElement(element.current, trigger);
    }
    const unwatch = tracker.watchExposure({ ...assignment, trigger });
    return () => {
      unwatch();
      unobserve?.();
    };
    // A new assignment only comes from a switch or a refresh; options.trigger is a constant at the call site.
  }, [tracker, assignment]);

  return { variant: assignment.variant, assignment, triggerRef };
};

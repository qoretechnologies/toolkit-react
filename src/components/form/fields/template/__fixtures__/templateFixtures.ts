// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The template catalogues the stories offer, as the server sends them, with each app's logo served from the
 * story's own origin.
 *
 * The server names an app's logo by URL - `<instance>/api/public/apps/<app>/logo`
 * (`DataProviderAppsRestClass::doGetLogo` in Qorus) - and the JSON keeps that URL, as a catalogue from the
 * server has it. A story loads nothing from a server, though (`realNetworkGuard` fails one that does), so the
 * image itself is a copy of that logo, here. The fixture's URL was `.../apps/Qorus/qorus-logo.svg`, which the
 * server never served: every chip and list row with the Qorus logo showed an empty slot in its capture.
 */
import qorusAppLogo from '../../../../../stories/Data/qorusAppLogo.svg';
import multiLevelTemplatesJson from './multiLevelTemplates.json';
import templatesJson from './templates.json';

/** An app's logo as the server names it, on whatever instance: `.../api/public/apps/<app>/logo`. */
const APP_LOGO_PATH = /\/api\/public\/apps\/([^/]+)\/logo$/;

/** The local copy a story shows for each app's logo, by app. */
const LOCAL_LOGOS: Record<string, string> = {
  Qorus: qorusAppLogo,
};

/** A catalogue with its apps' logos served locally. A logo with no local copy is left, and the guard names it. */
const withLocalLogos = <T extends Record<string, { logo?: string }>>(catalogue: T): T =>
  Object.fromEntries(
    Object.entries(catalogue).map(([key, app]) => {
      const local = LOCAL_LOGOS[APP_LOGO_PATH.exec(app.logo ?? '')?.[1] ?? ''];
      return [key, local ? { ...app, logo: local } : app];
    })
  ) as T;

export const templates = withLocalLogos(templatesJson);
export const multiLevelTemplates = withLocalLogos(multiLevelTemplatesJson);

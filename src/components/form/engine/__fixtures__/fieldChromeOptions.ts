// Shared field-chrome / meta schema bodies used by both the CompactFieldTypes
// catalog and the CompactShowcase stress schema; each site decorates them
// (group / preselected / extra messages) on top.

// A tiny inline SVG logo so the `image` chrome examples need no network.
export const FIXTURE_LOGO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%233b8eea'/%3E%3Ctext x='12' y='16' font-size='10' text-anchor='middle' fill='white'%3EQ%3C/text%3E%3C/svg%3E";

export const chromeFieldBases = {
  chromeIcon: {
    type: 'string',
    ui_type: 'string',
    display_name: 'With icon',
    icon: 'Database2Line',
  },
  chromeImage: {
    type: 'string',
    ui_type: 'string',
    display_name: 'With image (logo)',
    image: FIXTURE_LOGO,
  },
  chromeIntent: {
    type: 'string',
    ui_type: 'string',
    display_name: 'With intent (danger)',
    intent: 'danger',
  },
};

export const metaFieldBases = {
  metaSensitive: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Sensitive (masked)',
    sensitive: true,
  },
  metaDefault: {
    type: 'number',
    ui_type: 'number',
    display_name: 'Default-value note',
    default_value: { type: 'number', value: 30 },
    default_value_desc: 'Falls back to 30 seconds when unset.',
    default_value_display_name: 'thirty',
  },
};

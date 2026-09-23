# The select picker's dialog floor

**As-built.** `src/components/form/fields/select/SelectCollection.tsx` —
`SELECT_DIALOG_MIN_WIDTH`, `SELECT_DIALOG_MIN_HEIGHT`, `StyledSelectDialog`.

## What it is

The picker dialog (`ReqoreModal`) is resizable, and it cannot be dragged below
**320px wide x 180px tall**. The floor is expressed as CSS on the element
`re-resizable` sizes, not as a prop on the modal:

```
min-width:  min(320px, 90vw)  !important;
min-height: min(180px, 90vh)  !important;
```

## Why those two numbers

Measured on `components-form-select--item-actions-in-the-title-bar` at
1400x1000, sweeping the dialog's width and height:

- **320px wide.** The collection lays its rows out in 300px columns
  (`minColumnWidth`), so a row is 300px wide whatever the dialog does. At 300px
  the row overhangs the dialog by 13px and at 310px by 3px; 320px is the first
  round width that contains it (-7px). From 340px the row grows with the box.
- **180px tall.** The panel header is 55px and the search field 26px, and both
  are whole from 100px — but the list below them has to show one entry in full
  or there is nothing choosable in the dialog. A plain row is 56px and is whole
  from 160px; a row carrying a description is 70px and needs 174px. The floor
  takes the taller of the two, because the same dialog serves both (qorus-ide's
  assertion-kind picker is the described-row case). 180px is the first round
  height that contains it.

Both are capped at the viewport — `min(320px, 90vw)` / `min(180px, 90vh)` — so
a phone gets a dialog it can see all of rather than a floor wider than its
screen. reqore's own maximum for a centred modal is `90vw` / `90vh`, so the cap
matches the ceiling it is measured against. The cap only engages below roughly
a 356px viewport (320 / 0.9).

## Why CSS and not `minSize` / `minWidth`

**reqore 0.74.1 has no working per-modal minimum.** A modal is a `ReqoreDrawer`
with `layout === 'center'`, and in that branch the floor is a literal:

```js
minHeight: layout === 'center' ? '40px' : layout === 'horizontal' ? … minSize || '40px' …
minWidth:  layout === 'center' ? '40px' : layout === 'vertical'   ? … minSize || '40px' …
```

(`node_modules/@qoretechnologies/reqore/dist/components/Drawer/index.js`,
≈L284-295.) `minSize` is read only on the edge layouts, so a centred modal
ignores it entirely and floors at 40px.

`className` does reach the element `re-resizable` sizes and drags, and a CSS
`min-width` clamps that element's **rendered** box however far the drag goes.
So the floor holds against the reqore we pin *and* against the `minWidth` /
`minHeight` props reqore grew later.

`!important` is load-bearing, not decoration: `re-resizable` writes its own
`min-width` / `min-height` **inline** on this same element, and an inline
declaration beats a normal one from a stylesheet.

## The cost: the inline width and the rendered box diverge

Clamping the box from outside `re-resizable` rather than through it costs one
thing, and it is not the thing it looks like. The drag stays exact: each move
sizes the box from where the drag *started* plus the pointer's delta, not from
the last size, so coming back out tracks the pointer with no dead zone.
Measured: past the floor the rendered box holds **320x180** while the inline
`style.width` reads **40px**, and 300px back out the box is 400px again.

What is left behind is that divergence — an inline width smaller than the box
anyone can see.

> **Read this dialog's size from its rect (`getBoundingClientRect()`), never
> from `style.width` / `style.height`.** A test or a consumer that reads the
> inline value gets 40px for a dialog that is plainly 320px wide.

## Exit condition

Drop the whole mechanism — the styled wrapper, the `!important`, and this
document — once reqraft can pin a reqore whose centred modals honour a
per-modal minimum. At that point `SELECT_DIALOG_MIN_WIDTH` /
`SELECT_DIALOG_MIN_HEIGHT` become `minWidth` / `minHeight` props on the modal,
`re-resizable` is told the floor instead of being overruled after the fact, and
the inline size and the rendered box agree again.

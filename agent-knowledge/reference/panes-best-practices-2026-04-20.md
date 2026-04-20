# Panes / Workspace / Split-View Best Practices — 2026-04-20

> Research digest feeding a Tinker `packages/panes` cleanup. Targets: VSCode grid/editor parts, Superset `@superset/panes` (fork-candidate), cmux (Swift, UX-only), react-mosaic, Dockview.

Scope: confirm what we already do right, find concrete primitives to steal or delete, keep the package lean before Dockview migration finishes (per [[D16]]).

---

## 1. Reference-library at-a-glance

| Library | Tree shape | Size storage | Drop zones | Persist format | Notes |
|---|---|---|---|---|---|
| VSCode `GridView` | n-ary branch, n-ary children array | absolute pixels per child, recomputed | 5-zone (top/right/bottom/left/center) via `EditorDropTarget.positionOverlay` | `ISerializedGrid` w/ recursive `branch\|leaf` nodes, each carrying `size` | nested `SplitView`s alternate orientation; `snap` + `edgeSnapping` are first-class |
| Dockview (`mathuo/dockview`) | n-ary (wraps `Gridview`) | abs pixel via internal `SplitView` | 5-zone `Droptarget` (center only when empty; edge always) | `SerializedDockview` w/ `grid.root`, flat `panels` record, plus floating/popout groups | Fork of VSCode split internals |
| react-mosaic | strict binary (`first`/`second`/`direction`/`splitPercentage`) | percentage (0–100) on parent | 4-zone via `react-dnd`; no center-merge (tree is always split) | The tree itself is the serial form | Simplest possible; no tabs within leaf |
| Superset `@superset/panes` | wraps `react-mosaic` (binary) | `splitPercentage` | Handled by mosaic + custom tab/merge logic in zustand actions | zustand `persist` middleware, key `tabs-storage` | Tabs live above layout; panes flattened in a record w/ `tabId` back-ref |
| cmux (Swift) | n-ary via `BonsplitController` | opaque (AppKit) | N/A — no web DnD | `cmux.json` recursive split/pane nodes | UX wins: attention flashes, unread badges, `focusedPanelId`, focus flash on new pane |
| Tinker today | strict binary split node (`a`/`b`) + stack leaves; stacks hold ordered `paneIds` | `ratio` (0.1–0.9 clamp) on each split | 5-zone body + tab-strip insert index | `WorkspaceState<TData>` shipped via `selectWorkspaceSnapshot` | Feature-for-feature parity with Dockview's common path |

---

## 2. What VSCode does right — steal or confirm

VSCode `src/vs/base/browser/ui/grid/gridview.ts`:

- **N-ary branches, not binary.** `class BranchNode` line 380 has `readonly children: Node[] = []` and delegates layout to a single `SplitView<ILayoutContext, Node>`. A deeply nested 3-way row is *one* branch with 3 children, not two nested binary splits. Source: https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/grid/gridview.ts#L380
- **Absolute pixel sizes at the node, ratios are derivative.** Each `LeafNode` stores `_size: number` (line 868); `BranchNode` exposes `size` + `orthogonalSize`. Layout pushes concrete px down, resize API is `resizeChild(index, sizeInPx)`. The serialized form keeps `size` per node — there's no `ratio` field. Source: https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/grid/gridview.ts#L868
- **Per-view min/max constraints are part of the `IView` contract,** not a layout-time afterthought: `minimumWidth/maximumWidth/minimumHeight/maximumHeight` are required; GridView re-lays-out on constraint change.
- **`snap` is a per-view hint** (line 102, 909) that tells `SplitView` to collapse to the min-size boundary instead of resisting. `edgeSnapping` on the GridView (line 631, setter 1295) propagates to branches. Users get Figma-style edge sticky behavior for free.
- **Serialization is recursive + self-describing.** `ISerializedLeafNode` (lines 163–169) and `ISerializedBranchNode` (lines 171–177):
  ```ts
  ISerializedLeafNode = { type: 'leaf', data: unknown, size: number, visible?, maximized? }
  ISerializedBranchNode = { type: 'branch', data: ISerializedNode[], size: number, visible? }
  ```
  No separate lookup map — leaf `data` carries the renderer payload inline. Restore is `GridView.deserialize(json, deserializer, options)` at line 1435.
- **Editor drop geometry is explicitly tuned** (`editorDropTarget.ts` lines 534–548): edge factor is **0.1 of control dimension for tabs**, **0.3 for whole-group drags**; split threshold is **width/3** so "prefer the split this user configured" wins when the pointer lands in the 0.1–0.33 band. Source: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/browser/parts/editor/editorDropTarget.ts#L534
- **Center drop = merge/insert-into-active,** edges = split. Dockview narrows this further: center is only a valid zone when the grid is totally empty (`acceptedTargetZones` on `_rootDropTarget`).
- **Group-drag vs. tab-drag are distinct payload types** — `DraggedEditorIdentifier` and `DraggedEditorGroupIdentifier` transferred via `LocalSelectionTransfer`. Copy vs. move is a modifier key (Ctrl / Alt). Means you can drag the whole stack not just its active tab.
- **Layout JSON is human-shaped.** Example from `EditorGroupLayout`:
  ```json
  { "orientation": 0,
    "groups": [ { "groups": [{"size":0.4},{"size":0.6}], "size": 0.5 },
                { "groups": [{},{}], "size": 0.5 } ] }
  ```
  The top-level wrapper is tiny; most fields are optional.

---

## 3. What Tinker does wrong / could steal

Against `packages/panes/src/core/store/store.ts` and `layout.ts`:

1. **Binary-only split tree blows up branching.** `SplitNode = { a: LayoutNode, b: LayoutNode, orientation }` — a 4-column row becomes 3 nested splits, each with its own ratio + resize handle + focus target. VSCode/Dockview collapse that into one `BranchNode` with `children: [...]` and one SplitView instance. Makes equal-split, "fit all evenly," keyboard nav, and ratio math all cleaner. Refs: `layout.ts:65–78` (`splitNode`), `SplitTree.tsx:63–82` (ratio → grid template computation hardcodes 2 children).
2. **Ratio-on-split vs. size-on-child.** `clampRatio 0.1..0.9` (`layout.ts:15–25`) is a 2-child shortcut that doesn't generalize to n children. If/when we move n-ary, switch to per-child sizes (abs px or normalized 0..1 array) — matches VSCode `SplitView` exactly.
3. **No `snap` / min-size hook.** `PaneDefinition` in `react/types.ts` (implied) doesn't declare `minimumWidth/minimumHeight/snap`. Chat vs. VaultBrowser vs. Today may have wildly different useful minima. Add it to `PaneDefinition` rather than let each renderer learn to hide controls below 240px.
4. **Drop-zone fraction is a single constant (28%).** `Stack.tsx:22` `EDGE_ZONE_FRACTION = 0.28`. VSCode differentiates tab-drag (10%) vs. group-drag (30%). We don't distinguish — and we don't expose group drag at all (see #7 in Deletions? no, this is Steal). Good small change: allow group drag on the stack header, bump to 0.3 for that payload kind.
5. **`activeStackId` + `activePaneId` are separate state slots.** Store keeps both in Tab (store.ts:243, 307–317). They can desync after close/move; `closePane` has to rebuild both with cascading `??` fallbacks (store.ts:309–317). VSCode keeps one "active group" and groups own their active editor — so invariants narrow. We could: (a) derive `activePaneId` from `activeStackId`'s stack, (b) drop `activePaneId` from Tab.
6. **`panes` record + `paneIds` in stack = two sources of truth for pane identity.** store.ts:137 clones `tab.panes` every mutation; stacks store ordered `paneIds`; removal has to match both. VSCode's serialized form inlines pane data in the leaf node. Tradeoff: easier record access for O(1) pane-by-id lookup, but the `Tab.panes` Record is never pruned at boundaries where it should be (e.g. if a pane somehow isn't in any stack, it lingers forever). Either keep the invariant checked (assert on hydrate) or drop the record and walk the tree.
7. **Focus flashes / attention cues are missing.** cmux `triggerFocusFlash`, blue-ring for waiting agents, Cmd+Shift+U to the newest unread. Tinker has zero of this. Cheap to add once Chat has a "needs attention" signal — hang it off `Pane<TData>` (`attention?: 'unread' | 'waiting' | null`) and let renderers own the flash CSS.
8. **Tab-strip on root workspace and stack-tabs are parallel implementations.** `TabStrip.tsx` and `Stack.tsx` each reimplement drag-reorder + insert-indicator + keyboard arrows (TabStrip: lines 42–89, Stack: 159–218). Superset proves you can reuse a single `TabBar` component across both layers. Extract.
9. **Drop handler dispatch goes through a 3-branch fallback** (`Workspace.tsx:53–82`: `onDropPane` → `onDropPaneOnPane` shim → `actions.movePane`). Legacy `onDropPaneOnPane` is code that only exists to keep pre-D16 callers alive. Kill the shim as soon as migration's done.
10. **Ids are time-based (`Date.now().toString(36) + counter`).** `layout.ts:32–39`. Fine for runtime but Superset's persisted layouts use caller-supplied ids so they stay stable across restart + rename operations. Tinker already lets caller pass `stack(…, id?)` — document that the desktop app should supply deterministic ids when round-tripping from the DB.

---

## 4. Deletion candidates — stuff VSCode proves we don't need

- **`splitPane` (store.ts:283–290).** Wraps `splitStack` with one step of indirection: find the host stack of `targetPaneId`, call `splitStack`. Three callers at most. Keep `splitStack` only; the desktop-side caller already has the stackId if it did `focusPane` first. Matches VSCode's "operate on group, not editor" pattern.
- **`movePaneRelativeToPane` (store.ts:434–446).** Same back-compat shim, resolves a targetPaneId → host stack, re-calls `movePane`. Delete after Dockview migration. Add "removed" note to [[D16]].
- **`Workspace.props.onDropPaneOnPane` (Workspace.tsx:63–75).** Legacy pane-on-pane drop bridge. Once desktop callers use `onDropPane` (or omit it and let the store drive), delete the prop + the whole 12-line fallback block.
- **`STACK_DRAG_MIME` in Stack.tsx:15.** Declared, never used — there's no group/stack drag yet. Delete until the feature exists. (Or: build the feature; see "Steal #4.")
- **`__classifyBodyDropForTests` and `__MIMES` test-only exports (Stack.tsx:353–354).** The classifier is a 20-line pure function. Move it to `layout.ts`, export normally, test it directly. Same with `__resetIdCounterForTests` (layout.ts:42) — inject an id factory instead of a module-scoped counter.
- **`findLayoutRoot` (store.ts:486–489).** Two-liner called by zero desktop code. Grep proves it. Drop it — callers can do `findActiveTab(state)?.layout`.
- **`findTabContainingPane` (store.ts:476–484).** Only useful if we want to dispatch actions without tabId, which we never do — every action already takes a `tabId` arg. Delete.
- **`buildPane`'s conditional title/pinned spreads (store.ts:149–155).** The `...(x === undefined ? {} : { x })` dance exists to satisfy `exactOptionalPropertyTypes`. That's fine in principle but it's repeated 3 places (here, `renameTab` store.ts:217, `renamePane` store.ts:383). Extract one `omitUndefined(obj)` helper or just set `title: title` and live with `title: undefined`.

---

## 5. Simplification candidates

- **Rewrite tree ops as visitor, not hand-rolled recursion.** `findStack`, `findStackContainingPane`, `findStackPath`, `firstStackId`, `firstPaneId`, `collapseEmptyStacks`, `replaceAtPath`, `setSplitRatioById`, `collectSpatialLayout` are all the same traversal with different visit actions. One `walk(node, visit)` + one `map(node, transform)` replaces ~120 lines in `layout.ts`.
- **Collapse `SplitTree.tsx` + `Stack.tsx` recursion into a single renderer.** Currently `SplitTree` recurses and switches on `isStack` (SplitTree.tsx:39–51); `Stack` is a separate component. VSCode / Dockview / react-mosaic all render one component that handles both (leaf → content + tabs, branch → children + dividers). Fewer props drilled.
- **Use a plain reducer, not a zustand action record.** `createStore<WorkspaceStoreState<TData>>` with an `actions` sub-object (store.ts:162) is zustand's "vanilla" escape hatch. We get none of zustand's selector/devtools affordances in return, and we pay an extra closure layer on every mutation. A plain `createStore` + exported `applyAction(state, action)` reducer is ~30% less code and makes testing actions pure. (But only do this after Dockview migration — don't thrash the API mid-flight.)
- **Drop `orientation: 'row' | 'column'`; store `'horizontal' | 'vertical'`.** CSS uses the latter; reading `flex-direction: row` for "split horizontally" is a minor but perpetual source of bug reports. VSCode uses `Orientation.HORIZONTAL | VERTICAL` enum. Our strings are fine, just pick axis-language not flexbox-language. Alternative: axis `'x' | 'y'`.
- **`DropTarget` union has 3 variants (`edge | center | insert`).** `insert` is a tab-bar-specific concept, `center` is a body-specific one. Split into two types: `BodyDrop = {edge}|{center}` and `TabBarDrop = {index}`. The store's `movePane` already branches differently on them (layout.ts:300–333). Separating avoids accidental invalid states (`{kind:'insert', index}` sent to body handler).
- **Inline + reduce `closePane`'s next-active cascade (store.ts:308–326).** 4 nullable lookups + 2 `??` fallbacks. Replace with one `resolveNextActive(layout, panes, justRemovedId)` helper that returns `{stackId, paneId}` directly.
- **Merge `computeInsertIndexFromPointer` (Stack.tsx:179–186) with `handleTabDragOver`'s effectiveIndex math (Stack.tsx:160–170).** Both compute "what index are we pointing at?" with duplicated midpoint logic. One function, called from both paths.
- **`ResizeHandle` key handling (ResizeHandle.tsx:72–99) covers Arrow/Home/End manually.** Consider an `<input type="range">` styled as a separator — keyboardy, accessible, and the browser handles Shift-modifier large-steps. (Risk: styling range inputs cross-platform is a pain. Worth prototyping.)

---

## 6. Concrete migration recs (prioritized)

1. **Delete the back-compat shims** (`splitPane`, `movePaneRelativeToPane`, `onDropPaneOnPane`) the moment [[D16]] migration closes. These are pure carry-over from Dockview's API surface.
2. **Add `minimumWidth/minimumHeight/snap` to `PaneDefinition`.** Thread them into `SplitView`-equivalent constraints on resize. Chat needs ~320px min; VaultBrowser can snap at 180px.
3. **Split the `DropTarget` union.** Safety win for zero runtime cost.
4. **Extract `walk` / `map` tree visitors in `layout.ts`.** Unlocks #5 and #6 cheaply.
5. **Collapse `activePaneId` into `activeStackId`-derived.** One invariant instead of two.
6. **Adopt VSCode's drop-zone factors (0.1 tab / 0.3 group)** once you introduce stack/group drag.
7. **Later, once DX stabilizes:** evaluate moving to n-ary branches. Not urgent — binary works fine until you see a user complaining about wonky 3-pane ratios or unequal-distribute.

Things explicitly *not* worth copying:
- VSCode's `IView`-as-interface + DI container machinery. Overkill for a React codebase where components are the unit.
- Dockview's floating/popout groups. Not in Tinker's product surface.
- react-mosaic's reliance on `react-dnd`. Native HTML5 DnD (what Tinker uses) is lighter, works fine for this.

---

## Citations

- VSCode grid core: https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/grid/gridview.ts
- VSCode editor drop target: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/browser/parts/editor/editorDropTarget.ts
- VSCode editor part (layout JSON example): https://github.com/microsoft/vscode/blob/main/src/vs/workbench/browser/parts/editor/editorPart.ts
- Dockview root drop target / 5-zone: https://github.com/mathuo/dockview/tree/master/packages/dockview-core/src/dnd
- Superset panes store: https://github.com/superset-sh/superset/tree/main/apps/desktop/src/renderer/stores/tabs
- react-mosaic `MosaicNode`: https://github.com/nomcopter/react-mosaic/blob/master/src/types.ts
- cmux `BonsplitController` / `Workspace`: https://github.com/manaflow-ai/cmux/tree/main/cmux/Workspace.swift
- Tinker files under review: `/Users/khani/Desktop/projs/tinker/packages/panes/src/{core/store/store.ts, core/utils/layout.ts, react/components/*.tsx}`

Also see `agent-knowledge/reference/panes-heritage.md` for prior decisions that seeded the current structure.

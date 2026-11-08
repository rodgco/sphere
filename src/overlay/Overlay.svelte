<script lang="ts">
  import { onMount } from 'svelte'
  import { formatPrompt, type PromptSelection } from '../runtime/format.js'
  import { pageInfo } from '../runtime/inspect.js'
  import { resolveElementSource } from '../runtime/location.js'
  import { relativeTo } from '../shared/paths.js'
  import { createSourceLoader } from '../runtime/source.js'
  import type { Inspected } from '../shared/payload.js'
  import Help from './Help.svelte'
  import Panel from './Panel.svelte'
  import { sphereConfig } from './config.js'
  import { groupDigits, writeClipboard } from './clipboard.js'
  import { lockCursor } from './cursor.js'
  import { dblpress, listen, press, shield } from './events.js'
  import { commandFor, initialTarget, navigate, type PickKey } from './keyboard.js'
  import { measureMark, measureMarks, trackMarks, type Mark } from './marks.js'
  import { startPicking } from './picking.js'
  import {
    DEFAULT_OPTIONS,
    readControl,
    readOptions,
    writeControl,
    writeOptions,
    type ControlPosition,
    type OverlayOptions,
  } from './storage.js'
  import { PICK_CAP, pickLabel, pickWhere, togglePick, type PickEntry } from './picks.js'
  import { clampControl, panelPlacement } from './position.js'

  interface Hover {
    top: number
    left: number
    width: number
    height: number
    label: string
    x: number
    y: number
  }

  interface Status {
    text: string
    error: boolean
  }

  const PANEL_WIDTH = 420

  let picking = $state(false)
  let position = $state<ControlPosition | null>(null)
  let picks = $state<PickEntry[]>([])
  let marks = $state<Mark[]>([])
  let hover = $state<Hover | null>(null)
  /**
   * The one selection the outline shows. The pointer sets it while it moves; a navigation key takes
   * it over and *locks* it, so a click confirms what is outlined even though the mouse had to travel
   * to get there (`docs/06-toolbar-ux.md` §2).
   */
  let selection = $state<Element | null>(null)
  let locked = false
  let pointerTarget: Element | null = null
  let pointerPoint = { x: 0, y: 0 }
  let status = $state<Status | null>(null)

  let options = $state<OverlayOptions>({ ...DEFAULT_OPTIONS })
  let instructions = $state('')
  let panelOpen = $state(false)
  let helpOpen = $state(false)
  let panelStyle = $state('')
  let focusPanel = $state(false)

  const loadSource = createSourceLoader({ root: sphereConfig.root, base: sphereConfig.base })

  let root: HTMLDivElement | undefined = $state()
  let shell: HTMLDivElement | undefined = $state()
  let control: HTMLButtonElement | undefined = $state()

  // Focus modality, tracked ourselves: Chromium reports `:focus-visible` after a programmatic
  // `focus()` from a pointerdown handler, which painted a rectangular ring on the pill for every
  // mouse click. The ring belongs to keyboard use only (docs/06 §8).
  let keyboard = $state(false)
  let focused = $state(false)
  const focusRing = $derived(keyboard && focused)

  let drag: {
    pointerX: number
    pointerY: number
    originX: number
    originY: number
    moved: boolean
    togglesOnTap: boolean
  } | null = null

  function noteKeyboardModality(event: KeyboardEvent) {
    if (event.key === 'Tab' || event.key === 'Shift') keyboard = true
  }

  function notePointerModality() {
    keyboard = false
  }

  onMount(() => {
    position = readControl()
    options = readOptions()

    window.addEventListener('keydown', noteKeyboardModality, true)
    window.addEventListener('pointerdown', notePointerModality, true)

    return () => {
      window.removeEventListener('keydown', noteKeyboardModality, true)
      window.removeEventListener('pointerdown', notePointerModality, true)
    }
  })

  // `bind:this` is assigned after mount, so the listener is attached from an effect rather than
  // from `onMount` (where the element can still be undefined).
  $effect(() => {
    if (shell === undefined) return
    return listen<PointerEvent>(shell, 'pointerdown', startDrag)
  })

  $effect(() => {
    if (control === undefined) return

    const stops = [
      listen<FocusEvent>(control, 'focus', () => (focused = true)),
      listen<FocusEvent>(control, 'blur', () => (focused = false)),
    ]

    return () => {
      for (const stop of stops) stop()
    }
  })

  $effect(() => {
    if (!picking) return
    return lockCursor()
  })

  $effect(() => {
    if (!picking) return
    return startPicking({
      host: overlayHost(),
      onHover: onHover,
      onPick: pickAtPointer,
      onLeave: () => {
        hover = null
        selection = null
        locked = false
      },
    })
  })

  // One place decides what the keyboard does while picking. Capture phase, so the app never sees a
  // key we handled; everything else passes through (`docs/specs/event-matrix.md`).
  $effect(() => {
    // Escape has to work whenever something of ours is open, not only while picking: after
    // Shift+Enter (or a copy) picking is over and the panel is still there.
    if (!picking && !panelOpen && !helpOpen) return

    window.addEventListener('keydown', onKeydown, true)
    return () => window.removeEventListener('keydown', onKeydown, true)
  })

  function onKeydown(event: KeyboardEvent) {
    const command = commandFor(event)
    if (command === null) return

    // Picking keys exist only while picking; Escape also closes what is left open afterwards.
    if (!picking && command !== 'leave') return

    const active = focusedElement()

    // Typing in the panel (or in an app field) is typing — except Escape, which is how picking is
    // left from anywhere. Note the shadow boundary: a listener on `window` sees the host as the
    // target, so the real focus is read from the shadow root.
    if (command !== 'leave' && (isTyping(event.target) || isTyping(active))) return

    // Enter and Space on the pill are the button's own activation (`aria-pressed`), not a pick:
    // docs/06 §1 and the a11y baseline outrank the shortcut.
    if (command === 'pick' && isOnControl(active)) return

    // Handled keys must not scroll the page (Space, arrows) or reach an app shortcut.
    event.preventDefault()
    event.stopPropagation()
    runKey(command)
  }

  $effect(() => {
    const targets = picks.map((pick, index) => ({ element: pick.element, index }))
    if (targets.length === 0) {
      marks = []
      return
    }

    return trackMarks(targets, () => {
      marks = measureMarks(targets)
    })
  })

  function overlayHost(): Element | null {
    if (root === undefined) return null
    const node = root.getRootNode()
    return node instanceof ShadowRoot ? node.host : root
  }

  function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
  }

  function isOnControl(element: Element | null): boolean {
    if (!(element instanceof Element)) return false
    return element.closest('.control') !== null
  }

  /** The deepest focused element, across the overlay's shadow boundary. */
  function focusedElement(): Element | null {
    // Ask the wrapper's root, not the host's: the host lives in the page, its root is the document.
    const node = root?.getRootNode()
    if (node instanceof ShadowRoot) return node.activeElement
    return document.activeElement
  }

  function runKey(command: PickKey) {
    switch (command) {
      case 'leave':
        // The cheat sheet closes before picking does: Escape means "out of the topmost thing".
        if (helpOpen) {
          helpOpen = false
          return
        }
        picking = false
        if (panelOpen) closePanel()
        selection = null
        locked = false
        return
      case 'help':
        helpOpen = !helpOpen
        return
      case 'pin': {
        // Freeze the outline where it is: the pointer can travel and the click still confirms it.
        if (selection === null) selection = pointerTarget
        if (selection === null) return
        locked = true
        return
      }
      case 'pickAndLeave': {
        const target = selection ?? pointerTarget
        if (target !== null) pickElement(target)
        picking = false
        helpOpen = false
        hover = null
        selection = null
        locked = false
        return
      }
      case 'copy':
        void copyPrompt()
        return
      case 'unpickLast': {
        const last = picks.at(-1)
        if (last !== undefined) removePick(last)
        return
      }
      case 'pick': {
        // What is outlined, whatever put it there — the pointer's own element or a key's.
        const target = selection ?? pointerTarget
        if (target !== null) pickElement(target)
        return
      }
      default: {
        // Keys work before the first pick: they move from whatever the pointer last outlined, so
        // entering picking and pressing `w` is enough to reach a covering parent.
        const start = selection ?? pointerTarget ?? initialTarget(picks.map((entry) => entry.element))
        if (start === null) return

        const next = navigate(start, command)
        if (next === null) return

        selection = next
        locked = true
        showKeyboardHover(next)
      }
    }
  }

  /** The outline and tooltip for the keyboard selection, anchored under the element. */
  function showKeyboardHover(element: Element) {
    const mark = measureMark({ element, index: 0 })
    if (mark === null) {
      hover = null
      return
    }

    hover = {
      top: mark.top,
      left: mark.left,
      width: mark.width,
      height: mark.height,
      label: `${element.localName}  ${pickWhere(element, sphereConfig.root)}`.trim(),
      x: mark.left,
      y: mark.top + mark.height + 6,
    }
  }

  function onHover(target: Element | null, clientX: number, clientY: number) {
    pointerTarget = target
    pointerPoint = { x: clientX, y: clientY }

    // A keyboard selection is locked: the outline stays on it until a click confirms it, even though
    // the pointer has to move to reach the click.
    if (locked) return

    selection = target
    showPointerHover(target, clientX, clientY)
  }

  function showPointerHover(target: Element | null, clientX: number, clientY: number) {
    if (target === null || picks.some((pick) => pick.element === target)) {
      hover = null
      return
    }

    const mark = measureMark({ element: target, index: 0 })
    if (mark === null) {
      hover = null
      return
    }

    hover = {
      top: mark.top,
      left: mark.left,
      width: mark.width,
      height: mark.height,
      label: `${target.localName}  ${pickWhere(target, sphereConfig.root)}`.trim(),
      x: clientX,
      y: clientY,
    }
  }

  /** A click confirms the outline; afterwards the pointer owns the selection again. */
  function pickAtPointer(target: Element, clientX: number, clientY: number) {
    const chosen = locked && selection !== null ? selection : target

    pickElement(chosen)

    locked = false
    selection = target
    pointerTarget = target
    showPointerHover(target, clientX, clientY)
  }

  function pickElement(target: Element) {
    const entry: PickEntry = {
      element: target,
      label: pickLabel(target),
      where: pickWhere(target, sphereConfig.root),
    }
    const result = togglePick(picks, entry, PICK_CAP)

    if (result.action === 'capped') {
      status = { text: `At most ${PICK_CAP} elements per prompt.`, error: true }
      return
    }

    picks = result.picks
    hover = null
    status = {
      text: result.action === 'added' ? `Added ${target.localName}` : `Removed ${target.localName}`,
      error: false,
    }

    if (result.action === 'added') {
      if (!panelOpen) openPanel(true)
      void refreshPickLocation(entry)
    }
  }

  /**
   * The chip shows the location the prompt will report, so it is resolved against the file: that
   * needs a read, which is cached per file and silence on failure (`options.source` controls only
   * the prompt's source window, not the honesty of the line).
   */
  async function refreshPickLocation(entry: PickEntry) {
    const api = typeof window === 'undefined' ? undefined : window.__SPHERE__
    if (api === undefined) return

    const inspected = api.inspectElement(entry.element)
    const file = inspected.source?.file ?? inspected.components[0]?.file ?? null
    const text = file === null ? null : await loadSource(file)
    const source = resolveElementSource({
      recorded: inspected.source,
      chainFile: inspected.components[0]?.file ?? null,
      element: toLocated(inspected),
      fileText: text,
    })

    if (source?.line == null) return

    const relative = relativeTo(sphereConfig.root)(source.file) ?? ''
    const place = `${relative}:${source.line}`.replace(/^:/, '')
    const where = source.matched !== null || source.enclosing === true ? `~${place}` : place
    // Compare by element: `$state` deep-proxies the array, so the stored object is not the one
    // that was pushed.
    picks = picks.map((pick) => (pick.element === entry.element ? { ...pick, where } : pick))
  }

  async function copyPrompt() {
    const api = typeof window === 'undefined' ? undefined : window.__SPHERE__
    const fallbackPage = pageInfo()

    const selections: PromptSelection[] = await Promise.all(
      picks.map(async (pick) => {
        if (api === undefined) {
          return {
            inspected: {
              page: fallbackPage,
              element: null,
              source: null,
              template: [],
              components: [],
            } satisfies Inspected,
          }
        }

        return resolveSelection(api.inspectElement(pick.element))
      }),
    )

    const prompt = formatPrompt({
      page: selections[0]?.inspected.page ?? fallbackPage,
      instructions,
      options,
      selections,
      root: sphereConfig.root,
      ...(api === undefined ? {} : { version: api.version }),
    })

    if (!(await writeClipboard(prompt.text))) {
      status = { text: 'Could not write to the clipboard.', error: true }
      return
    }

    status = {
      text: `Copied ${groupDigits(prompt.text.length)} chars${prompt.truncated ? ' (truncated)' : ''}`,
      error: false,
    }
    // Copying ends the flow (docs/06 §2): the prompt is on the clipboard, the next step is the agent.
    picking = false
    hover = null
  }

  /** Reads the element's file once, so the prompt can verify the location and quote the source. */
  async function resolveSelection(inspected: Inspected): Promise<PromptSelection> {
    const file = inspected.source?.file ?? inspected.components[0]?.file ?? null
    const text = file === null ? null : await loadSource(file)

    const source = resolveElementSource({
      recorded: inspected.source,
      chainFile: inspected.components[0]?.file ?? null,
      element: toLocated(inspected),
      fileText: text,
    })

    return {
      inspected: source === null ? inspected : { ...inspected, source },
      ...(text !== null && file !== null ? { source: { path: file, text } } : {}),
    }
  }

  function toLocated(inspected: Inspected) {
    const element = inspected.element
    if (element === null) return null

    return { tag: element.tag, classes: element.classes, id: element.id, attrs: element.attrs }
  }

  function removePick(pick: PickEntry) {
    picks = picks.filter((entry) => entry.element !== pick.element)
    status = { text: `Removed ${pick.element.localName}`, error: false }
  }

  function clearAll() {
    picks = []
    instructions = ''
    status = { text: 'Cleared the prompt.', error: false }
  }

  function onOptionsChange(key: keyof OverlayOptions, value: boolean) {
    options = { ...options, [key]: value }
    writeOptions(options)
  }

  function openPanel(fromPick: boolean) {
    if (shell === undefined) return

    const rect = shell.getBoundingClientRect()
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const panel = {
      width: Math.min(PANEL_WIDTH, viewport.width - 36),
      height: Math.min(viewport.height * 0.7, 620),
    }

    const placement = panelPlacement(
      { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      panel,
      viewport,
    )

    panelStyle = `left: ${placement.left}px; top: ${placement.top}px; max-height: ${placement.maxHeight}px;`
    panelOpen = true
    focusPanel = fromPick
  }

  function closePanel() {
    panelOpen = false
    focusPanel = false
    control?.focus({ preventScroll: true })
  }

  function togglePanel() {
    if (panelOpen) closePanel()
    else openPanel(false)
  }

  function startDrag(event: PointerEvent) {
    if (event.button !== 0 || shell === undefined) return

    const target = event.target
    const fromChip = target instanceof Element && target.closest('.chip') !== null
    if (fromChip) return

    event.preventDefault()
    // Browsers do not focus a button whose pointerdown default was prevented.
    control?.focus({ preventScroll: true })

    const rect = shell.getBoundingClientRect()
    drag = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
      togglesOnTap: !fromChip,
    }

    const stop = listen<PointerEvent>(window, 'pointermove', moveDrag)
    const end = listen<PointerEvent>(window, 'pointerup', () => {
      stop()
      end()
      endDrag()
    })
  }

  function moveDrag(event: PointerEvent) {
    if (drag === null || shell === undefined) return

    const dx = event.clientX - drag.pointerX
    const dy = event.clientY - drag.pointerY

    // The gesture is decided by movement: a small wobble is still a click (docs/06 §1).
    if (!drag.moved && Math.hypot(dx, dy) <= 4) return
    drag.moved = true

    position = clampControl(
      { x: drag.originX + dx, y: drag.originY + dy },
      { width: shell.offsetWidth, height: shell.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
  }

  function endDrag() {
    if (drag === null) return

    const { moved, togglesOnTap } = drag
    drag = null

    if (moved) {
      // The click that follows a drag must not toggle picking.
      writeControl(position)
      return
    }

    if (togglesOnTap) toggle()
  }

  function toggle() {
    picking = !picking
    if (!picking) {
      hover = null
      selection = null
      locked = false
      helpOpen = false
    }
  }

  function toggleHelp() {
    helpOpen = !helpOpen
  }

  /** Mouse clicks are handled on `pointerup`; `detail === 0` means the click came from the keyboard. */
  function onClick(event: MouseEvent) {
    if (event.detail === 0) toggle()
  }

  function onDoubleClick(event: MouseEvent) {
    event.preventDefault()
    position = null
    writeControl(null)
  }

  function onResize() {
    if (position === null || shell === undefined) return
    position = clampControl(
      position,
      { width: shell.offsetWidth, height: shell.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    )
  }

  onMount(() => {
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  const controlStyle = $derived(
    position === null
      ? ''
      : `left: ${position.x}px; top: ${position.y}px; right: auto; bottom: auto;`,
  )

  const hoverStyle = $derived(
    hover === null
      ? ''
      : `top: ${hover.top}px; left: ${hover.left}px; width: ${hover.width}px; height: ${hover.height}px;`,
  )

  const tooltipStyle = $derived(
    hover === null ? '' : `left: ${hover.x + 14}px; top: ${hover.y + 18}px;`,
  )

  const marksView = $derived(
    marks.map((mark) => ({
      index: mark.index,
      style: `top: ${mark.top}px; left: ${mark.left}px; width: ${mark.width}px; height: ${mark.height}px;`,
    })),
  )
</script>

<div class="overlay" bind:this={root}>
  {#if hover !== null}
    <div class="hover-outline" style={hoverStyle}></div>
    <div class="tooltip" style={tooltipStyle}>{hover.label}</div>
  {/if}

  {#each marksView as mark (mark.index)}
    <div class="mark" style={mark.style}>
      <span class="badge">{mark.index + 1}</span>
    </div>
  {/each}

  {#if helpOpen}
    <Help style="left: 18px; top: 18px;" onClose={toggleHelp} />
  {/if}

  {#if panelOpen}
    <Panel
      {picks}
      {options}
      {instructions}
      {status}
      {focusPanel}
      style={panelStyle}
      onCopy={copyPrompt}
      onHelp={toggleHelp}
      onRemove={removePick}
      onClear={clearAll}
      onClose={closePanel}
      onOptionsChange={onOptionsChange}
      onInstructionsChange={(value) => (instructions = value)}
    />
  {/if}

  <div
    class="control"
    class:focus-ring={focusRing}
    bind:this={shell}
    style={controlStyle}
    role="group"
    aria-label="Sphere"
    use:shield
  >
    <button
      bind:this={control}
      class="inspect"
      type="button"
      aria-pressed={picking}
      use:press={onClick}
      use:dblpress={onDoubleClick}
    >
      <span class="dot" aria-hidden="true"></span>
      <span class="label">Inspect</span>
    </button>

    {#if picks.length > 0}
      <button
        class="chip"
        type="button"
        aria-expanded={panelOpen}
        aria-label={`${picks.length} picked. ${panelOpen ? 'Close' : 'Open'} the prompt panel`}
        use:press={togglePanel}
      >
        {picks.length} picked
      </button>
    {/if}
  </div>
</div>

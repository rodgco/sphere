<script lang="ts">
  import { onMount } from 'svelte'
  import Panel from './Panel.svelte'
  import { lockCursor } from './cursor.js'
  import { dblpress, listen, press } from './events.js'
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
  let status = $state<Status | null>(null)

  let options = $state<OverlayOptions>({ ...DEFAULT_OPTIONS })
  let instructions = $state('')
  let panelOpen = $state(false)
  let panelStyle = $state('')
  let focusInstructions = $state(false)

  let root: HTMLDivElement | undefined = $state()
  let shell: HTMLDivElement | undefined = $state()
  let control: HTMLButtonElement | undefined = $state()

  let drag: {
    pointerX: number
    pointerY: number
    originX: number
    originY: number
    moved: boolean
    togglesOnTap: boolean
  } | null = null

  onMount(() => {
    position = readControl()
    options = readOptions()
  })

  // `bind:this` is assigned after mount, so the listener is attached from an effect rather than
  // from `onMount` (where the element can still be undefined).
  $effect(() => {
    if (shell === undefined) return
    return listen<PointerEvent>(shell, 'pointerdown', startDrag)
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
      onPick: onPick,
      onLeave: () => {
        hover = null
      },
    })
  })

  $effect(() => {
    if (!picking) return

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      picking = false
      if (panelOpen) closePanel()
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })

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
    const rootNode = root.getRootNode()
    return rootNode instanceof ShadowRoot ? rootNode.host : root
  }

  function onHover(target: Element | null, clientX: number, clientY: number) {
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
      label: `${target.localName}  ${pickWhere(target)}`.trim(),
      x: clientX,
      y: clientY,
    }
  }

  function onPick(target: Element) {
    const entry: PickEntry = { element: target, label: pickLabel(target), where: pickWhere(target) }
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

    if (result.action === 'added' && !panelOpen) openPanel(true)
  }

  function removePick(pick: PickEntry) {
    picks = picks.filter((entry) => entry !== pick)
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
    focusInstructions = fromPick
  }

  function closePanel() {
    panelOpen = false
    focusInstructions = false
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
    if (!picking) hover = null
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

  {#if panelOpen}
    <Panel
      {picks}
      {options}
      {instructions}
      {status}
      {focusInstructions}
      style={panelStyle}
      onRemove={removePick}
      onClear={clearAll}
      onClose={closePanel}
      onOptionsChange={onOptionsChange}
      onInstructionsChange={(value) => (instructions = value)}
    />
  {/if}

  <div class="control" bind:this={shell} style={controlStyle} role="group" aria-label="Sphere">
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

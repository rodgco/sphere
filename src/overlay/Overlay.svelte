<script lang="ts">
  import { onMount } from 'svelte'
  import { lockCursor } from './cursor.js'
  import { dblpress, listen, press } from './events.js'
  import { measureMark, measureMarks, trackMarks, type Mark } from './marks.js'
  import { startPicking } from './picking.js'
  import { PICK_CAP, pickLabel, pickWhere, togglePick, type PickEntry } from './picks.js'
  import { clampControl } from './position.js'
  import { readControl, writeControl, type ControlPosition } from './storage.js'

  interface Hover {
    top: number
    left: number
    width: number
    height: number
    label: string
    x: number
    y: number
  }

  let picking = $state(false)
  let position = $state<ControlPosition | null>(null)
  let picks = $state<PickEntry[]>([])
  let marks = $state<Mark[]>([])
  let hover = $state<Hover | null>(null)

  let root: HTMLDivElement | undefined = $state()
  let control: HTMLButtonElement | undefined = $state()

  let drag: {
    pointerX: number
    pointerY: number
    originX: number
    originY: number
    moved: boolean
  } | null = null

  onMount(() => {
    position = readControl()
  })

  // `bind:this` is assigned after mount, so the listener is attached from an effect rather than
  // from `onMount` (where the element can still be undefined).
  $effect(() => {
    if (control === undefined) return
    return listen<PointerEvent>(control, 'pointerdown', startDrag)
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
      if (event.key === 'Escape') picking = false
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

    // A full list refuses quietly; the panel reports the cap with words (docs/06 §5).
    if (result.action === 'capped') return

    picks = result.picks
    hover = null
  }

  function startDrag(event: PointerEvent) {
    if (event.button !== 0 || control === undefined) return

    event.preventDefault()
    // Browsers do not focus a button whose pointerdown default was prevented.
    control.focus({ preventScroll: true })

    const rect = control.getBoundingClientRect()
    drag = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    }

    const stop = listen<PointerEvent>(window, 'pointermove', moveDrag)
    const end = listen<PointerEvent>(window, 'pointerup', () => {
      stop()
      end()
      endDrag()
    })
  }

  function moveDrag(event: PointerEvent) {
    if (drag === null || control === undefined) return

    const dx = event.clientX - drag.pointerX
    const dy = event.clientY - drag.pointerY

    // The gesture is decided by movement: a small wobble is still a click (docs/06 §1).
    if (!drag.moved && Math.hypot(dx, dy) <= 4) return
    drag.moved = true

    position = clampControl(
      { x: drag.originX + dx, y: drag.originY + dy },
      sizeOf(control),
      viewportSize(),
    )
  }

  function endDrag() {
    if (drag === null) return

    const { moved } = drag
    drag = null

    if (moved) {
      // The click that follows a drag must not toggle picking.
      writeControl(position)
      return
    }

    toggle()
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

  function sizeOf(element: HTMLElement) {
    return { width: element.offsetWidth, height: element.offsetHeight }
  }

  function viewportSize() {
    return { width: window.innerWidth, height: window.innerHeight }
  }

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

  <button
    bind:this={control}
    class="control"
    type="button"
    aria-pressed={picking}
    style={controlStyle}
    use:press={onClick}
    use:dblpress={onDoubleClick}
  >
    <span class="dot" aria-hidden="true"></span>
    <span class="label">Inspect</span>
  </button>
</div>

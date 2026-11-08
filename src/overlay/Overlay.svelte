<script lang="ts">
  import { onMount } from 'svelte'
  import { lockCursor } from './cursor.js'
  import { dblpress, listen, press } from './events.js'
  import { clampControl } from './position.js'
  import { readControl, writeControl, type ControlPosition } from './storage.js'

  let picking = $state(false)
  let position = $state<ControlPosition | null>(null)
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

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') picking = false
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })

  function onResize() {
    if (position === null || control === undefined) return
    position = clampControl(position, sizeOf(control), viewportSize())
  }

  onMount(() => {
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

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

  const style = $derived(
    position === null
      ? ''
      : `left: ${position.x}px; top: ${position.y}px; right: auto; bottom: auto;`,
  )
</script>

<button
  bind:this={control}
  class="control"
  type="button"
  aria-pressed={picking}
  {style}
  use:press={onClick}
  use:dblpress={onDoubleClick}
>
  <span class="dot" aria-hidden="true"></span>
  <span class="label">Inspect</span>
</button>

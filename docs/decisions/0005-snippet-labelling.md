# 0005 — Snippets: keep the rendered tree, label the ownership

## Context

When a component passes markup to another as a snippet (`<Wrapper>{…}</Wrapper>` with
`{@render children()}`), Svelte renders that DOM inside `Wrapper`'s tree but the markup is written in
the caller's file. Svelte's own dev metadata attributes the DOM to the renderer; ownership
(`dev_current_component_function`) belongs to the definer. The prototype tried rewriting the tree to
the definer (wrapping `wrap_snippet`), which changed component parentage globally — it broke the
“slotted child belongs to the host” expectation that devtools panels rely on — and was reverted.

## Decision

Keep the rendered tree exactly as Svelte reports it, and label the relationship:

```
1. Wrapper — src/lib/Wrapper.svelte — renders the markup
2. Page — src/routes/+page.svelte — defines the markup
```

The label is added when the element's source file does not match the head instance and does match a
later instance in the chain.

## Consequences

- The component chain stays consistent with the Svelte runtime, other devtools and the reader's mental
  model (`Wrapper` really did render that node).
- The reader still learns where to edit.
- No global change to the instance tree: Sphere never re-parents anything.

## Alternatives considered

- **Re-parent to the definer**: more “intuitive” for editing, but wrong about rendering, requires
  wrapping `wrap_snippet`/`snippet`, and risks breaking third-party assumptions.
- **Show both chains**: noisy and ambiguous in a prompt.

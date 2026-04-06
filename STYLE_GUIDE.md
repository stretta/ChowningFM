# Style Guide

This repo uses a restrained, system-led visual language. The goal is not to maximize stylistic variety. The goal is to make hierarchy, interaction, and emphasis feel intentional and repeatable.

## Design Charter

- Build the interface to work in grayscale first.
- Use accent color only after spacing, scale, and weight already establish hierarchy.
- Keep color semantic. It should communicate action, state, or emphasis.
- Keep typography single-family dominant.
- Keep expressive moves rare and scoped to a small number of approved moments.

## Typography Rules

- `90%` of all text should use `--font-primary`.
- `--font-primary` should be an Avenir-like humanist sans.
- Use weight, size, case, spacing, and layout before reaching for another typeface.
- Use serif only for selective editorial emphasis, not for core UI.
- Use display or script styling only for rare highlight moments with clear intent.

## Chowning FM Typography Override

The current Chowning FM control surface uses a deliberate role reversal inside the paired FM groups:

- Labels use the broader primary typeface.
- Labels should read as the heavier voice.
- Numeric values use the condensed typeface.
- Editable numeric values and derived numeric values should feel equal in scale.
- Numeric alignment should follow text baselines, not visual box centering.

## Color Rules

- Default to neutral surfaces and text colors.
- Use the primary action color for links, buttons, and key calls to action.
- Use muted neutrals for supporting copy and structural surfaces.
- Secondary accent colors are exceptions, not defaults.
- Do not assign color decoratively to sections or components without semantic purpose.

## Chowning FM Layout Override

The active Chowning FM UI is intentionally reduced:

- Keep only three primary FM groups and the keyboard.
- Use one accent color per primary group.
- Do not nest secondary cards inside those primary groups.
- Do not render white numeric entry rectangles.
- Let spacing and typography carry most of the hierarchy.

## Implementation Contract

- Prefer semantic tokens such as `--color-text-primary` and `--color-action-primary` over raw palette values in component styles.
- Avoid introducing new font families unless the component has a documented exception.
- Avoid hard-coded hex values in feature-level CSS when a token already exists.
- New components should inherit from the global type system by default.
- When a skin pairs controls with RNBO outports, document that mapping in the repo docs.

## Review Checklist

- Does this still read clearly in grayscale?
- Is the primary sans doing nearly all of the typographic work?
- Is accent color signaling meaning instead of filling space?
- Could this hierarchy be solved with spacing, scale, or weight instead?
- Is any expressive flourish rare enough to feel intentional?
- If this is the Chowning FM skin, does it preserve the three paired-group structure?

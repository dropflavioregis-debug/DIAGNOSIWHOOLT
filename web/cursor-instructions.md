# Cursor Instructions — EV Diagnostic Design System

## Regola fondamentale

Ogni componente React/Next.js che crei per questo progetto deve usare
esclusivamente le CSS variables definite in `design-system.css`.
Non usare Tailwind per i colori — usa le variabili CSS del design system.

---

## Stack

- Next.js 14 App Router
- TypeScript strict
- CSS Modules o `style={}` inline — no Tailwind per i colori
- Supabase JS client
- Anthropic SDK

---

## Regole di stile — seguile sempre

### Colori
- Usa SOLO le variabili `--color-*` da `design-system.css`
- MAI hardcodare colori hex nei componenti
- Per testo su sfondo colorato: usa il tono 800/900 dello stesso ramp
- Esempio corretto:   `color: var(--color-text-primary)`
- Esempio sbagliato:  `color: #333`

### Bordi
- Bordi sempre `0.5px solid var(--color-border-tertiary)`
- Per enfasi: `var(--color-border-secondary)`
- MAI `1px` o `2px` di default — solo `0.5px`
- Eccezione: bordo featured item usa `2px solid var(--color-border-info)`

### Border radius
- Card e container: `var(--border-radius-lg)` (12px)
- Elementi UI (input, badge, button): `var(--border-radius-md)` (8px)
- Pill/badge arrotondati: `border-radius: 20px`

### Tipografia
- Font: `var(--font-sans)` — MAI Inter, Roboto, Arial
- Font mono: `var(--font-mono)`
- Due pesi SOLI: `font-weight: 400` e `font-weight: 500`
- MAI 600 o 700 — troppo pesanti
- Testo sempre in sentence case — MAI Title Case o ALL CAPS

### Spacing
- Ritmo verticale: multipli di `rem` (1rem, 1.5rem, 2rem)
- Gap interni componenti: `px` (8px, 12px, 16px)

### Effetti
- MAI gradienti decorativi
- MAI box-shadow (tranne focus ring: `box-shadow: 0 0 0 2px`)
- MAI blur o glow
- Tutto piatto e pulito

---

## Componenti base da riusare

### Card
```tsx
<div style={{
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-tertiary)',
  borderRadius: 'var(--border-radius-lg)',
  padding: '16px'
}}>
```

### Metric card
```tsx
<div style={{
  background: 'var(--color-background-secondary)',
  borderRadius: 'var(--border-radius-md)',
  padding: '14px 16px'
}}>
  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '5px' }}>
    Label
  </div>
  <div style={{ fontSize: '24px', fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1 }}>
    Valore
  </div>
</div>
```

### Badge
```tsx
// Verde (successo/ok)
<span style={{ background: 'var(--green-50)', color: 'var(--green-600)', 
  padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 500 }}>
  OK
</span>

// Rosso (errore/critico)
<span style={{ background: 'var(--red-50)', color: 'var(--red-600)', ... }}>
  Critico
</span>
```

### Button
```tsx
<button style={{
  padding: '7px 14px',
  fontSize: '12px',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)'
}}>
  Testo
</button>
```

### Input
```tsx
<input style={{
  width: '100%',
  padding: '8px 11px',
  fontSize: '12px',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 'var(--border-radius-md)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-sans)'
}}/>
```

---

## Dark mode

È automatica — tutte le `--color-*` variables si aggiornano con
`@media (prefers-color-scheme: dark)` già definita in `design-system.css`.
Non aggiungere mai `dark:` classi Tailwind o logica JS per il tema.

---

## Prompt tipo da dare a Cursor

Quando vuoi un nuovo componente, usa questo template:

> "Crea un componente React TypeScript per [nome componente].
> Usa le CSS variables da design-system.css per tutti i colori.
> Stile: piatto, niente gradienti, niente shadow, bordi 0.5px,
> font system-ui, font-weight solo 400 o 500.
> Segui le regole in cursor-instructions.md"

---

## Struttura file consigliata

```
ev-diagnostic/
├── app/
│   ├── globals.css          ← @import './design-system.css'
│   └── ...
├── design-system.css        ← questo file
├── cursor-instructions.md   ← questo file
├── components/
│   ├── ui/
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── MetricCard.tsx
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   └── ...
```

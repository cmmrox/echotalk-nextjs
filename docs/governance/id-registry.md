# Stable ID Registry

IDs are repository-wide and never reused. The PM allocates the next ID in the
same reviewed change that creates its canonical artifact; CI rejects collisions
and stale allocations in the checked-out integration candidate.

| Type | Allocated | Next provisional |
|---|---|---|
| Feature | `F000`, `F001` | `F002` |
| Stage | `S00`, `S01`, `S02`, `S03`, `S04`, `S05`, `S06`, `S07` | `S08` |
| Architecture decision | `ADR-0001`, `ADR-0002` | `ADR-0003` |

Task IDs restart within a stage. QA case numbers restart within a feature.
“Next provisional” is guidance, not a reservation; recheck current integration
branches before creating files. The scaffolder accepts only that value, moves
it into `Allocated`, and advances the provisional value in the same operation.

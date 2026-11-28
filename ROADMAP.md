# Focus Sessions — Roadmap

**Target:** a production-grade, sleek, industry-standard **Windows** desktop focus timer that doubles as a
**portfolio showcase**. Code quality, architecture, tests and documentation are first-class deliverables.

**Checks:** there is no hosted CI. `npm run check` (typecheck → unit + e2e → production build) must pass locally before
every push and merge; a pre-commit hook may run the fast subset.

**Tracking:** each milestone is a [GitHub Milestone](https://github.com/GodzillaJim/my-clock-app/milestones); each item is an issue
with context, tasks and acceptance criteria. PRs close issues with `Closes #N`, and the box here is ticked when it lands.
Work milestones roughly in order; within a milestone, `priority:high` items go first.

**Baseline (2026-11-28):** Electron 33 · React 18 · MUI 6 · Vite 5 · better-sqlite3 · TypeScript strict.
~16.7k lines of app code, of which ~4.9k (33 files) are unreachable; typecheck clean; `npm test` 13/13 after #11;
no hosted CI — checks run locally with `npm run check`.

---

## [M0 — Repo in Order](https://github.com/GodzillaJim/my-clock-app/milestone/1)

_Exit criteria: `npm run check` passes on main and there are no GitHub workflows; no dead code or boilerplate leftovers; repo metadata reflects the product; Windows-only build config._

### Checks & git hygiene

- [x] [PR #11](https://github.com/GodzillaJim/my-clock-app/pull/11) — ZenFocusTimer tests; e2e isolated from real user data
- [x] [#12](https://github.com/GodzillaJim/my-clock-app/issues/12) remove GitHub workflows; run checks locally with `npm run check` **(priority)**
- [x] [#13](https://github.com/GodzillaJim/my-clock-app/issues/13) commit package-lock.json for reproducible installs **(priority)**
- [x] [#14](https://github.com/GodzillaJim/my-clock-app/issues/14) untrack .claude/settings.local.json
- [x] [#15](https://github.com/GodzillaJim/my-clock-app/issues/15) close stale Dependabot PRs and remove automated version updates

### Dead code & boilerplate removal

- [x] [#16](https://github.com/GodzillaJim/my-clock-app/issues/16) delete unreferenced modules
- [x] [#17](https://github.com/GodzillaJim/my-clock-app/issues/17) remove unused dependencies
- [x] [#18](https://github.com/GodzillaJim/my-clock-app/issues/18) remove electron-vite-react template leftovers
- [x] [#19](https://github.com/GodzillaJim/my-clock-app/issues/19) remove the open-win IPC handler

### Identity & config

- [x] [#20](https://github.com/GodzillaJim/my-clock-app/issues/20) fix package and installer metadata
- [x] [#21](https://github.com/GodzillaJim/my-clock-app/issues/21) make packaging Windows-only
- [ ] [#22](https://github.com/GodzillaJim/my-clock-app/issues/22) rename repository to match the product
- [x] [#23](https://github.com/GodzillaJim/my-clock-app/issues/23) rewrite README to match the current app

### Known bugs

- [x] [#78](https://github.com/GodzillaJim/my-clock-app/issues/78) better-sqlite3 is not rebuilt for Electron in dev and test **(priority)**
- [x] [#24](https://github.com/GodzillaJim/my-clock-app/issues/24) replace 1000-session cap with 90-day retention
- [x] [#25](https://github.com/GodzillaJim/my-clock-app/issues/25) notification sounds setting has no sound files

---

## [M1 — Engineering Foundations](https://github.com/GodzillaJim/my-clock-app/milestone/2)

_Exit criteria: `npm run check` (and a pre-commit hook) runs lint, format, typecheck, tests with coverage and a build; dependencies are current._

### Quality gates

- [x] [#26](https://github.com/GodzillaJim/my-clock-app/issues/26) add ESLint flat config and fix violations
- [x] [#27](https://github.com/GodzillaJim/my-clock-app/issues/27) add Prettier with a pre-commit hook
- [x] [#28](https://github.com/GodzillaJim/my-clock-app/issues/28) split unit and e2e into separate Vitest projects
- [x] [#29](https://github.com/GodzillaJim/my-clock-app/issues/29) coverage reporting with a ratcheting threshold
- [x] [#30](https://github.com/GodzillaJim/my-clock-app/issues/30) conventional commits and changelog generation

### Dependency upgrades

- [x] [#31](https://github.com/GodzillaJim/my-clock-app/issues/31) upgrade Electron to the latest stable
- [x] [#32](https://github.com/GodzillaJim/my-clock-app/issues/32) upgrade Vite and Vite Electron plugins
- [x] [#33](https://github.com/GodzillaJim/my-clock-app/issues/33) upgrade React to 19
- [x] [#34](https://github.com/GodzillaJim/my-clock-app/issues/34) upgrade MUI to the current major
- [x] [#35](https://github.com/GodzillaJim/my-clock-app/issues/35) upgrade electron-builder

### Code hygiene

- [x] [#36](https://github.com/GodzillaJim/my-clock-app/issues/36) structured logging with electron-log
- [x] [#37](https://github.com/GodzillaJim/my-clock-app/issues/37) eliminate `any` usages

---

## [M2 — Architecture & Security](https://github.com/GodzillaJim/my-clock-app/milestone/3)

_Exit criteria: One storage path, a typed IPC contract, a pure tested timer engine, no source file over ~400 lines, and the Electron security checklist passing._

### Security (highest priority)

- [x] [#38](https://github.com/GodzillaJim/my-clock-app/issues/38) restrict storage IPC to a sandboxed directory **(priority)**
- [x] [#80](https://github.com/GodzillaJim/my-clock-app/issues/80) re-enable webSecurity on the main window **(priority)**
- [x] [#39](https://github.com/GodzillaJim/my-clock-app/issues/39) add a Content-Security-Policy
- [x] [#40](https://github.com/GodzillaJim/my-clock-app/issues/40) enable renderer sandbox and minimize the preload surface
- [x] [#41](https://github.com/GodzillaJim/my-clock-app/issues/41) validate IPC inputs with schemas
- [x] [#42](https://github.com/GodzillaJim/my-clock-app/issues/42) run a security review and document the results

### Architecture

- [ ] [#43](https://github.com/GodzillaJim/my-clock-app/issues/43) make SQLite the single storage path
- [x] [#44](https://github.com/GodzillaJim/my-clock-app/issues/44) typed IPC contract shared by main, preload and renderer
- [x] [#45](https://github.com/GodzillaJim/my-clock-app/issues/45) extract the timer into a pure state machine
- [x] [#82](https://github.com/GodzillaJim/my-clock-app/issues/82) tray Start, Ctrl+Shift+S and Space don't control the timer
- [ ] [#46](https://github.com/GodzillaJim/my-clock-app/issues/46) split focusStorage into domain services
- [ ] [#47](https://github.com/GodzillaJim/my-clock-app/issues/47) break up oversized components
- [ ] [#50](https://github.com/GodzillaJim/my-clock-app/issues/50) error boundaries and process crash handling
- [ ] [#51](https://github.com/GodzillaJim/my-clock-app/issues/51) architecture decision records

### Decisions

- [ ] [#48](https://github.com/GodzillaJim/my-clock-app/issues/48) layout strategy (Zen / Dashboard / Command Center)
- [ ] [#49](https://github.com/GodzillaJim/my-clock-app/issues/49) keep, polish or cut Challenges and Feedback

---

## [M3 — Reliability & Data Integrity](https://github.com/GodzillaJim/my-clock-app/milestone/4)

_Exit criteria: User data survives crashes, upgrades and migrations — proven by tests._

- [ ] [#52](https://github.com/GodzillaJim/my-clock-app/issues/52) repository integration tests against real SQLite
- [ ] [#53](https://github.com/GodzillaJim/my-clock-app/issues/53) migration tests and automatic pre-migration backup
- [ ] [#54](https://github.com/GodzillaJim/my-clock-app/issues/54) crash-recovery e2e (kill mid-session, relaunch, resume)
- [ ] [#55](https://github.com/GodzillaJim/my-clock-app/issues/55) data export/import and backup/restore
- [ ] [#56](https://github.com/GodzillaJim/my-clock-app/issues/56) timer accuracy across sleep/hibernate and clock changes
- [ ] [#57](https://github.com/GodzillaJim/my-clock-app/issues/57) performance budget checked locally

---

## [M4 — Product Polish](https://github.com/GodzillaJim/my-clock-app/milestone/5)

_Exit criteria: Design review and a WCAG 2.1 AA audit both pass; the first-run experience is guided._

- [ ] [#58](https://github.com/GodzillaJim/my-clock-app/issues/58) design tokens as the single theme source
- [ ] [#59](https://github.com/GodzillaJim/my-clock-app/issues/59) visual design pass across all screens
- [ ] [#60](https://github.com/GodzillaJim/my-clock-app/issues/60) first-run onboarding and empty states
- [ ] [#61](https://github.com/GodzillaJim/my-clock-app/issues/61) simplify and group settings
- [ ] [#62](https://github.com/GodzillaJim/my-clock-app/issues/62) micro-interactions with reduced-motion support
- [ ] [#63](https://github.com/GodzillaJim/my-clock-app/issues/63) WCAG 2.1 AA pass
- [ ] [#64](https://github.com/GodzillaJim/my-clock-app/issues/64) shortcut overlay / command palette
- [ ] [#65](https://github.com/GodzillaJim/my-clock-app/issues/65) Windows-native integration

---

## [M5 — Release Engineering (Windows)](https://github.com/GodzillaJim/my-clock-app/milestone/6)

_Exit criteria: One local command produces a published, auto-updating Windows release._

- [ ] [#66](https://github.com/GodzillaJim/my-clock-app/issues/66) local release script publishing to GitHub Releases
- [ ] [#67](https://github.com/GodzillaJim/my-clock-app/issues/67) auto-update from GitHub Releases
- [ ] [#68](https://github.com/GodzillaJim/my-clock-app/issues/68) code signing
- [ ] [#69](https://github.com/GodzillaJim/my-clock-app/issues/69) installer data-retention choice and upgrade-in-place test
- [ ] [#70](https://github.com/GodzillaJim/my-clock-app/issues/70) smoke-test the packaged app before release

---

## [M6 — Portfolio Presentation](https://github.com/GodzillaJim/my-clock-app/milestone/7)

_Exit criteria: A visitor understands what it is, why it's well built, and can install it in under a minute._

- [ ] [#71](https://github.com/GodzillaJim/my-clock-app/issues/71) showcase README
- [ ] [#72](https://github.com/GodzillaJim/my-clock-app/issues/72) architecture, data model, IPC and testing docs
- [ ] [#73](https://github.com/GodzillaJim/my-clock-app/issues/73) demo mode with seeded data
- [ ] [#74](https://github.com/GodzillaJim/my-clock-app/issues/74) landing page on GitHub Pages
- [ ] [#75](https://github.com/GodzillaJim/my-clock-app/issues/75) community health files
- [ ] [#76](https://github.com/GodzillaJim/my-clock-app/issues/76) v1.0.0

---

## Open decisions

| Decision                                           | Milestone | Issue                                                        |
| -------------------------------------------------- | --------- | ------------------------------------------------------------ |
| rename repository to match the product             | M0        | [#22](https://github.com/GodzillaJim/my-clock-app/issues/22) |
| layout strategy (Zen / Dashboard / Command Center) | M2        | [#48](https://github.com/GodzillaJim/my-clock-app/issues/48) |
| keep, polish or cut Challenges and Feedback        | M2        | [#49](https://github.com/GodzillaJim/my-clock-app/issues/49) |
| code signing                                       | M5        | [#68](https://github.com/GodzillaJim/my-clock-app/issues/68) |

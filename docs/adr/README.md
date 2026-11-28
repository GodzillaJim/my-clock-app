# Architecture decision records

Short records of the decisions that shape Focus Sessions: what was decided, why, and what it costs.
New ADRs copy [template.md](template.md), take the next number, and are never rewritten. A decision
that changes gets a new ADR that supersedes the old one.

| #                                                 | Decision                                             | Status   |
| ------------------------------------------------- | ---------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)     | Record architecture decisions                        | Accepted |
| [0002](0002-sqlite-in-the-main-process.md)        | SQLite, owned by the main process                    | Accepted |
| [0003](0003-typed-validated-ipc-contract.md)      | A typed, schema-validated IPC contract               | Accepted |
| [0004](0004-timer-as-a-pure-state-machine.md)     | The timer as a pure state machine                    | Accepted |
| [0005](0005-keep-three-layouts.md)                | Keep three layouts on one timer engine               | Accepted |
| [0006](0006-windows-only.md)                      | Windows only                                         | Accepted |
| [0007](0007-keep-challenges-replace-feedback.md)  | Keep Challenges; replace Feedback with issue reports | Accepted |
| [0008](0008-local-checks-instead-of-hosted-ci.md) | Local checks instead of hosted CI                    | Accepted |

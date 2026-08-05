# agenticapps-dashboard v2 — Spezifikation

> Status: Entwurf zur Freigabe · Autor: Claude (Cowork) · Datum: 2026-07-26
>
> **Nachtrag nach PR #66 (gleicher Tag).** Das Repo ist inzwischen nach OpenSpec
> migriert: 12 ratifizierte Capabilities, 100 deployte Requirements, vier offene
> Changes. Die betroffenen Stellen sind unten mit ⚠ markiert und korrigiert.
> Die Auswirkungen auf den Plan stehen in §14.
> Zielrepo: `~/Sourcecode/agenticapps/agenticapps-dashboard`
> Grundlage: Messung des Ist-Stands aller Fleet-Repos am 2026-07-26 (Abschnitt 1)

---

## 0. Was sich ändert, in einem Satz

Das Dashboard hört auf, ein Observability-Werkzeug für den Workflow zu sein,
und wird ein **Bereitschafts-Instrument**: pro Repo sechs immer gleiche Checks,
plus eine präzise Versions-Seite für die fünf Workflow-Repos, plus ein
Kanban-Board über die laufenden Agent-Sessions.

---

## 1. Ist-Stand (gemessen, nicht angenommen)

Alle Angaben aus den Repos unter `~/Sourcecode/agenticapps` am 2026-07-26.

### 1.1 Core-Spec

`agenticapps-workflow-core` versioniert **pro Sektion**, nicht pro Repo:
`spec/*.md` tragen im Frontmatter `spec_version:` mit dem Wert, bei dem die
Sektion zuletzt geändert wurde (4× 0.1.0, 1× 0.3.2, 2× 0.4.0, 1× 0.6.0,
1× 0.7.0, 1× 0.8.0, 1× 0.9.1, 1× 0.10.0, **8× 1.0.0**).

**Repo-Version = Maximum = `1.0.0`.** `CHANGELOG.md` führt einen
`[Unreleased]`-Block, der ausdrücklich *keine* Spec-Version-Änderung ist
(betrifft nur `tools/` und `reference-implementations/`). Kein Host muss
handeln.

Das ist für das Dashboard relevant: **eine einzelne Zahl pro Repo genügt nicht.**
Ein Host kann `implements_spec: 1.0.0` behaupten und trotzdem eine Sektion auf
0.4.0-Stand mitschleppen.

### 1.2 Host-Repos — `implements_spec`

| Repo | Primär-Skill | Nachzügler-Skills |
|---|---|---|
| `claude-workflow` | **1.0.0** ✓ (`skill/SKILL.md`, `setup/snapshot/…`) | `ts-declare-first` = 0.4.0 |
| `codex-workflow` | **1.0.0** ✓ | 6 Skills auf 0.4.0: `codex-qa`, `codex-cso`, `codex-impeccable-audit`, `codex-database-sentinel-audit`, `codex-ts-declare-first`, `codex-design-critique` |
| `opencode-workflow` | **1.0.0** ✓ | keine — alle 10 Skills auf 1.0.0 |
| `pi-agentic-apps-workflow` | **1.0.0** ✓ | `pi-ts-declare-first` = 0.10.0 |

`opencode-workflow` ist der einzige Host ohne Skill-Drift. Genau diese
Aufspaltung (Primär vs. min/max über alle Skills) fehlt heute im Dashboard.

### 1.3 Gate & reviewer-cli — vollständig synchron

Byte-Identität gegen `agenticapps-workflow-core/reference-implementations/`
per md5 geprüft:

| Artefakt | Version | claude | codex | opencode | pi |
|---|---|---|---|---|---|
| `bin/openspec-change-gate.sh` | `# gate-version: 1.2.2` | ✓ identisch | ✓ | ✓ | ✓ |
| `bin/reviewer-cli.sh` | `# reviewer-cli-version: 1.0.0` | ✓ identisch | ✓ | ✓ | ✓ |
| `tools/change-gate-conformance.sh` | Harness, 28 Zeilen | ✓ identisch | ✓ | ✓ | ✓ |
| `tools/reviewer-cli-conformance.sh` | Harness | ✓ vorhanden | ✓ | ✓ | ✓ |

Der Fleet-Zustand ist hier also **grün** — was das Dashboard heute nirgends
zeigt. Umgekehrt: **kein** Host-Gate trägt einen Vendor-Header mit dem
Core-Commit, obwohl `codex-workflow/openspec/specs/change-gate/spec.md` das
als SHALL fordert („SHALL record **the same** core commit in a vendor header").
Byte-Identität stimmt aktuell zufällig-korrekt; die geforderte
Nachweiskette fehlt. Das ist ein Kandidat für die Versions-Seite.

### 1.4 OpenSpec-Adoption — uneinheitlich

| Repo | `openspec/` | aktive Changes | archivierte | deployte Requirements |
|---|---|---|---|---|
| `agenticapps-workflow-core` | ✓ | 0 | ✓ | (Dry-Run-Korpus, nicht live) |
| `codex-workflow` | ✓ | **0** | 2 | 11 (`change-gate` 7, `reviewer-cli` 4) |
| `opencode-workflow` | ✓ | 0 | ✓ | — |
| `claude-workflow` | ✗ | — | — | — |
| `pi-agentic-apps-workflow` | ✗ | — | — | — |
| `agenticapps-dashboard` | ✗ | — | — | — |

⚠ **Überholt.** Diese Tabelle bildet den Stand *vor* PR #66 ab. Das Dashboard
hat seit dem 2026-07-26 einen vollständigen Spec-Slot: 12 ratifizierte
Capabilities, 100 deployte Requirements, vier offene Changes, 21 archivierte.
Siehe §14.

### 1.5 Das Dashboard-Repo ist selbst nicht up-to-date

`agenticapps-dashboard/.claude/skills/agentic-apps-workflow/SKILL.md`:

```
version: 2.9.0
implements_spec: 0.9.0
```

`claude-workflow` liefert inzwischen `1.0.0` aus und steht bei Migration
`0032`. **Das Dashboard hängt also eine Spec-Minor hinterher** — und genau
dieses Signal soll v2 als erste Kachel anzeigen. Ein besseres Motivationsbeispiel
gibt es nicht.

Wichtige Einschränkung, die die Spec berücksichtigen muss: **es gibt kein
Migrations-Ledger.** Weder `.planning/config.json` noch `.claude/` führen
Buch darüber, welche Migrationen angewandt wurden. Ableitbar ist deshalb nur
der Vergleich `installiertes SKILL.md (version + implements_spec)` gegen
`vom Host-Repo ausgeliefertes SKILL.md`. Ein Ledger wäre eine
Core-Spec-Erweiterung und ist hier **out of scope** (§11).

### 1.6 agents-task-viewer ist weiter als gedacht

Nicht mehr leer: Phase 5 von 6, 15 von 18 Plänen fertig, 67 %.
Drei funktionierende Adapter mit echten Fixtures (`src/adapters/{claude,codex,opencode}.ts`),
ein normalisierter Store (`src/store.ts`), ein festgeschriebenes Datenmodell
(`src/model.ts`: `Session`, `Task`, `HostAdapter`, `TaskStatus =
todo|in_progress|done|blocked`), OpenTUI-Rendering.

**Das Datenmodell wird nicht neu erfunden.** Das Dashboard-Board übernimmt
`Session`/`Task` eins zu eins als Wire-Shape (§7).

---

## 2. Produktentscheidung

### 2.1 Was das Dashboard ab v2 ist

Ein Instrument, das für jedes registrierte Repo dieselbe Frage in derselben
Form beantwortet: **Ist dieses Repo produktionsreif, und wenn nein, woran
liegt es?**

Dazu ein Spezialfall: für die fünf Workflow-Repos beantwortet es zusätzlich
**Sind die Implementierungen mit der Core-Spec synchron?** — versionsgenau,
weil das dort die eigentliche Arbeit ist.

Und ein Live-Blick: **Was tun die Agents gerade?**

### 2.2 Was das Dashboard ab v2 nicht mehr ist

- Kein GitNexus-Frontend (raus: `/code-intelligence`, `gitnexusScan`, `gitNexusScanner`, `InstallGitNexusButton`, `ScanPill`, `UnderstandCopyPill`, Understand-Viewer).
- Kein Observability-Werkzeug (raus: `ObservabilityHealth`, `SentryPanel`, `SecretsHealth`, `IntegrationsHealth`, `/observability/*`).
- Keine Coverage-Matrix im heutigen Sinn (3 Familien × 4 Spalten × Drift-Badges). Das Wort „Coverage" bedeutet in v2 **Test-Coverage**, nicht Werkzeug-Abdeckung.
- Kein Skill-Drift-Werkzeug (raus: `/observability/skill-drift`) — der eine nützliche Teil davon (Spec-Drift der Workflow-Skills) wandert in die Versions-Seite §6.
- Kein Conformance-Trend-Chart über 90 Tage.

### 2.3 Leitprinzip

**Sechs Checks, immer dieselben, immer in derselben Reihenfolge, für jedes
Repo.** Wo ein Check nicht laufen kann, sagt das Dashboard das (`nie
gelaufen`, `nicht eingerichtet`) — es zeigt nie 0 % oder ein grünes Häkchen
für „keine Daten". Diese Ehrlichkeitsregel steht schon in `PRODUCT.md` und
wird zur harten Invariante.

---

## 3. Informationsarchitektur

Vier Seiten. Aus heute 9 Routen werden 4 + 2 Utility.

```
/                  Fleet          — alle Repos, je eine Zeile mit Readiness-Strip
/repos/:id         Repo-Detail    — die sechs Checks ausgeklappt, mit Evidenz
/workflow          Workflow-Fleet — Versionsmatrix core ↔ 4 Hosts ↔ gate ↔ reviewer-cli
/board             Board          — Kanban über claude/codex/opencode-Sessions
/settings          Settings       — Pairing, Registry, Theme
/help              Help           — bleibt, aber auf 3 Seiten eingedampft
```

Sidebar: eine Sektion weniger. `WORKSPACE (Fleet, Board, Workflow)` /
`ACCOUNT (Settings, Help)`. Die Projekt-Unterliste in der Sidebar entfällt —
bei wachsender Repo-Zahl ist sie Lärm; die Fleet-Seite ist die Liste.

---

## 4. Das Readiness-Modell (Kern der Spec)

### 4.1 Die sechs Checks

Generische IDs. Welches Werkzeug einen Check erfüllt, ist **Mapping-Sache
und nicht Teil der UI** — das Dashboard zeigt „Security Review: bestanden",
nicht „cso v3 bestanden".

| # | `id` | Frage | Herkunft (Tier A, abgeleitet) |
|---|---|---|---|
| 1 | `workflow` | Läuft das Repo auf dem aktuellen Workflow? | hostabhängig, siehe §4.1.1 |
| 2 | `spec` | Wie ist der OpenSpec-Stand? | ⚠ **nicht selbst ableiten** — den Reader aus `add-openspec-project-reader` konsumieren, siehe §14.2 |
| 3 | `code-review` | Wurde Code-Review gefahren? | `openspec/changes/**/{REVIEWS.md,CODE-REVIEW.md}`, Fallback `.planning/phases/**/*-REVIEW.md` |
| 4 | `security-review` | Wurde ein Security-Review gefahren? | `openspec/changes/**/SECURITY.md`, Fallback `.planning/phases/**/*-SECURITY.md` |
| 5 | `pen-test` | Wurde ein Penetrationstest gefahren? | **kein Tier-A-Signal** → immer `never`, bis Tier B es liefert |
| 6 | `coverage` | Wie ist die Test-Coverage? | `coverage/coverage-summary.json` (v8/istanbul json-summary) → `total.lines.pct` |

### 4.1.1 Der workflow-Check ist pro Host verschieden (verifiziert)

Die vier Hosts installieren ihre Skills **nicht** gleich. Das ist der
unangenehmste Befund der Bestandsaufnahme, und eine Implementierung, die einen
einheitlichen Pfad annimmt, liefert für drei von vier Hosts Unsinn.

| Host | Per-Repo-Artefakt | Wo `implements_spec` steht |
|---|---|---|
| claude | `.claude/skills/agentic-apps-workflow/SKILL.md` mit `version:` + `implements_spec:` | **im Repo** |
| codex | `.codex/workflow-version.txt` — nur die Scaffolder-Version, gemessen z. B. `0.2.1` | **global** in `${CODEX_HOME:-~/.codex}/skills/` |
| opencode | `.opencode/workflow-version.txt` — analog | **global** in `$OPENCODE_CONFIG_DIR/skills/` |
| pi | kein Versionsartefakt gefunden; das Repo wird in `~/.pi/agent/settings.json` registriert, Skills kommen über `pi.json` | offen |

Konsequenzen, die in die UI durchschlagen:

- Bei claude ist „ist dieses Repo aktuell?" eine **Repo-Frage**.
- Bei codex und opencode ist es zur Hälfte eine **Maschinenfrage**: die
  Skill-Version gilt für alle Projekte dieses Hosts auf dieser Maschine. Der
  Check meldet dann die Scaffolder-Version aus dem Repo **und** die
  maschinenweite `implements_spec` — und die Detailseite sagt ausdrücklich,
  dass letztere nicht repo-spezifisch ist. Alles andere täuscht eine
  Granularität vor, die es nicht gibt.
- Bei pi liefert der Check zunächst `na` mit Begründung, bis geklärt ist,
  woran man die Version festmacht. Das ist ehrlicher als eine erfundene
  Ableitung.

`pen-test` ist bewusst ein leerer Slot mit ehrlichem Zustand. Er markiert die
Lücke zur Produktionsreife, statt sie zu verstecken. Sobald ein Werkzeug
gewählt ist, schreibt es Tier B (§4.3) — die UI ändert sich dabei nicht.

### 4.2 Statusvokabular

Genau sechs Werte, für alle Checks identisch:

| Wert | Bedeutung | Farbe |
|---|---|---|
| `ok` | Check erfüllt | grün |
| `warn` | erfüllt, aber grenzwertig (z. B. Coverage über Schwelle, aber gefallen) | bernstein |
| `fail` | Check gelaufen und durchgefallen | rot |
| `stale` | Check gelaufen, aber älter als der letzte relevante Commit | bernstein, schraffiert |
| `never` | Nie gelaufen | grau, Umriss |
| `n/a` | Für dieses Repo nicht anwendbar (begründungspflichtig) | grau, gepunktet |

`stale` ist der wichtigste neue Zustand: ein grüner Security-Review von vor
40 Commits ist keine Zusicherung. Definition: Zeitstempel des Evidenz-Artefakts
< Zeitstempel des letzten Commits, der Produktionscode berührt hat
(`git log -1 --format=%ct -- <src-Pfade>`).

### 4.3 Zwei Ebenen der Datenherkunft

**Tier A — abgeleitet.** Der Daemon liest, was ohnehin auf Platte liegt
(Spalte „Herkunft" in §4.1). Funktioniert heute, für jedes Repo, ohne dass
irgendein Repo geändert werden muss.

**Tier B — deklariert.** Existiert `<repo>/.agenticapps/readiness.json`,
gewinnt sie pro Check gegen Tier A. So können Checks Zustände melden, die
der Daemon nicht ableiten kann (externer Pen-Test, Coverage aus einem
CI-Lauf, bewusstes `n/a`).

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-26T09:12:00Z",
  "checks": [
    {
      "id": "pen-test",
      "status": "ok",
      "at": "2026-07-20T16:00:00Z",
      "summary": "Externer Test, 0 High/Critical offen",
      "evidence": "docs/security/2026-07-pentest.pdf"
    },
    {
      "id": "coverage",
      "status": "warn",
      "value": 78.4,
      "threshold": 80,
      "evidence": "coverage/coverage-summary.json"
    }
  ]
}
```

Regeln: unbekannte `id` wird ignoriert (nicht: Fehler). Fehlende Datei ist
kein Fehler. `schemaVersion`-Mismatch → die Datei wird ignoriert und das Repo
bekommt einen sichtbaren Hinweis, nicht stillschweigend Tier A.

**Warum zweistufig:** Ein einstufiges Modell zwingt entweder zu einem
Rollout über alle Repos, bevor irgendetwas sichtbar wird (Tier B allein),
oder deckelt das Dashboard dauerhaft auf das, was man aus Markdown
herausgreppen kann (Tier A allein). Zweistufig zeigt es ab Tag eins etwas
Echtes und wird pro Repo besser, das sich meldet.

### 4.4 Kein Gesamtscore

Es gibt **keine** aggregierte Prozentzahl pro Repo und keinen Fleet-Score.
Die heutige Conformance-Seite hat gezeigt, wohin das führt: eine Zahl, die
niemand zurück auf eine Handlung abbilden kann. Der Readiness-Strip ist
sechs Zellen — der Blick zählt die roten selbst.

Sortierung auf der Fleet-Seite: nach Anzahl `fail`, dann `never`, dann
zuletzt geändert. Sortieren ersetzt das Ranking.

---

## 5. Seite `/` — Fleet

Eine Tabelle, eine Zeile pro registriertem Repo.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Repo                    Workflow  Spec  Review  Sec  Pen  Cov   Zuletzt   │
├──────────────────────────────────────────────────────────────────────────┤
│ agenticapps-dashboard   ▲ 0.9.0    —     ■      ■    □    □     vor 2 Std │
│ claude-workflow         ● 1.0.0    —     ■      ■    □    □     vor 1 Tag │
│ codex-workflow          ● 1.0.0   0/11   ■      ■    □    □     vor 1 Tag │
│ fx-signal-agent         ● 1.0.0   3 off  ■      ■    □    ■ 84% vor 3 Tg  │
└──────────────────────────────────────────────────────────────────────────┘
   ● ok   ▲ veraltet   ■ ok   □ nie gelaufen   ▨ stale   ✕ fail
```

- **Workflow-Spalte** zeigt die *installierte* `implements_spec`-Zahl direkt in
  der Zelle, nicht nur eine Farbe. Die Zahl ist die Information.
- **Spec-Spalte** zeigt `N offen` (aktive Changes) bzw. `—` wenn kein
  `openspec/` existiert.
- **Cov-Spalte** zeigt Prozent, wenn vorhanden — nie „0 %" für „keine Daten".
- Klick auf die Zeile → `/repos/:id`. Klick auf eine Zelle → dieselbe Seite,
  zum passenden Check gescrollt.
- Filter-Chips oben: `nur mit Problemen` · `nur Workflow-Repos` · `nur Produkte`.
- Kein Karten-Grid mehr. Karten kosten pro Repo ~200 px Höhe; die Zeile
  kostet 40 px, und die Fleet wächst.

### 5.1 `/repos/:id` — Detail

Kopf: Repo-Name, Pfad, Host, letzter Commit, Buttons `In Editor öffnen`
(bestehendes `POST /open`) und `Neu scannen`.

Darunter die sechs Checks als ausgeklappte Zeilen, jede mit: Status,
Zeitstempel, Evidenzpfad (klickbar → bestehende `read`-Route rendert die
Datei), und bei `never` einem Satz, *wie* man den Check zum Laufen bringt.

Kein Sub-Tab, kein Modal, keine Drawer. Eine Seite, sechs Blöcke, scrollbar.

---

## 6. Seite `/workflow` — Workflow-Fleet

Die Seite, die es heute nicht gibt und die der eigentliche Auslöser ist.
Sie betrifft nur die fünf Repos `agenticapps-workflow-core`, `claude-workflow`,
`codex-workflow`, `opencode-workflow`, `pi-agentic-apps-workflow`.

### 6.1 Block 1 — Spec-Konformanz

```
Core-Spec: 1.0.0   (max über spec/*.md; [Unreleased] ohne Versionsänderung)

Host                        Primär-Skill   min–max über alle Skills   Migrationen
claude-workflow             1.0.0  ●        0.4.0 – 1.0.0  ▲           0032
codex-workflow              1.0.0  ●        0.4.0 – 1.0.0  ▲           0015
opencode-workflow           1.0.0  ●        1.0.0 – 1.0.0  ●           0011
pi-agentic-apps-workflow    1.0.0  ●        0.10.0 – 1.0.0 ▲           0010
```

Die zweite Spalte ist der Punkt: sie deckt die Skill-Nachzügler auf, die eine
Einzelzahl versteckt. Aufklappen listet die abweichenden Skills namentlich.

### 6.2 Block 2 — Geteilte Artefakte

```
Artefakt                Core      claude    codex     opencode  pi
openspec-change-gate    1.2.2     1.2.2 ✓   1.2.2 ✓   1.2.2 ✓   1.2.2 ✓
reviewer-cli            1.0.0     1.0.0 ✓   1.0.0 ✓   1.0.0 ✓   1.0.0 ✓
change-gate-conformance  —        ✓ ident   ✓ ident   ✓ ident   ✓ ident
Vendor-Header (Commit)   —        fehlt ▲   fehlt ▲   fehlt ▲   fehlt ▲
installiert in ~/.agenticapps/bin/                    1.2.2 / 1.0.0
```

`✓` bedeutet **byte-identisch** (md5 gegen `reference-implementations/`),
nicht „gleiche Versionsnummer im Header". Ein Host kann `1.2.2` behaupten
und abweichen — genau diese Klasse Fehler ist laut Core-Handoff schon einmal
passiert („a host that hand-merges instead of vendoring is the exact failure
this whole change exists to stop").

Die Zeile `installiert in ~/.agenticapps/bin/` prüft den maschinenweiten
Pfad — dort entscheidet sich, was die Agents tatsächlich ausführen, und dort
lag die Race-Condition aus dem Core-`[Unreleased]`-Block.

### 6.3 Block 3 — Harness-Ergebnis

Ein Knopf pro Host: `change-gate-conformance.sh` und
`reviewer-cli-conformance.sh` ausführen, Ergebnis als `n/28` bzw. `n/12`
mit Zeitstempel cachen (analog zum bestehenden `conformanceCache`).
Nicht automatisch beim Seitenaufruf — die Harness baut Fixture-Repos an
und ist zu teuer für einen Render.

### 6.4 Datenquellen (verifiziert)

| Wert | Pfad |
|---|---|
| Core-Spec-Version | `agenticapps-workflow-core/spec/*.md` → Frontmatter `spec_version:`, Maximum |
| `implements_spec` | `<host>/skills/*/SKILL.md` Frontmatter; bei claude zusätzlich `skill/SKILL.md` + `setup/snapshot/agentic-apps-workflow-SKILL.md` |
| gate-version | `<host>/bin/openspec-change-gate.sh`, Zeile `# gate-version: X.Y.Z` |
| reviewer-cli-version | `<host>/bin/reviewer-cli.sh`, Zeile `# reviewer-cli-version: X.Y.Z` |
| Byte-Identität | md5 gegen `agenticapps-workflow-core/reference-implementations/<artefakt>/` |
| Migrations-Höchstnummer | `<host>/migrations/NNNN-*.md`, höchste `NNNN` |
| Maschinenweit installiert | `~/.agenticapps/bin/*` |

---

## 7. Seite `/board` — Kanban

### 7.1 Architektur-Entscheidung

Die Adapter aus `agents-task-viewer` werden **nicht kopiert und nicht neu
geschrieben.** Sie wandern in ein eigenes Paket, das beide Konsumenten
importieren:

```
agents-task-viewer/
  packages/core/     ← model.ts, store.ts, adapters/{claude,codex,opencode}.ts
                        + Fixtures + Tests   (npm: @agenticapps/task-adapters)
  packages/tui/      ← das bestehende OpenTUI-Frontend
agenticapps-dashboard/
  packages/agent/    ← importiert @agenticapps/task-adapters, serviert /api/v2/board
```

Begründung: die Adapter sind der teure, schon getestete Teil (Fixtures gegen
echte Dateien verifiziert, drei Fehlerklassen pro Adapter abgefangen). Zwei
Kopien driften garantiert. Die TUI bleibt bestehen — sie ist das schnellere
Werkzeug am Terminal; das Board ist das Werkzeug für das iPad.

Konsequenz: `agents-task-viewer` muss auf ein Workspace-Layout umgestellt
werden (heute flach, `bun`). Das ist eigene Arbeit und ein eigenes Issue.
Bis dahin liefert der Daemon `/api/v2/board` gegen einen Stub aus
`skeleton-data.ts` — die SPA-Arbeit ist dadurch nicht blockiert.

### 7.2 Wire-Shape

Unverändert aus `agents-task-viewer/src/model.ts` übernommen:

```ts
type Host = 'claude' | 'codex' | 'opencode'
type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
interface Session { host, id, title, cwd?, createdAt?, updatedAt, active }
interface Task { host, sessionId, id, title, status, blockedBy[], blocks[],
                 startedAt?, completedAt?, note? }
```

Zod-Spiegel in `packages/shared/src/schemas/board.ts`, `.strict()` wie alle
bestehenden Schemas — Drift wird am Wire-Boundary zum Parse-Fehler.

### 7.3 Darstellung

Vier Spalten: `To do` · `In Arbeit` · `Blockiert` · `Erledigt`.
Karte = Task. Kartenkopf trägt einen Host-Punkt (claude / codex / opencode)
in der Farbe, die die TUI schon benutzt (`src/lib/host-style.ts`) — ein
Farbsystem, zwei Frontends.

- Gruppierung umschaltbar: nach Session (Default) oder flach nach Status.
- `Erledigt` standardmäßig auf die letzten 24 h begrenzt, sonst läuft die
  Spalte über.
- Filter: Host, „nur aktive Sessions" (7-Tage-Fenster aus dem Modell).
- Blockiert-Karten zeigen die blockierenden Task-Titel als Text. **Keine
  gezeichneten Abhängigkeitspfeile** — dieselbe Entscheidung, die die TUI
  schon getroffen hat.
- Read-only. Keine Drag-and-Drop-Statusänderung. Beobachten, nicht steuern.

Aktualisierung: Polling alle 3 s über TanStack Query. Kein SSE, kein
WebSocket — das widerspräche der bestehenden „no push"-Architektur und
3 s reichen für einen Blick aufs Board.

---

## 8. Daemon-API v2

Neu, unter `/api/v2/`, parallel zu den bestehenden Routen lauffähig.

| Methode | Pfad | Antwort |
|---|---|---|
| `GET` | `/api/v2/fleet` | `{ repos: RepoSummary[] }` — je Repo Identität + 6 `CheckResult` |
| `GET` | `/api/v2/repos/:id` | `RepoDetail` — Summary + Evidenzpfade + Hinweistexte |
| `POST` | `/api/v2/repos/:id/rescan` | Cache invalidieren, neu ableiten |
| `GET` | `/api/v2/workflow` | `WorkflowMatrix` — §6 Blöcke 1 + 2 |
| `POST` | `/api/v2/workflow/harness` | Harness-Lauf anstoßen (Body: `{host, which}`) |
| `GET` | `/api/v2/board` | `{ sessions: Session[], tasks: Task[] }` |

Cache: dieselbe 5-Sekunden-Memo-Strategie wie `overviewCache`/`phaseCache`.
Harness-Ergebnisse persistent unter `~/.agenticapps/dashboard/` (wie
`conformanceCache` heute).

Alle Antworten laufen weiterhin durch `outbound(c, Schema.parse)` —
die Schema-Drift-Verteidigung aus Phase 1 bleibt.

### 8.1 Routen, die entfallen

`gitnexusScan`, `understandViewer`, `sentry`, `secrets`, `observability`,
`integrations`, `skillDrift`, `conformance`, `coverage`, `coverageHistory`,
`agentlinter`, `commitment`, `discipline`, `phaseProgress`, `observations`,
`security`, `linear`.

Bleiben: `auth`, `registry`, `registryFixPath`, `health`, `admin`, `read`,
`git`, `overview` (verschlankt).

Das ist von **26 Routen-Modulen** (40 Dateien inklusive Tests) auf etwa 11.
`linear` ist ein Grenzfall — die
Linear-Integration wird für v2 **nicht** übernommen (Linear ist der Ort für
Issues, das Dashboard ist der Ort für Zustand). Wiedereinführung ist ein
späteres, separates Thema.

---

## 9. Umbaustrategie — Greenfield-SPA

Entschieden: **neues SPA daneben, altes danach löschen.**

1. `packages/spa-v2` wird angelegt: Vite + React + TS + Tailwind + TanStack
   Query + Zod + lucide-react. Keine weiteren Abhängigkeiten — die
   `PRODUCT.md`-Regel bleibt.
2. Aus dem alten SPA werden gezielt **übernommen**, nicht neu geschrieben:
   `lib/pairing.ts`, `lib/api.ts`, `lib/theme.ts`, `lib/registry.ts`,
   `lib/relativeTime.ts`, `lib/queryClient.ts`, `components/ui/{Pill,
   StatusPill,Card,PageHeader,EmptyState,Toast,Tooltip}.tsx`,
   `styles/tokens.css`. Das sind die getesteten, unstrittigen Teile.
3. Der Daemon serviert `/api/v2/*` **zusätzlich**, bevor irgendetwas gelöscht
   wird. Beide SPAs laufen parallel gegen denselben Daemon.
4. Cutover: `spa-v2` → `spa`, altes Verzeichnis löschen, tote Daemon-Routen
   und `shared`-Schemas löschen, `node_modules`-Ballast fällt mit.
5. Erst *nach* dem Cutover: Abbau in `packages/agent` (§8.1).

Nicht verhandelbar bei Schritt 4: der Cutover ist ein einzelner Commit, der
löscht. Kein „wir lassen die alte Seite erst mal noch drin".

### 9.1 Was mit `packages/agentlinter` und `packages/meta-observer` passiert

Beide werden in v2 nicht mehr vom Dashboard konsumiert. Sie werden **nicht
gelöscht**, sondern aus dem Workspace ausgehängt (`pnpm-workspace.yaml`) und
in eigene Repos verschoben oder archiviert. Eigenes Issue, kein Blocker.

---

## 10. Gestaltung

Die Identität aus `PRODUCT.md` bleibt gültig — warmes Papier, helles Theme
zuerst, Instrumententafel statt Marketingseite, keine Emoji, keine
Jubel-Copy. Was sich ändert:

- **Dichte statt Karten.** Zeilen à 40 px. Eine Bildschirmseite zeigt 15 Repos,
  nicht 4.
- **Ein Formvokabular für Zustand.** Der Readiness-Strip ist überall
  identisch: sechs Zellen, gleiche Reihenfolge, gleiche Sechs-Werte-Skala.
  Wer ihn einmal gelesen hat, liest ihn überall.
- **Farbe ist nie das einzige Signal.** Jeder Zustand hat zusätzlich eine
  Form (gefüllt / Umriss / schraffiert / gepunktet). Das ist
  Barrierefreiheit und funktioniert auch auf dem Handy in der Sonne.
- **Zahlen statt Ampeln, wo eine Zahl existiert.** `1.0.0`, `84 %`,
  `3 offen` stehen im Feld. Die Farbe ist die Zusammenfassung, nicht der
  Inhalt.
- **Typografie:** eine Schrift, drei Größen, zwei Gewichte. Tabellenzahlen
  tabellarisch (`font-variant-numeric: tabular-nums`), damit Spalten fluchten.
- ⚠ **Impeccable-Schwelle** ~~bleibt CI-Gate, wird auf **≥ 90** angehoben — das
  war ohnehin die v1.1-Zusage, und ein Neubau ist der Moment dafür.~~
  **Korrigiert 2026-08-05 (ADR-0003).** Beide Annahmen waren falsch: es gibt
  kein CI-Gate — `impeccable.yml` wurde zugunsten des Pro-Change-Artefakts
  zurückgezogen — und die ratifizierte Schwelle war zu diesem Zeitpunkt bereits
  **≥ 80**, nicht ≥ 87. Die Schwelle **bleibt ≥ 80** und wird weiterhin über das
  committete Kritik-Artefakt durchgesetzt, nicht in CI. Die v1.1-Zusage ≥ 90
  stand in einem `README.md`, das eine im Juni 2026 abgelöste Schwelle nannte.

---

## 11. Nicht im Scope

- **Migrations-Ledger.** Wäre die saubere Antwort auf „ist der Workflow
  up-to-date" (§1.5), gehört aber in die Core-Spec und die vier Host-Installer,
  nicht ins Dashboard. Separater Vorschlag in `agenticapps-workflow-core`.
- **Vendor-Header-Pflicht** für gate/reviewer-cli (§1.3) — ebenfalls Core.
- **Ein konkretes Pen-Test-Werkzeug auswählen.** Der Slot existiert; die
  Werkzeugwahl ist eine eigene Entscheidung.
- Windows, Mobile-Layout unter 768 px, Cloud-Speicherung, Push, Schreibzugriff
  auf Repos (außer dem bestehenden `POST /open`), Linear-Rückintegration.

---

## 12. Offene Entscheidungen

| # | Frage | Vorschlag |
|---|---|---|
| E-1 | Liegt `readiness.json` unter `<repo>/.agenticapps/` oder `<repo>/.planning/`? | `.agenticapps/` — hostneutral, `.planning/` ist GSD-Erbe und wandert laut §19 ohnehin |
| E-2 | Coverage-Schwelle global oder pro Repo? | Global 80 %, per `threshold` in `readiness.json` überschreibbar |
| E-3 | Wird `agents-task-viewer` wirklich auf Workspace umgebaut, oder liest der Daemon die Adapter per relativem Pfad? | Workspace + npm-Paket. Ein Pfad-Import über Repo-Grenzen bricht die Selbstenthaltung der Repos (Memory `feedback_repos_self_contained`) |
| E-4 | Bleibt die Cloudflare-Pages-Auslieferung? | Ja, unverändert — sie ist nicht Teil des Problems |
| E-5 | Bekommt die Fleet-Seite ein „Familie"-Konzept (agenticapps/factiv/neuroflash) zurück? | Als Filter-Chip ja, als Gruppierungsebene nein |

---

## 13. Erfolgskriterien

1. Ein Blick auf `/` beantwortet für jedes Repo die Frage „reif?" ohne Klick.
2. `/workflow` hätte die Skill-Drift aus §1.2 und den fehlenden Vendor-Header
   aus §1.3 sichtbar gemacht, bevor jemand danach gesucht hat.
3. `/board` zeigt eine Statusänderung in einem beliebigen Host innerhalb von
   4 Sekunden (3 s Polling + Render).
4. Das SPA hat weniger als **50 Quelldateien ohne Tests** (heute gemessen: 145
   ohne Tests, 282 inklusive).
5. `pnpm lint` meldet 0 Fehler und 0 Warnungen (heute: 3 Fehler, ~247
   Warnungen).
6. ⚠ Impeccable-Composite ~~≥ 90~~ **≥ 80** auf allen vier Seiten bei
   1440 × 900, nachgewiesen durch vier committete Kritik-Artefakte — kein
   CI-Check (korrigiert 2026-08-05, ADR-0003).

---

## 14. Nachtrag — was PR #66 an diesem Plan ändert

Die OpenSpec-Migration landete am selben Tag wie dieser Entwurf, wenige Stunden
später. Sie ändert nichts am Produktziel, aber vier Dinge an der Ausführung.

### 14.1 Der Plan hat jetzt einen Vorlauf

Vier Changes liegen offen auf `main`. Sie sind älter als dieser Plan und werden
eingeordnet, nicht überschrieben — Milestone **M0** im Linear-Projekt:

| Change | Entscheidung | Warum |
|---|---|---|
| `add-openspec-project-reader` | zuerst | liefert den Reader, den der `spec`-Check konsumiert |
| `remove-gitnexus-integration` | descopen, dann umsetzen | Task-Block 1 (Conformance-History-Kontinuität) entfällt, weil v2 die Conformance-Fläche löscht |
| `verify-tailscale-second-device-access` | nach v2 | verifiziert Panels, die v2 löscht |
| `add-oss-readiness` | nach v2 | veröffentlicht sonst 145 Dateien, von denen die meisten fallen |

### 14.2 §4.1 ist an einer Stelle überholt

Diese Spec schloss den Aufruf der `openspec`-CLI pauschal aus („nicht
garantiert vorhanden, zu teuer pro Render"). `add-openspec-project-reader` löst
das besser: CLI wenn das Binary auflöst, direkter Tree-Read sonst, das Archiv
immer aus dem Tree — plus ein Test, der für dieselbe Fixture identische Werte
aus beiden Pfaden beweist.

**Der `spec`-Check baut keinen zweiten Reader.** Er bildet ab, was der
bestehende liefert, auf das Statusvokabular aus §4.2. Zwei Reader über
dasselbe Verzeichnis wären genau die Drift, gegen die die Fleet-Disziplin
existiert.

Nebeneffekt, der erhalten bleiben soll: der Reader-Change retiriert den
GSD-Reader und blankt damit bewusst acht noch nicht migrierte Repos. Auf der
Fleet-Seite erscheinen sie in der `spec`-Spalte als `—`. Das ist der gewünschte
Zustand — die Spalte macht den Migrationsrückstand sichtbar. Ein GSD-Fallback
würde genau die Information verstecken, wegen der die Spalte existiert.

### 14.3 Der Abbau ist jetzt auch eine Spec-Aussage

Als dieser Entwurf entstand, hatte das Repo keinen Spec-Slot — der Abbau war
reines Löschen von Code. Jetzt sind es **100 deployte Requirements**, und v2
nimmt 42 davon zurück:

- **zurückgezogen (5 Capabilities):** `code-intelligence` (7 Req.),
  `fleet-coverage` (10), `fleet-conformance` (9), `skills-and-linting` (5),
  `optional-integrations` (11)
- **modifiziert (3):** `project-dashboard`, `design-system`, `help-docs`
- **unberührt (4):** `daemon-runtime`, `auth-and-pairing`,
  `filesystem-access-policy`, `project-registry` — die Sicherheits- und
  Infrastrukturwirbelsäule bleibt, weil v2 ändert *was* gezeigt wird, nicht
  *wie* die Daten geholt werden
- **neu (3):** `repo-readiness`, `workflow-fleet-conformance`, `agent-board`

Netto 12 → 10 Capabilities. Jede Rücknahme braucht ein
`## REMOVED Requirements`-Delta mit Begründung. „Der Code ist weg" ist keine;
„das Produkt beantwortet eine andere Frage" ist eine.

**Namensregel:** die neue Test-Coverage-Capability heißt **nicht**
`fleet-coverage`, und der Versionsvergleich heißt **nicht** `fleet-conformance`.
Beide Namen gehören zurückgezogenen Konzepten. Dieselbe Vokabel für zwei
Konzepte im selben Slot ist die zuverlässigste Art, ein halbes Jahr später
falsch zu lesen.

### 14.4 Die Ratifizierung hat Fragen bereits beantwortet

`openspec/CAPABILITY-MAP.md` löst GAP-01 bis GAP-05 mit Begründung auf, und
zwei davon korrigieren ausdrücklich eine vorher falsche Prämisse — etwa die
Annahme, GitNexus sei „ein Feature, dessen Upstream die Fleet fallengelassen
hat". Tatsächlich hat Migration 0032 GitNexus nur aus dem *Workflow-Scaffold*
entfernt; das Werkzeug ist v1.6.4 installiert und als MCP-Server registriert.
Die Entfernung aus dem Dashboard ist deshalb eine Produktentscheidung, keine
mechanische Folge.

Das Dokument ist ratifiziert und datiert. Änderungen werden **angehängt**,
nicht eingearbeitet (§08: supersede, never delete).

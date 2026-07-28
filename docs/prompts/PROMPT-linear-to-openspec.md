# Prompt — Linear-Projekt „Dashboard v2" in einen gemeinsamen OpenSpec-Plan überführen

> Startprompt für eine Agent-Session im Repo
> `~/Sourcecode/agenticapps/agenticapps-dashboard`, Branch von `main`.
> Host: Claude Code (bei Codex/opencode die Pfade sinngemäß ersetzen).
>
> **Fassung 2 — 2026-07-26.** Die erste Fassung ging davon aus, dass dieses Repo
> noch keinen Spec-Slot hat. Seit PR #66 hat es einen. Der Auftrag hat sich
> dadurch grundlegend geändert: nicht mehr *anlegen*, sondern *zusammenführen*.

---

## Auftrag

Im Repo liegen **vier offene OpenSpec-Changes** aus der Migration. In Linear
liegt ein **Projekt mit 28 Issues**, das einen Umbau beschreibt, der mehrere
dieser Changes berührt und fünf ratifizierte Capabilities zurückzieht.

Beides muss in **einen gemeinsamen Plan**. Nicht in zwei Pläne nebeneinander,
und nicht so, dass der neue den alten stillschweigend überschreibt.

Linear:
`https://linear.app/agenticapps/project/dashboard-v2-vereinfachung-fleet-versionen-kanban-0ab6d6d3537a`

Design-Grundlage: `docs/spec/DASHBOARD-V2-SPEC.md` (ist an zwei Stellen
überholt — siehe Phase 1).
Normativ: `agenticapps-workflow-core` **v1.0.0**, §16 (Spec-Slot), §17
(Lifecycle & Gate-Mapping), §18 (Change-Gate), §19 (Placement & Linear).

---

## Was auf `main` steht (Stand PR #66, `83b08f3`)

**12 ratifizierte Capabilities, 100 deployte Requirements** unter
`openspec/specs/`. Ratifiziert am 2026-07-26, dokumentiert in
`openspec/CAPABILITY-MAP.md` — 21 GSD-Phasen wurden zu 12 Capabilities
verschmolzen, Phasennummern bewusst nicht gespiegelt.

**Vier offene Changes** unter `openspec/changes/`:

| Change | Linear | Entscheidung |
|---|---|---|
| `add-openspec-project-reader` | AGE-479 | **Zuerst.** Fundament für v2. |
| `remove-gitnexus-integration` | AGE-480 | **Descopen**, dann umsetzen. |
| `verify-tailscale-second-device-access` | AGE-481 | **Nach v2.** |
| `add-oss-readiness` | AGE-482 | **Nach v2.** |

Außerdem: `openspec/BACKLOG.md` für Prozessschuld ohne Spec-Delta,
`docs/legacy-planning/` mit der GSD-Historie (read-only, §19 Tier 0),
21 archivierte Changes.

**Was das für dich heißt:** Recipe 0001 ist gelaufen. Lege keinen Slot an,
verschiebe kein `.planning/`, erfinde keine Capabilities. Die Vorarbeit ist
gemacht und war gründlich — lies sie, bevor du etwas hinzufügst.

---

## Die vier Regeln, an denen dieser Auftrag scheitert

**1. Ein Issue ist kein Requirement.**
§19 verlangt *merged, not mirrored*. 28 Issues werden nicht zu 28 Requirements
und nicht zu 28 Changes. Sie werden zu drei neuen Capabilities plus Deltas auf
bestehenden.

**2. Nur Produktgarantien gehören in den Spec-Slot.**
Der Placement-Test aus §19: *Produktgarantie oder Arbeitsweise?* Eine Garantie
ist etwas, dessen Verletzung ein Bug wäre. Die Issues aus M5 (Cutover, Lint,
Impeccable-Schwelle, Workspace-Aufräumen) sind fast vollständig Arbeitsweise
und erzeugen kaum Requirements — **mit einer Ausnahme**: AGE-483, das die
Rücknahme deployter Requirements beschreibt. Das ist eine Aussage über das
Produkt und gehört zwingend in Deltas.

**3. Ein Rückbau ist ein Spec-Delta, kein Aufräumen.**
Das ist der Unterschied zur ersten Fassung dieses Prompts. Damals war der Slot
leer, es gab nichts zurückzunehmen. Jetzt gibt es 100 Requirements, und v2
nimmt 42 davon zurück. Jedes braucht ein `## REMOVED Requirements`-Delta mit
Begründung. „Der Code ist weg" ist keine Begründung; „das Produkt beantwortet
eine andere Frage" ist eine.

**4. Linear wird nicht synchronisiert.**
§19: die Kopplung ist „a human-followable pointer". Nenne Issue-IDs in
`proposal.md`. Kein Sync, kein Rückschreiben, keine Pflicht zur Vollständigkeit
in beide Richtungen.

---

## Phase 0 — Lesen, bevor du schreibst

```sh
git rev-parse --abbrev-ref HEAD && git log --oneline -1   # erwartet: main @ 83b08f3 oder neuer
openspec --version                                        # fehlt -> npm i -g @fission-ai/openspec
openspec validate --all                                   # Ausgangszustand festhalten
ls openspec/changes/                                      # erwartet: die 4 + archive
```

Lies in dieser Reihenfolge, vollständig:

1. `openspec/CAPABILITY-MAP.md` — besonders die Abschnitte *Deliberate
   exclusions* und die aufgelösten GAP-01 bis GAP-05. Dort steht, **warum**
   geschnitten wurde, wie geschnitten wurde. Zwei der Auflösungen korrigieren
   ausdrücklich eine vorher falsche Prämisse; dieselbe Sorgfalt wird von dir
   erwartet.
2. Die vier `proposal.md`.
3. `openspec/config.yaml` — der `context:`-Block und die `rules:`.
4. `openspec/BACKLOG.md` — damit du Prozessschuld nicht versehentlich in einen
   Change ziehst.
5. Die 28 Linear-Issues.

**Berichte dann, bevor du eine Datei anfasst**, was du an Widersprüchen
zwischen dem Repo-Stand und den Linear-Issues findest. Die unten aufgeführten
sind die bekannten — wenn du weitere findest, sind sie das Wertvollste, was
diese Session produziert.

---

## Phase 1 — Die bekannten Widersprüche

Vier Stellen, an denen Repo und Linear-Plan aneinander vorbeireden. Drei sind
bereits entschieden; für die vierte trägst du die Entscheidung nur nach.

### 1.1 Zwei OpenSpec-Reader

`add-openspec-project-reader` baut genau den Reader, den AGE-458 unabhängig
noch einmal spezifiziert hatte: aktive Changes ohne `archive/`, `- [x]` gegen
`- [ ]`, `### Requirement:` unter `specs/`.

**Entschieden:** AGE-458 ist auf „konsumiert den Reader" zurückgeschnitten.
Der Change bleibt die einzige Implementierung.

**Und: die v2-Spec ist hier überholt.** `DASHBOARD-V2-SPEC.md` §4.1 schließt
den CLI-Aufruf pauschal aus („nicht garantiert vorhanden, zu teuer pro
Render"). Der Change löst es besser — CLI wenn das Binary auflöst, Tree-Read
sonst, Archiv immer aus dem Tree, plus ein Test, der für dieselbe Fixture
identische Werte aus beiden Pfaden beweist. **Korrigiere die Spec**, statt den
Widerspruch stehen zu lassen.

### 1.2 Der Conformance-History-Recompute

`remove-gitnexus-integration` widmet seinen ersten und aufwendigsten Task-Block
der Kontinuität des 90-Tage-Trends beim Spaltenwegfall. v2 löscht die
Conformance-Seite samt Chart und Snapshot-Historie.

**Entschieden (AGE-480):** Task-Block 1 entfällt, das Requirement
„Conformance History Survives A Column-Set Change" wird aus dem
`fleet-conformance`-Delta genommen.

**Der Abschnitt „The history problem, and why it gets its own requirement" im
`proposal.md` bleibt stehen** und bekommt eine Notiz, warum die Maßnahme
entfällt. Wer ihn löscht, macht aus einer Entscheidung einen übersehenen Task.

### 1.3 Das Capability-Panel

`add-openspec-project-reader` fügt der Einzelprojekt-Ansicht ein
Capability-Panel hinzu. AGE-466 ersetzt diese Ansicht durch sechs
Check-Blöcke.

**Nicht als Konflikt behandeln.** Der Reader ist die Arbeit, das Panel ist die
Fläche darüber. In v2 wird aus dem Panel die Evidenzanzeige des `spec`-Checks.
Halte das im `proposal.md` des v2-Changes fest, damit niemand später denkt, das
Panel sei versehentlich verschwunden.

### 1.4 Die acht blanken Repos

Der Reader-Change retiriert den GSD-Reader und blankt damit acht noch nicht
migrierte Repos — darunter `claude-workflow` und `factiv/cparx`.

**Kein Widerspruch, sondern das gewünschte Verhalten.** Auf der v2-Fleet-Seite
erscheinen sie in der `spec`-Spalte als `—`. Die Spalte macht den
Migrationsrückstand sichtbar. **Baue keinen GSD-Fallback** — er würde genau die
Information verstecken, wegen der die Spalte existiert.

---

## Phase 2 — Capabilities schneiden

Drei neue. Der Schnitt ist ein Vorschlag; widersprich begründet, wenn Phase 0
etwas anderes nahelegt.

| Neue Capability | Garantiert | Aus Issues |
|---|---|---|
| `repo-readiness` | Sechs Checks pro Repo, Statusvokabular, Tier-A/Tier-B-Präzedenz, Ehrlichkeitsregel | AGE-456, 457, 459, 460, 461, 462, 464, 465, 466 |
| `workflow-fleet-conformance` | Versionsvergleich Core ↔ Hosts, Byte-Identität, Harness-Ergebnis mit Alter | AGE-467, 468, 469 |
| `agent-board` | Normalisierte Sessions/Tasks über drei Hosts, read-only, Sichtbarkeitsfrist | AGE-470, 471, 472 |

**Ein Namenshinweis, der ernst gemeint ist:** die neue Capability für
Test-Coverage heißt **nicht** `fleet-coverage`. Dieser Name gehört der alten
Werkzeug-Abdeckungsmatrix und wird zurückgezogen. Dieselbe Vokabel für zwei
Konzepte im selben Slot ist die zuverlässigste Art, ein halbes Jahr später
falsch zu lesen.

Ebenso: `workflow-fleet-conformance` ist bewusst nicht `fleet-conformance`. Die
Frage überlebt, die Antwortform nicht — aus einem gewichteten Score wird ein
Versionsvergleich.

---

## Phase 3 — Changes anlegen

```sh
openspec new change add-repo-readiness
openspec new change add-workflow-fleet-conformance
openspec new change add-agent-board
openspec new change retire-v1-surfaces
```

**Die installierte CLI ist maßgeblich** (§16: „Where this prose and the
installed CLI disagree on a file name or subcommand, the CLI wins"). Heißt der
Befehl in deiner Version anders, nimm die CLI und notiere die Abweichung.
Bekannte Falle aus dem Core-Handoff: `OPENSPEC-CLI-AND-MULTIHOST.md` schreibt
`openspec update --tools` vor, das es in CLI 1.6.0 nicht gibt — `init` ist das
werkzeugwählende Verb.

### Der vierte Change ist der wichtige

`retire-v1-surfaces` trägt die Rücknahme (AGE-483). Ohne ihn führt der
Spec-Slot nach v2 zwei einander widersprechende Wahrheiten, und
`openspec validate` fängt das **nicht** — es prüft Struktur, nicht
Widerspruchsfreiheit.

Bilanz, gezählt auf `main`:

- **Zurückgezogen, 5 Capabilities / 42 Requirements:** `code-intelligence` (7),
  `fleet-coverage` (10), `fleet-conformance` (9), `skills-and-linting` (5),
  `optional-integrations` (11).
- **Modifiziert, 3:** `project-dashboard` (Projektionen ersetzt — setzt auf dem
  Delta von `add-openspec-project-reader` auf, nicht daneben), `design-system`
  (Impeccable 80 → 90, Dichte, „Farbe ist nie das einzige Signal"), `help-docs`
  (sechs Seiten → drei).
- **Unberührt, 4:** `daemon-runtime`, `auth-and-pairing`,
  `filesystem-access-policy`, `project-registry`. Das ist die Sicherheits- und
  Infrastrukturwirbelsäule. v2 ändert, *was* gezeigt wird, nicht *wie* die
  Daten geholt werden.

Delta-Format wie in `remove-gitnexus-integration/specs/` — dort stehen
`## REMOVED Requirements`, `## ADDED Requirements` und
`## MODIFIED Requirements` sauber nebeneinander. Nimm das als Vorlage.

**`CAPABILITY-MAP.md` nicht bereinigen.** Sie ist ein ratifiziertes Dokument
mit Datum. Änderungen werden angehängt, nicht eingearbeitet — §08: supersede,
never delete.

### Je Change

- **`proposal.md`** — Problem, Lösung, *was ausdrücklich nicht geändert wird*,
  Linear-IDs als Pointer.
- **`design.md`** — die verworfenen Alternativen. Für `repo-readiness`
  mindestens: warum nicht einstufig (nur Tier A oder nur Tier B), und warum
  kein aggregierter Score. Beide Begründungen stehen in der Design-Spec und im
  Linear-Projekt; übernimm sie, erfinde keine neuen.
- **`specs/<capability>/spec.md`** — das Delta, `### Requirement:` mit
  `#### Scenario:` im WHEN/THEN-Stil. Formatvorlage:
  `openspec/specs/filesystem-access-policy/spec.md`.
- **`tasks.md`** — hier landen die Issues als Arbeitsschritte mit
  `- [ ]`-Checkboxen und Linear-ID je Zeile.

---

## Phase 4 — Die gemeinsame Reihenfolge festhalten

Das ist der eigentliche Kern des Auftrags. Sieben Changes werden offen sein
(vier bestehende, drei bis vier neue), und ihre Reihenfolge ist nicht beliebig.
Halte sie an **einer** Stelle fest — vorgeschlagen: ein neuer Abschnitt
*Sequenz* in `openspec/CAPABILITY-MAP.md`, angehängt, nicht eingearbeitet.

```
1. add-openspec-project-reader        Fundament. Liefert den Reader, den der
                                      spec-Check konsumiert.
2. remove-gitnexus-integration        Descoped (Block 1 raus). Läuft parallel
   (descoped)                         zu 3 — berührt andere Dateien.
3. add-repo-readiness                 Braucht 1.
4. add-workflow-fleet-conformance     Unabhängig, kann früh laufen.
5. add-agent-board                    Unabhängig; Stufe 1 gegen Stub, also
                                      nicht durch die Adapter-Extraktion
                                      blockiert.
6. retire-v1-surfaces                 Am Cutover. Braucht 2 (GitNexus ist
                                      dann schon raus).
7. verify-tailscale-…  /  add-oss-…   Nach dem Cutover.
```

Warum diese Reihenfolge: (1) ist die einzige echte Abhängigkeit im Plan. (6)
muss ans Ende, weil ein Rückzug erst stimmt, wenn der Ersatz steht — sonst
sagt der Slot zwischenzeitlich, das Produkt könne nichts. (7) wartet, weil
beide Changes gegen Flächen arbeiten, die v2 ersetzt.

---

## Phase 5 — Validieren und Review

```sh
openspec validate --all
```

Muss grün sein. Erst danach darf Code unter einem offenen Change angefasst
werden — §18, durchgesetzt an drei Stellen (PreToolUse-Hook, git pre-commit,
CI) durch `~/.agenticapps/bin/openspec-change-gate.sh`.

**Beachte:** keiner der vier bestehenden Changes trägt bisher ein `REVIEWS.md`.
Das Gate verlangt mindestens zwei Reviewer, und zwar aus **fremden** CLIs — nie
der implementierende Host. Schreibt Claude Code diese Changes, sind die
Reviewer z. B. `gemini` und `opencode`, nicht `claude`. Die
Selbstausschluss-Regel ist im Gate implementiert und wird geprüft; sie zu
umgehen ist genau die Fehlerklasse, gegen die §18 existiert.

---

## Was du ausdrücklich nicht tust

- **Keine Code-Änderung.** Dieser Auftrag erzeugt Spec-Artefakte.
- **Kein Anlegen des Spec-Slots.** Er existiert. Kein `openspec init`, kein
  Verschieben von `.planning/`, keine Neu-Ratifizierung der Capability-Map.
- **Kein Löschen** in `docs/legacy-planning/` oder `openspec/changes/archive/`.
- **Kein Zurückziehen** von `daemon-runtime`, `auth-and-pairing`,
  `filesystem-access-policy`, `project-registry`. Wenn dein Delta eine davon
  anfasst, hast du wahrscheinlich Produktfläche mit Infrastruktur verwechselt —
  prüfe zweimal.
- **Kein Linear-Rückschreiben.**
- **Kein Erfinden von Messwerten.** Die Zahlen in den Issues (Core 1.0.0, gate
  1.2.2, reviewer-cli 1.0.0, 12 Capabilities, 100 Requirements, 42 zurückgezogen)
  sind am 2026-07-26 auf Platte gemessen. Prüfe nach, was du in eine Begründung
  übernimmst — ein Spec, der eine veraltete Messung als Tatsache führt, ist
  schlimmer als einer ohne Zahlen.

---

## Abschlussbericht

1. Welche Capabilities entstanden sind und **welche Issues in welche
   verschmolzen** wurden.
2. Welche Issues **kein** Requirement erzeugt haben, und nach welchem Kriterium.
3. Die Rücknahme-Bilanz: welche Requirements zurückgezogen wurden, mit je einem
   Satz Begründung. Wenn deine Zählung von den 42 oben abweicht, sag warum —
   du hast frischer gemessen als dieser Prompt.
4. Die Sequenz, wie du sie festgehalten hast, plus jede Abweichung von der
   vorgeschlagenen Reihenfolge mit Begründung.
5. Ausgabe von `openspec validate --all`.
6. Widersprüche zwischen Repo-Stand und Linear, die über die vier in Phase 1
   hinausgehen.
7. Offene Fragen, die du **nicht** selbst entschieden hast.

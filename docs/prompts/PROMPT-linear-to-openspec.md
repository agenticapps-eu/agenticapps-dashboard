# Prompt — Linear-Issues → OpenSpec-Change im agenticapps-dashboard

> Diesen Text als Startprompt in einer Agent-Session im Repo
> `~/Sourcecode/agenticapps/agenticapps-dashboard` verwenden.
> Host: Claude Code (bei Codex/opencode die Pfade sinngemäß ersetzen).

---

## Auftrag

Übersetze das Linear-Projekt **„Dashboard v2 — Vereinfachung, Fleet-Versionen,
Kanban"** (Team `AgenticApps`, 23 Issues, 5 Milestones) in einen konformen
OpenSpec-Spec-Slot in diesem Repo.

Linear:
`https://linear.app/agenticapps/project/dashboard-v2-vereinfachung-fleet-versionen-kanban-0ab6d6d3537a`

Design-Grundlage im Repo: `docs/spec/DASHBOARD-V2-SPEC.md`.
Normative Grundlage: `agenticapps-workflow-core` **v1.0.0**, insbesondere
**§16** (Spec-Slot), **§17** (Lifecycle & Gate-Mapping), **§18**
(Change-Gate), **§19** (Placement & Linear-Kopplung).

---

## Die drei Regeln, an denen dieser Auftrag scheitert, wenn du sie brichst

**1. Ein Issue ist kein Requirement.**
§19 verlangt ausdrücklich *merged, not mirrored*: „one-phase-one-spec is a
non-conforming mirror that recreates `.planning`'s fragmentation inside
`specs/`." Dasselbe gilt für Issues. 23 Issues werden **nicht** zu 23
Requirements und **nicht** zu 23 Changes. Sie werden zu einer Handvoll
Capabilities, deren Requirements aus mehreren Issues zusammenwachsen.

**2. Nur Produktgarantien gehören in den Spec-Slot.**
Der Placement-Test aus §19 lautet: *Ist das eine Produktgarantie oder eine
Arbeitsweise?* Eine Garantie ist etwas, worauf sich ein Nutzer verlässt und
dessen Verletzung ein Bug wäre. Eine Arbeitsweise ist eine Konvention des
Teams.

Konkret für dieses Projekt:

| Gehört in `specs/` | Gehört in `CLAUDE.md` (Prozess) | Gehört nirgendwohin |
|---|---|---|
| „Jedes Repo zeigt genau sechs Checks in fester Reihenfolge" | „SPA-Abhängigkeiten bleiben auf Vite/React/TS/Tailwind/Query/Zod/lucide beschränkt" | „`packages/spa-v2` anlegen" (ein Task) |
| „Ein Check ohne Datenlage zeigt `never`, nie 0 %" | „Impeccable-Composite ≥ 90 vor Merge" | „agentlinter aus dem Workspace aushängen" (ein Task) |
| „Tier B gewinnt pro Check gegen Tier A" | „Cutover ist genau ein Commit" | Lint-Zielwerte |
| „Byte-Identität, nicht Versionsnummer, entscheidet über ✓" | „Harness-Läufe werden nie automatisch ausgelöst" | Dateizählungen |

Die Issues aus **M5 (Cutover und Abbau)** enthalten fast ausschließlich
Arbeitsweise und Tasks. Sie erzeugen wahrscheinlich **kein einziges**
Requirement. Wenn du aus „Lint auf 0 Fehler" ein Requirement machst, hast du
den Placement-Test nicht angewandt.

**3. Linear wird nicht synchronisiert.**
§19: die Kopplung ist „a human-followable pointer, not a system of record
integration." Nenne die Issue-IDs in `proposal.md`. Baue **keinen** Sync,
verlange **nicht**, dass jedes Issue in einem Change auftaucht, und schreibe
**nichts** nach Linear zurück. Eine fehlende Referenz ist höchstens eine
SHOULD-Lücke, nie ein Konformanzfehler.

---

## Phase 0 — Bestandsaufnahme, bevor irgendetwas entsteht

Dieses Repo hat **noch keinen** Spec-Slot (`openspec/` fehlt) und **hat** eine
GSD-Historie (`.planning/phases/` mit Phasen bis DASH-15). Das heißt: der
Slot wird nicht auf der grünen Wiese angelegt, sondern nach **Recipe 0001**
(`planning-to-openspec`) migriert.

Prüfe und berichte, bevor du etwas schreibst:

```sh
openspec --version          # fehlt -> npm i -g @fission-ai/openspec
test -d openspec            # erwartet: fehlt
test -d .planning/phases    # erwartet: vorhanden
git status --porcelain      # erwartet: sauber, oder du benennst was offen ist
```

Die Recipe liegt in `claude-workflow` (bzw. als vendored Kopie in
`codex-workflow/docs/recipes/0001-planning-to-openspec.md`). Sie hat drei
Stufen:

- **Tier 0 (do no harm)** — `.planning/` wird nach `docs/legacy-planning/`
  **verschoben, nie gelöscht.** Achtung, hostabhängig: die *Runtime*-Configs
  bleiben an ihrem Platz (bei Claude: `.planning/config.json`). Nur die
  Historie zieht um.
- **Tier 1 (mechanisch)** — jede abgeschlossene Phase wird zu einem
  archivierten Change unter `changes/archive/<datum>-<slug>/`.
- **Tier 2 (überwacht)** — `specs/<capability>/` wird durch **Zusammenführen**
  verwandter Phasen rekonstruiert. Ausdrücklich kein unbeaufsichtigtes Skript.

**Halt hier an und lege dem Menschen deinen Plan für Tier 0 bis 2 vor,
bevor du migrierst.** Insbesondere: welche der bestehenden Phasen zu welcher
Capability verschmelzen und welche als reine Effort-Historie im Archiv
bleiben. Tier 2 ist Urteilssache, und ein falsch geschnittener Seed-Spec ist
teurer zu reparieren als neu zu schneiden.

---

## Phase 1 — Capabilities schneiden

Vorschlag als Ausgangspunkt, nicht als Vorgabe. Widersprich begründet, wenn
der Schnitt nach der Bestandsaufnahme anders sinnvoller ist:

| Capability | Was sie garantiert | Speist sich aus |
|---|---|---|
| `repo-readiness` | Sechs Checks pro Repo, Statusvokabular, Tier-A/Tier-B-Präzedenz, Ehrlichkeitsregel | AGE-456 bis AGE-462, AGE-464 bis AGE-466 |
| `workflow-fleet-conformance` | Versionsvergleich Core ↔ Hosts, Byte-Identität geteilter Artefakte, Harness-Ergebnisse mit Alter | AGE-467 bis AGE-469 |
| `agent-board` | Normalisierte Sessions/Tasks über drei Hosts, Read-only, Sichtbarkeitsfrist | AGE-470 bis AGE-472 |
| *(bestehend, aus Tier 2)* `pairing-and-registry` | Pairing, Token-Rotation, Registry, Pfad-Allowlist | Historie, nicht dieses Projekt |

Vier Capabilities, nicht dreiundzwanzig. Prüfe jede an §16: „A capability is
a coherent product surface, not a single phase."

---

## Phase 2 — Changes anlegen

Ein Change pro Capability, die neue Garantien bekommt. Also drei — nicht
fünf (Milestones sind Ablaufplanung, keine Spec-Struktur) und nicht
dreiundzwanzig.

```sh
openspec new change add-repo-readiness
openspec new change add-workflow-fleet-conformance
openspec new change add-agent-board
```

**Die installierte CLI ist maßgeblich** (§16: „Where this prose and the
installed CLI disagree on a file name or subcommand, the CLI wins"). Wenn
`openspec new change` in der installierten Version anders heißt, nimm die CLI
und notiere die Abweichung. Erfinde keine Verzeichnisse von Hand.

Bekannter Stolperstein aus dem Core-Handoff: `OPENSPEC-CLI-AND-MULTIHOST.md`
schreibt an zwei Stellen `openspec update --tools` vor — **das existiert in
CLI 1.6.0 nicht**, `init` ist das werkzeugwählende Verb. Nicht blind
abschreiben.

Je Change entstehen:

- **`proposal.md`** — Problem, Lösung, **was ausdrücklich nicht geändert
  wird**, und die Liste der Linear-IDs als Pointer.
- **`design.md`** — die verworfenen Alternativen, nicht nur die gewählte.
  Für `repo-readiness` heißt das mindestens: warum nicht einstufig (nur Tier A
  oder nur Tier B), und warum kein aggregierter Score. Beides steht mit
  Begründung in der Design-Spec und im Projekt-Beschrieb; übernimm die
  Begründung, erfinde keine neue.
- **`specs/<capability>/spec.md`** — das Delta: `### Requirement:` mit
  `#### Scenario:`-Blöcken im `WHEN/THEN`-Stil. Als Formatvorlage dient
  `codex-workflow/openspec/specs/change-gate/spec.md` — dort ist der Stil
  sauber getroffen.
- **`tasks.md`** — hier landen die Issues als Arbeitsschritte, mit
  `- [ ]`-Checkboxen und der Linear-ID je Zeile. **Das ist der Ort für
  Umsetzungsdetails, nicht der Spec.**

---

## Phase 3 — Requirements schreiben

Ein Requirement ist eine Zusicherung, kein Arbeitsauftrag. Prüfsatz: *Wenn
das verletzt wird, ist es ein Bug?* Wenn die Antwort „nein, dann haben wir
nur etwas nicht gemacht" lautet, ist es ein Task.

Aus den Issues lassen sich unter anderem diese Kandidaten destillieren — die
Formulierungen sind bewusst als Garantie geschrieben, nicht als Tätigkeit:

**`repo-readiness`**

- Die Antwort trägt für jedes Repo genau sechs Checks in fester Reihenfolge;
  ein Repo ohne jede Datenlage trägt sechsmal `never`, nie ein kürzeres Array.
- Ein Check ohne Datenlage meldet `never` und niemals einen Nullwert, der wie
  eine Messung aussieht.
- Eine `.agenticapps/readiness.json` gewinnt **pro Check** gegen den
  abgeleiteten Wert; bei unbekannter `schemaVersion` wird die Datei ignoriert
  **und** die Ablehnung sichtbar gemeldet — stilles Zurückfallen ist von
  „Datei existiert nicht" ununterscheidbar und deshalb ausgeschlossen.
- Ein Review-Artefakt, das älter ist als der jüngste Commit an
  Produktionscode, meldet `stale`, nicht `ok`. Änderungen an Dokumentation
  lösen kein `stale` aus.
- Der Fleet-Endpunkt wirft nie: der Ausfall eines Ableiters für ein Repo
  beeinträchtigt weder die übrigen Checks dieses Repos noch andere Repos.

**`workflow-fleet-conformance`**

- Die Core-Spec-Version ist das **Maximum** der `spec_version`-Werte über
  `spec/*.md` — Core versioniert pro Sektion, nicht pro Repo.
- Die Konformanz eines Hosts wird über **alle** seine Skills berichtet
  (Primär, Minimum, Maximum), nicht nur über den Primär-Skill.
- Ein geteiltes Artefakt gilt als übereinstimmend, wenn es **byte-identisch**
  zur Core-Referenz ist. Eine übereinstimmende Versionsnummer im Header
  genügt nicht.
- Ein Harness-Ergebnis wird immer mit seinem Alter berichtet und verfällt,
  sobald sich die Prüfsumme der geprüften Datei ändert.

**`agent-board`**

- Das Board ist read-only; es schreibt unter keinen Umständen in Host-Zustand.
- Ein nicht vorhandener Host fehlt in der Antwort, statt sie fehlschlagen zu
  lassen.
- Eine Statusänderung in einem beliebigen Host ist innerhalb von vier
  Sekunden sichtbar.

Diese Liste ist ein Ausgangspunkt. Ergänze, was du in den Issues findest,
aber **prüfe jede Ergänzung am Bug-Test.**

---

## Phase 4 — Validieren und Review

```sh
openspec validate --all
```

Muss grün sein. Erst danach darf Code unter einem offenen Change angefasst
werden — §18, durchgesetzt an drei Stellen (PreToolUse-Hook, git pre-commit,
CI) durch `~/.agenticapps/bin/openspec-change-gate.sh`.

Zusätzlich verlangt das Gate **`REVIEWS.md` mit mindestens zwei Reviewern**,
und die Reviewer müssen **fremde** CLIs sein — nie der implementierende Host.
Wenn Claude Code diesen Change schreibt, sind die Reviewer z. B. `gemini` und
`opencode`, nicht `claude`. Die Selbstausschluss-Regel ist im Gate
implementiert und wird geprüft; sie zu umgehen ist genau die Fehlerklasse,
gegen die §18 existiert.

---

## Was du ausdrücklich nicht tust

- **Keine Code-Änderung.** Dieser Auftrag erzeugt Spec-Artefakte. Die
  Implementierung folgt danach, unter dem dann offenen Change.
- **Kein Löschen von `.planning/`.** Verschieben, nie entfernen (§19 Tier 0).
- **Kein Linear-Rückschreiben**, kein Sync, kein Statuswechsel dort.
- **Kein Erfinden von Messwerten.** Die Zahlen in den Issues (Core 1.0.0,
  gate 1.2.2, reviewer-cli 1.0.0, Skill-Drift in drei von vier Hosts,
  Dashboard selbst auf 0.9.0) sind am 2026-07-26 auf Platte gemessen. Prüfe
  sie nach, wenn du sie in eine Requirement-Begründung übernimmst — sie
  können sich seither geändert haben, und ein Spec, der eine veraltete
  Messung als Tatsache führt, ist schlimmer als einer ohne Zahlen.

---

## Abschlussbericht

Wenn du fertig bist, berichte in dieser Form:

1. Welche Capabilities entstanden sind und **welche Issues in welche
   verschmolzen** wurden.
2. Welche Issues **kein** Requirement erzeugt haben, und nach welchem Kriterium.
3. Die Ausgabe von `openspec validate --all`.
4. Wo Recipe 0001 von ihrer Beschreibung abweichen musste, weil die
   installierte CLI oder dieses Repo anders aussehen — mit Begründung.
5. Offene Fragen, die du **nicht** selbst entschieden hast.

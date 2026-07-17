# SONNET_EXECUTION_PLAN.md — Amsterdam Undead

Handoff van Claude Fable (architect) naar Claude Sonnet (uitvoerder).
Je hoeft alleen dit bestand, `ROADMAP.md` (secties "v0.14+", "v0.15+" en
"v0.16"), `ARCHITECTURE_NOTES.md` en de code te lezen.

## Projectsamenvatting
Amsterdam Undead is een first-person undead wave-survival in één bestand:
`amsterdam-undead.html` (HTML + JS + Three.js via CDN-importmap, geen
build-stap, geen externe assets). Vier zones (woonkamer → gang → atelier →
binnenplaats) achter koopbare deuren, twee wapens (Drukspuit/Ratelaar,
wissel met Q), barricades op alle ramen, ondode-varianten
(Loper/Sjouwer/Brander), power-ups (Munitievoorraad/Dubbele
Beloning/Eliminatiemodus/Kerninslag), upgrades (schade, Snelheidselixer,
Pantserdrank), HUD, wave-banners en een game-over/reload-loop.
De codekaart met symboolnamen per systeem staat in `ARCHITECTURE_NOTES.md` §1.

Stand na ronde 1 (v0.14, fases 1–5 UITGEVOERD): eventgolven met de
Mistgolf + Sluiper, threat-budget (`spelStaat.budget`), HP-trap
(`ONDODE_HP_TRAPPEN`, plafond 4), spawn-cap 14/16/18, power-up-cooldowns
(sterk 2 golven / Kerninslag 4 / Munitievoorraad 2) en De Smederij
(€3000 per wapen, `wapenStaat.gesmeed`, `smederijConfig`). De
codekaart-aanvullingen voor de huidige staat staan in
`ARCHITECTURE_NOTES.md` §4.

## Architectuurregels (hard)
1. Alles blijft in `amsterdam-undead.html` — single-file, geen frameworks,
   geen assets, alleen simpele Three.js-geometrie en Web Audio via `piep()`.
2. `defend-national-monument.html` en `index.html` NIET aanraken.
3. IP-regels (CLAUDE.md): geen bestaande gamenamen. De Pack-a-Punch-machine
   heet in-game **De Smederij**; verder gelden de bestaande originele namen.
4. Debug-hook: alles testbaars exporteren op `window.AmsterdamUndeadDebug`
   (getters/setters voor `let`-variabelen). GEEN tweede test-global maken,
   ook al noemde een eerdere opdracht `__AMSTERDAM_UNDEAD_TEST__`.
5. Directe `spawnOndode(idx)`-aanroepen blijven standaard `'normaal'`
   spawnen; typevariatie loopt uitsluitend via `golfSpawnStap()`.
6. Balansconstanten bovenaan hun blok, met comment. Geen magic numbers
   diep in functies.
7. Elke wijziging: eerst headless load-check (geen console errors), dan de
   relevante tests, dan pas klaar melden. Commit/push alleen op expliciet
   verzoek van de gebruiker.

## Wat je WEL doet
- Eén ticket per keer, in de fasevolgorde hieronder.
- Minimale diff per ticket; bestaande gedragingen behouden tenzij het
  ticket expliciet iets verandert.
- Tests die door de wijziging van verwachting veranderen in HETZELFDE
  ticket bijwerken (staat per ticket aangegeven).
- Debug-exports bijwerken bij elke nieuwe state.

## Wat je NIET doet
- Geen tickets combineren of vooruitwerken ("nu ik hier toch ben…").
- Geen refactors buiten de ticketscope, geen hernoemingen van bestaande
  publieke debug-exports.
- Geen nieuwe dependencies, textures, modellen of audio-bestanden.
- Ticket 13 nooit tegelijk met iets anders uitvoeren.

## Testinfrastructuur (belangrijk!)
Sinds Ticket 10 (fase 2, uitgevoerd) staat de kernsuite in de repo:
`tests/` met `helpers.mjs` (Chromium op `/opt/pw-browsers/chromium`,
CDN-intercept voor `three.module.js`, optionele pointer-lock-simulatie),
`check-load.mjs`, `test-golf-cyclus.mjs`, `test-varianten.mjs`,
`test-powerups.mjs`, `test-eventgolven.mjs`, `test-smederij.mjs` en
`run-all.mjs` — zie `tests/README.md`. Elke wijziging: eerst
`node tests/check-load.mjs`, dan de relevante suite(s), en tests waarvan
de verwachting verandert in HETZELFDE ticket bijwerken. Voor checks die
(nog) niet in de repo-suite passen schrijf je een klein wegwerp-script
volgens het patroon in CLAUDE.md.

## Uitvoeringsvolgorde
| Fase | Tickets | Waarom deze volgorde |
| --- | --- | --- |
| 1. Balanspatch | 1, 2, 3, 4, 5 | Klein, onafhankelijk, direct spelbaar effect |
| 2. Debugbaarheid | 10 | Hooks + tests in repo vóór de grotere features |
| 3. Eventgolven | 6 → 7 → 8 → 9 | Framework eerst, dan mist, dan Sluiper, dan gating |
| 4. Wave-redesign | 13 → 14 → 15 | Budget eerst; HP-curve en cap bouwen erop |
| 5. De Smederij | 11 → 12 | Ná fase 4: de schadebonus is gebalanceerd op de NIEUWE HP-curve (cap 4). Eerder bouwen = twee keer tunen. |

Binnen fase 1 is de volgorde vrij, maar 2 en 3 raken dezelfde functie
(`kiesPowerupType`) — doe die direct na elkaar.

### Ronde 2 (v0.15+, fases 6–9 zijn UITGEVOERD)
| Fase | Tickets | Waarom deze volgorde |
| --- | --- | --- |
| 6. Power-up-droplimieten | 16 | Vervangt de cooldown-architectuur van T2/T3 + feedbackronde — één afgebakende refactor |
| 7. Smederij-visuals | 17 | Klein, puur cosmetisch, onafhankelijk van al het andere |
| 8. Zombie-herwerking | 18 → 19 → 20 → 21 → 22 → 23 | Model-refactor eerst (pivots), dan vorm, dan animatie, dan reacties, dan dood, dan de limiter |
| 9. Map-lus | 24 → 25 → 26 → 27 → 28 → 29 | Geometrie-schil eerst, dan deuren in koopvolgorde, dan inhoud, dan pas navigatie, dan balans |

**Fase 8 komt verplicht vóór fase 9**: de zombie-tickets herschrijven de
animatie-helft van `updateOndoden()`, het nav-ticket (T28) de
navigatie-helft — door elkaar heen werken in die functie is vragen om
regressies. Architectuur/planning is al gedaan (ARCHITECTURE_NOTES §4 +
ontwerpbeslissingen 14–20); alle tickets hieronder zijn implementatie.

**Nooit combineren met een ander ticket** (elk in een eigen sessie/commit):
- **T16** (drop-slot) — raakt `kiesPowerupType`/`spawnPowerupDrop` én
  vervangt bestaande cooldowntickets; ook nooit tegelijk met T21
  (beide raken `raakOndode`).
- **T18** (zombie-model-refactor) — het hitbox-contract mag maar door
  één wijziging tegelijk bewegen.
- **T24** (map-lus-geometrie) — muur-naden en obstakel-tellingen.
- **T28** (zone-navigatie-graaf) — herschrijft de navigatie-helft van
  `updateOndoden`.

### Ronde 3 (v0.16 — combat-leesbaarheid, schietfeedback, winkel-identiteit, sfeer)

Tickets 30–41 staan in `ROADMAP.md` sectie **v0.16**; de architectuur in
`ARCHITECTURE_NOTES.md` **§5** + **ontwerpbeslissingen 21–32**. Alles is
ontworpen — jij implementeert; neem GEEN nieuwe architectuurbeslissingen.
De standaard ticket-prompt verwijst voor deze ronde dus naar "sectie
v0.16" i.p.v. "v0.14+".

| Fase | Tickets | Waarom deze volgorde |
| --- | --- | --- |
| 10. Aanvalsleesbaarheid | 30 → 31 | Eerst de state-machine (gameplay), dan pas de tells (presentatie) — apart testbaar, apart terug te draaien |
| 11. Schietfeedback | 32 → 33 → 34 | Effecten-pool is de infrastructuur; hitmarker/audio bouwt erop; wapen-identiteit raakt dezelfde functies en komt daarom als laatste |
| 12. Winkel-identiteit | 35 → 36 → 37 | Smederij eerst op zijn definitieve plek, dan het stijl-register over ALLE winkels (incl. de verhuisde), dan status + licht |
| 13. Sfeer & leesbaarheid | 38 → 39 → 40 | Materiaal-families leveren de impactkleuren (na T32); vijand-ritmes hebben T31's oogMateriaal nodig; omgevingsdetails sluiten af |
| 14. Integratie | 41 | Performance-asserts + regressie + screenshots over het geheel |

**Nooit combineren met een ander ticket (ronde 3):**
- **T30** (aanvals-machine) — raakt de melee-branch van
  `updateOndoden()` én vervangt een verankerde test; de derde keer dat
  deze functie onder het mes gaat, dus dezelfde discipline als T18/T28.
- **T32** (effecten-pool) — hot-path-refactor van `schiet()`/
  `raakOndode()`.
- **T36** (markering-vervanging) — raakt alle 12 winkels tegelijk.

**Commitgrenzen ronde 3:** één commit per ticket, game werkend na elke
commit (load-check + volledige `tests/run-all.mjs` groen vóór commit).
Binnen een commit nooit oud + nieuw systeem tegelijk actief: T30
verwijdert de `MELEE_*`-constanten in dezelfde commit die de
state-machine introduceert; T32 verwijdert `vonk`/`bloedvonk` in
dezelfde commit als de pool; T36 vervangt ALLE
`interactieMarkering`-aanroepen in één commit. Documentatiestatus
(ROADMAP-vinkje) mag in dezelfde commit mee.

---

## Sonnet-prompts per ticket

Gebruik per ticket letterlijk deze opdrachtstijl. Vervang alleen het
ticketnummer. Algemene kop voor elke prompt:

> Je bent Claude Sonnet. Voer alleen Ticket X uit. Lees eerst
> `SONNET_EXECUTION_PLAN.md`, het ticket in `ROADMAP.md` (sectie v0.14+)
> en de relevante secties van `ARCHITECTURE_NOTES.md`. Pas alleen de
> minimale code aan die nodig is. Voer geen andere tickets uit. Draai na
> afloop de load-check en het testplan van het ticket. Commit niet zonder
> expliciete opdracht.

### Ticket 1 — wave-heal naar 60
- **Context:** `WAVE_HEAL_MIN` (blok "Balanswaarden golven") wordt in de
  wave-complete-branch van `updateGolf()` toegepast via `Math.max`.
- **Doel:** 75 → 60, inclusief README-tekst.
- **Stappen:** constante wijzigen; `grep -n "75"` op README.md en het
  startscherm voor verouderde teksten; testscript: golf uitroeien met
  hp=40 → verwacht 60, met hp=90 → verwacht 90.
- **Niet veranderen:** bonusformule, rustTimer, banner.
- **Acceptatie/test:** zie Ticket 1 in ROADMAP.md.

### Ticket 2 — sterke power-up-cooldown (2 golven)
- **Context:** `kiesPowerupType()` is nu een uniforme loting; drops
  ontstaan in `raakOndode()` → `spawnPowerupDrop()`.
- **Doel:** sterke types (Dubbele Beloning, Eliminatiemodus, Kerninslag)
  alleen toegestaan als `golf >= laatsteSterkePowerupGolf + 2`;
  registratie op drop-moment in `spawnPowerupDrop()`.
- **Stappen:** `sterk: true` op de drie entries; state + constante;
  `kiesPowerupType()` op basis van een toegestane-lijst; debug-export
  (getter+setter). Sampling-test (200 lotingen per golfstand).
- **Niet veranderen:** dropkans (0.12), effecten, verval/pickup.
- **Let op:** utility (`munitievoorraad`) is ALTIJD toegestaan — de lijst
  is nooit leeg.

### Ticket 3 — Kerninslag-cooldown (4 golven)
- **Context:** bouwt direct op Ticket 2, zelfde functie.
- **Doel:** kerninslag vereist bovendien `golf >= laatsteKerninslagGolf + 4`.
- **Stappen:** tweede state + constante + gate; registratie in
  `spawnPowerupDrop()`; debug-export; sampling-test met de mengsituatie
  (sterke-cd verlopen, kerninslag-cd actief → andere sterke types vallen
  wel, kerninslag niet). Noteer de open nerf-ontwerpvraag als comment bij
  de constante — niet bouwen.
- **Niet veranderen:** `geefKerninslag()` zelf.

### Ticket 4 — Loper 2,2 m/s
- **Stappen:** `ONDODE_TYPES.loper.snelheidMultiplier` 1.8 → 1.47,
  comment bijwerken, waarde-assert (`snelheid ≈ 2.205`).
- **Niet veranderen:** hp/geld/schaal/kleur van de Loper.

### Ticket 5 — Sjouwer 5 HP
- **Stappen:** `ONDODE_TYPES.sjouwer.hpMultiplier` 4 → 2.5, comment,
  waarde-assert (golf ≥ 3 → hp === 5). Bestaande variantentest blijft
  geldig (5 > 2×2).
- **Niet veranderen:** snelheid/geld van de Sjouwer.

### Ticket 10 — debug-hooks + tests in repo
- **Doel:** alle nieuwe state van T1–T9 op `AmsterdamUndeadDebug`;
  `tests/`-map met de kern-Playwright-scripts + README.
- **Let op:** GEEN nieuw global; volg het bestaande getter/setter-patroon.
  Tests moeten draaien vanaf schone checkout (documenteer de
  `three`/`playwright`-installatie in `tests/README.md`).

### Ticket 6 — eventgolf-framework
- **Context:** `startGolf()` en de wave-complete-branch van `updateGolf()`
  (zie waarschuwingen onderaan).
- **Doel:** `isEventGolf(golf)` (elke 5e), `kiesEventType` (nu altijd
  'mist'), `actieveEventGolf`-state met start-/afloophaakjes en eigen
  banner. Gewone golven gedragsidentiek.
- **Stappen:** helpers + state; banner-branch in `startGolf`; afloophaakje
  + reset in `updateGolf`-complete-branch en in `gameOver()`;
  debug-exports; tests op golf 4/5/6/10 + volledige cyclus.
- **Niet veranderen:** spawn-logica, heal/bonus-volgorde.

### Ticket 7 — Mistgolf-fog
- **Context:** er is exact één `scene.fog = new THREE.Fog(0x060a0e, 6, 24)`.
- **Doel:** tijdens 'mist'-event fog naar `{0x39443f, 2.5, 11}`, herstel
  in afloophaakje ÉN `gameOver()`; banner "MISTGOLF", eindmelding
  "De mist trekt weg".
- **Stappen:** `FOG_NORMAAL`/`FOG_MIST`-constanten; muteren via
  `scene.fog.color.setHex/.near/.far`; beide herstelpaden; fog-asserts
  vóór/tijdens/na + na gameOver; screenshot-leesbaarheidscheck.
- **Niet veranderen:** fog buiten mistgolven; renderer/licht-setup.

### Ticket 8 — Sluiper
- **Doel:** `ONDODE_TYPES.sluiper` (1.35 / 0.75 / 1.1, schaal 0.75,
  kleur 0x3c4a41, ogen 0xb8ffc8), NIET in de normale weging.
- **Stappen:** type-entry; gewicht 0 buiten mist (echte gating is T9);
  stats-assert + 200 samples buiten mist bevatten geen sluiper +
  screenshot in mist (ogen zichtbaar).
- **Niet veranderen:** `maakOndodeModel`-structuur (type-data volstaat),
  `ONDODE_TYPE_MIN_GOLF`.

### Ticket 9 — Mistgolf-spawngewichten
- **Doel:** tijdens `actieveEventGolf === 'mist'` retourneert
  `ondodeTypeGewichten()` uitsluitend `{ sluiper: 1 }`.
- **Stappen:** één early-return; 100-spawns-asserts op golf 5 (100%
  sluiper) en golf 6 (0% sluiper); bestaande variantentests groen.
- **Niet veranderen:** `golfSpawnStap`, barricade-gedrag.

### Ticket 13 — threat budget (VOORZICHTIG)
- **Context:** riskantste ticket; `spelStaat.teSpawnen` verandert van
  betekenis. Lees eerst de hele golf-cyclus (`startGolf`, `updateGolf`,
  `golfSpawnStap`) en het ticket in ROADMAP.md volledig.
- **Werkwijze verplicht in deze volgorde:** (1) schrijf eerst een
  headless test die de HUIDIGE volledige golf-cyclus vastlegt (golf start
  → spawns → uitroeien → golf++), (2) refactor naar
  budget-semantiek, (3) werk de test bij naar de nieuwe verwachtingen,
  (4) volledige regressie. Eén commit voor het geheel (makkelijke revert).
- **Kernpunten:** kosten-tabel; `golfBudget(golf) = round(5 + 1.7×(golf−1))`;
  type kiezen → kosten checken → terugvallen op 'normaal' → budget
  aftrekken ná echte spawn (barricade-beuk gratis); einde bij
  `budget < 1 && ondoden.length === 0`; banner toont dreiging i.p.v.
  aantal; mist-modifier ×0.9; debug-exports.
- **Niet veranderen:** `effectiefMaxActief`/interval-logica (dat is T15),
  heal/bonus, barricades.

### Ticket 14 — HP-schaling
- **Doel:** `ondodeStartHP()` → trap 1/2/3/4 (golf 1–4 / 5–10 / 11–15 /
  16+, hard plafond 4); Sjouwer `min(round(basis×2.5), 8)`.
- **Stappen:** trapfunctie; oude constanten opruimen of mappen
  (debug-export bijwerken!); HP-tabel-assert golf 1–25; balans- en
  variantentests bijwerken.
- **Let op:** brander-explosie (3 schade) doodt een 4-HP-normaal niet
  meer — bedoeld, noteer het in de commitboodschap.

### Ticket 15 — spawn-cap
- **Doel:** `GOLF_MAX_ACTIEF` 18 → 14; `ZONE_MAX_ACTIEF_BONUS` 4 → 2
  (plafond 14/16/18 per zonestand).
- **Stappen:** twee constanten + comments; cap-test per zonestand
  bijwerken; speeltest-notitie "vol maar leesbaar".
  
### Ticket 11, Smederij-architectuur, ná fase 4
* **Doel:** per-wapen `gesmeed`-status + schadeformule
  `schadePerTreffer + smederijbonus(actief wapen) + headshot`, zonder
  zichtbare machine-wijziging. Tegelijk wordt de bestaande globale
  schade-upgrade herbalanceerd, zodat die een kleiner early-game pad blijft
  en De Smederij later de sterkere late-game upgrade wordt.
* **Stappen:** `smederijConfig` op beide wapendefinities, Drukspuit
  `{ schadeBonus: 1.5, magazijnMax: 12 }`, Ratelaar
  `{ schadeBonus: 1, magazijnMax: 24 }`; `gesmeed: false` in
  `nieuweWapenStaat`; `koopUpgrade` aanpassen naar `+0.5` schade i.p.v.
  `+1`; `WAPEN_SCHADE_MAX` aanpassen naar `1.5` i.p.v. `2`;
  HUD-schadeweergave decimal-proof maken; één extra term in `raakOndode`
  toevoegen, Eliminatiemodus-override blijft erboven; debug-exports;
  16-combinaties-schadetest + assert dat globale schade stopt bij `1.5` +
  wisselpersistentie + volledige regressie.
* **Schadeverwachting:** zonder upgrades blijft bodyshot-schade `1`;
  globale schade-upgrade maakt dit `1.5`; gesmede Drukspuit krijgt `+1.5`;
  gesmede Ratelaar krijgt `+1`. Maximale bodyshot-schade wordt dus
  Drukspuit `3` en Ratelaar `2.5`. Headshots blijven
  `+HEADSHOT_EXTRA` bovenop bodyshot-schade.
* **Niet veranderen:** `HEADSHOT_EXTRA`, wapenwissel-logica,
  Eliminatiemodus-override, bestaande per-wapen ammo-state behalve het
  nieuwe `gesmeed`-veld.

### Ticket 12, Smederij-machine
* **Doel:** interactiepunt op de binnenplaats, €3000 per wapen, smeedt
  het ACTIEVE wapen éénmalig: schadebonus actief, magazijn
  `8 -> 12` / `16 -> 24` en meteen bijvullen, visueel accent + feller
  vlamlicht + eigen koop-piep, HUD-merkteken.
* **Stappen:** volg het `ratelaarPunt`-kooppatroon; positioneer via
  `PLAATS_*`-ankers en verifieer met `isVrijePlek`; prompt toont actief
  wapen + prijs of "al gesmeed"; `koopSmederij()` doet geld-check,
  zet `wapenStaat.gesmeed = true`, past `magazijnMax` aan via
  `smederijConfig`, vult het magazijn meteen bij en blokkeert dubbele
  aankoop per wapen; decor zonder collision, of mét collision en dan
  obstakel-test bijwerken; kooppad-tests per wapen + dubbele-aankoop-guard
  * onafhankelijkheid van beide wapens + schade-asserts + magazijn-refill
    assert + screenshot; balanscheck golf 12 tot 15 zonder smeden haalbaar.
* **Schadeverwachting:** Drukspuit gesmeed zonder globale upgrade doet
  bodyshot `2.5`, met globale upgrade bodyshot `3`; Ratelaar gesmeed zonder
  globale upgrade doet bodyshot `2`, met globale upgrade bodyshot `2.5`.
  Headshots blijven telkens `+HEADSHOT_EXTRA`.
* **Niet veranderen:** wapenwissel-logica, ammo-kist, bestaande
  koopinteractie-patronen, bestaande reserve-ammo-regels behalve het direct
  bijvullen van het actieve magazijn na smeden.


---

## Sonnet-prompts per ticket — ronde 2 (v0.15+)

Zelfde kop als hierboven; vervang alleen het ticketnummer. Lees per ticket
óók `ARCHITECTURE_NOTES.md` §4 (codekaart-aanvullingen na v0.14, huidige
plattegrond + lus-voorstel) en de ontwerpbeslissingen 14–20.

### Ticket 16 — power-ups: één drop-slot per golf
- **Context:** `kiesPowerupType()` heeft nu drie cooldown-gates
  (sterk/kerninslag/munitievoorraad); registratie op drop-moment in
  `spawnPowerupDrop()`, inclusief een `if (!type) return;`-guard.
- **Doel:** max één drop per golf (nieuwe state `laatstePowerupDropGolf`),
  Kerninslag houdt zijn 4-golven-ritme; sterk-/munitievoorraad-cooldowns
  en hun states/constanten/`sterk`-vlaggen verdwijnen.
- **Stappen:** state + slot-check vooraan `kiesPowerupType()`; oude gates
  en states verwijderen (ook uit de debug-export); registratie in
  `spawnPowerupDrop()`; debug-export getter+setter; de cooldownchecks in
  `tests/test-powerups.mjs` in ditzelfde ticket herschrijven naar
  slot-semantiek (geforceerde kills per golf + Kerninslag-sampling).
- **Niet veranderen:** `POWERUP_DROP_KANS`, effecten, verval/pickup,
  `KERNINSLAG_COOLDOWN_GOLVEN`.
- **Let op:** dit VERVANGT Tickets 2/3 + de feedbackronde-cooldown; één
  commit (makkelijke revert). Nooit combineren met T21.

### Ticket 17 — Smederij-visuals
- **Context:** wapen-Groups hangen aan de camera; `wisselWapen()` togglet
  `groep.visible`; `koopSmederij()` kleurt nu alleen
  `meterDrukspuit`/`tandwielRatelaar`; `schiet()` boost al
  `vlamLicht.intensity` bij gesmeed.
- **Doel:** per wapen een vooraf gebouwde, onzichtbare visual-Group
  (Drukspuit: 2 gloeiringen + ember-light; Ratelaar: draaiend tandwiel +
  hitteband + ember-light), zichtbaar na smeden; warmere mondingsflits;
  `updateSmederijVisuals(dt)` in de gameLoop (flikker + rotatie).
- **Stappen:** Groups bouwen bij de wapen-opbouw (`visible = false`);
  `koopSmederij()` zet visible; kleur-shift in `schiet()` (elk schot
  expliciet gezet, ook de niet-gesmede kleur); gameLoop-haakje;
  debug-export; 8-combinaties-visibility-test + screenshots van beide
  gesmede wapens.
- **Niet veranderen:** schade/magazijn/HUD-logica, `wisselWapen()`.
- **Let op:** budget ≤ 5 meshes + 1 light per wapen; geen particles.

### Ticket 18 — zombies Z1: modulair model (VOORZICHTIG)
- **Context:** `maakOndodeModel()` is één Group met 8 meshes zonder
  pivots; `userData.lichaamsdeel === 'kop'` op hoofd + ogen; `schiet()`
  raycast recursief op `ondodenGroep`.
- **Doel:** deel-hiërarchie met pivots (beenL/R, romp, armL/R, hoofd) +
  `ondode.delen`, zonder enige gedrags- of silhouetwijziging.
- **Werkwijze verplicht:** (1) eerst een headless raycast-test schrijven
  die het HUIDIGE hitbox-gedrag vastlegt (hoofd/torso/arm per type),
  (2) refactoren, (3) dezelfde test ongewijzigd groen draaien,
  (4) volledige regressie + vóór/na-screenshots van alle vijf types.
- **Niet veranderen:** `updateOndoden`, stats, traits-effect op het
  eindbeeld, het `'kop'`-contract.
- **Let op:** NOOIT combineren met een ander ticket; één commit.

### Ticket 19 — zombies Z2: silhouetten + variatieprofielen
- **Context:** na Z1; `ONDODE_TYPES` heeft per type kleur/oogKleur/schaal;
  `kiesOndodeTraits()` loot cosmetische traits.
- **Doel:** per-type vorm-data (Loper dun/gebogen, Sjouwer breed/bochel,
  Brander buik + gloeiende kern-mesh, Sluiper klein/ingedoken) +
  `VARIATIE_PROFIELEN` (6–8) in de traits-loting.
- **Stappen:** vorm-data + toepassing in `maakOndodeModel`; profielen;
  raycast-sweep per type × 3 profielen; screenshotserie; regressie.
- **Niet veranderen:** stats, hitbox-contract (hoofd nooit kleiner dan de
  huidige sphere), directe `spawnOndode`-defaults.

### Ticket 20 — zombies Z3: ledematen-animatie
- **Context:** na Z1/Z2; animatie-helft van `updateOndoden()` doet nu
  alleen `rotation.y` + strompel-wiebel op de root.
- **Doel:** stappende benen, tegenfase-armen, romp-bob, hoofd-microkantel
  voor alle ondoden; strompelt = asymmetrie; wiebel verhuist naar de
  romp-groep.
- **Stappen:** `loopFase` altijd laten lopen (snelheidsgekoppeld);
  pivot-rotaties (≤ 10 writes/ondode/frame, geen allocaties); bob op een
  kind van de root (nooit `groep.position` zelf); fase-screenshots;
  regressie.
- **Niet veranderen:** de navigatie-helft, positie/collision, melee.

### Ticket 21 — zombies Z4: hitreacties
- **Context:** na Z3; `raakOndode()` is het drukste risicogebied
  (schade/geld/drops/buffs) — alleen een veld toevoegen.
- **Doel:** flinch-state (kop/lichaam) + korte knockback (±0.12 m, door
  `losBotsingenOp` geklemd) + Brander-kern-puls; lerp in de
  animatie-helft.
- **Stappen:** `ondode.flinch` zetten in `raakOndode()`; afhandeling in
  `updateOndoden`; muurtest voor de knockback; regressie (incl.
  power-up-drops).
- **Niet veranderen:** volgorde/logica in `raakOndode` verder, melee,
  Eliminatiemodus-pad (geen flinch op directe kills).
- **Let op:** nooit tegelijk met T16 (zelfde functie).

### Ticket 22 — zombies Z5: doodsanimaties
- **Context:** `doodOndode()` verwijdert nu direct; drie contracten in
  ontwerpbeslissing 17 (golf-einde telt `ondoden`, raycast raakt
  `ondodenGroep`, melee itereert `ondoden`).
- **Doel:** `stervenden`-lijst + eigen scene-Group + `updateStervenden(dt)`
  (val-stijlen, ±0.7 s); Brander blijft direct exploderen zonder lijk.
- **Stappen:** verhuizing in `doodOndode()`; gameLoop-haakje; de drie
  contracten elk expliciet headless testen (golf eindigt met lijken in
  beeld; raycast door een lijk; Kerninslag → 5 stervenden); regressie.
- **Niet veranderen:** drop-posities, geld, `ontploiBrander`.

### Ticket 23 — zombies Z6: wave-variatie-limiter
- **Context:** na Z2; profielen worden geloot in `kiesOndodeTraits()`.
- **Doel:** ringbuffer (4) voorkomt 3 (bijna) identieke profielen op rij
  in golf-spawns; directe `spawnOndode()`-aanroepen blijven erbuiten.
- **Stappen:** buffer + herloting (max 3 pogingen, dan accepteren);
  sampling-test (100 spawns); debug-export; regressie.
- **Niet veranderen:** typekeuze, budget, barricade-gedrag.

### Ticket 24 — map-lus M1: geometrie-schil (VOORZICHTIG)
- **Context:** lees eerst ARCHITECTURE_NOTES §4.4 (muursegmenten +
  pocket) en §4.7 (plattegrond + constanten). `GRENS` hoeft NIET te
  wijzigen.
- **Doel:** bijkeuken (x ∈ [4.5, 12], z ∈ [−4.5, 4.5]) + kelderhals
  (x ∈ [9, 11], z ∈ [−7, −4.5]) fysiek bouwen, volledig dicht (op de
  deur 3/4-plekken staat gewoon muur), eigen vloer-/plafondtinten.
- **Stappen:** constanten; `vlak`/`bouwMuur`-aanroepen; probe-checks op
  alle nieuwe naden (`isVrijePlek`, niet op het oog); verifiëren dat de
  nepgevel op (16, −5.95) buiten de bijkeuken valt; obstakel-count-test
  bijwerken; screenshot vanaf de binnenplaats (zuidmuur-aanzicht
  ongewijzigd); volledige regressie.
- **Niet veranderen:** bestaande muren, `GRENS`, spawns, nav.
- **Let op:** NOOIT combineren met een ander ticket.

### Ticket 25 — map-lus M2: deur 3
- **Context:** de binnenplaats-zuidmuur is één `bouwBinnenplaatsMuur` op
  z = −6.85 — die wordt gesplitst; kooppatroon = `koopDeur2`.
- **Doel:** koopbare deur 3 (€1200) op x ∈ [9, 11], banner
  "DE BIJKEUKEN", `deur3Gekocht`; pacing gaat rekenen met
  `min(aantalOntgrendeldeZones(), 3)` (plafond blijft 14/16/18,
  ontwerpbeslissing 18).
- **Stappen:** muur-splitsing; mesh + obstakel + punt + markering +
  `koopDeur3()`; pacing-clamp; startscherm/README; kooppad-tests +
  pacing-asserts + reachability D→E; regressie.
- **Niet veranderen:** kelderdeur-spawn (20.1, −7.4), vensters (dat is
  T27), nav (dat is T28).

### Ticket 26 — map-lus M3: terugdeur (deur 4)
- **Context:** woonkamer-oostmuur is één `bouwMuur` op x = 4.65.
- **Doel:** koopbare terugdeur (€800) op z ∈ [−1, 1], kooppunt aan de
  bijkeuken-kant; ontgrendelt GEEN zone (pacing negeert deur 4);
  melding "De terugweg is open".
- **Stappen:** muur-splitsing; kooppatroon; probes op de naden;
  reachability A↔E in beide richtingen; regressie.
- **Niet veranderen:** A-vensters, ammo-kist, pacing.

### Ticket 27 — map-lus M4: zone-E-inhoud
- **Context:** venster-activering volgt het
  `koopDeur2`/`VENSTERS_PLAATS`-patroon; ammo-kist en zone-audio
  (`gangBetreden`) zijn de voorbeelden.
- **Doel:** `VENSTERS_BIJKEUKEN` (1 venster (11.6, 2) + barricade, actief
  na deur 3), Provisiekast (€350, tweede ammo-kist), decor
  (keukenblok/planken/kelderluik/flikkerpeertje), eenmalige
  bijkeuken-kraak, én de `plaatsBetreden`-windvlaag aansluiten op de
  nieuwe zone-indeling (mag niet in de bijkeuken afgaan).
- **Stappen:** venster + activering; kooppunt; decor zonder collision;
  audio-flags; tests (activering, kooppad, audio); regressie.
- **Niet veranderen:** `kiesVensterIndex`, bestaande vensters.

### Ticket 28 — map-lus M5: navigatie-graaf (VOORZICHTIG)
- **Context:** lineaire spine (`zoneVan` + `ZONE_DEURPUNTEN`) in de
  navigatie-helft van `updateOndoden()`; fase 8 MOET afgerond zijn.
- **Doel:** `zoneVan` met E-tak (vóór de woonkamer-check!), `ZONE_GRAAF`
  + `herbouwNavTabel()` (BFS, herbouwd bij elke deuraankoop),
  `updateOndoden` leest `NAV_VOLGENDE[eigenZone][spelerZone]`.
- **Werkwijze verplicht:** (1) eerst een headless test die het HUIDIGE
  nav-gedrag vastlegt (ondode in A/B/C/D vs. speler-zones → doelpunt),
  (2) refactoren, (3) met deur 3/4 dicht moet die test ONGEWIJZIGD groen
  zijn (lijn-graaf = oud gedrag), (4) lus-scenario's toevoegen (E→A
  beide richtingen, kortste-kant-keuze), (5) volledige regressie.
- **Niet veranderen:** ontwijk-logica, melee, `kiesVensterIndex`.
- **Let op:** NOOIT combineren met een ander ticket; één commit.

### Ticket 29 — map-lus M6: balans + eindregressie
- **Doel:** pacing-asserts (4 zones == 3-zones-waarden), speeltest beide
  looprichtingen (golf 8+), teksten (startscherm/README), eventuele
  prijstuning ± 25%.
- **Stappen:** asserts; speeltest-notities; teksten; `tests/run-all.mjs`
  + scratchpad-suite + screenshots van de complete lus.
- **Niet veranderen:** mechanica.

### Ticket 30 — aanval A1: state-machine met wind-up (VOORZICHTIG)
- **Context:** melee-branch bovenaan `updateOndoden()`
  (`afstand <= MELEE_BEREIK` → schade → `continue`) plus de
  `ondode.meleeTimer = 0`-reset onderaan de loop; constants
  `MELEE_BEREIK/SCHADE/COOLDOWN` (±regel 2160). Volledige
  state-machine-spec: ARCHITECTURE_NOTES §5.2 (letterlijk het
  `AANVAL_PROFIELEN`-blok overnemen) + beslissingen 21–24.
- **Doel:** 'jaag'/'windup'/'herstel' per ondode; discreet slag-moment
  (afstand + hoek + `isVrijePlek`-middelpunt); windup = stilstaan +
  beperkt draaien; herstel = 40% snelheid; `MAX_AANVALLERS = 2` +
  startjitter; headshot onderbreekt altijd, lichaamstreffer alleen
  Loper/Sluiper; `MELEE_*` vervalt volledig.
- **Stappen:** (1) constants + profielen; (2) statevelden in
  `spawnOndode`; (3) melee-branch vervangen (raak/mis als discrete
  overgang); (4) onderbrekingshaakje in `raakOndode` (ná de
  flinch-set), slot-vrijgave in `doodOndode`; (5) debug-export;
  (6) `tests/test-ondode-hitreacties.mjs`: de check "meleeTimer wordt
  elk frame gereset" VERVANGEN door state-checks (zelfde ticket!);
  (7) nieuwe `tests/test-aanval-machine.mjs` (scenario's uit het
  ROADMAP-testplan); (8) volledige regressie.
- **Niet veranderen:** navigatie-helft, animatie-helft,
  `ontploiBrander`, `spelerSchade`-signatuur.
- **Let op:** NOOIT combineren; derde ingreep in `updateOndoden` —
  alleen de melee-branch aanraken.

### Ticket 31 — aanval A2: tells (pose, ogen, audio)
- **Context:** arm-pivots + `ARM_RUST_ROTATIE_X` (animatie-helft),
  oog-materiaal in `maakOndodeModel` (één material per ondode, nu
  zonder `delen`-referentie). Spec: §5.3.
- **Doel:** windup-pose (armen naar −1.9 rad, hoofd licht achterover,
  ogen 1.4 → 2.6), herstel-afbouw; `delen.oogMateriaal`-referentie;
  `speelAanvalGrom(type)` / `speelSlagRaak()` / `speelSlagMis()`.
- **Stappen:** oogMateriaal in `delen`; pose-overrides in de
  animatie-helft (alleen voor windup/herstel-ondoden, arm-writes
  vervangen de loop-zwaai); audio-functies + aanroepen op de
  T30-overgangen; debug-tellers voor audio; tests
  (`test-aanval-tells.mjs`) + regressie (`test-ondode-animatie.mjs`
  moet groen blijven).
- **Niet veranderen:** T30-logica/timings, loop-zwaai buiten
  windup/herstel.
- **Let op:** `if (delen.armL)` overal (eenarmig-profiel).

### Ticket 32 — feedback F1: effecten-pool + tracers + impacts (VOORZICHTIG)
- **Context:** `vonk` in `schiet()` en `bloedvonk` in `raakOndode()`
  (beide: nieuwe mesh + `setTimeout` — verwijderen). Spec: §5.5,
  beslissing 25.
- **Doel:** `TRACER_MAX 8` / `IMPACT_MAX 24`, pools met gedeelde
  geometry + gecachete `MeshBasicMaterial`s, `spawnTracer` /
  `spawnImpact` / `updateEffecten(dt)` (in de `spelActief`-tak),
  module-temp-vectors; tracer bij ELK schot (vlam-wereldpositie →
  raakpunt/30 m); vijand 3 deeltjes, headshot 5 lichtere, wereld
  familie-kleur (default 'steen').
- **Stappen:** effecten-blok; `schiet()` ombouwen (vonk weg, tracer +
  wereld-impact erin); `raakOndode()` ombouwen (bloedvonk weg);
  gameLoop-aanroep; debug-export; `tests/test-effecten-pool.mjs`
  (plafonds, source-check op `setTimeout`/`new THREE.` in de hot
  paths, pauze-bevriezing); regressie.
- **Niet veranderen:** raycast-logica, headshot-detectie,
  geld/schade-paden, Brander-flits (gedocumenteerde uitzondering).
- **Let op:** NOOIT combineren; 0 allocaties per schot na opwarmen.

### Ticket 33 — feedback F2: hitmarker + treffer-/herlaad-audio
- **Context:** `speelTreffer` (uniform), `speelHerlaad`
  (vaste `setTimeout(900)` — vervangen), `speelDroogKlik`, `ammoUI`,
  HUD-DOM-conventie (`vignet`-decay-patroon). Spec: §5.4/§5.5-audio +
  beslissing 26.
- **Doel:** `#hitmarker`-DOM met drie tiers (raak/kop/kill),
  dt-gedreven decay; `speelRaakTik`/`speelKopTik`/`speelKillKnak` met
  ±5% pitch-variatie; herlaad-audio gesplitst (start in `herladen()`,
  klaar in `updateWapen()`); ammo-UI-knipper bij leeg magazijn.
- **Stappen:** HTML/CSS; tier-keuze in `raakOndode`; audio-functies;
  herlaad-splitsing; leeg-cue in `probeerTeSchieten`; decay in de
  cosmetische gameLoop-zone; debug-export; tests + regressie.
- **Niet veranderen:** schadeberekening, `speelSchot` (dat is T34).

### Ticket 34 — feedback F3: wapen-identiteit
- **Context:** `WAPEN_DRUKSPUIT`/`WAPEN_RATELAAR`-definities,
  `terugslag`-zone in `gameLoop`, camera-pitch-compose in
  `updateSpeler`, `wisselWapen` (instant toggle). Spec: §5.6-tabel +
  beslissing 27 — neem de waarden letterlijk over.
- **Doel:** per-wapen `kickSterkte`/`spreadNdc`/`terugslagSterkte`/
  `schotToon`; `cameraKick`-offset (visueel-only, exponentieel verval,
  `speler.pitch` NOOIT muteren); herlaad-dip; wisselanimatie 0.16 s +
  `speelWissel()`.
- **Stappen:** definitievelden; `schiet()` (kick/spread/per-wapen
  schotgeluid); camera-compose + decay; dip in `updateWapen`/
  terugslag-zone; wisseltimer; debug-export; tests + regressie.
- **Niet veranderen:** schade, cooldowns, magazijnen, T33's tiers.

### Ticket 35 — winkel W1: Smederij naar de bijkeuken
- **Context:** `SMEDERIJ_X = DEUR2_X + 2.5`, `SMEDERIJ_Z =
  PLAATS_Z_NOORD + 1.2`; machineblok/markering/kooppunt/koolLicht zijn
  allemaal afgeleiden. Spec: §5.8 + beslissing 28.
- **Doel:** `SMEDERIJ_X = 6.8`, `SMEDERIJ_Z = 3.5` — verder niets aan
  de Smederij-logica.
- **Stappen:** constanten wijzigen + comment bijwerken; README-regel;
  `tests/test-smederij-verhuizing.mjs` (oude plek leeg, nieuwe plek
  koopt beide wapens, muur-check vanaf (4.4, 3.5), route-probes,
  `schaduw === 1`); `test-smederij.mjs` moet ONGEWIJZIGD groen zijn;
  screenshots vóór/na van beide plekken.
- **Niet veranderen:** prijzen, smeed-logica, binnenplaats-decor,
  interactieradius.
- **Let op:** de deur4Punt-les — vanaf de woonkamer-kant mag NOOIT een
  prompt verschijnen.

### Ticket 36 — winkel W2: stijl-register + iconen (VOORZICHTIG)
- **Context:** `interactieMarkering(x, z, kleur)` (±3470) — ring +
  generieke kubus; 12 aanroepen; `doofMarkering` traverset materials.
  Spec: §5.7-tabel (iconen + kleuren letterlijk overnemen) +
  beslissing 29.
- **Doel:** `WINKEL_STIJLEN` + `winkelMarkering(x, z, stijlNaam)`;
  functie-iconen (munitie/upgrade/elixer/pantser/genezing/wapen/
  smeden/deur); alle aanroepen gemigreerd; exportnamen behouden;
  pantserdrank-kleur naar `0xb8c8ff`.
- **Stappen:** stijl-register + icoon-bouwers (gedeelde geometry-cache,
  EIGEN materials per markering — doofbaar); `winkelMarkering`;
  migratie van alle 12 aanroepen; debug-export (`WINKEL_STIJLEN`);
  `tests/test-winkel-stijlen.mjs`; screenshots; regressie.
- **Niet veranderen:** interactiepunt-radii/posities, koop-functies,
  `updateInteracties`.
- **Let op:** NOOIT combineren (12 winkels tegelijk); `doofMarkering`
  moet op elke nieuwe markering blijven werken.

### Ticket 37 — winkel W3: status + winkelLicht + koop-flits
- **Context:** T36's register; `doofMarkering`-patroon; lampflikker als
  puls-voorbeeld. Spec: §5.7-status + beslissing 30.
- **Doel:** `status()` per stijl ('beschikbaar'/'teDuur'/'gekocht'/
  'nvt'); `updateWinkelMarkeringen(dt)` (puls/stilstand/doof/ontkleurd,
  gedoofde markers overslaan); `flitsMarkering` in de koop-functies;
  één `winkelLicht` (PointLight zonder schaduw, ≤ 6 m,
  kleur-lerp, intensiteit-puls, dooft zonder winkel in de buurt).
- **Stappen:** status-functies; update-loop in `spelActief`-tak;
  flits-aanroepen naast elke `speelKoop()`; winkelLicht-blok;
  debug-export; `tests/test-winkel-status.mjs` + mist-screenshot;
  regressie.
- **Niet veranderen:** prompts, prijzen, `doofMarkering` zelf.
- **Let op:** Smederij-status volgt het ACTIEVE wapen (zelfde logica
  als de bestaande prompt); `schaduw === 1` blijft.

### Ticket 38 — sfeer S1: materiaal-families + impactkleuren
- **Context:** `mat()`-helper; T32's wereld-impactpad. Spec: §5.9-
  materiaal + beslissing 31.
- **Doel:** `matFamilie(naam, kleur)`-cache (hout/steen/tegel/metaal/
  natSteen); toegepast op binnenplaats-klinkers, bijkeuken-vloer,
  gang-vloer, kelderluik, deur-meshes; `userData.materiaalFamilie`;
  impact-deeltjeskleur per familie. Familie-materialen zijn IMMUTABEL.
- **Stappen:** cache-blok; oppervlakken migreren (kleuren blijven
  identiek — alleen roughness/metalness/gedeeldheid verandert);
  userData; T32-koppeling; debug-export; tests + screenshots per zone;
  regressie.
- **Niet veranderen:** props, ondode-materialen, winkel-materials
  (die blijven eigen/doofbaar), tone mapping/color space.

### Ticket 39 — sfeer S2: vijandleesbaarheid
- **Context:** `ONDODE_TYPES`, animatie-writes in `updateOndoden`,
  `startEventGolf`/`eindigEventGolf`, T31's `delen.oogMateriaal`.
  Spec: §5.9 + beslissing 32.
- **Doel:** `gang`-velden per type (pasFactor/bobFactor/ampFactor,
  waarden uit §5.9); per-type grom-timers (4–9 s, < 8 m, globale cap
  1/0.6 s, Sluiper NOOIT); mist-oogboost 2.6 aan/uit + bij
  mist-spawns; `oogBasisIntensiteit`-veld zodat T31's windup-puls
  vanaf de juiste basis rekent.
- **Stappen:** type-data; factoren in de bestaande animatie-formules
  (netto 0 extra writes); gromTimer in `spawnOndode` + decrement in
  `updateOndoden`; audio-functies; event-haken; debug-tellers; tests
  (incl. mist-screenshot Loper vs. Sjouwer) + regressie
  (hoofd-hoogte-anker!).
- **Niet veranderen:** hoofdgroep-y, hitbox-contract, T30-profielen.

### Ticket 40 — sfeer S3: omgevingsdetails
- **Context:** atelier-dakramen (lichtkolommen), kelderluik
  (±regel 1012), `startGolf()`, lampflikker-loop in `gameLoop`.
  Spec: §5.9-sfeer.
- **Doel:** 2 stofwolken (`THREE.Points` ≤ 30 punten, zichtbaar alleen
  in zone C, groepstransform-animatie); kelderhals-druppel (1 mesh,
  3–6 s cyclus, tik < 8 m); golfstart-lichtdip (`lampDipFactor`
  0.6 → 1 over 0.8 s in de flikker-loop).
- **Stappen:** stof-blok; druppel-blok + timer in `spelActief`-tak;
  dip-set in `startGolf` + factor in de flikker-loop; debug-export;
  `tests/test-omgeving-sfeer.mjs`; screenshots; regressie.
- **Niet veranderen:** Mistgolf, bestaande zone-audio, fog-waarden.

### Ticket 41 — integratie: eindregressie + performance-audit
- **Doel:** performance-asserts als test (lichten ≤ bestaand + 1,
  precies 1 schaduwwerper, effect-plafonds na stress, pool-hergebruik);
  speeltest-notities (golf 8+ alle deuren open, Mistgolf met
  tells/winkels/ogen, beide wapens); screenshots per zone + mist;
  teksten-check; micro-tuning ≤ ±25%.
- **Stappen:** `tests/test-v016-integratie.mjs`; `tests/run-all.mjs` +
  scratchpad-suite (bekende uitzonderingen documenteren);
  screenshotronde; eventuele tuning; eindrapport.
- **Niet veranderen:** mechanica buiten de ±25%-tuning.

---

## Waarschuwingen: risicovolle codegebieden
1. **`updateGolf()` — wave-complete-branch.** Heal, bonus, banner,
   event-afloop en budget-reset komen hier samen. Volgorde niet husselen;
   na elke wijziging de golf-cyclus headless simuleren.
2. **`raakOndode()`.** Schade, geld, buffs én drops in één functie.
   Tickets 2, 3 en 11 raken 'm — nooit twee tegelijk.
3. **`spelStaat.teSpawnen` → budget (T13).** Banner en meerdere tests
   lezen dit veld. Semantiekwijziging = alle lezers langslopen.
4. **`scene.fog` (T7).** Eén gedeeld object; elk pad dat een mistgolf kan
   beëindigen (golf-einde, game over) moet herstellen. Restart is een
   page-reload en herstelt zichzelf.
5. **Debug-export onderaan het bestand.** Elk ticket met nieuwe state
   werkt 'm bij; vergeten export = onschrijfbare acceptatietest.
6. **Barricade-contract.** `golfSpawnStap()` beukt eerst planken en
   spawnt pas bij 0 planken; dat mag geen budget kosten (T13) en geen
   sluiper-gate omzeilen (T9).
7. **Scratchpad-tests bestaan niet meer in jouw sessie.** Vertrouw niet op
   testbestanden uit de gespreksgeschiedenis; bouw ze uit `tests/` (na
   T10) of ad-hoc volgens het patroon in CLAUDE.md.

### Extra waarschuwingen ronde 2 (v0.15+)
8. **`updateOndoden()` heeft twee helften.** De animatie-helft
   (kijkrichting/wiebel, straks ledematen + flinches, T20/T21) en de
   navigatie-helft (zoneVan/deurpunten/ontwijk-bursts, T28). Fase 8 raakt
   uitsluitend de eerste, fase 9 uitsluitend de tweede — en fase 8 komt
   eerst. Nooit beide in één ticket.
9. **Raycast-contract van `schiet()`.** ALLES in `ondodenGroep` vangt
   kogels (recursieve intersect). Lijken moeten die groep dus verlaten
   (T22) en elk nieuw mesh-deel zonder `userData.lichaamsdeel === 'kop'`
   telt als lichaamstreffer — een vergeten kop-markering breekt headshots
   stil.
10. **Muur-splitsingen (T25/T26).** De hoekafdichtingen van de bestaande
    map leunen op botsingsradius-toleranties; verifieer nieuwe naden met
    `isVrijePlek`-probes, nooit op het oog (ARCHITECTURE_NOTES §4.4).
11. **T16 vervangt bestaande cooldowns.** De cooldownchecks in
    `tests/test-powerups.mjs` moeten in hetzelfde ticket mee naar
    slot-semantiek, anders is de suite rood terwijl het spel klopt.
12. **`plaatsBetreden`-audio checkt `x > DEUR2_X`.** De bijkeuken ligt
    óók op x > DEUR2_X — bij T27 die trigger op de nieuwe `zoneVan`
    aansluiten, anders waait de wind binnen.

### Extra waarschuwingen ronde 3 (v0.16)
13. **`updateOndoden()` heeft nu DRIE gescheiden werkgebieden**: de
    melee-branch (T30), de navigatie-helft (T28, af) en de
    animatie-helft (fase 8, af + T31/T39-factoren). Elk ronde-3-ticket
    benoemt expliciet welk gebied het mag aanraken — blijf daarbinnen.
14. **`tests/test-ondode-hitreacties.mjs` verankert het OUDE
    melee-gedrag** ("meleeTimer wordt elk frame gereset"). T30 vervangt
    die check in hetzelfde ticket — anders is de suite rood terwijl het
    spel klopt (zelfde les als T16/test-powerups).
15. **`schiet()`/`raakOndode()` zijn hot paths.** Na T32 geldt: geen
    `new THREE.*`, geen `setTimeout`, geen closures per schot. De
    effecten-tests doen een source-check — houd die groen.
16. **Gedeelde vs. eigen materials.** `matFamilie`-materialen (T38)
    zijn gedeeld en IMMUTABEL; winkelmarkering-materialen (T36) zijn
    per markering EIGEN (want `doofMarkering` muteert ze). Die twee
    werelden nooit mengen.
17. **Hoofd-hoogte-anker (±0.03) en het hitbox-contract** (beslissing
    16) blijven onaantastbaar: pose-/ritme-tickets (T31/T39) sturen
    alleen rotaties, amplitudes en frequenties — nooit de
    hoofdgroep-y of mesh-schalen van het hoofd.
18. **Audio-stapeling.** Ratelaar (10 schoten/s) × raak-tiks × groms:
    houd de nieuwe piep-volumes ≤ 0.16, duren kort, gebruik de
    grom-cap (1/0.6 s) en de ±5% pitch-variatie. Bij twijfel: minder
    lagen tegelijk.
19. **Eén Smederij, altijd.** T35 verhuist via de twee constanten —
    voeg NOOIT een tweede machineblok/markering/punt toe "voor de
    overgang". `tests/test-smederij.mjs` moet vóór en na T35
    ongewijzigd groen zijn; alleen `test-smederij-verhuizing.mjs` kent
    de nieuwe coördinaten.
20. **`winkelLicht` en de schaduw-invariant.** Er blijft precies één
    schaduwwerpende lamp in het hele spel (`schaduw === 1` in de
    perf-tests). Het winkelLicht, de kool, de vlammen en de
    Brander-flits werpen GEEN schaduw — nieuwe lichten evenmin.

---

## Sonnet-prompts per ticket — ronde 4 (v0.17)

Zelfde werkwijze als ronde 1-3: één ticket per keer, eerst dit plan +
het ticket in ROADMAP.md + de relevante §6-secties van
ARCHITECTURE_NOTES.md lezen, minimale wijziging, load-check + het
testplan van het ticket, nooit committen zonder expliciete opdracht.

### Ticket 42 — score, runStats en highscore
- **Context:** `spelStaat` (~4032), `schiet()` (~2671),
  `raakOndode()` (~3912), `gameOver()` (~3995), start-/gameOver-DOM
  (~336-353). Spec: §6.2.
- **Doel:** `runStats`-tellers op de bestaande plekken, `berekenScore()`
  alleen bij het einde, stats+score+record op het gameOver-scherm,
  record op het startscherm, `leesHighscore`/`schrijfHighscore` met
  verplichte try/catch.
- **Stappen:** runStats + increments; scoreformule; gameOver-scherm
  uitbreiden; startscherm-recordregel; helpers + guards; debug-export;
  `tests/test-score-stats.mjs`; regressie.
- **Niet veranderen:** de geld-uitkeringslogica zelf (alleen tellers
  ernaast), hot-path-structuur, bestaande scherm-flows.

### Ticket 43 — moeilijkheidsgraden
- **Context:** startscherm-DOM + click (~342-353, ~2053),
  `golfBudget()` (~3027), regen-constantes (~3000). Spec: §6.3.
- **Doel:** `MOEILIJKHEDEN`-register (toerist/amsterdammer/nachtwacht),
  drie startknoppen, drie inhaakplekken (budget, regen, score) +
  startGeld; amsterdammer = exact huidig gedrag.
- **Stappen:** register; knoppen + keuze-flow; inhaakplekken;
  moeilijkheid in gameOver-/recordweergave; debug-export;
  `tests/test-moeilijkheid.mjs`; regressie.
- **Niet veranderen:** prijzen, pauze-flow, de startscherm-guard voor
  game over.

### Ticket 44 — vluchtroute-onderdelen
- **Context:** `interactiePunten` (~4804), `WINKEL_STIJLEN` (~1730),
  `startGolf()` (~4120), HUD. Spec: §6.4-beslissing 35.
- **Doel:** drie onderdelen (golf 3/6/9, atelier/binnenplaats/bijkeuken)
  die dynamisch verschijnen (mesh + punt + markering), gratis oppakbaar,
  met HUD-teller en banner; laadtelling blijft 12.
- **Stappen:** register + meshes (isVrijePlek-probes); startGolf-hook;
  oppak-actie; `vluchtroute`-stijl; HUD-element; debug-export;
  `tests/test-vluchtroute.mjs`; screenshot; regressie.
- **Niet veranderen:** bestaande winkels/punten, de exacte-telling in
  test-smederij-verhuizing (die blijft juist kloppen dankzij het
  dynamische patroon).

### Ticket 45 — De Ontsnapping (VOORZICHTIG: schermen-guard)
- **Context:** pointerlockchange-handler (~2060-2071), `gameOverScherm`,
  kelderluik/kelderhals, T42-statsrender, T44-state. Spec: §6.4-
  beslissing 36 + risico §6.10.
- **Doel:** ontsnappingspunt (3/3 + €2500) bij het kelderluik, winscherm
  met stats/score(+1000)/record en "Speel door"/"Opnieuw"; winnen is
  géén gameOver; guard kent drie overlays.
- **Stappen:** punt (dynamisch); `#winScherm`-DOM/CSS; win-flow
  (exitPointerLock, record-save); doorspeel-flow (re-lock, punt weg);
  guard-uitbreiding; debug-export; `tests/test-ontsnapping.mjs` (incl.
  pauze-/gameover-regressiechecks); screenshot; regressie.
- **Niet veranderen:** `gameOver()` zelf, de bestaande
  restart-via-reload-conventie.

### Ticket 46 — eventgolf Stroomuitval
- **Context:** eventgolf-framework (~4052-4110), `hangLamp()` (~1205),
  flikker-loop (~4893), `spawnOndode()`-mistcheck (~3491),
  `eventSpawnGewichten` (~2977). Spec: §6.5.
- **Doel:** deterministische afwisseling mist/stroomuitval;
  `stroomFactor` (0.12, herstel ~2s) op lampen + peer-emissive +
  winkelLicht; buitenlicht blijft aan; oog-boost via zetOogBasis;
  gewichten {normaal 1, loper 2, sluiper 2}; start-/eindgeluid.
- **Stappen:** bol-mesh in lampLichten-entry; stroomFactor + ramp;
  kiesEventType; start/eindig-takken; spawn-check generaliseren; audio;
  debug-export; `tests/test-stroomuitval.mjs` (mét mist-regressie);
  screenshot; regressie.
- **Niet veranderen:** fog-waarden, `lampDipFactor`-gedrag, de
  mist-implementatie zelf.

### Ticket 47 — De Hagelketel: data, model, pellets (VOORZICHTIG: hot path)
- **Context:** wapen-definities (~2368-2400), `schiet()` (~2671),
  wapen-modelbouw, `test-v016-integratie.mjs` (lichtgrens). Spec: §6.6-
  beslissing 38.
- **Doel:** `WAPEN_HAGELKETEL` (volledige veldenset), `pelletAantal`-lus
  in `schiet()` (1 = exact het oude pad), ketel-model + vlam/vlamLicht
  (licht 23→24, grens in test-v016-integratie in DIT ticket mee),
  smederij-gloeiband zonder licht; alleen via debug activeerbaar.
- **Stappen:** definitie; pellet-lus (allocatievrij!); model + vlam;
  smederij-visual; wapenStaten-slot; lichtgrens-test bijwerken;
  debug-export; `tests/test-hagelketel-wapen.mjs`; screenshot; regressie.
- **Niet veranderen:** gedrag van beide bestaande wapens (regressie-
  contract), pool-plafonds, `raakOndode()`.

### Ticket 48 — Hagelketel-winkel + driewapen-wissel
- **Context:** `wisselWapen()` (~2429), koopRatelaar-patroon (~4580),
  `WINKEL_STIJLEN`, bijkeuken, `test-smederij-verhuizing.mjs`
  (12-telling). Spec: §6.6-beslissing 39.
- **Doel:** kooppunt (€2800, bijkeuken-noordwand via isVrijePlek +
  screenshot), `koopHagelketel`, `hagelketel`-stijl,
  `WAPEN_VOLGORDE`-cycle die niet-gekochte wapens overslaat; telling
  12→13 (test in DIT ticket bijwerken).
- **Stappen:** koopfunctie + punt + markering + wandrek-decor;
  stijl-entry; wisselWapen-herschrijving; tellingcheck bijwerken;
  debug-export; `tests/test-hagelketel-winkel.mjs`; screenshot;
  regressie.
- **Niet veranderen:** Smederij-/ammo-/HUD-logica (die volgen
  `wapenStaat` al), gedrag van de cycle bij precies twee wapens.

### Ticket 49 — dreigingsaudio-laag
- **Context:** `initGeluid()`/`piep()` (~2730), gameLoop-takken. Spec:
  §6.7.
- **Doel:** twee nooit-herstartende oscillators + gainNode;
  `berekenDreigingsGain` (puur, plafond 0.05); ~0.25s-throttle in de
  spelActief-tak; pauze → 0.
- **Stappen:** oscillator-init; pure helper; throttle-sturing beide
  takken; debug-export; `tests/test-dreigingsaudio.mjs` (pure functie +
  getters); regressie.
- **Niet veranderen:** bestaande one-shots, `speelGolfStart`.

### Ticket 50 — zone-naambanners + HUD-zonelabel
- **Context:** zone-triggerplek (~4866-4872), `zoneVan()` (~3536),
  `toonGolfBanner`, HUD. Spec: §6.8.
- **Doel:** `ZONE_NAMEN` (indices exact zoneVan: 0-4), banner 1x per
  zone per run, HUD-label alleen geschreven bij zonewissel.
- **Stappen:** namen + Set + laatsteZone-cache; banner-aanroep;
  HUD-element; debug-export; `tests/test-zone-banners.mjs`; regressie.
- **Niet veranderen:** `gangBetreden`/`plaatsBetreden`-audio,
  banner-systeem zelf.

### Ticket 51 — integratie: pacing-audit + eindregressie + teksten
- **Doel:** `tests/test-lategame-pacing.mjs` (sim golf 12-20: budget,
  HP-trap, mix, max-actief, geldstroom vs sinks); tuning uitsluitend
  ±25% van GOLF_BUDGET_GROEI / WAVE_BONUS_PER_GOLF /
  ONDODE_HP_TRAPPEN-drempels; README + startscherm bijwerken met alle
  ronde-4-features; screenshotronde (winscherm, stroomuitval,
  Hagelketel, vluchtroute, zone-banner); volledige suites.
- **Stappen:** pacing-test + meting; evt. tuning; teksten; screenshots;
  `run-all` + scratchpad-suite (uitzonderingen alleen na
  git-stash-verificatie documenteren); eindrapport.
- **Niet veranderen:** mechanica buiten de ±25%-tuning.

### Extra waarschuwingen ronde 4 (v0.17)

21. **Exacte-tellingschecks verhuizen mee met hun ticket.**
    `test-smederij-verhuizing` (12 punten) wordt ALLEEN in T48
    bijgewerkt (12→13); `test-v016-integratie` (lichten ≤ 23) ALLEEN in
    T47 (≤ 24). T44/T45 houden de telling op 12 dankzij het dynamische
    punten-patroon (beslissing 35) — voeg vluchtroute-punten dus nooit
    bij laadtijd toe.
22. **De schermen-guard (~2065) is één handler voor drie overlays.**
    Volgorde-regel: gameOver- en winscherm winnen van het startscherm;
    nooit twee overlays tegelijk. Elke wijziging draait de bestaande
    pauze- en gameover-tests mee.
23. **`schiet()` wordt voor de derde ronde op rij aangeraakt.** Het
    `pelletAantal = 1`-pad moet byte-voor-byte het huidige gedrag zijn;
    de source-checks (geen `new THREE.`/`setTimeout`) én de
    T34-identiteitstests bewaken dit. Geen array-allocaties in de
    pellet-lus.
24. **localStorage altijd via de guard-helpers.** Directe
    `localStorage.x`-toegang buiten `leesHighscore`/`schrijfHighscore`
    is verboden; de weiger-flow (mock) is een verplichte testcase.
25. **Mist en stroomuitval delen kanalen** (ogen, gewichten, budget-
    factor). Elke stroomuitval-wijziging draait de mist-checks uit
    `test-vijand-leesbaarheid.mjs`/`test-eventgolven.mjs` mee; het
    windup-randgeval (T39-patroon) geldt voor beide events.
26. **Drone-oscillators nooit stoppen of herstarten** — alleen
    gain-sturing; start/stop klikt hoorbaar en een dubbele start stapelt
    oscillators. Pauze dempt via doelgain 0, niet via stop.
27. **wisselWapen-regressiecontract:** met precies twee gekochte wapens
    moet de nieuwe cycle exact de oude toggle zijn — de bestaande
    wisseltests draaien ONGEWIJZIGD groen vóór de nieuwe tests erbij
    komen.
28. **Klok-vs-dt (drie keer geleerd in ronde 3):** alles wat op de
    module-`klok` of echte timers draait test je met
    `waitForTimeout` + de draaiende gameLoop (simuleerPointerLock),
    nooit met handmatige synchrone ticks; DOM/audio-doelwaarden lees je
    in dezelfde `evaluate()`-snapshot als hun invoer.

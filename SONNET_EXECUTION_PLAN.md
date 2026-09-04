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

### Ronde 5 (v0.19 — visuele/ruimtelijke diepte, AI en oriëntatie)

Tickets 58–68 staan in `ROADMAP.md` sectie **v0.19**; de architectuur in
`ARCHITECTURE_NOTES.md` **§7** + **ontwerpbeslissingen 49–61**. Alles is
ontworpen — jij implementeert; neem GEEN nieuwe architectuurbeslissingen.
Deze hele ronde is **gepland, nog niet uitgevoerd**: elk ticket wacht op
een aparte, expliciete opdracht.

| Fase | Tickets | Waarom deze volgorde |
| --- | --- | --- |
| 15. Visuele kwaliteit | 58 → 59 → 60 → 61 | Palet eerst (kleurbasis), dan texturen (bouwt op het palet), dan post-processing (onafhankelijke renderlaag), dan silhouetten (puur cosmetisch, los van de rest) |
| 16. Verticaliteit | 62 → 63 | Geometrie/Y-beweging eerst (VOORZICHTIG, hoogste regressierisico), dan pas inhoud + het "permanent veilig"-contract erbovenop |
| 17. Pathfinding | 64 → 65 | Eerst de waypoint-dataset + lookup (puur additief), dan de integratie die de oude ad-hoc code verwijdert (VOORZICHTIG) |
| 18. Sfeer | 66 | Onafhankelijk, volgt het bestaande drone-patroon |
| 19. Oriëntatie & feedback | 67 → 68 | Minimap en richtingsfeedback raken andere code-gebieden en kunnen in willekeurige volgorde, maar niet gecombineerd met elkaar |

**T58 vóór T59/T61** (palet-consistentie), **T62 vóór T63** (geometrie
vóór inhoud/contract), **T64 vóór T65** (dataset vóór integratie) zijn
harde volgordes; de overige fases zijn onderling onafhankelijk.

**Nooit combineren met een ander ticket (ronde 5):**
- **T61** (silhouetten) — het hitbox-/head-anchor-contract mag maar
  door één wijziging tegelijk bewegen, zelfde discipline als T18/T30.
- **T62** (kelder-geometrie/Y-beweging) — eerste structurele gebruik
  van `positie.y` in het hele project; nooit combineren met T63 of
  enig ander ticket dat `speler.positie` aanraakt.
- **T65** (waypoint-integratie) — herschrijft de navigatie-helft van
  `updateOndoden()` en verwijdert bestaande code in dezelfde diff;
  zelfde discipline als T18/T28/T30.

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

### Ticket 1 —1 wave-heal naar 60
- **Context:** `WAVE_HEAL_MIN` (blok "Balanswaarden golven") wordt in de
  wave-complete-branch van `updateGolf()` toegepast via `Math.max`.
- **Doel:** 75 → 60, inclusief README-tekst.
- **Stappen:** constante wijzigen; `grep -n "75"` op README.md en het
  startscherm voor verouderde teksten; testscript: golf uitroeien met
  hp=40 → verwacht 60, met hp=90 → verwacht 90.
- **Niet veranderen:** bonusformule, rustTimer, banner.
- **Acceptatie/test:** zie Ticket 1 in ROADMAP.md.

### Ticket 2 —2 sterke power-up-cooldown (2 golven)
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

### Ticket 3 —3 Kerninslag-cooldown (4 golven)
- **Context:** bouwt direct op Ticket 2, zelfde functie.
- **Doel:** kerninslag vereist bovendien `golf >= laatsteKerninslagGolf + 4`.
- **Stappen:** tweede state + constante + gate; registratie in
  `spawnPowerupDrop()`; debug-export; sampling-test met de mengsituatie
  (sterke-cd verlopen, kerninslag-cd actief → andere sterke types vallen
  wel, kerninslag niet). Noteer de open nerf-ontwerpvraag als comment bij
  de constante — niet bouwen.
- **Niet veranderen:** `geefKerninslag()` zelf.

### Ticket 4 —4 Loper 2,2 m/s
- **Stappen:** `ONDODE_TYPES.loper.snelheidMultiplier` 1.8 → 1.47,
  comment bijwerken, waarde-assert (`snelheid ≈ 2.205`).
- **Niet veranderen:** hp/geld/schaal/kleur van de Loper.

### Ticket 5 —5 Sjouwer 5 HP
- **Stappen:** `ONDODE_TYPES.sjouwer.hpMultiplier` 4 → 2.5, comment,
  waarde-assert (golf ≥ 3 → hp === 5). Bestaande variantentest blijft
  geldig (5 > 2×2).
- **Niet veranderen:** snelheid/geld van de Sjouwer.

### Ticket 10 —10 debug-hooks + tests in repo
- **Doel:** alle nieuwe state van T1–T9 op `AmsterdamUndeadDebug`;
  `tests/`-map met de kern-Playwright-scripts + README.
- **Let op:** GEEN nieuw global; volg het bestaande getter/setter-patroon.
  Tests moeten draaien vanaf schone checkout (documenteer de
  `three`/`playwright`-installatie in `tests/README.md`).

### Ticket 6 —6 eventgolf-framework
- **Context:** `startGolf()` en de wave-complete-branch van `updateGolf()`
  (zie waarschuwingen onderaan).
- **Doel:** `isEventGolf(golf)` (elke 5e), `kiesEventType` (nu altijd
  'mist'), `actieveEventGolf`-state met start-/afloophaakjes en eigen
  banner. Gewone golven gedragsidentiek.
- **Stappen:** helpers + state; banner-branch in `startGolf`; afloophaakje
  + reset in `updateGolf`-complete-branch en in `gameOver()`;
  debug-exports; tests op golf 4/5/6/10 + volledige cyclus.
- **Niet veranderen:** spawn-logica, heal/bonus-volgorde.

### Ticket 7 —7 Mistgolf-fog
- **Context:** er is exact één `scene.fog = new THREE.Fog(0x060a0e, 6, 24)`.
- **Doel:** tijdens 'mist'-event fog naar `{0x39443f, 2.5, 11}`, herstel
  in afloophaakje ÉN `gameOver()`; banner "MISTGOLF", eindmelding
  "De mist trekt weg".
- **Stappen:** `FOG_NORMAAL`/`FOG_MIST`-constanten; muteren via
  `scene.fog.color.setHex/.near/.far`; beide herstelpaden; fog-asserts
  vóór/tijdens/na + na gameOver; screenshot-leesbaarheidscheck.
- **Niet veranderen:** fog buiten mistgolven; renderer/licht-setup.

### Ticket 8 —8 Sluiper
- **Doel:** `ONDODE_TYPES.sluiper` (1.35 / 0.75 / 1.1, schaal 0.75,
  kleur 0x3c4a41, ogen 0xb8ffc8), NIET in de normale weging.
- **Stappen:** type-entry; gewicht 0 buiten mist (echte gating is T9);
  stats-assert + 200 samples buiten mist bevatten geen sluiper +
  screenshot in mist (ogen zichtbaar).
- **Niet veranderen:** `maakOndodeModel`-structuur (type-data volstaat),
  `ONDODE_TYPE_MIN_GOLF`.

### Ticket 9 —9 Mistgolf-spawngewichten
- **Doel:** tijdens `actieveEventGolf === 'mist'` retourneert
  `ondodeTypeGewichten()` uitsluitend `{ sluiper: 1 }`.
- **Stappen:** één early-return; 100-spawns-asserts op golf 5 (100%
  sluiper) en golf 6 (0% sluiper); bestaande variantentests groen.
- **Niet veranderen:** `golfSpawnStap`, barricade-gedrag.

### Ticket 13 —13 threat budget (VOORZICHTIG)
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

### Ticket 14 —14 HP-schaling
- **Doel:** `ondodeStartHP()` → trap 1/2/3/4 (golf 1–4 / 5–10 / 11–15 /
  16+, hard plafond 4); Sjouwer `min(round(basis×2.5), 8)`.
- **Stappen:** trapfunctie; oude constanten opruimen of mappen
  (debug-export bijwerken!); HP-tabel-assert golf 1–25; balans- en
  variantentests bijwerken.
- **Let op:** brander-explosie (3 schade) doodt een 4-HP-normaal niet
  meer — bedoeld, noteer het in de commitboodschap.

### Ticket 15 —15 spawn-cap
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

### Ticket 16 —16 power-ups: één drop-slot per golf
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

### Ticket 17 —17 Smederij-visuals
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

### Ticket 18 —18 zombies Z1: modulair model (VOORZICHTIG)
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

### Ticket 19 —19 zombies Z2: silhouetten + variatieprofielen
- **Context:** na Z1; `ONDODE_TYPES` heeft per type kleur/oogKleur/schaal;
  `kiesOndodeTraits()` loot cosmetische traits.
- **Doel:** per-type vorm-data (Loper dun/gebogen, Sjouwer breed/bochel,
  Brander buik + gloeiende kern-mesh, Sluiper klein/ingedoken) +
  `VARIATIE_PROFIELEN` (6–8) in de traits-loting.
- **Stappen:** vorm-data + toepassing in `maakOndodeModel`; profielen;
  raycast-sweep per type × 3 profielen; screenshotserie; regressie.
- **Niet veranderen:** stats, hitbox-contract (hoofd nooit kleiner dan de
  huidige sphere), directe `spawnOndode`-defaults.

### Ticket 20 —20 zombies Z3: ledematen-animatie
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

### Ticket 21 —21 zombies Z4: hitreacties
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

### Ticket 22 —22 zombies Z5: doodsanimaties
- **Context:** `doodOndode()` verwijdert nu direct; drie contracten in
  ontwerpbeslissing 17 (golf-einde telt `ondoden`, raycast raakt
  `ondodenGroep`, melee itereert `ondoden`).
- **Doel:** `stervenden`-lijst + eigen scene-Group + `updateStervenden(dt)`
  (val-stijlen, ±0.7 s); Brander blijft direct exploderen zonder lijk.
- **Stappen:** verhuizing in `doodOndode()`; gameLoop-haakje; de drie
  contracten elk expliciet headless testen (golf eindigt met lijken in
  beeld; raycast door een lijk; Kerninslag → 5 stervenden); regressie.
- **Niet veranderen:** drop-posities, geld, `ontploiBrander`.

### Ticket 23 —23 zombies Z6: wave-variatie-limiter
- **Context:** na Z2; profielen worden geloot in `kiesOndodeTraits()`.
- **Doel:** ringbuffer (4) voorkomt 3 (bijna) identieke profielen op rij
  in golf-spawns; directe `spawnOndode()`-aanroepen blijven erbuiten.
- **Stappen:** buffer + herloting (max 3 pogingen, dan accepteren);
  sampling-test (100 spawns); debug-export; regressie.
- **Niet veranderen:** typekeuze, budget, barricade-gedrag.

### Ticket 24 —24 map-lus M1: geometrie-schil (VOORZICHTIG)
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

### Ticket 25 —25 map-lus M2: deur 3
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

### Ticket 26 —26 map-lus M3: terugdeur (deur 4)
- **Context:** woonkamer-oostmuur is één `bouwMuur` op x = 4.65.
- **Doel:** koopbare terugdeur (€800) op z ∈ [−1, 1], kooppunt aan de
  bijkeuken-kant; ontgrendelt GEEN zone (pacing negeert deur 4);
  melding "De terugweg is open".
- **Stappen:** muur-splitsing; kooppatroon; probes op de naden;
  reachability A↔E in beide richtingen; regressie.
- **Niet veranderen:** A-vensters, ammo-kist, pacing.

### Ticket 27 —27 map-lus M4: zone-E-inhoud
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

### Ticket 28 —28 map-lus M5: navigatie-graaf (VOORZICHTIG)
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

### Ticket 29 —29 map-lus M6: balans + eindregressie
- **Doel:** pacing-asserts (4 zones == 3-zones-waarden), speeltest beide
  looprichtingen (golf 8+), teksten (startscherm/README), eventuele
  prijstuning ± 25%.
- **Stappen:** asserts; speeltest-notities; teksten; `tests/run-all.mjs`
  + scratchpad-suite + screenshots van de complete lus.
- **Niet veranderen:** mechanica.

### Ticket 30 —30 aanval A1: state-machine met wind-up (VOORZICHTIG)
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

### Ticket 31 —31 aanval A2: tells (pose, ogen, audio)
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

### Ticket 32 —32 feedback F1: effecten-pool + tracers + impacts (VOORZICHTIG)
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

### Ticket 33 —33 feedback F2: hitmarker + treffer-/herlaad-audio
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

### Ticket 34 —34 feedback F3: wapen-identiteit
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

### Ticket 35 —35 winkel W1: Smederij naar de bijkeuken
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

### Ticket 36 —36 winkel W2: stijl-register + iconen (VOORZICHTIG)
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

### Ticket 37 —37 winkel W3: status + winkelLicht + koop-flits
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

### Ticket 38 —38 sfeer S1: materiaal-families + impactkleuren
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

### Ticket 39 —39 sfeer S2: vijandleesbaarheid
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

### Ticket 40 —40 sfeer S3: omgevingsdetails
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

### Ticket 41 —41 integratie: eindregressie + performance-audit
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

### Ticket 42 —42 score, runStats en highscore
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

### Ticket 43 —43 moeilijkheidsgraden
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

### Ticket 44 —44 vluchtroute-onderdelen
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

### Ticket 45 —45 De Ontsnapping (VOORZICHTIG: schermen-guard)
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

### Ticket 46 —46 eventgolf Stroomuitval
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

### Tickets 47/48 — BACKLOG (niet uitvoeren zonder expliciete opdracht)
Op verzoek van de gebruiker uit de scope gehaald. Volledige tickets
staan (met Status: backlog) in ROADMAP.md onderaan de v0.17-sectie;
ontwerp staat nog in §6.6 (beslissingen 38-39). Pas oppakken als de
gebruiker dit expliciet weer vraagt.

### Ticket 49 —49 dreigingsaudio-laag
- **Context:** `initGeluid()`/`piep()` (~2730), gameLoop-takken. Spec:
  §6.7.
- **Doel:** twee nooit-herstartende oscillators + gainNode;
  `berekenDreigingsGain` (puur, plafond 0.05); ~0.25s-throttle in de
  spelActief-tak; pauze → 0.
- **Stappen:** oscillator-init; pure helper; throttle-sturing beide
  takken; debug-export; `tests/test-dreigingsaudio.mjs` (pure functie +
  getters); regressie.
- **Niet veranderen:** bestaande one-shots, `speelGolfStart`.

### Ticket 50 —50 zone-naambanners + HUD-zonelabel
- **Context:** zone-triggerplek (~4866-4872), `zoneVan()` (~3536),
  `toonGolfBanner`, HUD. Spec: §6.8.
- **Doel:** `ZONE_NAMEN` (indices exact zoneVan: 0-4), banner 1x per
  zone per run, HUD-label alleen geschreven bij zonewissel.
- **Stappen:** namen + Set + laatsteZone-cache; banner-aanroep;
  HUD-element; debug-export; `tests/test-zone-banners.mjs`; regressie.
- **Niet veranderen:** `gangBetreden`/`plaatsBetreden`-audio,
  banner-systeem zelf.

### Ticket 51 —51 integratie: pacing-audit + eindregressie + teksten
- **Doel:** `tests/test-lategame-pacing.mjs` (sim golf 12-24: budget,
  HP-trap, mix, max-actief, geldstroom vs sinks, + het
  10/14/18/22-ontsnappingsvensterpatroon uit T54); tuning uitsluitend
  ±25% van GOLF_BUDGET_GROEI / WAVE_BONUS_PER_GOLF /
  ONDODE_HP_TRAPPEN-drempels; README + startscherm bijwerken met alle
  features van deze ronde (moeilijkheden, vluchtroute, de gang-naar-
  de-gracht met boot, ontsnappingsritme, stroomuitval — GEEN Hagelketel,
  die is backlog); screenshotronde (winscherm, stroomuitval, vlonder
  met boot, vluchtroute-onderdelen op hun rustvlak, zone-banner);
  volledige suites.
- **Stappen:** pacing-test + meting; evt. tuning; teksten; screenshots;
  `run-all` + scratchpad-suite (uitzonderingen alleen na
  git-stash-verificatie documenteren); eindrapport.
- **Niet veranderen:** mechanica buiten de ±25%-tuning.

### Ticket 52 —52 Gang naar de Gracht: vlonder, water, boot, lantaarn
- **Context:** bijkeuken-oostmuur (`BIJKEUKEN_X_OOST`=12, "nepgevel"-
  comment), `GANG_*`-gangpatroon, `bouwLantaarn` (~993, lokaal gescoped
  — kopiëren), `GRENS` (ongewijzigd, ruim voldoende ruimte tot
  `PLAATS_X_OOST`−0.05≈20.45). Spec: §6.12-beslissing 43.
- **Doel:** nieuwe korte gang vanuit de bijkeuken naar een vlonder met
  watervlak, boot (nog puur decor) en een niet-flikkerende, niet-
  schaduwwerpende lantaarn (licht 23→24).
- **Stappen:** doorgang in de oostmuur; gang-geometrie (kopie van het
  GANG-patroon); vlonder + watervlak + boot-mesh + lantaarn-kopie;
  obstakel aan de vlonderrand; `isVrijePlek`-probes; lichtgrens-test
  bijwerken (in DIT ticket); debug-export; `tests/test-gracht-dock.mjs`;
  screenshots (gang + vlonder); regressie.
- **Niet veranderen:** GRENS, andere zones, bestaande bijkeuken-inhoud
  (Smederij/Provisiekast/druppel/kelderluik blijven ongemoeid).

### Ticket 53 —53 De Ontsnapping verhuist naar de vlonder (VOORZICHTIG)
- **Context:** `toonOntsnappingspuntIndienKlaar()` (§6.4-plek),
  `test-ontsnapping.mjs`'s kelderluik-positie-assertie. Spec:
  §6.13-beslissing 44.
- **Doel:** het interactiepunt van `kelderluikMesh.position` naar de
  T52-vlonder-/bootcoördinaten verplaatsen — verder niets.
- **Stappen:** positie-bron aanpassen; `test-ontsnapping.mjs`'s
  positie-assertie bijwerken (in DIT ticket); screenshot; regressie
  (alle bestaande win-flow-checks moeten ONGEWIJZIGD groen blijven).
- **Niet veranderen:** `ONTSNAPPING_PRIJS`, `toonWinScherm()`,
  `probeerOntsnapping()`, de 3/3-voorwaarde.

### Ticket 54 —54 Periodieke ontsnappingsvensters (ronde-gating)
- **Context:** `startGolf()`/`updateGolf()` (haakpunten, zelfde plek als
  T44's `toonVluchtOnderdelenIndienDrempel()`), `isEventGolf` als
  pure-functie-voorbeeld. Spec: §6.13-beslissing 45.
- **Doel:** `isOntsnappingsGolf(golf)` (start 10, elke 4 golven daarna);
  `updateOntsnappingsVenster()` voegt het interactiepunt toe/verwijdert
  het op de golf-grenzen, ALLEEN als ook 3/3 onderdelen binnen zijn;
  eenmalige golf-10-ontgrendel-melding; HUD-indicator (golven-tot-boot
  / "Boot ligt aan!").
- **Stappen:** constanten + pure helper (+ tabeltest); haak
  `updateOntsnappingsVenster()` aan `startGolf()`; venster-sluiting in
  `updateGolf()`'s wave-complete-tak; golf-10-melding; HUD-element;
  debug-export; `tests/test-ontsnapping-vensters.mjs`; bijgewerkte
  `test-ontsnapping.mjs` (simuleert nu ook een geldige
  ontsnappingsgolf); screenshot (beide HUD-standen); regressie.
- **Niet veranderen:** de bestaande 3/3-vluchtroute-voorwaarde (T45) —
  dit ticket VOEGT de golf-gate toe, vervangt niets. Nog GEEN
  aankondigingstimer/tell (dat is T55).

### Ticket 55 —55 Boot-aankomst: tell en opbouw
- **Context:** `updateOntsnappingsVenster()` (T54, breidt uit),
  `piep()`-patroon, lampflikker-patroon, T52's lantaarnlicht. Spec:
  §6.14-beslissing 46.
- **Doel:** een aankondigingsfase (`ONTSNAPPING_AANKONDIGING_DUUR`,
  4-6s) vóór het interactiepunt verschijnt: boothoorn-geluid, banner
  ("Er nadert iets…"), kort feller lantaarnlicht; symmetrisch
  vertrek-signaal bij het sluiten van het venster.
- **Stappen:** aankondigingstimer in `updateOntsnappingsVenster()`;
  `speelBootHoorn()`; lantaarn-lichtpuls; vertrek-signaal; debug-export
  (timer-getters); tests uitbreiden in `test-ontsnapping-vensters.mjs`
  (timer via `waitForTimeout` + draaiende gameLoop, klok-vs-dt-les);
  regressie.
- **Niet veranderen:** T54's golf-gating-logica zelf (alleen de timing
  van wanneer het interactiepunt precies verschijnt, binnen een al open
  venster).

### Ticket 56 —56 Vluchtroute-onderdelen fysiek prominenter
- **Context:** `bouwRoeispaanMesh()`/`bouwTouwbundelMesh()`/
  `bouwScheepslantaarnMesh()` (§6.4-blok), `VLUCHT_ONDERDELEN`,
  `raapVluchtOnderdeelOp()` (haal NIET aan). Spec: §6.15-beslissing 47.
- **Doel:** elk onderdeel op een klein rustvlak (krat/plank/vensterbank
  passend bij de zone) i.p.v. zwevend; iets prominentere schaal +
  subtiele permanente puls/glans (tot het opgeraapt is); item + rustvlak
  verdwijnen samen bij het oprapen.
- **Stappen:** voeg
  per bouw-functie een rustvlak-mesh toe als KIND van dezelfde
  `THREE.Group` die de functie teruggeeft (dus `g.add(rustvlak)` vóór
  `return g`, niet een los `wereld.add()` ernaast) — zo hoeft
  `raapVluchtOnderdeelOp()` niet aangepast: de bestaande
  `wereld.remove(onderdeel.mesh)` neemt het rustvlak automatisch mee;
  schaal/glans-aanpassing; evt. puls-regel in de spelActief-gameLoop-
  tak; `test-vluchtroute.mjs` uitbreiden (mesh-samenstelling/positie +
  een check dat het rustvlak een kind van `onderdeel.mesh` is, dus
  vóór/ná-oprapen-vergelijking); screenshots (alle drie de locaties,
  vóór én na oprapen); regressie.
- **Niet veranderen:** de golf-drempels, HUD-teller-logica, de
  interactiepunt-structuur van T44, `raapVluchtOnderdeelOp()` zelf
  (die blijft ongewijzigd werken dankzij de group-structuur).

### Ticket 57 —57 Zwevende barricadeplanken elders: audit
- **Context:** `bouwBarricade()` (`basisY`, al aanwezig sinds de
  binnenplaats-fix), `VENSTERS`/`VENSTERS_KAMER2`/`VENSTERS_BIJKEUKEN`.
  Spec: §6.16-beslissing 48.
- **Doel:** dezelfde zwevende-planken-fout als de binnenplaats
  (`VENSTERS_PLAATS`) opsporen en oplossen bij de resterende
  gebarricadeerde vensters — met screenshots onderbouwde
  gebruikersfeedback (golf 6, Vluchtroute 1/3).
- **Stappen:** reproduceer de HUD-staat uit de screenshots; controleer
  visueel ELK venster in `VENSTERS`, `VENSTERS_KAMER2` en
  `VENSTERS_BIJKEUKEN` (niet alleen de twee al vooronderzochte
  verdachten — de woonkamer/atelier-kozijnhoogte-mismatch en de
  kozijnloze steegdeur, zie §6.16); pas per gevonden mismatch `basisY`
  aan (of voeg een kozijn-mesh toe als een ontbrekend referentiepunt de
  oorzaak is); nieuw testbestand met een positie-check per venster;
  screenshotronde van ALLE gebarricadeerde vensters; regressie
  (inclusief de al gefixte binnenplaats-vensters, die mogen niet
  terugveranderen).
- **Niet veranderen:** `BARRICADE_MAX_PLANKEN`, de plank-geometrie
  zelf, `repareerBarricade()`/`golfSpawnStap()`'s barricade-contract —
  dit ticket is uitsluitend positionering.

### Extra waarschuwingen ronde 4 (v0.17)

21. **Exacte-tellingschecks verhuizen mee met hun ticket.**
    `test-ontsnapping.mjs`'s kelderluik-positie-assertie wordt ALLEEN in
    T53 bijgewerkt; de lichttelling (≤ 23) wordt ALLEEN in T52
    bijgewerkt (≤ 24, via T52's lantaarn — niet via een wapen). T44/T45
    houden de interactiepunten-telling op 12 dankzij het dynamische
    punten-patroon (beslissing 35); T54 hergebruikt datzelfde patroon
    voor het boot-punt, dus ook daar geen laadtijd-toevoeging.
22. **De schermen-guard (~2065) is één handler voor drie overlays.**
    Volgorde-regel: gameOver- en winscherm winnen van het startscherm;
    nooit twee overlays tegelijk. Elke wijziging draait de bestaande
    pauze- en gameover-tests mee. T52-56 raken deze guard NIET aan (T53
    is een pure positie-wijziging, geen scherm-logica).
23. **localStorage altijd via de guard-helpers.** Directe
    `localStorage.x`-toegang buiten `leesHighscore`/`schrijfHighscore`
    is verboden; de weiger-flow (mock) is een verplichte testcase.
24. **Mist en stroomuitval delen kanalen** (ogen, gewichten, budget-
    factor). Elke stroomuitval-wijziging draait de mist-checks uit
    `test-vijand-leesbaarheid.mjs`/`test-eventgolven.mjs` mee; het
    windup-randgeval (T39-patroon) geldt voor beide events.
25. **Drone-oscillators nooit stoppen of herstarten** — alleen
    gain-sturing; start/stop klikt hoorbaar en een dubbele start stapelt
    oscillators. Pauze dempt via doelgain 0, niet via stop.
26. **Klok-vs-dt (drie keer geleerd in ronde 3, opnieuw relevant voor
    T55's aankondigingstimer):** alles wat op de module-`klok` of echte
    timers draait test je met `waitForTimeout` + de draaiende gameLoop
    (simuleerPointerLock), nooit met handmatige synchrone ticks;
    DOM/audio-doelwaarden lees je in dezelfde `evaluate()`-snapshot als
    hun invoer.
27. **T52's nieuwe pocket-ruimte blijft binnen de bestaande GRENS** —
    geen GRENS-wijziging nodig (geverifieerd: de vrije pocket tussen
    `BIJKEUKEN_X_OOST`=12 en `GRENS.maxX`≈20.45 is leeg, ver van de
    binnenplaats die rond `DEUR2_Z`≈−15.5 ligt). Toch altijd
    `isVrijePlek`-probes + screenshot vóór/na, zelfde discipline als
    elk eerder map-lus-ticket — een aanname op basis van constanten is
    geen vervanging voor een echte in-game check.
28. **T54 (mechaniek) en T55 (tell) nooit combineren** — exact dezelfde
    les als T30/T31: bouw en test eerst de golf-gating/interactiepunt-
    logica volledig, dan pas de aankondigingstimer/het geluid eromheen.
29. **T53 raakt ALLEEN de positie.** Niet de verleiding voelen om
    tegelijk ook T54's golf-gating of T55's tell erbij te pakken "omdat
    je toch al in die functie zit" — drie aparte, aparte-diff-tickets,
    zelfde discipline als de rest van dit project.
30. **T56's rustvlak moet IN de group, niet ernaast.** De hele
    "item + rustvlak verdwijnen samen"-eis hangt af van precies dat ene
    detail (`g.add(rustvlak)` binnen dezelfde `bouw*Mesh()`-functie) —
    een los `wereld.add()` ernaast lijkt in eerste instantie hetzelfde
    resultaat te geven (allebei zichtbaar), maar laat na het oprapen
    een wees-object achter. Test dit expliciet (vóór/ná-oprapen-check),
    niet alleen "ziet er goed uit vóór het oprapen".
31. **T57 is een audit, geen 1-op-1-kopie van de binnenplaats-fix.**
    De twee vooronderzochte verdachten (§6.16) zijn een startpunt, geen
    garantie dat daar de hele fout zit — controleer ECHT elk
    overgebleven venster met een screenshot, inclusief de al gefixte
    binnenplaats-vensters (regressie: die mogen niet per ongeluk
    terugveranderen als `bouwBarricade()` wordt aangeraakt).

---

## Sonnet-prompts per ticket — ronde 5 (v0.19)

Zelfde werkwijze als ronde 1-4: één ticket per keer, eerst dit plan +
het ticket in ROADMAP.md (sectie v0.19) + de relevante §7-secties van
ARCHITECTURE_NOTES.md lezen, minimale wijziging, load-check + het
testplan van het ticket, nooit committen zonder expliciete opdracht.

### Ticket 58 —58 PALET-systeem voor consistente art direction
- **Context:** `MATERIAAL_FAMILIES`/`matFamilie()` (~559-575) als
  bestaand stijlvoorbeeld; gevel-/straatdecor-aanroepen
  (`bouwAchterGevel()` e.a.). Spec: §7.4.1-beslissing 50.
- **Doel:** nieuw `PALET`-object met een klein aantal benoemde
  kleurgroepen; de aangewezen gevel-/straat-call-sites gebruiken
  `PALET.*` i.p.v. eigen hex-literals.
- **Stappen:** `PALET`-object nabij `MATERIAAL_FAMILIES`; call-sites
  één voor één omzetten; debug-export; screenshotvergelijking vóór/na;
  regressie.
- **Niet veranderen:** kleuren buiten de aangewezen call-sites;
  materiaal-families zelf.

### Ticket 59 —59 Procedurele texturen voor materiaaldiepte
- **Context:** `matFamilie()`/`MATERIAAL_FAMILIES` (~559-575),
  `matFamilieCache`. Spec: §7.3 (regel-interpretatie) + §7.4.2-
  beslissing 51.
- **Doel:** kleine set runtime-getekende `THREE.CanvasTexture`s
  (steen/hout/metaal), gecachet, gekoppeld via een nieuw `map`-veld
  aan de betrokken `MATERIAAL_FAMILIES`-varianten.
- **Stappen:** `bouwCanvasTexture()`-helper + eigen cache; `map`
  toevoegen aan de aangewezen families; screenshotronde van
  representatieve oppervlakken; regressie.
- **Niet veranderen:** materiaal-mutatiediscipline (per-familie
  gedeeld, nooit per-instantie); geometrie-UV's.

### Ticket 60 —60 Post-processing-pipeline (EffectComposer)
- **Context:** render-loop (`renderer.render(scene, camera)`),
  `onresize`-handler, `<script type="importmap">`. Spec: §7.3 + §7.4.3-
  beslissing 52.
- **Doel:** `EffectComposer` (RenderPass + max één subtiele extra
  pass) via Three.js' eigen `examples/jsm/postprocessing/*`-submodules
  op dezelfde CDN-host als de kern-`three.module.js`.
- **Stappen:** EERST verifiëren dat de CDN de submodule voor de
  gebruikte Three.js-versie serveert (blokkeer het ticket en meld
  terug als dat niet lukt — niet improviseren); importmap-entry;
  composer-opzet; resize-koppeling; `schaduw === 1`-check; regressie +
  perf-test.
- **Niet veranderen:** shadow-lichttelling; bestaande materiaal-
  instellingen.

### Ticket 61 —61 Vloeiendere silhouetten (VOORZICHTIG)
- **Context:** ondode-modelopbouw (Z1-modulaire structuur, Tickets
  18-22), wapenmodel-opbouw, hoofd-hoogte-anker (beslissing 16). Spec:
  §7.4.4-beslissing 53.
- **Doel:** zachtere overgangen/segmenten op zichtbare randen, puur
  cosmetisch, zonder head-anchor- of hitbox-transforms te raken.
- **Stappen:** modelopbouw-functies aanpassen; hitbox-regressietest
  vóór/na; head-anchor-regressietest; screenshotronde per ondode-type;
  regressie. Los van elk ander ticket uitvoeren.
- **Niet veranderen:** hitbox-mesh-schalen, head-group-Y-positie,
  animatie-systeem.

### Ticket 62 —62 Kelder: geometrie, trap en Y-beweging (VOORZICHTIG)
- **Context:** `speler.positie` (~2348), `GRENS` (~659),
  `registreerRechthoek`/`losBotsingenOp`/`isVrijePlek` (2D-botsing),
  `speler.hoogte`-toepassing bij het renderen. Spec: §7.5.1-
  beslissing 54.
- **Doel:** nieuwe, disjuncte kelder-footprint + trap-corridor waarin
  `speler.positie.y` lineair interpoleert tussen 0 en een vaste
  kelderdiepte, puur als functie van positie langs de trap-as; buiten
  die band blijft `positie.y` exact zoals nu.
- **Stappen:** kelder-/trapconstantes; Y-interpolatie in de
  trapband; camera-hoogtekoppeling; lokale kelder-grenscontrole
  (GEEN wijziging aan `GRENS` zelf); **Y-aanname-audit**: elke plek die
  `speler.positie` leest (schietrichting, botsingen, zone-lookup)
  narekenen op impliciete "Y is altijd 0"-aannames; nieuwe trap-/
  Y-bewegingstest; screenshotronde; volledige regressie. Niet
  combineren met T63.
- **Niet veranderen:** `registreerRechthoek`/`losBotsingenOp`/
  `isVrijePlek` zelf (blijven 2D); `GRENS`.

### Ticket 63 —63 Kelder als permanente veilige zone + inhoud
- **Context:** `ZONE_GRAAF` (~4072), spawn-vensterdefinities,
  `zoneVan()` (~4037). Spec: §7.5.2-beslissing 55, §7.5.3-
  beslissing 56.
- **Doel:** kelder NIET in `ZONE_GRAAF`, geen spawn-vensters, klein
  setje passend decor + optioneel één bestaand interactiepunt-type
  herplaatst.
- **Stappen:** decorfuncties; expliciet NIET toevoegen aan
  `ZONE_GRAAF`/spawn-registratie; `zoneVan()` mag kelder herkennen voor
  HUD/label alleen; nieuwe "kelder blijft leeg tijdens golven"-test
  (meerdere golven simuleren, tel = altijd 0); screenshotronde;
  volledige regressie (met name `test-gracht-dock.mjs`).
- **Niet veranderen:** `updateOndoden()`/`NAV_VOLGENDE`.

### Ticket 64 —64 Waypoint-navigatiegraaf: dataset + lookup
- **Context:** `ZONE_GRAAF` (~4072) als stijlvoorbeeld,
  `test-gracht-dock.mjs`-coördinaten voor de bekende chokepoints. Spec:
  §7.6.1-beslissing 57.
- **Doel:** nieuwe, hand-geplaatste waypoint-dataset per zone + een
  lookup-functie (dichtstbijzijnde bruikbare waypoint richting de
  speler). Puur additief — nog GEEN koppeling aan `updateOndoden()`.
- **Stappen:** waypoint-dataset (dekt in elk geval de gang-naar-de-
  gracht-zone); lookup-functie (simpele array-/object-indexering, geen
  per-frame graaf-traversal); nieuw testbestand met lookup-checks;
  bevestig dat de volledige bestaande regressie ONGEWIJZIGD blijft
  (geen gedragskoppeling in dit ticket).
- **Niet veranderen:** `updateOndoden()` zelf; `ZONE_GRAAF`/
  `NAV_VOLGENDE`.

### Ticket 65 —65 Waypoint-integratie: ad-hoc code vervangen (VOORZICHTIG)
- **Context:** `updateOndoden()` (~4204-4228),
  `GRACHTGANG_DREMPEL`/`eigenInGracht`/`spelerInGracht`/`inZoneVier`,
  T64's waypointgraaf. Spec: §7.6.2-beslissing 58.
- **Doel:** `updateOndoden()` routeert via de T64-waypointgraaf; de
  oude ad-hoc special-case-code wordt VOLLEDIG verwijderd in dezelfde
  diff.
- **Stappen:** koppeling waypointgraaf → beweging; verwijder
  `GRACHTGANG_DREMPEL`/`eigenInGracht`/`spelerInGracht`/`inZoneVier`
  + hun debug-exports; volledige `test-gracht-dock.mjs`-regressie
  (dekt beide sessie-bugs); nieuwe trajectory-trace-tests voor
  minstens 2 andere zones met obstakels; volledige regressie.
- **Niet veranderen:** `ZONE_GRAAF`/cross-zone-routing zelf.

### Ticket 66 —66 Achtergrondmuziek
- **Context:** dreigingsaudio-drone (~3135-3172,
  `dreigingsGainNode`/`zetDreigingsGain()`, plafond 0.07) als exact
  sjabloon. Spec: §7.7.1-beslissing 59.
- **Doel:** tweede, permanente oscillator/gain-laag (eigen origineel
  motief), nooit gestopt/herstart, alleen via
  `gain.setTargetAtTime()` aangestuurd; eigen volumeplafond (bv. 0.05)
  apart van de drone.
- **Stappen:** oscillator-groep + gainNode, eenmalig aangemaakt bij
  eerste gebruikersinteractie; aansturingsfunctie gekoppeld aan
  golf-aankondiging/combat-state; debug-export (incl. een
  schrijf-teller zoals `dreigingsGainSchrijfTeller`); nieuw
  testbestand (gain-doelwaarden per spelfase + node-identiteitscheck);
  regressie.
- **Niet veranderen:** de bestaande dreigingsaudio-drone zelf; diens
  volumeplafond (0.07).

### Ticket 67 —67 Minimap
- **Context:** bestaande HUD-`<div>`'s (~390-410), zone-/
  muurconstantes voor omtreklijnen. Spec: §7.8.1-beslissing 60.
- **Doel:** klein, vast gepositioneerd 2D-`<canvas>` bovenop de HUD:
  speler-positie/-richting, statische zone-omtreklijnen, nabije
  ondoden als stippen.
- **Stappen:** `<canvas id="minimapUI">` (HTML, HUD-patroon);
  `tekenMinimap()`-functie vanuit de render-/update-loop (throttle
  indien nodig); kelder-laag toont alleen een simpel label/icoon, geen
  aparte sublaag-tekening; nieuwe render-/state-test; screenshotronde;
  perf-test; regressie.
- **Niet veranderen:** geen extra Three.js-camera/render-target; geen
  fog-of-war.

### Ticket 68 —68 Duidelijkere richtingsfeedback bij schade
- **Context:** `tracerPool`/`impactPool` (~2957-2959) als exact
  poolsjabloon, `raakOndode()`/speler-schadepad. Spec: §7.8.2-
  beslissing 61.
- **Doel:** kort, richtinggevoelig DOM-"wedge"-element aan de
  beeldrand, georiënteerd op de hoek kijkrichting/schaderichting, via
  een vast, klein aantal vooraf aangemaakte, hergebruikte
  pool-elementen.
- **Stappen:** DOM-wedge-pool (HTML/CSS + JS, poolgrootte vast);
  aanroep vanuit de schade-afhandeling (geen
  `document.createElement`/allocatie in de hot path); hoek-naar-
  positie-mapping; nieuw testbestand (hoek-checks + pool-hergebruik-
  check: DOM-node-aantal blijft constant na veel treffers); regressie.
- **Niet veranderen:** geen nieuwe canvas-laag; schade-berekening
  zelf.
---

### Extra waarschuwingen ronde 5 (v0.19)

32. **T60's CDN-afhankelijkheid is de grootste onzekere factor van deze
    ronde.** Verifieer EERST dat de gebruikte CDN-host de
    `examples/jsm/postprocessing/*`-submodules voor de actieve
    Three.js-versie daadwerkelijk serveert (via een expliciete
    importmap-testload), vóórdat er ook maar één regel
    `EffectComposer`-code geschreven wordt. Lukt dat niet: ticket
    blokkeren en terugmelden, niet uitwijken naar een ander CDN of een
    losse copy-paste van de module-broncode het bestand in — dat zou de
    "geen nieuwe dependency"-regel wél echt breken.
33. **T62 is de eerste plek in het hele project waar `positie.y`
    structureel gebruikt wordt.** Elke bestaande functie die met
    `speler.positie` rekent (schietrichting, `losBotsingenOp`,
    `isVrijePlek`, `zoneVan`, elke debug-export die de positie
    blootlegt) moet EXPLICIET nagelopen worden op een impliciete "Y is
    altijd 0"-aanname vóór T62 als afgerond geldt — dit is geen
    optionele opmerking maar een verplicht onderdeel van het ticket
    (zie ROADMAP.md T62, Randgevallen).
34. **De kelder (T62/T63) blijft BUITEN `ZONE_GRAAF` en krijgt GEEN
    spawn-vensters.** Dit is een architecturale keuze, geen gat dat
    "later" nog moet worden dichtgemaakt — een toekomstig ticket dat de
    kelder alsnog aan de AI-/spawn-systemen koppelt is een NIEUW
    ontwerpbesluit, geen bugfix op T62/T63.
35. **T65 verwijdert oude code in DEZELFDE diff als de nieuwe code.**
    `GRACHTGANG_DREMPEL`/`eigenInGracht`/`spelerInGracht`/
    `inZoneVier` mogen na T65 niet meer bestaan — exact hetzelfde
    principe als T30 (MELEE_*-constanten), T32 (vonk/bloedvonk) en T36
    (interactieMarkering) in eerdere rondes. Draai vóór het ticket als
    afgerond geldt de VOLLEDIGE `test-gracht-dock.mjs`-suite (die dekt
    letterlijk de twee bugs die deze sessie in dit exacte codegebied
    zijn gefixt).
36. **T61 (silhouetten) raakt nooit de hoofd-hoogte-anker (beslissing
    16) of een hitbox-mesh-schaal.** Verplichte hitbox-regressietest
    vóór/na, los van elk ander ticket uitgevoerd — derde keer dat dit
    exacte contract relevant is (na T18 en T30), zelfde discipline.
37. **T66's muziekgain en de bestaande dreigingsaudio-drone hebben
    APARTE volumeplafonds** (bv. 0.05 vs. het bestaande 0.07) — en
    dezelfde "nooit stoppen/herstarten, alleen gain-sturing"-regel als
    beslissing 25 (ronde 4, warning 25) geldt onverkort ook voor de
    nieuwe muziek-oscillator(en).
38. **T68's DOM-wedge-pool volgt het `tracerPool`/`impactPool`-patroon
    letterlijk:** vaste poolgrootte, vooraf aangemaakt, geen
    `document.createElement` in `raakOndode()`/de schade-hot-path. Test
    expliciet dat het DOM-node-aantal na veel treffers constant blijft
    (zelfde "pool groeit niet stiekem"-discipline als T32 destijds).
39. **T67 (minimap) en T68 (richtingsfeedback) raken verschillende
    codegebieden en kunnen in willekeurige volgorde, maar niet in
    dezelfde sessie/diff gecombineerd worden** — zelfde
    één-ticket-per-keer-discipline als de rest van het project, ook al
    is er geen harde technische afhankelijkheid tussen de twee.
40. **Alle nieuwe permanente audio-/canvas-/DOM-lagen uit deze ronde
    (T60's composer, T66's muziek, T67's minimap-canvas, T68's
    wedge-pool) moeten hun eigen resize-/pauze-gedrag correct afhandelen**
    — dezelfde pauze-gate (`document.pointerLockElement ===
    renderer.domElement`) die de bestaande game-loop bepaalt, geldt ook
    voor deze nieuwe lagen (geen doorlopende animatie/audio-opbouw
    tijdens pauze).

---

## Sonnet-prompts per ticket — ronde 6 (v0.20)

Zelfde werkwijze als ronde 1-5: één ticket per keer, eerst dit plan +
het ticket in ROADMAP.md (sectie v0.20) + de relevante §8-secties van
ARCHITECTURE_NOTES.md lezen, minimale wijziging, load-check + het
testplan van het ticket, nooit committen zonder expliciete opdracht.

**Afwijkend aan deze ronde:** v0.20 komt uit een code-audit, niet uit een
feature-wens. Bijna elk ticket heeft een **nulmeting** in
ARCHITECTURE_NOTES §8.11 — lees die vóór je begint en herhaal de meting
ná afloop. "Het lijkt te werken" is voor deze ronde geen acceptabel
bewijs; de getallen zijn het bewijs.

**Aanbevolen volgorde:** T77 → T69 → T70 → T71 → T72 → T73 → T74 →
T75 → T76 → T78 → T79. T77 gaat bewust vóór T69: de test moet eerst rood
staan op de huidige code.

### Ticket 77 —77 Resource- en levensduur-regressietests
- **Context:** `tests/helpers.mjs`, `tests/run-all.mjs`, nulmeting in
  §8.11. Spec: §8.8.1-beslissing 68.
- **Doel:** de ontbrekende testcategorie toevoegen: resourcegroei,
  DOM-groei, schrijffrequentie en gedrag over een lange run.
- **Stappen:** `frames(page, n)`-helper in `helpers.mjs` (echte
  `requestAnimationFrame`-ticks); nieuw `tests/test-resources.mjs` met
  (a) geometriegroei over 100 spawn/kill-cycli, (b) DOM-node-aantal na
  veel treffers, (c) DOM-schrijffrequentie bij regen/buff/prompt, (d)
  lange-run-simulatie van 25 golven met groei-assercties op `ondoden`/
  `stervenden`/`powerups`/`interactiePunten`.
- **Verplicht bewijs:** draai het script tegen de HUIDIGE code en laat
  zien dat (a) FAALT. Slaagt het meteen, dan meet je het verkeerde en
  moet je eerst de twee valkuilen uit §8.8.1 nalopen.
- **Niet veranderen:** geen enkele regel in `amsterdam-undead.html`
  (dit ticket is puur test); geen fps-assercties.

### Ticket 69 —69 Gedeelde geometrie-cache voor ondode-modellen (VOORZICHTIG)
- **Context:** `maakOndodeModel()` (STAP 6), `mat()`/`matFamilie()` als
  cache-sjabloon, `doodOndode()`. Spec: §8.3.1-beslissing 63.
- **Doel:** het bevestigde GPU-lek (+9 geometrieën per ondode, nooit
  vrijgegeven) dichten zonder hitbox of silhouet te veranderen.
- **Stappen:** `geoCache(sleutel, fabriek)` naast de bestaande caches;
  maatvariatie van geometrie-parameters naar `mesh.scale`; directe
  `new THREE.MeshStandardMaterial(...)`-aanroepen via `mat()` waar dat
  kan; `oogMateriaal` bewust UNIEK laten; per-variant eigen
  cache-sleutel.
- **Verplicht bewijs:** wereld-bounding-box van kop én romp vóór/ná
  identiek (≤ 1 mm) voor alle vijf types, plus T77's geheugentest van
  rood naar groen.
- **Niet veranderen:** aantal/indeling van lichaamsdelen; de
  effect-pools; `userData.lichaamsdeel`; geen `InstancedMesh`.

### Ticket 70 —70 Dispose-contract voor wegwerp-objecten
- **Context:** `ontploiBrander()`, `spawnPowerupDrop()`,
  `raapPowerupOp()`, `updatePowerups()`, `updateStervenden()`. Spec:
  §8.3.1/§8.3.2-beslissing 63.
- **Doel:** alle overige per-run aangemaakte objecten netjes vrijgeven.
- **Stappen:** `ruimGroepOp(object3D)`-helper die `traverse()`t en
  `geometry.dispose()` + `material.dispose()` doet; gedeelde
  cache-materialen expliciet overslaan via een markering bij aanmaak
  (`material.userData.gedeeld = true`); aanroepen vanuit de vier
  opruimplekken; de explosie-opruiming van `setTimeout` naar een timer
  in de cosmetische zone van de game-loop.
- **Niet veranderen:** `tracerPool`/`impactPool` (die mogen NOOIT
  disposed worden); `bouwCanvasTextuur()`-texturen (gedeeld, permanent).

### Ticket 71 —71 `updateHUD()` uit de per-frame hot path
- **Context:** `updateHUD()`, het UI-const-blok in STAP 3,
  `updateSpelerRegen()`, `updatePowerups()`. Spec:
  §8.4.1-beslissing 64.
- **Doel:** van 60 HUD-writes/s naar ≤ 2/s tijdens regeneratie.
- **Stappen:** de 9 `getElementById` één keer als const bovenaan
  (zelfde plek/patroon als `hudUI`/`vignet`/`ammoUI`); laatst
  geschreven weergavewaarden onthouden; write overslaan als niets
  wijzigde. Guard IN `updateHUD()`, niet bij de 28 aanroepers.
- **Let op:** vergelijk op `Math.round(hp)`, niet op de ruwe float —
  anders is er nul winst. HP-balkkleur (drempels 60%/30%) hoort bij de
  vergeleken staat. Buff-teller moet elke seconde nog updaten én één
  keer bij aflopen.
- **Niet veranderen:** HUD-inhoud/opmaak; de aanroepplekken zelf.

### Ticket 72 —72 Interactie-prompt en per-frame array-kopieën
- **Context:** `updateInteracties()`, `toonInteractiePrompt()`,
  `verbergInteractiePrompt()`, `updatePowerups()`, `ontploiBrander()`.
  Spec: §8.4.1-beslissing 64.
- **Doel:** nul DOM-writes per frame bij stilstand zonder
  interactiepunt; geen array-allocatie per frame.
- **Stappen:** prompt alleen schrijven bij gewijzigde zichtbaarheid óf
  tekst (vergelijk op de resulterende string — prijzen zijn dynamisch);
  `[...powerups]`/`[...ondoden]` vervangen door achterwaartse
  index-loops.
- **Let op:** `pointerlockchange` roept `verbergInteractiePrompt()`
  expliciet aan bij pauze — de nieuwe guard mag dat pad niet blokkeren.
  `ontploiBrander()` verwijdert tijdens de loop uit `ondoden`
  (kettingreactie): de index-loop moet daar aantoonbaar tegen kunnen.
- **Niet veranderen:** prompt-teksten; het interactiepunt-systeem.

### Ticket 73 —73 Ondoden kijken in hun looprichting
- **Context:** `updateOndoden()`, de `groep.rotation.y`-regel net ná
  `losBotsingenOp()`/`berekenKelderY()`. Spec: §8.5.1-beslissing 65.
- **Doel:** kijkrichting volgt de werkelijke looprichting, behalve
  tijdens `windup`.
- **Stappen:** `rotation.y` afleiden uit `richting` (incl. de
  ontwijk-blend) i.p.v. `rechtstreeks`; `windup`-tak ongemoeid laten;
  bij snelheid ≈ 0 de laatste geldige hoek behouden; eventueel een
  korte lerp tegen schokken bij een waypoint-wissel.
- **Verplicht bewijs:** de positiereeks over 60 ticks moet IDENTIEK
  zijn aan vóór het ticket — anders heb je stilletjes de pathing
  veranderd.
- **Testvalkuil:** zet in de test NIET `deurGekocht = true` rechtstreeks
  — dat herbouwt `NAV_VOLGENDE` niet en geeft een vals-negatief (0,0°
  verschil). Gebruik `koopDeur()`.
- **Niet veranderen:** `NAV_VOLGENDE`, `ZONE_WAYPOINTS`,
  `zoekWaypoint()`, de melee-`hoekVerschil`-check.

### Ticket 74 —74 Zichtbare faalmodi: CDN-laadfout en corrupte opslag
- **Context:** importmap/module-`<script>` in de head,
  `leesHighscore()`, `toonStartschermRecord()`. Spec:
  §8.6.1-beslissing 66.
- **Doel:** een begrijpelijk scherm in plaats van een zwart scherm bij
  CDN-uitval; geen `undefined` in beeld bij corrupte opslag.
- **Stappen:** klassiek (niet-module) scriptje vóór de module-import met
  een ~10 s-timer die controleert of `window.AmsterdamUndeadDebug`
  bestaat, plus `window.addEventListener('error')`; vormvalidatie in
  `leesHighscore()` (`typeof score === 'number'`, eindig, `golf`
  positief geheel) met `null` als fallback.
- **Let op:** expliciet asserteren dat de melding tijdens een NORMALE
  testrun nooit zichtbaar wordt. Een record zonder `moeilijkheid`-veld
  (oudere opslagversie) moet blijven werken.
- **Niet veranderen:** geen tweede CDN, geen retry, geen lokale
  Three.js-kopie in de repo (breekt de single-file/geen-assets-regel).

### Ticket 75 —75 Muisgevoeligheid instelbaar en persistent
- **Context:** `mousemove`-handler, startscherm-HTML/CSS,
  `leesHighscore()`/`schrijfHighscore()` als opslagsjabloon. Spec:
  §8.6.2-beslissing 67.
- **Doel:** één slider, huidige waarde als default, waarde overleeft
  herladen.
- **Stappen:** `MUIS_GEVOELIGHEID_BASIS`-constante; slider in het
  startscherm (zelfde overlay als moeilijkheidsknoppen/geluidsknop);
  opslag via het beschermde try/catch-patroon; bereik ~0,25×-3×,
  waarde klemmen bij inlezen.
- **Let op:** `stopPropagation()` op de slider — anders start/hervat een
  klik het spel, exact de bug die Fix 4 bij de geluidsknop opleverde.
  Een niet-geklemde corrupte waarde maakt de camera onbestuurbaar.
- **Niet veranderen:** geen aparte x/y-gevoeligheid, geen invert-Y, geen
  volwaardig instellingenscherm.

### Ticket 76 —76 Ontsnappingsvereiste volledig in beeld
- **Context:** `raapVluchtOnderdeelOp()`,
  `updateOntsnappingVensterHUD()`, het interactiepunt van De
  Ontsnapping. Spec: §8.7.1.
- **Doel:** de wincondition ontdekbaar maken.
- **Stappen:** vanaf het EERSTE opgeraapte onderdeel het volledige
  vereiste tonen (teller + geldbedrag + boot-cadans, één regel); bij een
  open venster met te weinig geld het ontbrekende bedrag in de prompt.
- **Let op:** vóór het eerste onderdeel niets tonen; na winnen +
  "Speel door" moet de regel verdwijnen; de regel valt onder T71's
  schrijf-alleen-bij-wijziging-regel.
- **Niet veranderen:** het vereiste zelf (bedrag, aantal onderdelen,
  venstercadans) — dit ticket verandert uitsluitend de communicatie.

### Ticket 78 —78 CI-workflow en snellere testsuite
- **Context:** `tests/run-all.mjs`, `tests/helpers.mjs`. Spec:
  §8.8.1-beslissing 68.
- **Doel:** de testdiscipline automatisch afdwingen; suite-duur omlaag
  vanaf de huidige ~3 minuten.
- **Stappen:** GitHub Actions-workflow die `node run-all.mjs` draait;
  één gedeelde browserinstantie met een verse page (en verse
  CDN-route) per script.
- **Let op:** CI heeft geen `/opt/pw-browsers/chromium` — workflow moet
  `npx playwright install chromium` doen en `helpers.mjs` moet met een
  ontbrekende `executablePath` overweg kunnen zonder het lokale pad te
  breken. De twee bekende wall-clock-flakes
  (`test-ontsnapping-vensters.mjs`, incidenteel
  `test-golf-variatielimiter.mjs`) documenteren of retryen — niet
  verbergen.
- **Niet veranderen:** geen ESLint/Prettier/TypeScript introduceren; de
  inhoud van de bestaande scripts.

### Ticket 79 —79 Zone-gebaseerde lichtculling (VOORZICHTIG, gated op profiling)
- **Context:** `lampLichten`, `buitenLichten`,
  `stroomGevoeligeDaklichten`, de lampflikker-loop. Spec:
  §8.10-beslissing 69.
- **Doel:** per-fragment shaderkosten verlagen door lichten van
  niet-actieve zones uit te schakelen.
- **Stap 0 (BLOKKEREND):** profileer op ECHTE hardware (Chrome
  DevTools Performance, met en zonder een deel van de lichten). Blijkt
  de winst verwaarloosbaar: ticket sluiten zonder wijziging en
  terugmelden. Begin niet aan de implementatie op basis van de
  theoretische analyse alleen.
- **Stappen (na stap 0):** lichten van nog-niet-ontgrendelde/ver-weg
  zones op `visible = false`, gestuurd door de bestaande
  `zoneVan()`/`deurNGekocht`-informatie.
- **Verplicht bewijs:** pixelmeting per zone (screenshot vanaf een vast
  standpunt, luminantie `0.2126r+0.7152g+0.0722b` over het onderste deel
  van het beeld) binnen ±3% van de huidige helderheid, in ZOWEL de
  normale als de Stroomuitval-stand.
- **Let op:** `intensity = 0` is GEEN culling (de uniform wordt nog
  steeds geëvalueerd). Zichtlijnen tussen zones kunnen een licht-pop
  geven. De Stroomuitval-`stroomFactor` mag niet doorbroken worden.
- **Niet veranderen:** het renderpad zelf (geen deferred/baked
  lighting); geen geometrie-merging in dit ticket.

---

### Extra waarschuwingen ronde 6 (v0.20)

41. **Deze ronde is meetgedreven, niet gevoelsgedreven.** Elk ticket met
    een nulmeting in §8.11 vereist dezelfde meting ná afloop, in het
    ticket gerapporteerd. "Voelt sneller" of "lijkt opgelost" telt niet
    als bewijs — juist bij resource-lekken en frame-budget is de
    waarneming onbetrouwbaar.
42. **T77 gaat vóór T69, en moet aantoonbaar ROOD staan op de huidige
    code.** Een geheugentest die meteen groen is, meet vrijwel zeker het
    verkeerde: zonder gerenderde frames tussen spawn en kill registreert
    Three.js de geometrie nooit bij de renderer, en frustum-culling doet
    hetzelfde. Beide valkuilen zijn in de audit daadwerkelijk opgelopen
    (twee foute metingen achter elkaar) — reken erop dat ze zich
    herhalen.
43. **T69 raakt hitboxen, ook al lijkt het puur een cache-wijziging.**
    De headshot-detectie hangt aan de werkelijke mesh-omvang, en GEEN
    ENKELE bestaande test asserteert op absolute hitbox-afmetingen. Een
    schaalfout verandert dus stilzwijgend de moeilijkheidsgraad zonder
    dat er iets rood wordt. De bounding-box-vergelijking vóór/ná is geen
    formaliteit maar de enige vangrail.
44. **Disposeer nooit een gedeeld cache-materiaal.** `mat()` en
    `matFamilie()` delen materialen over honderden meshes; één
    `dispose()` daarop maakt de halve kaart zwart. Markeer gedeelde
    materialen bij aanmaak en laat `ruimGroepOp()` daarop filteren —
    vertrouw niet op een heuristiek als "zit dit materiaal op meer dan
    één mesh".
45. **`intensity = 0` is geen lichtculling (T79).** De uniform wordt nog
    steeds per fragment geëvalueerd; alleen `visible = false` of uit de
    scene halen scheelt echt werk. Dit is een klassieke aanname die
    ogenschijnlijk werkt (het beeld wordt donkerder) maar nul
    performancewinst geeft.
46. **T79 raakt vier feedbackrondes aan getunede helderheid** (§7.5.5,
    §7.5.7-7.5.10). Verifieer met exact dezelfde pixelmeting-methode als
    daar beschreven, in beide standen (normaal én Stroomuitval). Doe dit
    ticket als laatste van de ronde, nooit als eerste.
47. **Framerate is in deze omgeving niet meetbaar.** Headless Chromium
    rendert via SwiftShader; de audit mat 159 ms mediaan per frame, wat
    niets zegt over echte hardware. Zet nooit een fps-assertie in de
    suite en trek nooit een performanceconclusie uit een headless
    frametijd — gebruik structurele tellers (meshes, lichten, draw
    calls, geometrieën) of profileer op een echt apparaat.
48. **De één-bestand-regel blijft staan.** Bij 7.887 regels is
    "splits dit op in modules" de meest voor de hand liggende
    architectuursuggestie — en hij valt buiten scope zolang CLAUDE.md
    de single-file-regel handhaaft. Verbeter binnen de beperking; stel
    het opsplitsen niet voor als bugfix.
49. **T71/T72 mogen de UI-inhoud niet veranderen.** Het zijn puur
    frame-budget-tickets. Verandert er iets aan wat de speler LEEST
    (andere tekst, andere volgorde, andere drempels), dan is de scope
    overschreden — dat hoort in T76.
50. **Elk ticket in deze ronde is los terugdraaibaar.** Er is geen
    ticket dat een ander ticket half achterlaat; combineer ze niet in
    één diff, ook niet de kleine (T71+T72 lijken samen te horen, maar
    hebben verschillende testbewijzen en verschillende rollbacks).

---

## Sonnet-prompts per ticket — ronde 7 (v0.21)

Zelfde werkwijze als ronde 1-6: één ticket per keer, eerst dit plan +
het ticket in ROADMAP.md (sectie v0.21) + de relevante §9-secties van
ARCHITECTURE_NOTES.md lezen, minimale wijziging, load-check + het
testplan van het ticket, nooit committen zonder expliciete opdracht.

**Afwijkend aan deze ronde:** v0.21 komt uit `IDEEEN.md` (een
vooruitblik), niet uit een audit of een bugmelding. Het gevolg is een
ronde die bijna volledig uit sfeer en wereld bestaat — en juist daarom
één harde regel heeft die boven alles gaat:

> **Geen enkel ticket in v0.21 mag een balansgetal wijzigen.**
> Verboden: `golfBudget()`, `GOLF_BUDGET_*`, `ONDODE_THREAT_KOSTEN`,
> `GOLF_MAX_ACTIEF`, `ONDODE_HP_TRAPPEN`, `AANVAL_PROFIELEN`, alle
> `*_PRIJS`-constanten, `GELD_PER_HIT`/`GELD_PER_KILL`,
> `POWERUP_DROP_KANS`, `SPELER_HP_MAX`, `schadePerTreffer`/
> `WAPEN_SCHADE_MAX`.

**Aanbevolen volgorde:** T80 → T84 → T81 → T82 → T83 → T86 → T85 → T87.
T80 eerst omdat T83 zijn pan-helper gebruikt. T84 en T81 daarna als
opwarmers (tekst en een geïsoleerd effect). T85 en T87 als laatste: die
raken respectievelijk de resource-discipline uit v0.20 en de Y-invariant.

### Ticket 80 —80 Richtinghoren: pan op wereldgeluiden
- **Context:** `piep()`, `speelOndodeGrom()` (+ aanroep in
  `updateOndoden()`), `speelPlankBreek()` (+ `beukBarricade()`),
  `berekenSchadeWedgeHoek()`, `berekenBootHoornPanVolume()`. Spec:
  §9.3-beslissing 70.
- **Doel:** geluid met een wereldpositie ook links/rechts hoorbaar maken.
- **Stappen:** trek één gedeelde `berekenRelatieveHoek(...)` +
  `hoekNaarPan(...)` en laat de twee bestaande aanroepers daarop leunen;
  geef `piep()` een optionele `pan`-parameter; geef de grom en de
  plankbreuk hun bronpositie mee.
- **Let op:** bij `pan === 0`/weggelaten mag er GEEN `StereoPannerNode`
  worden aangemaakt — de keten blijft dan exact `osc → gain →
  masterGainNode` (contract van `test-geluidsknop.mjs`). En: er zitten
  TWEE verschillende negaties in de bestaande code, om twee
  verschillende redenen (CSS rechtsom-positief vs. StereoPanner
  rechts = +1). Vat die niet samen.
- **Niet veranderen:** pan op speler-eigen geluiden (schot, herladen,
  wisselen), UI-geluiden of globale gebeurtenissen; de handmatige
  volume-op-afstand-aanpak.

### Ticket 81 —81 Zeldzame lampuitval
- **Context:** de lampflikker-loop in de gameLoop, `lampLichten`.
  Spec: §9.4.1-beslissing 71.
- **Doel:** eens in de zoveel golven knipt één lamp 0,3-0,5s uit.
- **Stappen:** een VIERDE, onafhankelijke factor per lamp naast de
  flikker-sinus, `lampDipFactor` en `stroomFactorVoorLamp`; na afloop
  herstellen naar exact 1.
- **Let op:** sluit de schaduwwerpende lamp (`(0, 2.58, 0)`) en de drie
  kelderlampen (`l.stroomVloer !== undefined`) uit — dat is geen
  cosmetiek maar de reden dat dit geen balanswijziging is. Blijft over:
  5 van de 9 entries. Een blackout tijdens een Stroomuitval mag
  `stroomFactor` niet terugzetten op 1.
- **Niet veranderen:** de bestaande drie factoren; de
  Stroomuitval-logica; de schaduwinstellingen.

### Ticket 82 —82 Het geluid van Amsterdam
- **Context:** `initGeluid()`, een nieuwe gethrottlede updatefunctie.
  Spec: §9.4.2-beslissing 72.
- **Doel:** een vijfde, permanente audiolaag (plafond 0,03) met zeldzame
  stadsgeluiden.
- **Stappen:** nieuwe gain-node onder `masterGainNode`; eigen
  gebeurtenis-timer los van de Nevelklok-cyclus; gain-writes
  gethrottled (patroon `MUZIEK_THROTTLE_INTERVAL`).
- **Let op:** het bed mag NOOIT een tell maskeren. De ondode-grom staat
  op 0,035-0,045 en is een gameplay-signaal (de Sluiper gromt niet —
  stilte is zijn tell). Plafond dus ónder het gromvolume, en blijf uit
  de gromband (120-340 Hz). Aansluiten op `masterGainNode`, nooit op
  `audio.destination`.
- **Niet veranderen:** de bestaande vier lagen; de Nevelklok-cyclus.

### Ticket 83 —83 De Waterschouw
- **Context:** nieuwe `schouwGroep` + updatefunctie naast
  `updateBootPositie()`, `tekenMinimap()`. Spec: §9.5.1-beslissing 73.
- **Doel:** een tweede boot die voorbijvaart en nooit stopt.
- **Stappen:** eigen groep, eigen update, eigen hoorn (via T80's
  pan-helper), eigen minimap-marker.
- **Let op:** de hoofdeis is ONVERWARBAARHEID met de ontsnappingsboot —
  andere hoorn dan 200→140 Hz/1,1s, een marker die GEEN `arc` is, en
  nooit een interactiepunt. De schouw mag `bootGroep` niet aanraken
  (`updateBootPositie()` schrijft die elke frame). En:
  `test-boot-aankondiging.mjs` asserteert nu "precies 1 boot-marker
  (arc)" — scherp die aan naar "de ONTSNAPPINGS-marker", verzwak of
  verwijder 'm niet.
- **Niet veranderen:** `bootGroep`, `updateBootPositie()`,
  `ontsnappingsPunt`, de ontsnappingsflow.

### Ticket 84 —84 Het pand krijgt een adres
- **Context:** startscherm, `toonWinScherm()`, één decor-object.
  Spec: §9.5.2-beslissing 74.
- **Doel:** een verzonnen grachtnaam + huisnummer op beide schermen en
  op een naambordje.
- **Let op:** IP-regel uit CLAUDE.md — de naam moet VERZONNEN zijn, geen
  bestaande Amsterdamse gracht met een echt huisnummer. Het naambordje
  mag geen collision toevoegen (`obstakels` blijft 52).
- **Niet veranderen:** `ZONE_NAMEN`/`ZONE_FLAVOUR`; gameplay van welke
  aard dan ook.

### Ticket 85 —85 Etalages: sporen van de run
- **Context:** `startGolf()`/wave-complete als trigger, bestaande
  decor-bouwfuncties, `mat()`/`matFamilie()`/`geoCache()`.
  Spec: §9.6-beslissing 75.
- **Doel:** decor dat meeverandert met wat er in de run gebeurd is.
- **Let op:** dit is precies het patroon dat T69/T70 net hebben
  opgeruimd. Materialen ALTIJD via `mat()`/`matFamilie()`, geometrie via
  `geoCache()` — nooit een directe `new THREE.MeshStandardMaterial()`
  per mijlpaal. Alleen op golfovergangen, nooit per frame. Geen
  collision (`obstakels` blijft 52). Voorkeur: materiaal WISSELEN op een
  bestaande mesh boven een mesh TOEVOEGEN, dan bewaakt `test-resources.mjs`
  dit ticket automatisch.
- **Niet veranderen:** `obstakels`; pathing; spawn-druk.

### Ticket 86 —86 Het stadsarchief
- **Context:** nieuw lees/schrijf-paar naar het model van
  `leesHighscore()`/`leesGevoeligheid()`, startscherm-UI.
  Spec: §9.7-beslissing 76.
- **Doel:** cosmetische ontgrendelingen over meerdere runs heen.
- **Let op:** UITSLUITEND cosmetisch. Raakt een ontgrendeling ook maar
  één spelregel, dan hoort hij niet in dit ticket. Vormvalidatie bij het
  lezen met een veilige default (patroon T74/T75); onbekende sleutels
  NEGEREN in plaats van als corrupt behandelen (anders wist een oudere
  versie de ontgrendelingen van een nieuwere); ontgrendelingen zijn
  additief en onomkeerbaar.
- **Niet veranderen:** de twee bestaande localStorage-sleutels; de
  arcade-start (het menu is optioneel, geen verplichte stap).

### Ticket 87 —87 De Vliering (VOORZICHTIG)
- **Context:** `berekenKelderY()` → `berekenVloerY()`, nieuwe geometrie,
  luik-interactiepunt, `tekenMinimap()`. Spec: §9.8-beslissing 77.
- **Doel:** verticaliteit zonder de Y-invariant te breken.
- **Stappen:** kies een footprint op x/z waar de begane grond NIET
  begaanbaar is (kelder-precedent), schrijf EERST de rastertest, bouw
  daarna pas de geometrie.
- **Let op:** `berekenKelderY(x, z)` is een pure functie van x/z, en
  vijf systemen leunen daarop (`updateSpeler`, `updateOndoden`,
  `losBotsingenOp`, `zoneVan`, `tekenMinimap`). De vliering mag die
  functie-eigenschap NIET breken — vandaar de disjuncte footprint. De
  rastertest is geen formaliteit maar de enige vangrail; het precedent
  staat in `test-kelder-trap.mjs` (15327 rasterpunten). Ondoden moeten
  gewoon op de vliering kunnen komen: een veilige plek waar ze niet
  komen, is een balanswijziging.
- **Niet veranderen:** `ZONE_GRAAF`/`NAV_VOLGENDE`; geen nieuwe zone-id;
  spawn-druk/`ZONE_MAX_ACTIEF_BONUS`. De vliering is ruimte, geen zone.

### Extra waarschuwingen ronde 7 (v0.21)

51. **Sfeer-tickets zijn balanswijzigingen in vermomming.** Dat is het
    faalpatroon van deze hele ronde. Een lamp die uitvalt op de
    verkeerde plek, een geluidslaag over een tell heen, een zolder waar
    ondoden niet komen — alle drie voelen als "sfeer" en zijn alle drie
    een moeilijkheidswijziging. Loop bij elk ticket expliciet de
    verboden-lijst uit §9.2 na vóór je klaar zegt.
52. **De schaduw-invariant blijft: precies één schaduwwerpend licht**
    (§7.9), gemeten op `(0, 2.58, 0)`. T81 mag die lamp niet uitzetten,
    T83/T87 mogen er geen tweede bij zetten. Controleer de telling ná
    elk ticket dat licht of geometrie raakt.
53. **Nieuwe audio moet ALTIJD op `masterGainNode`.** Fix 4's
    geluidsknop-contract is dat er precies één node op
    `audio.destination` hangt; `test-geluidsknop.mjs` asserteert dat op
    bronniveau. Dit geldt voor T82 én voor de nieuwe hoorn in T83.
54. **Voeg geen `StereoPannerNode` toe aan geluiden die geen bron in de
    ruimte hebben.** Een gepande UI-piep of een gepand golfstart-signaal
    is verwarrend, niet immersief. T80 noemt expliciet welke geluiden
    wél in aanmerking komen; breid die lijst niet uit "omdat het kan".
55. **T85 kan het lek uit T69/T70 opnieuw introduceren.** Decor dat
    tijdens een run wordt bijgemaakt is runtime-allocatie. Gaat dat niet
    via `mat()`/`matFamilie()`/`geoCache()`, dan lekt elke golfmijlpaal —
    exact de bug die beslissing 63 dichtte. `test-resources.mjs` is hier
    de bewaker; laat 'm meelopen.
56. **`obstakels` staat op 52 en hoort daar te blijven in deze ronde.**
    Alleen T87 mag dat aantal veranderen, en dan expliciet en getest.
    Een naambordje (T84), een schouwboot (T83) of dichtgetimmerd decor
    (T85) dat stiekem collision toevoegt, verandert pathing en dus
    balans.
57. **T87: schrijf de rastertest vóór de geometrie, niet erna.** Dit is
    hetzelfde patroon als waarschuwing 42 (T77 vóór T69): de test moet
    de footprint-eis afdwingen terwijl je 'm kiest, niet achteraf
    bevestigen wat je toevallig gebouwd hebt. Kies je de footprint
    eerst en test je later, dan is de kans groot dat je een overlap
    ontdekt als de geometrie er al staat.
58. **De ontsnappingsboot is een van de belangrijkste signalen in het
    spel.** T83 zet er een tweede boot naast. Elke visuele of auditieve
    gelijkenis kost een speler een run. Andere hoorn, andere marker,
    nooit een interactiepunt — en test die scheiding expliciet, niet
    "het ziet er anders uit".

---

## Sonnet-prompts per ticket — ronde 8 (v0.22, visuele architectuur)

Zelfde werkwijze als ronde 1-7: één ticket per keer, eerst dit plan +
de relevante §10-secties van ARCHITECTURE_NOTES.md + `VISUEEL.md` lezen,
minimale wijziging, load-check + het testplan van het ticket, nooit
committen zonder expliciete opdracht.

**Afwijkend aan deze ronde:** de tickets staan hier compleet (inclusief
acceptatiecriteria en testplan) in plaats van in ROADMAP.md. Deze ronde
komt uit `VISUEEL.md`, een technical-artist-analyse, en de eigenaar
heeft daaruit 23 richtingen goedgekeurd; daar komen 4
infrastructuurstappen, een toegankelijkheidsticket en een eindmeting
bij — samen 29 tickets.

**De zes invarianten van deze ronde (§10.2) — lees ze vóór élk ticket:**

> 1. **De helderheidsbasislijn uit T88** is de meetlat. Elk ticket dat
>    licht, materiaal of post-processing raakt, draait
>    `test-visuele-basislijn.mjs`. Buiten de band ⇒ niet af.
> 2. **Het lichtaantal blijft 28** (1 hemisfeer + 27 point), waarvan
>    **precies 1** schaduw werpt. Geen enkel ticket voegt een `Light` toe.
> 3. **Gameplay-leesbaarheid boven schoonheid.** Aanvallende ondode,
>    schotrichting en interactiepunt blijven altijd afleesbaar.
> 4. **Geen balansgetallen** — de verbodenlijst uit §9.2 blijft gelden.
> 5. **`obstakels` blijft 56.** Geen visuele toevoeging krijgt collision.
> 6. **Het T69/T70-resourcecontract blijft heel.** Materialen via
>    `mat()`/`matFamilie()`, geometrie via `geo()`/`geoCache`, opruimen
>    via `ruimGroepOp()`.

**Elk ticket levert een beeldverslag (beslissing 93).** Naast het
testresultaat hoort er per ticket minimaal één **voor**- en één
**na**-opname, vanaf het standpunt dat in dat ticket staat. Gebruik
`tests/maak-beeldverslag.mjs` (opgeleverd door T88): die neemt op vanuit
dezelfde **bevroren** opstelling als de basislijntest — flikker,
`lampDipFactor`, `mistUitfaseTimer` en `klok` vastgezet. Dat is niet
optioneel netjes maar noodzakelijk: zonder bevriezen verschillen twee
opnamen van een ongewijzigde scene al 11,2% (§10.4.1) en vergelijk je
ruis.

De opnamen horen **niet** in de repository (tientallen PNG's per ronde,
zonder historische waarde zodra het volgende ticket eroverheen bouwt) —
scratchpad of oplevering.

**Uitvoeringsvolgorde (vast, zie §10.15):**

```
Fase 0  T88
Fase 1  T89 → T90 → T91 → T92 → T93 → T94 → T95
Fase 2  T96 → T97 → T98
Fase 3  T99 → T100 → T101
Fase 4  T102 → T103 → T104 → T105
Fase 5  T106 → T107 → T108
Fase 6  T109 → T110
Fase 7  T111 → T112 → T113
Fase 8  T114
Fase 9  T115   (optioneel; vereist T92 en T96)
Fase 10 T116   (eindmeting + advies laag 3/4)
```

Harde afhankelijkheden: T88 vóór alles · T89 vóór T90/T110/T113 · T93
vóór T111/T112 · T96 vóór T97/T98 · T99 vóór T100 · T102 vóór T103 ·
T103 vóór T104 · T106 vóór T107 vóór T108 · T112 vóór T113.

---

### Fase 0 — Vangrail

### Ticket 88 —88 Visuele basislijn en helderheidsvangrail (EERST)
- **Context:** nieuw `tests/test-visuele-basislijn.mjs`, `tests/helpers.mjs`,
  `run-all.mjs`. Spec: §10.4-beslissing 79, nulmeting §10.17.
- **Doel:** een machinale meetlat waaraan elk volgend ticket in deze
  ronde getoetst wordt.
- **Stappen:** (1) per zone één vaste camerastand (positie +
  kijkrichting + vensterafmeting hardcoded, nooit afhankelijk van
  spelstaat); (2) **de tijdafhankelijke systemen bevriezen** (zie Let
  op); (3) `page.screenshot()` → gemiddelde en mediane pixelhelderheid +
  verdeling over een paar helderheidsbanden; (4) rendermetrics
  vastleggen via `info.render`/`info.memory` met `autoReset = false`;
  (5) de invarianten-tellingen uit §10.17 asserteren (28 lichten, 1
  schaduwwerper, 56 obstakels, 14 interactiepunten).
- **Acceptatie:** de test draait groen op de huidige build; elke
  vastgelegde waarde staat als constante bovenaan het bestand met een
  toegestane band eromheen; **de band is smal (orde 1-2%), niet 11%**;
  `run-all.mjs` pikt hem op. Daarnaast levert dit ticket
  `tests/maak-beeldverslag.mjs` op — hetzelfde bevroren mechanisme, maar
  dan opnamen wegschrijvend in plaats van metend (beslissing 93). Elk
  volgend ticket in de ronde leunt daarop.
- **Test:** zichzelf. Verifieer expliciet dat **tien** opeenvolgende
  metingen binnen de band vallen — twee is niet genoeg om de
  flikkercyclus te vangen.
- **Beeldverslag:** **levert zelf de gereedschapskist.** Naast de test ook `tests/maak-beeldverslag.mjs`: genummerde opnamen vanaf de vaste, bevroren standpunten. De set die dit ticket produceert is de **"voor"-referentie voor de hele ronde** — bewaar hem apart.
- **Let op — twee gemeten vallen (§10.4.1), allebei fataal als je ze
  mist:**
  1. **De flikker geeft 11,2% spreiding** over 90 frames (19,09-21,36,
     gemiddelde 20,28). Dat komt van de twee sinussen per lamp in
     `lampLichten` plus `lampDipFactor`. **Bevries vóór het meten:** de
     flikkerfase per lamp op een vaste waarde, `lampDipFactor` op 1,
     `mistUitfaseTimer` op 0, `klok` op een vaste waarde. Zonder dat is
     de band óf zo breed dat hij niets vangt, óf hij alarmeert vals.
  2. **Gebruik `page.screenshot()`, NIET `gl.readPixels()` of
     `canvas.toDataURL()`.** De renderer draait met
     `preserveDrawingBuffer: false`. Gemeten: `readPixels` buiten het
     rAF-venster ⇒ **0 (zwart)**; `toDataURL()` na rAF ⇒ **leeg**;
     `page.screenshot()` ⇒ werkt (luminantie 30,91). De twee
     kapotte routes zijn precies de routes waar je intuïtief naar
     grijpt, en ze leveren een test op die groen blijft terwijl hij
     niets bewaakt.

  Verder: pointer lock simuleren (bekende valkuil uit CLAUDE.md), en de
  camerastand mag niet van een gespawnde ondode of een gekochte deur
  afhangen.
- **Niet veranderen:** niets in `amsterdam-undead.html`. Dit ticket is
  test-only.

---

### Fase 1 — Directe winst

### Ticket 89 —89 Emissieve hiërarchie vastleggen
- **Context:** `bloomPass` (`UnrealBloomPass(256×256, 0.35, 0.4, 0.82)`),
  `glasMateriaal`, de lampbollen in `hangLamp()`/`bouwLantaarn()`,
  `kernMateriaal`, `OOG_INTENSITEIT_*`, `winkelMarkering()`/
  `flitsMarkering()`/`doofMarkering()`. Spec: §10.5-beslissing 80.
- **Doel:** de 64 emissieve meshes onder drie benoemde niveaus brengen
  (Accent ~0,4 / Bron ~1,2-1,6 / Signaal ~2,6-3,4) en de uitschieters
  corrigeren.
- **Stappen:** inventariseer élke emissieve waarde in het bestand; leg de
  drie niveaus als constanten vast; deel elk bestaand element in; corrigeer
  alleen wat er echt buiten valt.
- **Acceptatie:** drie benoemde constanten bestaan; elke emissieve
  call-site verwijst ernaar of heeft een expliciete comment waarom niet;
  `test-visuele-basislijn.mjs` blijft binnen de band.
- **Test:** basislijn + een nieuwe assertie dat ondode-ogen en actieve
  koopmarkeringen op het Signaal-niveau zitten.
- **Beeldverslag:** startkamer met beide hanglampen in beeld, plus de binnenplaats met één lantaarn. **Hoort identiek te zijn** — dit ticket verandert het beeld niet, alleen de onderliggende waarden. Zichtbaar verschil = uitschieter verkeerd gecorrigeerd.
- **Let op:** **de Signaal-laag is een gameplaylaag.** Ondode-ogen en
  actieve koopmarkeringen zitten daar omdat de speler ze moet kunnen
  vinden, niet omdat ze mooi zijn. Verlaag ze nooit. Dit ticket levert
  bewust **geen zichtbaar effect** op — het is een tabel waar T90, T110
  en T113 op leunen. Verzin er geen effect bij.
- **Niet veranderen:** de bloom-threshold zelf in dit ticket (dat is een
  aparte, gemeten beslissing); de oogtrap 1,4/2,6/3,4.

### Ticket 90 —90 De mondingsvlam wordt een lichtmoment
- **Context:** `vlamDrukspuit` + `vlamLichtDrukspuit`, het gelijknamige
  paar bij de Ratelaar, `schiet()`. Spec: §10.6-beslissing 81.
- **Doel:** elk schot verlicht één tot twee frames lang de kamer.
- **Stappen:** (1) `vlamLichtDrukspuit`-intensiteit van 1,1 naar de orde
  15-25 voor precies één tot twee frames; (2) vlamgeometrie van
  `SphereGeometry(0.035)` naar twee gekruiste quads met een
  canvas-getekende stervorm, per schot willekeurig geroteerd/geschaald;
  (3) optioneel een korte piek op de bloom-sterkte.
- **Acceptatie:** de flitsduur is korter dan het kortste vuurinterval van
  de Ratelaar; de piek schaalt **niet** met vuursnelheid; het
  lichtaantal blijft 28.
- **Test:** nieuwe `test-mondingsvlam.mjs` — assert de flitsduur, dat er
  bij aanhoudend vuur nooit twee flitsen stapelen, en dat `visible`
  netjes terugvalt. Plus basislijn.
- **Beeldverslag:** donkerste hoek van de startkamer, één frame tijdens een schot. Twee sets: Drukspuit én Ratelaar (de Ratelaar is waar de stroboscoop-fout zichtbaar wordt).
- **Let op:** bij de Ratelaar (automatisch vuur) wordt dit een
  **stroboscoop** als de duur of de piek niet begrensd is — en dat kost
  leesbaarheid op precies het moment dat de speler het meest moet zien.
  Zet er een minimum-interval en een bovengrens op. Dit is een bestaand
  licht dat harder aangaat, **geen nieuw licht**.
- **Niet veranderen:** `WAPEN_DRUKSPUIT`/`WAPEN_RATELAAR`-definities,
  vuursnelheid, schade, `terugslag`/`cameraKick`.

### Ticket 91 —91 Contactschaduwen
- **Context:** nieuwe helper naast `blok()`/`meubelBox()`; aanroepers
  `bouwTafel()`, `bouwLantaarn()`, de kist-/ton-bouwers;
  `bouwCanvasTextuur()`; `berekenVloerY()`. Spec: §10.7-beslissing 82.
- **Doel:** elk vrijstaand object krijgt een zachte donkere vlek op de
  vloer eronder.
- **Stappen:** één gedeelde radiale gradient-canvastextuur + één gedeelde
  `PlaneGeometry`; `MeshBasicMaterial({ transparent: true, depthWrite:
  false })`; schaal uit de bounding box; y net boven de vloer (patroon:
  de bestaande `lichtvlek` op y = 0,012).
- **Acceptatie:** textuur en geometrie zijn gedeeld (één instantie, in de
  cache); `obstakels` blijft 56; basislijn binnen de band.
- **Test:** `test-contactschaduw.mjs` — assert precies één gedeelde
  textuur en één gedeelde geometrie, geen collision-toevoeging, en dat
  elke schaduw-y overeenkomt met `berekenVloerY()` op die x/z. Plus
  `test-resources.mjs` en basislijn.
- **Beeldverslag:** atelier op ooghoogte met tafel, kisten en een lantaarnpaal in beeld; plus één laag standpunt vlak boven de vloer waar het contactvlak zichtbaar is.
- **Let op:** op de **kelder-ramp en de vlieringtrap** loopt de vloer —
  daar hoort geen contactschaduw (of hij moet de juiste y krijgen).
  Simpelste veilige regel: alleen op vlakke vloerdelen. Overlappende
  transparante quads kunnen z-fighten; houd ze op één vaste hoogte per
  vloerniveau.
- **Niet veranderen:** `obstakels`; `berekenVloerY()`/`berekenKelderY()`/
  `berekenVlieringY()`.

### Ticket 92 —92 De camera gaat leven
- **Context:** de cosmetische zone van de gameLoop waar `terugslag` en
  `cameraKick` wegvallen; `updateSpeler()` voor de snelheid;
  `berekenVloerY()` voor het landingsmoment. Spec: §10.9-beslissing 84.
- **Doel:** loopwiegen, landingsdip en lean bij strafen.
- **Stappen:** sinus op de camera-y gekoppeld aan **afgelegde afstand**;
  gedempte veer op de landing; `camera.rotation.z` die naar de zijwaartse
  invoer toe interpoleert; wapenmodel wiegt tegen.
- **Acceptatie:** amplitude in centimeters, lean onder 1°; bij stilstand
  is er **geen** wieging; een schot raakt exact hetzelfde als vóór dit
  ticket.
- **Test:** `test-camerabeweging.mjs` — assert dat de camera-y bij
  stilstand constant is, dat hij bij lopen binnen een band varieert, en
  (belangrijkst) dat de raycast-oorsprong van `schiet()` niet meebeweegt.
- **Beeldverslag:** een reeks van vijf opeenvolgende frames tijdens het lopen, plus één frame op het moment van de landingsdip na een sprong van de vliering. Een enkel stilstaand beeld toont dit ticket niet.
- **Let op:** **hang het wiegen aan de afgelegde afstand, niet aan de
  tijd** — anders wiegt het beeld ook als je stilstaat, en dat is
  achteraf lastig te herkennen. De camerabeweging staat volledig buiten
  `updateSpeler()`, `losBotsingenOp()` en `schiet()`. Misselijkheid is
  een reëel risico: klein houden.
- **Niet veranderen:** collision, `speler.hoogte`, muisgevoeligheid,
  de raycast-keten.

### Ticket 93 —93 Fogdiepte per zone
- **Context:** `FOG_NORMAAL`, `scene.fog`, `mistUitfaseTimer`/
  `mistUitfaseVan` als interpolatiesjabloon, `zoneVan()`. Spec:
  §10.13-beslissing 88.
- **Doel:** binnen blijft benauwd (6/24), buiten opent naar ~40 m.
- **Stappen:** twee fogprofielen (binnen/buiten), zacht geïnterpoleerd op
  een zonewissel met dezelfde soort overgang als de mist-uitfade.
- **Acceptatie:** de Mistgolf werkt onveranderd en stapelt netjes op het
  zoneprofiel in plaats van het te overschrijven; na een Mistgolf keert
  de fog terug naar het profiel van de **huidige** zone, niet naar
  `FOG_NORMAAL`.
- **Test:** `test-fogdiepte.mjs` — assert de profielen per zone, de
  zachte overgang, en expliciet het samenspel met `FOG_MIST` (start
  Mistgolf buiten, beëindig hem, controleer dat je op het buitenprofiel
  uitkomt). Plus `test-eventgolven`-regressie.
- **Beeldverslag:** binnenplaats kijkend naar de overkant (de fog moet opengaan) én startkamer kijkend door de gang naar het noorden (de fog moet dicht blijven). Het contrast tussen die twee ís het ticket.
- **Let op:** fog-afstand is een **gameplayparameter** — hij bepaalt op
  hoeveel meter je een ondode ziet aankomen. Buiten verder zien is
  vermoedelijk positief, maar benoem het als bijeffect en test het; laat
  het niet stilzwijgend gebeuren. Dit ticket is de **voorwaarde** voor
  T111/T112.
- **Niet veranderen:** `FOG_MIST`-waarden; `MIST_UITFADE_DUUR`;
  `camera.far`.

### Ticket 94 —94 Rijkere inslagen
- **Context:** `spawnImpact()`, `bouwEffectSlot()`, `pakEffectSlot()`,
  `IMPACT_MAX`, `MATERIAAL_KLEUREN`, `actieveEffecten`, en de
  `face.normal` die `schiet()` al uit de raycast krijgt.
- **Doel:** inslagen krijgen richting, langgerekte vonken en een korte
  rookpluim.
- **Stappen:** deeltjes krijgen een snelheidscomponent langs de
  inslagnormaal; langgerekte vorm voor snelle vonken (schaal langs de
  bewegingsrichting, zoals `spawnTracer()` al doet); tweede pool voor
  korte opzwellende rookquads.
- **Acceptatie:** alles vooraf gebouwd en gerecycled — **nul allocaties
  en nul `setTimeout` in `schiet()`/`raakOndode()`**; `IMPACT_MAX`
  verhoogd maar begrensd.
- **Test:** `test-resources.mjs` (geheugenlek) + een uitbreiding van het
  bestaande effect-testscript: assert dat het aantal effect-meshes na
  200 schoten constant blijft.
- **Beeldverslag:** close-up van een inslag op steen, op hout en op metaal — drie opnamen, want `MATERIAAL_KLEUREN` verschilt per familie.
- **Let op:** dit is de veiligste ticket van de ronde, met één
  aandachtspunt: `pakEffectSlot()` loopt **lineair** over
  `actieveEffecten` en dat is een hot path. Bij enkele tientallen slots
  verwaarloosbaar, bij honderden niet. Houd de pool klein.
- **Niet veranderen:** de pool-architectuur zelf; `TRACER_MAX`-gedrag;
  schade of raycast-logica.

### Ticket 95 —95 De kill als gebeurtenis
- **Context:** `raakOndode()` (kill-afhandeling), de bestaande
  impact-burst, de hitmarker-tiers en `HITMARKER_SAMENVAL_VENSTER`.
- **Doel:** een dodelijke treffer krijgt een korte emissieve flits plus
  een grotere deeltjesburst.
- **Stappen:** één frame de emissieve waarde van de ondode-materialen
  omhoog (die zijn **per instantie** aangemaakt, dus dat mag — in
  tegenstelling tot de gedeelde wereldmaterialen); grotere
  `spawnImpact()`-burst met `MATERIAAL_KLEUREN.vijand`/`vijandKop`.
- **Acceptatie:** bij meerdere gelijktijdige kills (Brander-explosie)
  stapelen de flitsen niet; het samenvalvenster werkt zoals bij de
  hitmarker.
- **Test:** uitbreiding van het bestaande kill-/hitmarker-testscript —
  assert de samenval bij 5 gelijktijdige kills.
- **Beeldverslag:** één frame op het moment van de dodelijke treffer, plus één frame bij vijf gelijktijdige kills (Brander-explosie) om te tonen dat de flitsen niet stapelen.
- **Let op:** raak **nooit** een gedeeld materiaal aan voor deze flits.
  De ondode-huidmaterialen zijn per instantie; `kernMateriaal` is
  **gedeeld** en mag niet gemuteerd worden (§7.9
  materiaal-mutatiediscipline).
- **Niet veranderen:** kill-logica, geld, score, `GELD_PER_KILL`.

---

### Fase 2 — De naverwerkingsketen

### Ticket 96 —96 Naverwerkingspass: filmkorrel en chromatische aberratie
- **Context:** de composer-opbouw (`RenderPass` → `bloomPass` →
  `OutputPass`). Nieuw: `ShaderPass` uit
  `three/addons/postprocessing/`. Spec: §10.8-beslissing 83.
- **Doel:** één eigen pass die het beeld "gefilmd" maakt — en die de
  drager wordt voor T97 en T98.
- **Stappen:** één `ShaderPass` met handgeschreven GLSL: hash-ruis op
  `gl_FragCoord` + `uTijd` voor de korrel, radiale UV-offset per
  kleurkanaal voor de aberratie. Plaatsing: **ná `bloomPass`, vóór
  `OutputPass`** (korrel mag niet mee-bloomen).
- **Acceptatie:** `composer.passes.length` gaat van 3 naar 4 en **blijft
  4** voor de rest van de ronde; de aberratie is nul in het beeldcentrum
  en begint pas voorbij ~60% van de straal; er is één schakelbare
  sterkte-uniform.
- **Test:** `test-naverwerking.mjs` — assert het aantal passes, de
  volgorde (bloom vóór deze pass, output erna), en dat de pass-uniforms
  bestaan. Plus basislijn (korrel verschuift de gemeten helderheid licht
  — dit is het eerste ticket dat de band mag opzoeken).
- **Beeldverslag:** een donkere hoek (daar is de korrel het best zichtbaar) én een beeld met een felle lantaarn aan de rand (daar de aberratie). Toon ook een fog-gradiënt: de banding hoort weg te zijn.
- **Let op:** `ShaderPass` komt uit **dezelfde addons-map** als de vier
  bestaande imports — dezelfde CDN-host, dezelfde versie, geen tweede
  afhankelijkheid (dus **geen** herhaling van waarschuwing 32). Gebruik
  níét de derde-partij-bibliotheek `postprocessing`. Korrel die je als
  korrel *ziet*, is te sterk. Aberratie in het centrum is
  misselijkmakend en kost richtprecisie.
- **Niet veranderen:** `bloomPass`-parameters; `OutputPass`;
  `toneMapping`/`toneMappingExposure`; de `.schadeWedge` (blijft DOM).

### Ticket 97 —97 Vignet in de composer
- **Context:** `#vignet` (CSS + de JS die zijn opacity per frame zet),
  `stroomFactor`, `EXPOSURE_STROOM_VLOER`, de T96-pass.
- **Doel:** het vignet ligt ín het beeld en reageert op HP en Stroomuitval.
- **Stappen:** radiale demping als extra term in de T96-pass; sterkte,
  kleur en radius als uniforms die de bestaande HP-/eventlogica zet; het
  DOM-element vervalt.
- **Acceptatie:** **geen** extra pass (`composer.passes.length` blijft
  4); een expliciete bovengrens op de sterkte staat als constante in de
  code; `.schadeWedge` blijft ongewijzigd in DOM.
- **Test:** uitbreiding `test-naverwerking.mjs` — assert dat het
  vignet-uniform meebeweegt met HP en met `stroomFactor`, en dat het
  DOM-element weg is. Plus het bestaande schadefeedback-testscript.
- **Beeldverslag:** hetzelfde standpunt bij volle HP en bij lage HP, plus één tijdens een Stroomuitval.
- **Let op:** het vignet maakt de beeldranden donkerder, en dáár
  verschijnen ondoden in het perifere zicht. Te sterk = verlies van
  leesbaarheid. De bovengrens is geen suggestie.
- **Niet veranderen:** `.schadeWedge` (moet scherp en direct blijven);
  de HP-logica zelf.

### Ticket 98 —98 Per-zone kleurgrading
- **Context:** `zoneVan()`, de T96-pass, `EXPOSURE_BASIS`/
  `EXPOSURE_STROOM_VLOER` als precedent voor globale beeldsturing.
- **Doel:** elke zone krijgt een eigen kleurtoon; de overgang is zacht.
- **Stappen:** lift/gamma/gain per zone als drie vectoren; interpolatie
  **in de pass** over minstens een halve seconde (`zoneVan()` is
  discreet, dus de blend hoort niet in de zonelogica).
- **Acceptatie:** **luminantie-neutraal** — de grading verschuift chroma,
  niet helderheid; `test-visuele-basislijn.mjs` blijft per zone binnen de
  band; geen extra pass.
- **Test:** uitbreiding basislijn — meet per zone zowel helderheid (moet
  binnen de band blijven) als een kleurindicator (moet meetbaar
  verschillen tussen kelder, atelier en buiten).
- **Beeldverslag:** één opname per zone, naast elkaar gezet. Het punt is het onderlinge kleurverschil, niet één beeld op zich.
- **Let op:** dit is het ticket dat het makkelijkst de kalibratie uit
  §7.5.5-7.5.10 sloopt. Luminantie-neutraal is de harde eis, niet een
  streven. Een harde overgang op de zonegrens is lelijk én verraadt de
  zonegrens aan de speler.
- **Niet veranderen:** helderheid per zone; `zoneVan()`; de
  Stroomuitval-exposurelogica.

---

### Fase 3 — De vijand

### Ticket 99 —99 Ondode-silhouet: handen, schouders, gerafelde vod
- **Context:** `maakOndodeModel()`, `geo()`/`geoCache`, `ONDODE_TYPES`,
  `VARIATIE_PROFIELEN`. Spec: §10.10-beslissing 85.
- **Doel:** een silhouet dat op tien meter in het donker als figuur leest.
- **Stappen:** drie tot vijf extra **gedeelde** vormen via `geo()`:
  schouderpartij, twee handen, en een vod-geometrie met gekartelde
  onderrand (in code gegenereerde `BufferGeometry`, geen `PlaneGeometry`).
- **Acceptatie:** alle nieuwe vormen zitten in `geoCache` met
  `userData.gedeeld = true`; `test-resources.mjs` blijft groen; de
  hoofdhoogte blijft binnen de ±0,03-band van `test-ondode-model.mjs`.
- **Test:** `test-ondode-model.mjs` uitbreiden — assert dat geen enkel
  nieuw deel `userData.lichaamsdeel === 'kop'` draagt, en dat het aantal
  gedeelde geometrieën per ondode constant is over 50 spawn/kill-cycli.
- **Beeldverslag:** één ondode op ~10 m in een donkere gang (silhouettest) én een close-up van hetzelfde model. Toon de drie types naast elkaar.
- **Let op:** **`userData.lichaamsdeel === 'kop'` staat uitsluitend op
  het hoofd-mesh en de twee ogen.** Een schouder die per ongeluk als kop
  telt, is een balanswijziging (headshots). Extra meshes schalen met
  `effectiefMaxActief()` (14, met zonebonus 18) — meet de draw calls.
- **Niet veranderen:** hitbox-markering; `ONDODE_TYPES`-kleuren;
  de armposities op x = ±0,24 (de arm-raycasts leunen daarop).

### Ticket 100 —100 Rimlight op de ondoden
- **Context:** `maakOndodeModel()` (waar per ondode al een
  `MeshStandardMaterial` wordt gemaakt), `kernMateriaal` (gedeeld —
  buiten de injectie houden), `OOG_INTENSITEIT_MIST`/`_STROOMUITVAL`.
  Spec: §10.10-beslissing 85.
- **Doel:** ondoden krijgen een koele lichtrand langs hun silhouetranden.
- **Stappen:** (1) **eerst een materiaalfabriek maken** —
  `maakOndodeMateriaal(huidKleur, ...)` die alle inline
  `new THREE.MeshStandardMaterial({ color: huidKleur, ... })`-constructies
  in `maakOndodeModel()` vervangt; (2) de fresnel-term
  (`pow(1.0 - dot(normal, viewDir), k)`) als extra emissieve bijdrage via
  `onBeforeCompile` in díé fabriek; (3) gedeelde uniform voor de sterkte,
  zodat hij mee kan bewegen met de eventgolven.
  **Stap 1 is niet optioneel:** waarschuwing 63 eist dat
  `onBeforeCompile` in de fabriek zit, en die fabriek bestáát niet —
  `maakOndodeModel()` maakt zijn materialen inline en per instantie.
- **Acceptatie:** **geen extra `Light`** (lichtaantal blijft 28); de
  rimkleur wijkt zichtbaar af van zowel warm lamplicht als koel
  maanlicht; `kernMateriaal` is ongemoeid.
- **Test:** `test-rimlight.mjs` — assert dat de injectie alleen op
  ondode-materialen zit (tel de gedeelde wereldmaterialen: die mogen
  géén rim-uniform hebben), en dat het lichtaantal 28 blijft.
- **Beeldverslag:** een ondode die uit een donkere gang komt, met de camera in het licht — dat is het geval waar rimlight voor bestaat. Plus dezelfde ondode vlak vóór een lichte muur (daar mag het effect juist níét overheersen).
- **Let op:** een echte rimlight-**lichtbron** zou 14-18 extra
  `PointLight`s betekenen bovenop 27 — onbetaalbaar (§10.3). Dit is
  shaderwerk. `onBeforeCompile` moet **in de materiaalfabriek**, nooit
  achteraf op een instantie (§7.9 materiaal-mutatiediscipline). Three.js'
  shader-chunknamen zijn **geen publieke API**: leg de gebruikte
  chunknaam en de versie vast in een comment. Te sterk = ondoden lijken
  te gloeien, wat de toon naar sci-fi duwt.
- **Niet veranderen:** `kernMateriaal`; de oogtrap; wereldmaterialen.

### Ticket 101 —101 Verval-shading op de huid
- **Context:** `geo()` (gedeelde vormen krijgen eenmalig een
  `color`-attribuut), `maakOndodeModel()`, `huidKleur`,
  `STADSARCHIEF_KLEURSET_TINT`.
- **Doel:** de huid ziet er rottend uit zonder één textuurpixel.
- **Stappen:** (1) holte-gebaseerde vertexkleur-gradient op de **gedeelde**
  `geo()`-vormen — kost per ondode letterlijk niets; (2) procedurele
  vlekkenruis in de shader met lage sterkte. Beide vermenigvuldigen met
  `huidKleur`.
- **Acceptatie:** de type-kleuren uit `ONDODE_TYPES` blijven onderling
  onderscheidbaar; `STADSARCHIEF_KLEURSET_TINT` (T86) werkt onveranderd.
- **Test:** uitbreiding `test-ondode-model.mjs` + `test-stadsarchief.mjs`
  — assert dat de kleurset-ontgrendeling nog steeds een meetbaar
  kleurverschil geeft, en dat twee verschillende types nog steeds
  meetbaar in tint verschillen.
- **Beeldverslag:** close-up van drie verschillende `ONDODE_TYPES` naast elkaar, zodat zichtbaar is dat de type-kleuren nog steeds te onderscheiden zijn.
- **Let op:** de type-kleuren zijn een **gameplaysignaal** (Brander vs.
  Loper). De vervalkleur mag daarom in **waarde** variëren, niet in
  **tint**. Dit is de grens tussen sfeer en balans.
- **Niet veranderen:** `ONDODE_TYPES`-basiskleuren; de
  `tint`-formule; `STADSARCHIEF_KLEURSET_TINT`.

---

### Fase 4 — Ruimtelijke diepte

### Ticket 102 —102 Subdivisie-helper voor grote vlakken (fundament)
- **Context:** `bouwMuur()`, `blok()`, de vloer-/plafond-
  `PlaneGeometry`-blokken (startkamer, atelier, kelder, kelderoost,
  vliering). Spec: §10.7-beslissing 82.
- **Doel:** grote vlakken krijgen genoeg vertices voor een vloeiende
  occlusie-gradient in T103.
- **Stappen:** één gedeelde helper die muur-/vloer-/plafondvlakken met
  bijvoorbeeld 8×8 segmenten opbouwt; alleen toepassen op de **grote**
  vlakken, niet op decor.
- **Acceptatie:** driehoekstal per frame blijft onder ~60k; draw calls
  **ongewijzigd** (subdivisie voegt geen meshes toe); basislijn binnen
  de band (dit ticket mag het beeld niet veranderen).
- **Test:** `test-visuele-basislijn.mjs` — het beeld moet **identiek**
  blijven binnen de band; plus een assertie op het driehoekstal.
- **Beeldverslag:** één opname per zone. **Deze horen pixel-identiek te zijn aan de voor-opname** — dit ticket mag het beeld niet veranderen. Zichtbaar verschil betekent verschoven naden of een fout in de subdivisie.
- **Let op:** dit ticket levert **geen zichtbaar effect** op. Als het
  beeld verandert, is er iets mis. Let op de naden: gesubdivideerde
  vlakken moeten exact op dezelfde wereldcoördinaten eindigen als
  daarvoor, anders ontstaan kieren tussen muur en vloer.
- **Niet veranderen:** wereldafmetingen; `obstakels`; `berekenVloerY()`.

### Ticket 103 —103 Ingebakken hoekocclusie (zwaartepunt van de ronde)
- **Context:** T102's helper, `obstakels` als bron, `mat()`/
  `matFamilie()` (`vertexColors`). Spec: §10.7-beslissing 82.
- **Doel:** hoeken, muurvoeten en plafondnaden lopen zacht donkerder —
  kamers krijgen een binnenkant.
- **Stappen:** per vertex bepalen hoe dicht die bij een andere
  geregistreerde rechthoek uit `obstakels` ligt; vertexkleur navenant
  dimmen; `vertexColors: true` op de betrokken materialen.
- **Acceptatie:** **nul extra rendertijd** (vertexattribuut, geen extra
  samples/passes/lichten); deurgaten smeren niet dicht; basislijn per
  zone binnen de band, of — als de band wordt overschreden — de nieuwe
  waarde expliciet bijgewerkt mét onderbouwing in ARCHITECTURE_NOTES §10.
- **Test:** `test-hoekocclusie.mjs` — assert dat vertices in een hoek
  donkerder zijn dan vertices midden op een vlak, dat vertices rond een
  deurgat **niet** gedimd zijn, en dat er geen nieuwe materialen zijn
  bijgekomen. Plus basislijn per zone en `test-resources.mjs`.
- **Beeldverslag:** de hoek van de startkamer, van het atelier en van de kelder, plus één deurgat van dichtbij. De deurgat-opname is de belangrijkste: die bewijst dat de opening niet dichtsmeert.
- **Let op:** **dit is het ticket dat de helderheidsbalans het hardst
  raakt.** §7.5.5-7.5.10 zijn vier feedbackrondes over precies deze
  kalibratie, en de kelder is al eens als "te donker" teruggekomen. Meet
  per zone, niet globaal.

  **`vertexColors` globaal aanzetten maakt het spel ZWART — doe dat
  niet.** Gemeten in r160 op een egaal belichte plane zonder
  color-attribuut: `vertexColors: false` ⇒ gemiddelde kanaalwaarde
  **244**, `vertexColors: true` ⇒ **0**. Een ongebonden vertex-attribuut
  levert `(0,0,0,1)` en dat vermenigvuldigt de basiskleur weg. Maak
  daarom een **aparte cache-tak** voor materialen met `vertexColors:
  true` — alleen voor de families die occlusie krijgen (steen, hout,
  tegel), dus de cache verdubbelt niet werkelijk. Die route faalt
  zichtbaar in plaats van stilzwijgend.

  **De bake moet een na-pass zijn.** `obstakels` wordt *tijdens* het
  bouwen gevuld — een muur die vroeg gebouwd wordt, kent de muur die er
  later naast komt niet. Verzamel tijdens het bouwen een lijst van
  vlakken die occlusie krijgen, en verwerk die in één keer ná het
  volledige geometrieblok. Let ook op de grenzen van de bron:
  `obstakels` is 2D (geen Y — plafondhoeken komen uit `KAMER_HOOGTE`/
  `ATELIER_HOOGTE`/`KELDER_HOOGTE`) en bevat geen decor
  (meubel-occlusie is T91, niet dit ticket).
- **Niet veranderen:** `obstakels`; basiskleuren; het cache-contract van
  `mat()`/`matFamilie()`.

### Ticket 104 —104 Variatie per instantie
- **Context:** `blok()`, `meubelBox()`, de `vertexColors`-infrastructuur
  uit T103. Spec: §10.12-beslissing 87.
- **Doel:** geen twee identieke bakstenen, kisten of planken.
- **Stappen:** een **deterministische** per-mesh tint (hash van de
  positie, geen `Math.random()`) als vertexkleur, vermenigvuldigend met
  de materiaalkleur. Bereik ±10%.
- **Acceptatie:** het aantal unieke materialen stijgt **niet** (dit is
  juist de manier om méér te delen); twee runs geven identieke tints.
- **Test:** `test-instantievariatie.mjs` — assert determinisme over twee
  page-loads, het tintbereik, en dat `materiaalCache`/`matFamilieCache`
  niet groeien. Plus basislijn.
- **Beeldverslag:** een muurvlak met meerdere blokken tegelijk in beeld, plus een rij identieke kisten. Zonder meerdere exemplaren in één beeld is variatie niet te zien.
- **Let op:** de ondode-modellen doen dit al met een **nieuw materiaal
  per instantie** — dat is precies wat hier vermeden moet worden. De
  meting laat 285 unieke materialen zien in een lege scene, veel meer
  dan de cache suggereert, omdat call-sites `extra` meegeven aan `mat()`
  (contract: niet-lege `extra` ⇒ altijd verse instantie). Niet-determinisme
  maakt `test-visuele-basislijn.mjs` instabiel.
- **Niet veranderen:** het cache-contract; `PALET`-waarden.

### Ticket 105 —105 Afgeschuinde randen
- **Context:** `blok()`, `meubelBox()`, `bouwTafel()`, `deurMesh`, de
  kisten/tonnen/werkbanken; `geo()` als cache-patroon. Spec:
  §10.12-beslissing 87.
- **Doel:** randen vangen een streepje licht; objecten ogen gemaakt.
- **Stappen:** een `blokAfgeschuind`-variant met 1-2 cm afschuining,
  gecachet op maat zoals `geo()` dat doet. Toepassen op tafels, kisten,
  deuren en werkbanken.
- **Acceptatie:** **niet** op `bouwMuur()` (muren hebben geen zichtbare
  vrije rand en het zou het driehoekstal verdrievoudigen); `obstakels`
  blijft rechthoekig en blijft 56; driehoekstal per frame binnen budget.
- **Test:** `test-afschuining.mjs` — assert dat gelijke maten dezelfde
  gecachete geometrie delen, dat muren ongewijzigd zijn, en het
  driehoekstal. Plus `test-resources.mjs`.
- **Beeldverslag:** close-up van een tafelhoek en een kistrand onder direct lamplicht — het lichtstreepje op de rand is het hele ticket.
- **Let op — TDZ-val:** "gecachet zoals `geo()` dat doet" betekent
  **niet** dat je `geo()` mag aanroepen. `geoCache` staat op regel 5500;
  `blok()` en `meubelBox()` draaien vanaf regel 833 tijdens module-load.
  Een aanroep crasht met een `ReferenceError` — exact de bugklasse die
  dit project al vier keer heeft geraakt (`PAND_ADRES`, `lampLichten`,
  `autoHerladerGekocht`, `DOORGANG_MARGE`). Declareer een **eigen**
  afschuiningscache **vóór regel 833**, naast `materiaalCache` en
  `canvasTextuurCache`, met een comment waarom hij daar staat
  (beslissing 90). Hetzelfde geldt voor T91 en T102.

  Verder: bij meer dan ~2 cm gaat de visuele geometrie merkbaar afwijken
  van `obstakels` en lijk je net naast een hoek vast te lopen.
- **Niet veranderen:** `obstakels`; muurgeometrie; wereldafmetingen.

---

### Fase 5 — Oppervlak

### Ticket 106 —106 Wereldschaal-UV's (fundament)
- **Context:** `bouwCanvasTextuur()` (`repeat.set(4, 4)`), `blok()`,
  `meubelBox()`, `bouwMuur()`, de vloer-/plafond-planes. Spec:
  §10.11-beslissing 86.
- **Doel:** een baksteen is overal even groot, ongeacht de maat van het
  vlak.
- **Stappen:** de `repeat` verhuist van de **gedeelde textuur** naar het
  `uv`-attribuut van de geometrie, per vlak geschaald naar de
  wereldafmetingen. Voor een `BoxGeometry`: zes vlakken, elk eigen schaal.
- **Acceptatie:** `repeat.set(4, 4)` staat niet langer op de gedeelde
  textuur; alle drie de bestaande texturen blijven gedeeld (cache
  intact); basislijn binnen de band.
- **Test:** `test-wereldschaal-uv.mjs` — assert dat twee vlakken van
  verschillende afmeting dezelfde UV-dichtheid per wereldmeter hebben, en
  dat `canvasTextuurCache` nog steeds 3 entries heeft.
- **Beeldverslag:** één opname per zone. **Horen identiek te zijn** (fundament-ticket, geen zichtbaar effect). Voeg één close-up toe van een groot én een klein vlak naast elkaar, om de UV-dichtheid te tonen.
- **Let op:** **dit ticket levert in isolatie bijna geen zichtbaar effect
  op** — een `roughnessMap` rond wit stretch je nauwelijks merkbaar. Het
  is fundament voor T107. Niet "verbeteren" door er alvast een `map` bij
  te doen; dat is T107. Triplanar is bewust **niet** de route (drie
  texture-samples per map per fragment op een fragment-bound scene).
- **Niet veranderen:** de tekenaars; de cache; basiskleuren.

### Ticket 107 —107 De procedurele texturenset
- **Context:** `CANVAS_TEXTUUR_TEKENAARS`, `bouwCanvasTextuur()`,
  `MATERIAAL_FAMILIES`, `matFamilie()`, `PALET`. Spec:
  §10.11-beslissing 86.
- **Doel:** baksteenverband, planken, pleister en klinkers in plaats van
  drie ruispatronen.
- **Stappen:** tekenaars op 512×512 die elk **drie** maps leveren:
  albedo (`map`), ruwheid (`roughnessMap`, bestaat al) en hoogte (bron
  voor T108). Het `textuur`-veld per familie wordt een object met drie
  verwijzingen. Kleuren uit `PALET`, niet uit nieuwe losse hex-waarden.
- **Acceptatie:** alle texturen blijven **gedeeld** en gecachet;
  laadtijdtoename gemeten en vastgelegd; basislijn per zone binnen de
  band (of expliciet bijgewerkt met onderbouwing).
- **Test:** `test-texturen.mjs` — assert het aantal gedeelde texturen,
  dat elke familie zijn drie maps heeft, en dat er geen textuur per
  instantie wordt aangemaakt. Meet de generatietijd en assert een
  bovengrens. Plus basislijn en `test-resources.mjs`.
- **Beeldverslag:** per materiaalfamilie twee opnamen: close-up (~1 m) en middenafstand (~4 m). De middenafstand is waar een te druk patroon zich verraadt.
- **Let op:** **stijl is hier het grootste risico, niet performance.**
  Fotorealistische baksteen op blokgeometrie ziet er *slechter* uit dan
  effen kleur — dan zie je pas echt dat het dozen zijn. Gestileerd
  houden, in lijn met het "geverfde maquette"-DNA. Tweede risico:
  512×512 met duizenden canvas-operaties × 8 tekenaars kan de laadtijd
  merkbaar verhogen; meet het en verspreid zo nodig over frames.
  §7.3 heeft de precedent-discussie al gevoerd — dit is de voortzetting
  daarvan, geen nieuwe uitzondering.
- **Niet veranderen:** basiskleuren van bestaande oppervlakken (de
  `map` mag patroon toevoegen, niet de gemiddelde kleur verschuiven);
  het cache-mechanisme.

### Ticket 108 —108 Normal maps uit dezelfde hoogtekaarten
- **Context:** `bouwCanvasTextuur()` (zustertje voor hoogte → normal),
  `matFamilie()`, `MATERIAAL_FAMILIES`. Spec: §10.11-beslissing 86.
- **Doel:** voegen en houtnerf vangen echt licht.
- **Stappen:** Sobel-achtige gradient over T107's hoogtekaart → RGB
  normal-canvas; als `normalMap` met een instelbare `normalScale`.
- **Acceptatie:** **lichte uitvoering als startpunt** — alleen baksteen
  en hout, lage `normalScale`, alleen grote vlakken. Draw calls
  ongewijzigd; fragment-kosten gemeten en vastgelegd.
- **Test:** `test-normalmap.mjs` — assert dat de normal-maps gedeeld
  zijn en uit dezelfde hoogtebron komen als T107. Plus basislijn en een
  expliciete rendermetriek-vergelijking vóór/ná.
- **Beeldverslag:** een muur onder scherende belichting (vlak naast een hanglamp) — daar vangen de voegen het licht. Frontaal belicht toont normal mapping vrijwel niets.
- **Let op:** **dit is de duurste per-fragment-richting van de ronde en
  hij schaalt met het aantal lichten** (27). Als de fillrate-aanname uit
  §10.3 klopt, is dit de eerste richting die op zwakke hardware
  teruggedraaid moet worden — bouw hem daarom achter één schakelbare
  constante. Zonder tangents valt Three.js terug op een afgeleide
  berekening, wat op grote vlakke planes artefacten kan geven.
  `normalScale` te hoog = reliëfbehang.
- **Niet veranderen:** T107's albedo/roughness; het lichtaantal.

---

### Fase 6 — Licht als vorm

### Ticket 109 —109 Raamprojecties op de vloer
- **Context:** de dakraam-blokken, de glas-/raamblokken rond
  `glasMateriaal`, het `lichtvlek`-patroon uit `bouwLantaarn()`,
  `PALET.raamWarmAmber`/`raamKoelBlauw`. Spec: §10.6-beslissing 81.
- **Doel:** licht neemt de vorm van zijn opening aan.
- **Stappen:** canvas-getekend kozijnpatroon als gedeelde textuur;
  geprojecteerd als quad op de vloer met additive blending en
  `depthWrite: false`; scheefheid statisch berekend uit de raampositie.
- **Acceptatie:** **geen** `SpotLight` en geen nieuw licht (invariant 2);
  alleen op **vlakke** vloerdelen — niet op de kelder-ramp of de
  vlieringtrap; `obstakels` blijft 56.
- **Test:** `test-raamprojectie.mjs` — assert het lichtaantal (28), dat
  elke projectiequad op een vlak vloerdeel ligt, en dat de textuur
  gedeeld is. Plus basislijn.
- **Beeldverslag:** de atelier-vloer onder het centrale dakraam, plus één gevelraam op de binnenplaats.
- **Let op:** de projectie is **statisch** en klopt dus niet meer zodra
  er iets tussen raam en vloer staat. In een donkere scene met fog is dat
  aanvaardbaar; noem het in een comment zodat het een bewuste cheat
  blijft en geen vergeten bug wordt. Three.js kan gobo's via
  `SpotLight.map` — dat is hier **verboden**, want het introduceert een
  nieuw lichttype.
- **Niet veranderen:** `glasMateriaal`; de dakraamlichten; het lichtaantal.

### Ticket 110 —110 Zichtbare lichtkegels (duurste ticket van de ronde)
- **Context:** `bouwLantaarn()`, de dakraam-blokken,
  `grachtLantaarnLicht`, `hangLamp()`, `buitenLichten`/`lampLichten`,
  `scene.fog`. Spec: §10.6-beslissing 81.
- **Doel:** je ziet het licht staan, niet alleen waar het op valt.
- **Stappen:** open `ConeGeometry` met een eigen `ShaderMaterial`:
  additive blending, `depthWrite: false`, opacity die naar de rand
  uitfadet via een fresnel-term en naar beneden via de lokale y; onderaan
  zacht oplossen.
- **Acceptatie:** **harde bovengrens op het aantal kegels** (start met
  zes: vier binnenplaats-lantaarns + de twee grootste dakramen); de
  kegel-opacity lift mee op `buitenLichten`/`lampLichten` (dimt tijdens
  Stroomuitval); de shader **respecteert de fog**; geen nieuw licht.
- **Test:** `test-lichtkegel.mjs` — assert het kegelaantal, dat de
  opacity meebeweegt met `stroomFactor`, en dat het lichtaantal 28
  blijft. Plus basislijn en een expliciete rendermetriek-vergelijking.
- **Beeldverslag:** onder een binnenplaats-lantaarn, licht omhoog kijkend; plus hetzelfde standpunt tijdens een Stroomuitval (de kegel moet meedimmen) en één met de camera ín de kegel (de overdraw-cliff).
- **Let op:** **dit is de duurste toegelaten richting.** Grote,
  overlappende, camera-nabije additieve transparantie is puur overdraw,
  en op `pixelRatio` 2 telt dat dubbel. Er is een reële performance-cliff
  als de speler met zijn neus in een kegel staat (fullscreen additive
  fragment). Bouw de **lichte** uitvoering (statische fresnel-fade, geen
  noise, geen animatie) en stop daar tenzij een meting ruimte laat zien.
  Een kegel die door de fog heen fel blijft, ziet er fout uit. Te sterk =
  mist-in-een-discotheek in plaats van nachtlucht.
- **Niet veranderen:** het lichtaantal; `FOG_NORMAAL`/`FOG_MIST`;
  de lampflikker-logica.

---

### Fase 7 — De wereld buiten

### Ticket 111 —111 Nachthemel
- **Context:** `scene.background` (`0x05080b`), `camera.far` (50),
  `FOG_NORMAAL`, T93's zoneprofiel. Spec: §10.13-beslissing 88.
- **Doel:** boven de binnenplaats hangt een echte nachthemel.
- **Stappen:** grote `SphereGeometry`, `side: BackSide`, `depthWrite:
  false`, **`fog: false`**, met een `ShaderMaterial`: verticale gradient,
  sterrenveld uit hash-ruis, traag scrollende wolkenlaag uit fractale
  ruis. De dome beweegt met de camera mee.
- **Acceptatie:** `fog: false` (anders wordt de hemel egaal grijs); de
  dome beweegt mee zodat er geen zichtbare parallax is bij het lopen;
  binnen is er niets van te zien.
- **Test:** `test-nachthemel.mjs` — assert `fog: false`, `BackSide`,
  dat de dome binnen `camera.far` past, en dat hij met de camera
  meebeweegt. Plus basislijn (binnenzones **moeten** onveranderd zijn).
- **Beeldverslag:** binnenplaats, recht omhoog kijkend. Plus één opname vanuit de startkamer om te bewijzen dat er binnen niets van te zien is.
- **Let op:** **donker en onopvallend houden.** Een sterrenhemel als in
  een openwereldspel trekt de aandacht weg van waar die hoort — meer "er
  is een boven" dan "kijk eens hoe mooi". Dit is een stijlbreukrisico,
  geen technisch risico. `camera.far` op 50 m maakt de dome relatief
  klein; zonder meebewegen is de parallax zichtbaar.
- **Niet veranderen:** `camera.far`; de fog-profielen uit T93;
  het lichtaantal.

### Ticket 112 —112 Skyline-silhouet
- **Context:** de binnenplaats-gevels (`PALET.gevelKoud`/`gevelWarm`),
  de gracht-zone, `blok()`, `camera.far`, T93's buitenprofiel. Spec:
  §10.13-beslissing 88.
- **Doel:** de binnenplaats wordt een binnenhof in een stad.
- **Stappen:** twee tot drie lagen platte, zwarte silhouetgeometrie op
  ~30/40/45 m, uit `blok()`-primitieven plus driehoeken voor
  geveltoppen, met aangepaste fogbehandeling. Optioneel trage parallax.
- **Acceptatie:** **IP-regel:** geen herkenbare bestaande Amsterdamse
  gebouwen (geen Westertoren, geen Munttoren) — generieke
  grachtenpand-silhouetten en verzonnen torens, dezelfde lijn als het
  verzonnen adres uit T84. Alles binnen `camera.far`. `obstakels` blijft
  56. Samengevoegd of geïnstantieerd, zodat het een handvol draw calls
  blijft.
- **Test:** `test-skyline.mjs` — assert het aantal draw calls dat de
  skyline toevoegt, dat er geen collision bijkomt, en dat de geometrie
  binnen `camera.far` valt. Plus basislijn.
- **Beeldverslag:** binnenplaats richting de horizon, op ooghoogte — het schaalgevoel is hier het beoordelingspunt.
- **Let op:** het echte risico is **schaal** — te dichtbij of te groot en
  de binnenplaats voelt kléiner in plaats van groter. Geometrie die niet
  wegdooft in een spel waarin alles wegdooft, kan opvallend fout lijken;
  stem de fogbehandeling zorgvuldig af. Zonder T93 is dit ticket
  zinloos: de fog op 24 m dooft alles uit.
- **Niet veranderen:** `obstakels`; `camera.far`; de zone-indeling.

### Ticket 113 —113 Verlichte raampjes in de verte
- **Context:** T112's silhouetlagen, de bestaande gevelraampjes,
  `PALET.raamWarmAmber`/`raamWarmZacht`, `buitenLichten`/`stroomFactor`,
  het **Accent**-niveau uit T89.
- **Doel:** er is nog iemand anders in deze stad — en tijdens een
  Stroomuitval gaan ze allemaal uit.
- **Stappen:** emissieve quads in de silhouetlagen op Accent-niveau;
  zeer trage willekeurige toestandswisseling (orde tientallen seconden);
  koppeling aan `stroomFactor`.
- **Acceptatie:** de raampjes zitten **onder** de bloom-threshold
  (Accent-niveau, T89) — een gloeiend raampje op 40 m concurreert met de
  Signaal-laag die de speler moet kunnen vinden.
- **Test:** uitbreiding `test-skyline.mjs` — assert het emissieniveau en
  de Stroomuitval-koppeling. Plus basislijn.
- **Beeldverslag:** de skyline normaal én tijdens een Stroomuitval (alle raampjes uit). Dat verschil is de reden dat dit ticket bestaat.
- **Let op:** dit ticket bestaat niet zonder T112 en is een klein detail.
  Bouw het niet groter dan het is.
- **Niet veranderen:** het bloom-niveau; T89's hiërarchie.

---

### Fase 8 — Water

### Ticket 114 —114 Levend water bij de gracht
- **Context:** `waterMesh`, `WATER_BREEDTE`, `grachtLantaarnLicht`,
  `bootGroep` + `updateBootPositie()`. Spec: §10.14-beslissing 89.
- **Doel:** de gracht deint en breekt het lantaarnlicht.
- **Stappen:** (1) `waterMesh` subdividen + vertex-shader met twee tot
  drie gekruiste sinussen; (2) procedurele normal-verstoring uit
  scrollende ruis zodat het specular van `grachtLantaarnLicht` in een
  trillende streep breekt; (3) optioneel de boot laten meedeinen.
- **Acceptatie:** **geen `Reflector`**, geen tweede scene-render, geen
  nieuwe addons-import; golven komen nooit boven de vlonderrand;
  `updateBootPositie()` blijft leidend voor de bootpositie (deining komt
  er bovenop, niet in plaats van).
- **Test:** `test-water.mjs` — assert dat de golfamplitude onder de
  vlonderrand blijft, dat `composer.passes.length` 4 blijft, en dat de
  bootpositie per frame nog steeds door `updateBootPositie()` bepaald
  wordt. Plus `test-gracht-dock.mjs` en `test-boot-aankondiging.mjs`.
- **Beeldverslag:** vanaf de vlonder over de gracht, met de lantaarnreflectie in beeld. Twee frames met ~1 s ertussen, zodat de beweging zichtbaar is.
- **Let op:** een echte spiegelreflectie via `three/addons/objects/Reflector`
  is een **nieuwe import én een tweede scene-render**, voor één vlak dat
  de speler alleen in zone 4 ziet, in het donker. Bewust afgewezen — de
  fake-variant (lantaarnstreep als verticaal uitgerekte gradient-quad die
  met de golfnormaal vervormt) kost een fractie. Het water ligt op
  y = −0,05 en de speler kan er niet in.
- **Niet veranderen:** `updateBootPositie()`; de ontsnappingsflow;
  `obstakels`.

---

### Fase 9 — Toegankelijkheid

### Ticket 115 —115 Visuele schakelaars in het instellingenmenu (optioneel)
- **Context:** het bestaande instellingenmenu waar `muisgevoeligheid`
  (T75) en de geluidsknop in staan; de schakelconstanten uit beslissing
  92. Spec: §10.16 (correctie na review).
- **Doel:** de speler kan camerawieg en filmkorrel uitzetten.
- **Stappen:** twee schakelaars die de bestaande constanten uit T92 en
  T96 op 0 zetten; persistent opslaan volgens hetzelfde patroon als
  `leesGevoeligheid()`/T75.
- **Acceptatie:** vormvalidatie bij het lezen met een veilige default
  (patroon T74/T75); onbekende sleutels negeren; standaard staan beide
  effecten **aan**.
- **Test:** `test-visuele-instellingen.mjs` — assert persistentie,
  corrupte-opslag-afhandeling en dat uitzetten het effect daadwerkelijk
  neutraliseert. Plus `test-instellingen`-regressie.
- **Beeldverslag:** voor beide schakelaars een paar aan/uit, vanaf een standpunt waar het effect duidelijk is (korrel: donkere hoek; camerawieg: reeks tijdens lopen).
- **Let op:** de camerawieg is de reden dat dit ticket bestaat en niet
  louter comfort — camerabeweging kan spelers fysiek onwel maken, en dan
  is een schakelaar toegankelijkheid. Voeg **geen** derde schakelaar toe
  "omdat het kan": de overige constanten uit beslissing 92 zijn
  ontwikkelaarsknoppen, geen spelerinstellingen.
- **Niet veranderen:** de bestaande instellingen; de opslagsleutels van
  T75/T86.

---

### Fase 10 — Eindmeting

### Ticket 116 — Eindmeting, speeltest en herbeoordeling van laag 3 en 4
- **Context:** de meetprocedure uit §10.14.2-beslissing 91, T88's
  basislijn en beeldverslag-script, de nulmeting in §10.17, en
  `VISUEEL.md` §3.2/§3.3 voor de niet-gebouwde richtingen. Spec:
  §10.14.5-beslissing 94.
- **Doel:** vaststellen wat er nu écht staat — visueel, qua speelgevoel
  en qua performance — en op basis daarvan adviseren welke richtingen
  uit laag 3 en laag 4 alsnog de moeite zijn.
- **Opleverproduct:** **een document, geen code.** Voorstel:
  `VISUEEL-EVALUATIE.md`, Nederlands, met de drie delen hieronder.

**Deel 1 — Performance-eindmeting.** Volg de procedure uit beslissing
91 op de eindtoestand:
  1. `python3 -m http.server 8000`, spel in Chrome, DevTools →
     Performance.
  2. Meet op elk vastgelegd standpunt, mét 14 ondoden actief, 10 s per
     opname.
  3. Noteer per standpunt de **mediane frametijd** en het **percentage
     frames boven 16,7 ms**.
  4. Meet ook de twee zwaarste momenten apart: een Mistgolf met volle
     golf, en de camera ín een lichtkegel (T110).
  5. Zet de rendermetrics uit T88 naast de nulmeting in §10.17: draw
     calls, driehoeken, materialen, geometrieën, texturen,
     shaderprogramma's, passes.
  6. Meet de laadtijd (T107's texturengeneratie) apart.

**Deel 2 — Speeltest.** Speel tot voorbij golf 10 en beoordeel
expliciet de vijf leesbaarheidsrisico's uit waarschuwing 72:
stroboscoop bij de Ratelaar (T90), aberratie in het richtpunt (T96),
vignet over het perifere zicht (T97), onderscheidbaarheid van
`ONDODE_TYPES` (T101), en kegels die het beeld vullen (T110). Noteer
elke hapering, elk moment waarop je iets niet kon aflezen, en elk
moment waarop het beeld mooier was dan bruikbaar.

**Deel 3 — Herbeoordeling van laag 3 en 4.** Loop de dertien
niet-gebouwde richtingen langs en geef per stuk een **oordeel met
onderbouwing uit deel 1 en 2**, niet uit de oorspronkelijke schatting:

| | Richting | Vraag die deel 1/2 nu kan beantwoorden |
| --- | --- | --- |
| Laag 3 | B6 — vuil en slijtage | Is er na T103/T107 nog visuele ruimte, of wordt het modderig? |
| | C3 — vertex-jitter | Voegt dit nog iets toe naast T103's occlusie? |
| | F1 — hoogtemist | Hoeveel fragment-marge is er nog na T110? |
| | F4 — stof per zone | Zijn T110's kegels er gekomen? Zo nee: overslaan. |
| | G3 — eventkleuren | Rijdt gratis mee op T98 — waarom dan niet? |
| | H3 — blijvende inslagen | Past +48 draw calls binnen de gemeten marge? |
| | E5 — dissolve bij de dood | Is T95 al genoeg als kill-feedback? |
| Laag 4 | A5 — gerichte `DirectionalLight` | Is de schaduw ná T103 nog steeds onzichtbaar? |
| | B5 — env map | Heeft T114's water dit nog nodig? |
| | D6 — tonemapping-curve | Is de kalibratie na T098/T103/T107 nog gezond? |
| | F3 — regen | Past dit binnen de gemeten buitenzone-marge? |
| | F5 — mistslierten | Wat kost een Mistgolf nu al (deel 1, stap 4)? |
| | G1 — kleurmigratie | Is de kleurtaal na T98 al samenhangend genoeg? |

  Sluit af met een **top 3** van richtingen die het meeste opleveren voor
  de minste kosten, en een expliciete lijst van wat je definitief laat
  vallen — met reden.

- **Acceptatie:** alle drie de delen aanwezig; elk oordeel in deel 3
  verwijst naar een getal of waarneming uit deel 1 of 2; er staat een
  expliciet ja/nee per richting, geen "zou kunnen".
- **Test:** `run-all.mjs` volledig groen als eindcontrole, plus
  `test-visuele-basislijn.mjs`.
- **Beeldverslag:** de volledige eindset vanaf alle vastgelegde
  standpunten, náást de "voor"-set die T88 aan het begin van de ronde
  heeft geproduceerd. Dat paar is het visuele eindverslag van de hele
  ronde en het beste materiaal om te beoordelen of drie maanden werk
  heeft opgeleverd wat het beloofde.
- **Let op:** dit ticket is grotendeels **handwerk** en dat is de
  bedoeling — deel 1 en 2 kunnen niet geautomatiseerd worden op
  SwiftShader (§8.11), en deel 3 is een oordeel. Plan er een echte
  sessie voor in. Het risico is dat dit ticket wordt overgeslagen omdat
  het laatste bouwticket al groen was; T79 laat zien wat er dan gebeurt.
  Verval **niet** in het alsnog bouwen van laag 3/4-richtingen binnen
  dit ticket: het levert een advies, en de eigenaar beslist.
- **Niet veranderen:** niets in `amsterdam-undead.html`. Dit ticket is
  meten, spelen en schrijven.

---

### Extra waarschuwingen ronde 8 (v0.22)

59. **Deze ronde heeft geen natuurlijke faalsignalen.** Een te licht
    beeld of een gezakte framerate meldt zichzelf niet, in tegenstelling
    tot een crash of een vastlopende ondode. T88's basislijn is daarom
    geen formaliteit maar de enige vangrail — draai hem na élk ticket dat
    licht, materiaal of post-processing raakt, niet alleen aan het eind.
60. **De scene is fragment-bound, niet draw-call-bound.** 280 draw calls
    en 18k driehoeken is ruim; 27 `PointLight`s die per verlicht fragment
    geëvalueerd worden, is dat niet. Geometrie toevoegen is goedkoop,
    per-fragment werk toevoegen is duur. Toets elke shader-wijziging aan
    deze regel vóór je hem bouwt (§10.3).
61. **Het lichtaantal blijft 28 en de schaduwwerper blijft er precies
    één.** Geen enkel ticket in deze ronde voegt een `THREE.Light` toe.
    De verleiding is het grootst bij T100 (rimlight per ondode zou
    14-18 lichten betekenen) en T110 (een echte spot per kegel).
    Controleer de telling ná elk ticket dat licht of geometrie raakt.
62. **`mat()` met niet-lege `extra` omzeilt de cache.** Dat contract
    verklaart waarom er 285 unieke materialen in een lege scene zitten.
    In deze ronde is dat dodelijk: T103 (`vertexColors`), T104 (tint) en
    T100 (`onBeforeCompile`) raken allemaal materialen die gedeeld
    hóren te zijn. Als het materiaalaantal na een ticket stijgt, is er
    een cache omzeild.
63. **`onBeforeCompile` hoort in de materiaalfabriek, nooit achteraf op
    een instantie.** Gedeelde materialen zijn immutabel (§7.9
    materiaal-mutatiediscipline). Eén achteraf gemuteerd gedeeld
    materiaal herschildert stilzwijgend elke gebruiker ervan.
64. **Three.js' shader-chunknamen zijn geen publieke API.** T100, T110,
    T111 en T114 injecteren of schrijven GLSL. Leg de gebruikte
    chunknaam en de Three.js-versie (r160) vast in een comment naast de
    injectie, zodat een versiewissel een vindbare faalplek heeft.
65. **`userData.lichaamsdeel === 'kop'` staat uitsluitend op het
    hoofd-mesh en de twee ogen.** T99 voegt schouders en handen toe. Een
    nieuw deel dat per ongeluk als kop telt, verandert de
    headshot-kans — een balanswijziging vermomd als silhouetverbetering.
66. **Extra meshes per ondode schalen met `effectiefMaxActief()`** (14,
    met zonebonus tot 18). T99's vijf extra delen betekent tot 90 extra
    draw calls in de piek. Dat past, maar meet het — dit is de grootste
    draw-call-toename van de ronde.
67. **Transparantie sorteert op afstand en `depthWrite: false` maakt dat
    zichtbaar.** T91 (contactschaduwen), T109 (raamprojecties), T110
    (kegels) en T113 (raampjes) voegen alle vier transparante geometrie
    toe bovenop de 80 die er al zijn. Overlappende quads op dezelfde
    hoogte flikkeren; houd één vaste hoogte per vloerniveau aan.
68. **`antialias: true` werkt niet meer zodra je via de composer
    rendert.** De anti-aliasing is dus al zwakker dan de constructor
    suggereert. Dat is geen bug die deze ronde oplost, maar het verklaart
    waarom T96's korrel relatief veel oplevert (hij maskeert
    trapjesranden en banding in gradiënten). Verwacht niet dat een extra
    pass de AA verslechtert — die was er al niet.
69. **T107 verhoogt de laadtijd.** Acht tekenaars op 512×512 met
    duizenden canvas-operaties elk is geen gratis opstart. Meet de
    generatietijd, leg een bovengrens vast, en verspreid zo nodig over
    frames. Een spel dat traag start, voelt kapot voordat het mooi is.
70. **De IP-regel geldt onverkort voor T112.** Geen herkenbare bestaande
    Amsterdamse gebouwen in het skyline-silhouet — dezelfde lijn als het
    verzonnen adres uit T84. Generiek en verzonnen.
71. **Drie tickets leveren bewust geen zichtbaar effect op:** T89
    (emissieve hiërarchie), T102 (subdivisie) en T106 (wereldschaal-UV's).
    Als het beeld ná zo'n ticket verandert, is er iets mis. Verzin er
    geen effect bij "omdat het ticket anders leeg voelt" — ze zijn
    fundament voor respectievelijk T90/T110/T113, T103 en T107.
72. **Gameplay-leesbaarheid is een acceptatie-eis, geen afweging.** Vijf
    tickets kunnen hem aantasten: T90 (stroboscoop bij automatisch vuur),
    T96 (aberratie in het richtpunt), T97 (vignet over het perifere
    zicht), T101 (type-kleuren die vervagen) en T110 (kegels die het
    beeld vullen). Elk van die vijf heeft de eis expliciet in zijn
    testplan staan. Vink hem af, schat hem niet in.
73. **De schaduw-wissel (A5) valt buiten deze ronde en is geen sluipende
    optie.** Eén gerichte `DirectionalLight` in plaats van de huidige
    cube-shadow is potentieel de grootste sprong die dit spel kan maken
    (§10.16), maar hij raakt een vastgelegde invariant en verdient een
    eigen ronde met een eigen GPU-meting. Geen enkel ticket hier mag er
    "alvast naartoe werken".

### Extra waarschuwingen ronde 8 — aanvulling na kritische review

Waarschuwingen 74-79 komen niet uit het ontwerp maar uit een review
achteraf, waarbij vier aannames uit dit plan zijn gemeten in plaats van
beredeneerd. Drie bleken onjuist. Volledige verantwoording:
ARCHITECTURE_NOTES.md §10.18.

74. **`vertexColors: true` zonder color-attribuut rendert ZWART, niet
    wit.** Gemeten in r160: `false` ⇒ 244, `true` zonder attribuut ⇒ 0.
    Een eerdere versie van dit plan beval bij T103 aan om de vlag
    globaal aan te zetten "want dat is neutraal". Dat was fout en had
    elk vlak zonder color-attribuut pikzwart gemaakt. Gebruik een
    aparte cache-tak. **Als een ticket in fase 4-5 het beeld ineens
    zwart maakt, is dit vrijwel zeker de oorzaak.**
75. **Meet nooit met `gl.readPixels()` of `canvas.toDataURL()`.** De
    renderer draait met `preserveDrawingBuffer: false`. Gemeten:
    `readPixels` buiten het rAF-venster ⇒ 0 (zwart), `toDataURL()` na
    rAF ⇒ leeg beeld, `page.screenshot()` ⇒ werkt. De twee kapotte
    routes zijn precies de routes waar je intuïtief naar grijpt, en ze
    leveren een test op die groen blijft terwijl hij niets bewaakt.
76. **De lampflikker geeft 11,2% spreiding in de gemeten helderheid.**
    Elke helderheidsmeting die de flikker, `lampDipFactor` en
    `mistUitfaseTimer` niet bevriest, meet ruis in plaats van het
    ticket. Dit geldt voor T88 én voor elke ad-hoc voor/na-meting die je
    onderweg doet.
77. **Elke nieuwe gedeelde cache hoort vóór regel 833.** `geoCache`
    (5500) is onbruikbaar voor wereldgeometrie, want `blok()` draait
    vanaf 833 tijdens module-load. Raakt T91, T102 en T105. Dit is de
    vijfde keer dat deze bugklasse in dit project opduikt — de vorige
    vier staan in beslissing 90.
78. **`obstakels` is geen volledige occlusiebron.** 2D, 56 entries, geen
    decor, en gevuld *tijdens* het bouwen. T103's bake moet een na-pass
    zijn over verzamelde vlakken, niet een berekening binnen
    `bouwMuur()`. Plafondhoeken komen uit de hoogte-constanten, niet uit
    `obstakels`.
79. **De performancepoort is handwerk en staat in de planning.**
    Beslissing 91 legt de procedure en de afbreekdrempel vast (>10% van
    de frames boven 16,7 ms, of mediane frametijd +15%). Zonder die
    handmatige meting zijn T108 en T110 op goed vertrouwen gebouwd — en
    T79 laat zien wat er gebeurt met een poort zonder procedure: die is
    nooit doorlopen. Plan de meetsessie in vóór je aan fase 5-6 begint.

---

## Sonnet-prompts per ticket — ronde 9 (v0.23, Zombie V2: renderarchitectuur)

**Deze hele ronde is gepland, nog niet uitgevoerd** (net als ronde 5 destijds):
elk ticket wacht op een aparte, expliciete opdracht. Niets hierin is al
gebouwd.

### Herkomst en grondslag

Deze ronde vertaalt een losse opdracht van de eigenaar
("Zombie V2 — Visual Overhaul + Performance-Safe Rendering Architecture",
~1700 regels) naar dit project se ticketformaat. Die opdracht stelt zelf
als hoofdregel **METEN > AANNEMEN** en verbiedt expliciet om
performancewinst, draw-call-aantallen of Three.js-gedrag te verzinnen.
Daarom is de architectuur hieronder niet overgetypt maar **gecontroleerd
tegen de actuele code** (na T116) vóór hij is opgeschreven:

- `maakOndodeModel()` (regel ~8414) bouwt per ondode een `THREE.Group`-
  hiërarchie van losse pivot-`Group`s (`beenL`, `beenR`, `romp`, `hoofd`,
  `armL`, `armR`) met tot **13 zichtbare meshes** (2 benen, torso, 2
  schouders, optioneel bochel, optioneel buik+kern, vod, hoofd, 2 ogen, 2
  armen, 2 handen) — de "~13 meshes"-aanname uit de opdracht klopt dus
  met de code, niet alleen met een vermoeden.
- Elk huid-onderdeel krijgt zijn **eigen** `MeshStandardMaterial`-instantie
  via `maakOndodeMateriaal()` (nooit gedeeld tussen onderdelen, wél nodig
  omdat elke ondode een eigen huidtint heeft) — dat is de daadwerkelijke
  bron van de hoge meshtelling: 13 meshes ⇒ tot 13 materialen ⇒ tot 13
  draw calls per ondode zónder shadow casting (`castShadow` staat nergens
  in `maakOndodeModel()` — ondoden werpen al geen schaduw; dat blijft zo).
  Met `effectiefMaxActief()` tot 18 is dat in de piek tot 234 zombie-draw-
  calls, bovenop de rest van de scene.
- `userData.lichaamsdeel === 'kop'` staat uitsluitend op `hoofd` en de
  twee oog-meshes (ontwerpbeslissing 16, T99); `schiet()` (regel ~7176)
  raycast met `raycaster.intersectObject(ondodenGroep, true)` en loopt bij
  een treffer omhoog tot `obj.userData.ondode` bestaat.
- `RIM_UNIFORMS` (T100) is een **gedeeld** uniform-paar — één schrijf
  verandert de rim op ALLE ondoden. `maakOndodeMateriaal()`'s
  `onBeforeCompile` injecteert in chunk `<emissivemap_fragment>`, three@0.160.0
  (gepind, chunknamen zijn geen publieke API — zelfde discipline als T100/
  T110/T111/T114).
- `delen.huidMaterialen` (array) wordt door `doodOndode()`/`raakOndode()`
  gebruikt om bij een treffer kort te flitsen; `delen.kern` (Brander) en
  `delen.oogMateriaal` (windup-pulse, T31) zijn losse, met naam
  aangesproken referenties — geen generieke array.
- `geoCache`/`geo()` (T69) deelt de ~9 basisvormen al tussen alle ondoden;
  per-ondode maatvariatie loopt via `mesh.scale`, nooit via nieuwe
  geometrie-parameters. `ruimGroepOp()` (T70) is het dispose-contract.
- Renderer: three@0.160.0, `pixelRatio` tot 2, `EffectComposer` met 4
  passes (Render, Bloom, de eigen naverwerkingspass, Output). 28 lichten
  (1 hemisfeer + 27 point), precies 1 schaduwwerper — geen enkele daarvan
  hoort bij een ondode.

Dit is de bron van waarheid voor de architectuurbeslissingen hieronder.
Waar de opdracht van de eigenaar een keuze openliet (bijv. hoeveel bones,
welk triangle-budget), staat dat hieronder ook als **open, in de code te
meten vraag** — niet als vooraf bedachte waarde. Zie ook waarschuwing 80.

### De architectuur in één zin

**Van 13 losse meshes + tot 13 materialen naar 1 `THREE.SkinnedMesh` +
1 materiaal per ondode**, met de bestaande pivot-`Group`s vervangen door
echte `THREE.Bone`s — en omdat een `Bone` gewoon een `Object3D`-subklasse
is, blijven bestaande schrijfpatronen zoals `ondode.delen.armL.rotation.x
= …` in `updateOndoden()`/`raakOndode()`/`doodOndode()` **syntactisch
identiek werken**. Dat is de kern-architectuurtruc van deze ronde: de
render­architectuur verandert fundamenteel, maar het `delen.*`-contract
dat de rest van het spel al gebruikt, hoeft niet te veranderen — het
draagvlak eronder (Group → Bone) wordt vervangen, niet het contract zelf.

**Wat WEL nieuw is en dus wél nieuwe code vraagt:**
1. De hitbox: een `SkinnedMesh` mag NOOIT het raycast-doelwit zijn (§24 van
   de opdracht, en bevestigd door de eigen regel van dit project "meten,
   niet aannemen" — Three.js' skinned-raycast-nauwkeurigheid/-kosten zijn
   hier niet gemeten en hoeven dat ook niet te worden, want onzichtbare
   proxy-volumes zijn sowieso goedkoper). `schiet()` raycast straks tegen
   een kleine set proxies, niet tegen `ondodenGroep`'s volledige meshes.
2. Twee bones die V1 niet had (`pelvis`, `chest`/`neck`) voor de
   anatomische bewegingswensen uit de opdracht (§8) — géén kinematische
   ouder-kind-keten (heup→wervelkolom→borst→schouder), want dat zou
   bestaande onafhankelijke rotatiewrites (kromme rug, scheve nek) laten
   interfereren met de armen eronder. **Plat** blijft, zoals V1 al is.
3. Eén gedeeld materiaal per ondode betekent dat wat vroeger "een ander
   materiaal" was (Brander-kern, oog-emissie) nu een **regio** op
   hetzelfde materiaal moet worden (emissive mask, vertex color of een
   kleine losse proxy-mesh — per geval afgewogen in de tickets hieronder,
   nooit "omdat het kan").

### De zes invarianten van deze ronde — lees ze vóór élk ticket

> 1. **Gameplaygetallen blijven exact gelijk.** HP, snelheid, schade,
>    headshot-/bodyshot-schade, geldbeloning, typekansen, spawn-pacing,
>    wave-budget, `effectiefMaxActief()`, Brander-explosiegedrag,
>    collisionregels, powerups, Kerninslag, zone-logica, event-golven —
>    niets daarvan wijzigt in deze ronde. Dit is uitsluitend rendering,
>    animatie-uitvoering en hitdetectie-**architectuur**.
> 2. **Het lichtaantal blijft 28, met precies 1 schaduwwerper.** Geen
>    enkel ticket voegt een `Light` toe — ook niet "een klein lichtje" voor
>    de Brander-kern of de ogen. Dat is exact de fout die §21/§20 van de
>    bronopdracht verbiedt en die dit project al zes rondes lang bewaakt.
> 3. **`userData.lichaamsdeel === 'kop'` blijft een expliciete, minimale
>    markering** — nooit "alles op de SkinnedMesh telt als kop" en nooit
>    een impliciete afleiding. Een nieuw lichaamsdeel dat per ongeluk als
>    kop telt, is een balanswijziging vermomd als renderrefactor (T99
>    waarschuwde hier al voor).
> 4. **V1 blijft bestaan naast V2 tot de eindbeoordeling (T129/T130) groen
>    licht geeft.** Eén module-constante stuurt welke gebouwd wordt. Geen
>    A/B-vergelijking is geldig zonder deze toggle.
> 5. **Meten, niet aannemen — voor élke claim in deze tickets.** Draw
>    calls, triangles, materialen, frametijd: als het niet betrouwbaar
>    meetbaar is (SwiftShader-frametijd, zie §10.3/§8.11), zeg dat
>    expliciet in het ticketverslag in plaats van een getal te verzinnen.
> 6. **`geoCache`/`geo()`, `ruimGroepOp()` en het T89-emissiehiërarchie-
>    contract (Bron/Signaal/Alarm) blijven heel.** Een `SkinnedMesh` se
>    geometrie en `Skeleton` moeten via hetzelfde dispose-discipline als
>    T70 worden opgeruimd bij `ruimGroepOp()` — een gemiste
>    `skeleton.dispose()` is een nieuwe lekklasse die dit project nog niet
>    kent.

### Uitvoeringsvolgorde (vast)

```
Fase 0  T117
Fase 1  T118
Fase 2  T119
Fase 3  T120
Fase 4  T121 → T122 → T123
Fase 5  T124 → T125
Fase 6  T126 → T127 → T128
Fase 7  T129 → T130
Fase 8  T131
```

Harde afhankelijkheden: T117 vóór alles (de baseline bestaat pas dan) ·
T118 vóór T119 (er moet een skelet zijn vóórdat het kan bewegen) · T119
vóór T120 (hitbox-proxies moeten tegen een ECHT bewegend skelet getest
worden, niet een rustpose — zie de toelichting bij T120) · T120 vóór T121
(anatomie/silhouet wijzigen terwijl de hitbox nog niet vaststaat is twee
keer werk) · T121 vóór T122/T123 (het gedeelde materiaal moet bestaan
vóórdat je 'm verrijkt) · T124 vóór T125 (geometrie vóór houding) · T121 én
T124 vóór T126/T127/T128 (typevarianten bouwen op de definitieve
Base Humanoid, niet op een tussenversie) · T126/T127/T128 vóór T129/T130
(het eindrapport en de regressiesuite hebben alle types nodig) · T129/T130
vóór T131 (V1 verwijderen zonder groen licht is onomkeerbaar).

**Nooit combineren met een ander ticket (ronde 9):**
- **T118** (V2-geometriebasis + skelet) — de eerste fundamentele wissel
  van de renderarchitectuur; niets anders verandert tegelijk.
- **T120** (hitbox-/raycast-compatibiliteitslaag) — het hitbox-contract
  mag maar door één wijziging tegelijk bewegen, exact dezelfde discipline
  als T18/T28/T30/T61/T65/T99 hiervoor. Headshots/bodyshots zijn de
  gevoeligste plek in het hele spel; geen andere wijziging in dezelfde
  commit.
- **T131** (V1 verwijderen) — onomkeerbaar zonder een aparte, expliciete
  opdracht bovenop het groene licht uit T129/T130.

**Commitgrenzen:** één commit per ticket, `run-all.mjs` volledig groen
vóór commit, nooit oud + nieuw systeem tegelijk actief NA T131 (tot dan
mág de V1/V2-toggle allebei laten bestaan — dat is het hele punt van de
toggle). Elk ticket vanaf T118 levert, net als ronde 8, een beeldverslag:
minimaal V1 vs V2 vanaf hetzelfde standpunt, met dezelfde bevriezing als
`openVoorVisueleMeting()` gebruikt.

---

### Fase 0 — Analyse & meetbasis

### Ticket 117 — Zombie V1-analyse, F3-overlay en de post-T116-baseline
- **Context:** §0–§4 van de bronopdracht: bouw NIETS aan Zombie V2 voordat
  V1 en de renderer exact gemeten zijn. De code-analyse hierboven
  ("Herkomst en grondslag") is het startpunt, geen vervanging van dit
  ticket — dit ticket meet in de draaiende game, niet in de broncode.
- **Doel:** een klein, tijdelijk debug-overlay (toggle, geen permanente
  UI) dat minimaal toont: FPS, gemiddelde frametijd, p95 frametijd,
  `renderer.info.render.calls/triangles/points/lines`,
  `renderer.info.memory.geometries/textures`, actieve/zichtbare ondoden,
  actieve lichten, schaduwwerpende lichten. Plus een document
  (`ZOMBIE_V2_BASELINE.md`, Nederlands) met de exacte V1-meting.
- **Stappen:**
  1. Controleer expliciet of `renderer.info.autoReset` correct staat voor
     hoe dit project de composer gebruikt (4 passes; T88 gebruikt al
     `autoReset=false` + handmatige `reset()` in de teststack — hergebruik
     dat patroon, verzin het niet opnieuw).
  2. Bouw de overlay als een verborgen HUD-laag (zelfde
     `display:none`/debug-toggle-patroon als bestaande dev-hulpjes), NIET
     zichtbaar voor gewone spelers.
  3. Meet in de draaiende game (niet alleen headless): 1 ondode dichtbij;
     10 ondoden; 18 ondoden; 18 ondoden tijdens snel schieten. Noteer per
     scenario: meshes/materialen/geometrieën per ondode (uit de
     scenegraaf, zelfde traversal-aanpak als `meet-eindtoestand.mjs` uit
     T116), draw calls, triangles, en — waar betrouwbaar meetbaar — FPS/
     frametijd/p95. Waar frametijd niet betrouwbaar meetbaar is
     (headless/SwiftShader), zeg dat expliciet in het document in plaats
     van een getal te verzinnen (§10.3/§8.11, exact het patroon uit T116).
  4. Schrijf `ZOMBIE_V2_BASELINE.md`: sectie "Zombie V1" met precies de
     velden die het latere eindrapport (T129) ook gebruikt (zie de
     rapportstructuur daar), zodat V1 en V2 straks letterlijk naast elkaar
     staan.
- **Acceptatie:** de overlay is uitzetbaar/onzichtbaar voor de speler; het
  document bevat gemeten (niet geschatte) getallen voor alle vier de
  scenario's; elke claim die niet gemeten kon worden staat expliciet
  benoemd als "niet betrouwbaar meetbaar" in plaats van weggelaten of
  verzonnen.
- **Test:** `run-all.mjs` blijft groen (de overlay mag geen bestaand
  gedrag raken); een nieuw, klein `test-perf-overlay.mjs` dat toetst dat
  de overlay standaard onzichtbaar is en de juiste velden toont zodra hij
  aan staat.
- **Niet veranderen:** geen enkele regel in `maakOndodeModel()`,
  `updateOndoden()`, `raakOndode()`, `doodOndode()` of `schiet()`. Dit
  ticket meet, het bouwt niets aan de zombie zelf.

---

### Fase 1 — Fundament: geometrie, skelet, gedeeld materiaal, toggle

### Ticket 118 — V2-geometriebasis: SkinnedMesh, plat botskelet, V1/V2-toggle
- **Context:** de architectuur hierboven ("De architectuur in één zin").
  `maakOndodeModel()` bouwt vandaag `Group`-pivots; dit ticket vervangt
  ALLEEN de rest van dat draagvlak (Group → Bone, losse meshes → één
  samengestelde `BufferGeometry`), niet de bewegingslogica (die staat in
  `updateOndoden()` en blijft in dit ticket ongewijzigd).
- **Doel:**
  1. `ZOMBIE_RENDER_VERSIE`-module-constante (`'v1' | 'v2'`), zelfde
     schakelaar-discipline als beslissing 92 (T96/T97/T98/T100/T103/
     T108/T110) — géén query-param, géén runtime-toggle-UI. Debug-hook
     getter/setter zodat tests 'm kunnen omzetten zonder reload.
  2. Bestaande `maakOndodeModel()` hernoemen naar `maakOndodeModelV1()`,
     ONGEWIJZIGD verder. Nieuwe `maakOndodeModelV2()` bouwt:
     - Eén samengestelde `THREE.BufferGeometry` met de disjuncte
       "eilanden" torso, 2 schouders, hoofd, 2 armen, 2 handen, 2 benen
       (Brander-kern/bochel/buik/vod komen in latere tickets — zie T121/
       T126/T127) — GEEN topologisch gesloten volume nodig (§10 van de
       bronopdracht staat dit expliciet toe).
     - `skinIndex`/`skinWeight`-attributen: elke vertex hoort bij precies
       één bone (geen echte blending nodig voor een low-poly figuur met
       harde delen — vereenvoudigt bind-pose-berekening en voorkomt
       naad-vervorming tussen delen die toch nooit hoeven te vervormen).
     - Eén **platte** `THREE.Skeleton`: `root`, `beenL`, `beenR`, `romp`,
       `hoofd`, `armL`, `armR` — zelfde namen, zelfde rustpose-transform
       (positie/rotatie) als de huidige V1-pivots, zodat de rustpose
       pixel-voor-pixel overeenkomt met een stilstaande V1-ondode.
     - Eén `MeshStandardMaterial`-instantie PER ONDODE (niet gedeeld
       tussen ondoden — zelfde per-instance-noodzaak als V1's
       `maakOndodeMateriaal()`, alleen nu 1 in plaats van tot 9 per
       ondode). Kleurvariatie per lichaamsdeel (torso vs hoofd iets
       lichter, zoals V1's `.multiplyScalar()`) via een vertex-color-
       attribuut op de samengestelde geometrie, zelfde bak-patroon als
       T104's `bakUniformeTint()`. Geen rim/emissive/normal-map nog — dat
       is T122/T123.
  3. `groep.userData.delen = { beenL, beenR, romp, hoofd, armL, armR,
     huidMaterialen: [materiaal], skinnedMesh, skeleton }` — dezelfde
     sleutelnamen als V1, dus `ondode.delen.armL` bestaat in beide
     versies en verwijst in V2 naar een `Bone` i.p.v. een `Group`.
  4. `spawnOndode()`/`updateOndoden()`/`raakOndode()`/`doodOndode()`
     blijven in DIT ticket op hun bestaande code — geen enkele van die
     functies wordt aangepast. Ze lezen/schrijven `delen.*`, en omdat een
     `Bone` een `Object3D`-subklasse is, werken hun bestaande
     `.rotation.x = …`/`.position.y = …`-writes al identiek tegen V2 —
     dat is precies de kern-architectuurtruc, en dit ticket is de plek
     waar die voor het eerst wordt aangetoond, niet alleen beweerd.
- **Stappen:** bouw eerst de geometrie-samensteller als pure functie
  (input: per-deel offset/rotatie/schaal, output: gecombineerde
  `BufferGeometry` + skin-attributen) zodat hij testbaar is zonder scene;
  dan het `Skeleton`/`SkinnedMesh`-bind; dan de toggle-vertakking in
  `spawnOndode()`. `SkinnedMesh` en `Skeleton` MOETEN via `ruimGroepOp()`
  correct disposen (invariant 6) — controleer expliciet of het bestaande
  T70-dispose-pad een `Skeleton` al meeneemt of dat dit een nieuwe
  disposeregel nodig heeft.
- **Acceptatie:** met de toggle op `'v1'` is het spel bit-voor-bit
  identiek aan vóór dit ticket (volledige regressiesuite groen). Met de
  toggle op `'v2'`: een V2-ondode laadt zonder fout, staat in exact de
  V1-rustpose (screenshot-vergelijking, geen mechanische assert nodig
  voor "ziet er hetzelfde uit"), en `ondode.delen.armL` bestaat en is een
  `THREE.Bone`. Meshes/materialen/geometrieën per V2-ondode gemeten en
  naast de T117-baseline gezet in `ZOMBIE_V2_BASELINE.md`.
- **Test:** `test-ondode-model-v2.mjs` (nieuw) — structuurchecks
  (skinIndex/skinWeight aanwezig, `skeleton.bones.length` klopt, `delen.*`
  bestaat met de juiste types) + een expliciete test dat het
  `raakOndode()`/`doodOndode()`-flash-pad nog steeds werkt met
  `huidMaterialen.length === 1` (was tot 9). GEEN gameplay-asserts hier
  (die komen in T119/T120) — dit ticket toetst uitsluitend structuur.
- **Niet veranderen:** `spawnOndode()`'s buitenkant (signature, `type`/
  `traits`-parameters), `updateOndoden()`, `raakOndode()`, `doodOndode()`,
  `schiet()`, elk balansgetal.
- **Let op:** dit is het risicovolste ticket van de ronde — de eerste
  fundamentele wissel van de renderarchitectuur. Nooit combineren met
  iets anders (zie boven).

---

### Fase 2 — Animatie

### Ticket 119 — Nieuwe anatomische bones + hun procedurele beweging
- **Context:** T118 leverde de 7 bones die V1 al had (via zijn pivots).
  Bestaande beweging (lopen, aanval, flinch, dood — allemaal in
  `updateOndoden()`/`raakOndode()`/`doodOndode()`) werkt daardoor al
  ONGEWIJZIGD tegen een V2-ondode; dit ticket voegt UITSLUITEND toe wat
  V1 nooit had: §8 van de bronopdracht vraagt een pelvis die apart
  beweegt tijdens het lopen, een borstkas die licht achterloopt, en een
  hoofd dat niet star aan de romp gekoppeld is (het laatste bestaat al
  gedeeltelijk via `hoofdGroep`'s eigen rotatie — dit ticket beoordeelt
  of dat voldoende is of dat een extra `neck`-bone meerwaarde heeft).
- **Doel:** twee nieuwe, PLATTE bones (`pelvis`, `chest`) naast de
  bestaande 7 — géén kinematische ouder-kind-keten (zie de toelichting in
  "De architectuur in één zin": een echte keten zou de bestaande
  onafhankelijke arm-/beenrotaties laten meebewegen met elke chest-
  rotatie, en dat verandert het silhouet tijdens exact de bewegingen die
  `updateOndoden()` al met zorg timet). Nieuwe, kleine procedurele
  bijdrages in `updateOndoden()`'s V2-tak: een lichte pelvis-sway in fase
  met de bestaande loop-cyclus, een chest-offset die met een korte
  vertraging achter de pelvis-sway aanloopt (het "loopt iets achter"-
  effect uit de bronopdracht, via een phase-lag op DEZELFDE sinus die de
  loop-cyclus al aanstuurt — geen nieuwe klok).
- **Stappen:** meet eerst of `hoofdGroep`'s bestaande rotatie het
  "hoofd niet star gekoppeld"-doel al voldoende dekt (kromme rug + scheve
  nek zitten er al) vóórdat een aparte `neck`-bone wordt toegevoegd — als
  het antwoord "ja" is, blijft `neck` weg en levert dit ticket alleen
  `pelvis`/`chest`. Voeg de twee nieuwe bones toe aan het `Skeleton` uit
  T118 (skinIndex/skinWeight van een klein deel van de torso-vertices
  verschuiven naar `chest`, van de heupregio naar `pelvis` — dus WEL een
  kleine geometrie-aanpassing t.o.v. T118, maar geen nieuwe zichtbare
  meshes). Exact dezelfde TIMING als de bestaande loop-/aanval-/flinch-/
  death-animatie (invariant 1) — dit voegt beweging toe, het verandert
  geen enkele bestaande snelheid of duur.
- **Acceptatie:** met de toggle op `'v2'` is een lopende ondode
  zichtbaar "voller" bewogen dan V1 (screenshot-reeks tijdens het lopen,
  V1 naast V2) zonder dat de voetstap-cyclus-duur, aanvalstiming of
  flinch-duur is veranderd (die blijven letterlijk dezelfde getallen als
  V1 — meetbaar via de bestaande timing-constanten, niet via ogenschouw).
  Bones die `updateOndoden()` niet expliciet aanstuurt (b.v. tijdens
  `strompelt`) reageren nog steeds correct op de bestaande strompel-code.
- **Test:** uitbreiding van de bestaande animatie-testsuite
  (`test-ondode-animatie.mjs`-stijl) met V2-varianten: pelvis/chest-
  posities verschuiven binnen de loop-cyclus, keren terug naar rust bij
  stilstand, en — cruciaal — de BESTAANDE V1-animatietests blijven
  ongewijzigd groen (ze testen de `delen.*`-writes, niet de
  renderarchitectuur eronder).
- **Niet veranderen:** looppas-snelheid, aanvalstiming, flinch-duur,
  `STERVEN_DUUR`, `VAL_STIJLEN` — dit ticket verrijkt de UITVOERING, niet
  de gameplaytiming (invariant 1).

---

### Fase 3 — Hitbox & raycasting

### Ticket 120 — Onzichtbare hitbox-proxies + `schiet()`/`raakOndode()` op V2
- **Context:** §24 van de bronopdracht is hier hard: de high-detail
  `SkinnedMesh` mag NOOIT de raycast-hitbox zijn. Dit project se eigen
  regel ("meten, niet aannemen") maakt de vraag "is Three.js' skinned-
  raycast wel accuraat/snel genoeg" irrelevant — onzichtbare
  proxy-volumes zijn sowieso goedkoper om te raycasten dan een volledige
  getrianguleerde mesh, dus die vraag hoeft niet eens gemeten te worden
  om de keuze te rechtvaardigen. Komt bewust NA T119 (animatie), zodat de
  proxies tegen een ECHT bewegend skelet gebouwd en getest worden — een
  proxy die alleen in de rustpose klopt en tijdens het lopen achterblijft,
  is een onzichtbare bug die precies headshots/bodyshots raakt.
- **Doel:** twee kleine, onzichtbare `Mesh`-proxies per V2-ondode (kop:
  sphere, lichaam: capsule of eenvoudige box), elk als kind van de
  bijbehorende bone (kop-proxy kind van `hoofd`, lichaam-proxy kind van
  `romp`) zodat ze automatisch de posed bone volgen zonder eigen
  update-code. `userData.lichaamsdeel` staat op deze proxies (`'kop'`
  resp. `'lichaam'`) — de daadwerkelijke `SkinnedMesh` krijgt GEEN
  `userData.lichaamsdeel` meer en wordt uit het raycast-pad gehaald via
  `THREE.Layers` (proxies op een aparte layer die `schiet()`'s raycaster
  wél doorzoekt; de zichtbare `SkinnedMesh` op de layer die de camera wél
  rendert maar de raycaster niet doorzoekt — controleer de exacte
  Three.js-laagconventie in r160 vóór je bouwt, verzin 'm niet).
  `schiet()`'s `raycaster.intersectObject(ondodenGroep, true)` blijft
  syntactisch identiek (die vindt de proxies gewoon, want ze zitten in
  dezelfde `ondodenGroep`-subboom) — geen wijziging nodig aan `schiet()`
  zelf zolang de layer-filtering op de raycaster staat, niet op de
  aanroep.
- **Stappen:** bouw de proxies als onzichtbare (`visible: false` ÉN op de
  raycast-only layer — beide, voor het geval een toekomstig ticket per
  ongeluk `visible` toggelt) meshes met een minimaal aantal driehoeken
  (een sphere/capsule op lage segmentcount is voldoende, dit is geen
  zichtbare geometrie). Test expliciet tijdens: lopen, voorover buigen
  (kromme rug), aanval, flinch, death-animatie — bij elke staat moet een
  recht-vooruit-schot op ooghoogte (1.7m, zelfde aanname als V1's
  hoofd-hoogte-anker) de kop-proxy raken.
- **Acceptatie:** met de toggle op `'v2'` zijn headshots en bodyshots
  betrouwbaar tijdens ALLE bewegingsstaten hierboven (test-matrix, geen
  losse steekproef); de zichtbare `SkinnedMesh` wordt NOOIT geraakt door
  `raycaster.intersectObject(ondodenGroep, true)` (expliciete test:
  richt op een plek die alleen de mesh raakt en niet een proxy — als dat
  een treffer geeft, lekt de mesh alsnog het raycast-pad in). Raycasting
  in V2 is niet duurder dan V1 gemeten in draw-call-equivalente termen
  (twee simpele primitieven per ondode i.p.v. 13 getrianguleerde meshes).
- **Test:** `test-ondode-hitreacties.mjs`/`test-schaderichting.mjs`-stijl
  uitgebreid met een V2-tak die de volledige bewegingsstaten-matrix
  hierboven doorloopt; een aparte, expliciete test dat de `SkinnedMesh`
  zelf geen `userData.lichaamsdeel` draagt en niet op de raycast-layer
  zit.
- **Niet veranderen:** `schiet()`'s buitenkant, headshot-/bodyshot-schade,
  de `while (obj && !obj.userData.ondode) obj = obj.parent;`-klim-logica
  (die blijft werken zolang de proxies ook een pad omhoog naar
  `userData.ondode` hebben, exact zoals V1's meshes dat nu hebben).
- **Let op:** het hitbox-contract mag maar door één wijziging tegelijk
  bewegen — nooit combineren met een ander ticket (zie boven).

---

### Fase 4 — Anatomie, houding en materiaalverrijking

### Ticket 121 — Anatomie- en silhouetupgrade + triangle-budgetonderzoek
- **Context:** §6/§7/§11 van de bronopdracht: dit is de stap waar de
  zombie daadwerkelijk "veel mooier" wordt. Komt NA de hitbox (T120), niet
  ervoor — anatomie/silhouet wijzigen terwijl de hitbox-proxies nog niet
  vaststaan, is twee keer werk als de proxy-ankerpunten (bone-posities)
  meeveranderen.
- **Doel:** de Base Humanoid-geometrie uit T118 (functioneel maar
  bewust nog grof) vervangen door een anatomisch overtuigender vorm:
  schedelvorm/kaak/jukbeenderen op het hoofd, een geloofwaardige
  schouderlijn/borstkas/taille op de romp, onderscheid bovenarm/
  onderarm/pols, onderscheid bovenbeen/knie/onderbeen/voet. Geen nieuwe
  ZICHTBARE meshes (dat zou de draw-call-winst van T118 ongedaan maken) —
  extra detail komt uit MEER driehoeken binnen dezelfde samengestelde
  `BufferGeometry`, niet uit meer objecten.
- **Stappen:** onderzoek de drie ranges uit de bronopdracht
  (2.000–4.000 / 4.000–8.000 / 8.000–15.000 triangles) als
  ONDERZOEKSRANGES, geen doelwaarden: bouw een middenvariant (4.000–8.000)
  eerst, vergelijk met screenshots tegen zowel V1 als een 2.000–4.000-
  variant, en verhoog alleen als het verschil op scherm aantoonbaar is
  (close-up ÉN op speelafstand). Besteed extra driehoeken waar de
  bronopdracht ze noemt: hoofd, gezichtssilhouet, schouders, handen,
  knieën, voeten, kledingranden, anatomische overgangen — niet aan
  vrijwel vlakke gebieden. Werk de bind-pose/skin-gewichten bij zodra de
  vertexverdeling verandert (nieuwe vertices horen bij dezelfde bones als
  hun buren, anders scheurt de mesh bij een pose).
- **Acceptatie:** een gekozen triangle-budget, ONDERBOUWD met een
  screenshot-vergelijking (niet alleen een getal) tegen zowel V1 als een
  lager-poly V2-kandidaat; draw calls per ondode blijven ongewijzigd
  t.o.v. T118/T119/T120 (dit ticket voegt vertices toe, geen objecten);
  de hitbox-proxies uit T120 blijven kloppen (regressietest T120 blijft
  groen — bones-posities zijn niet verschoven, alleen de mesh eromheen is
  gedetailleerder).
- **Test:** `run-all.mjs` inclusief T120's hitbox-matrix; nieuwe
  beeldverslag-set (V1 vs V2, close-up + speelafstand, zelfde standpunten
  als T88's acht bevroren standpunten waar een ondode zichtbaar is).
- **Niet veranderen:** bone-posities/-rotaties uit T118/T119, het
  hitbox-contract uit T120, elk balansgetal.

### Ticket 122 — Materiaalverrijking: rim-light, Bron/Signaal-emissie, ogen, Brander-kern
- **Context:** T118 leverde één vlak, ongekleurd materiaal per ondode.
  Dit ticket zet V1's bestaande, WERKENDE emissie-systemen over: de
  rim-light (T100, gedeelde `RIM_UNIFORMS`), de Bron/Signaal-
  emissiehiërarchie (T89, `OOG_INTENSITEIT_BASIS`/alarm-schaal via
  `delen.oogMateriaal`), en de Brander-kernpuls (`delen.kern`,
  `EMISSIE_BRON_MAX`, aangestuurd door `raakOndode()`). Dit is waar de
  "1 materiaal in plaats van tot 9"-belofte tegen echte complexiteit
  wordt getoetst — niet alles kan zomaar op één materiaal.
- **Doel, met de afweging per feature expliciet gemaakt (§16 van de
  bronopdracht: "is de zichtbare winst groot genoeg voor de fragmentkosten"):**
  - **Rim-light:** blijft `onBeforeCompile` op het (nu enkelvoudige)
    materiaal, zelfde `RIM_UNIFORMS`-gedeelde-uniform-patroon als V1 —
    geen wijziging in de aard van de techniek, alleen in hoeveel
    materialen 'm dragen (1 i.p.v. tot 9 per ondode, dus GOEDKOPER, niet
    duurder).
  - **Ogen:** GEEN losse mesh (dat zou de 1-materiaal-belofte meteen
    doorbreken voor een detail dat de bronopdracht expliciet als
    "geen extra draw call" markeert, §20). Los een emissive-mask-regio
    op via een vertexattribuut (of een klein, toegewezen UV-gebied als
    T107's texture-aanpak dat makkelijker maakt) die in de fragment-
    shader de oogkleur/-intensiteit apart aanstuurt. `delen.oogMateriaal`
    (het bestaande T31-windup-pulse-contract, dat leest/schrijft
    `.emissiveIntensity`) wordt een lichte FACADE — een gewoon
    JS-object met een `emissiveIntensity`-property die bij het schrijven
    een uniform op het gedeelde materiaal bijwerkt — zodat T31's
    bestaande code (`delen.oogMateriaal.emissiveIntensity = …`)
    ongewijzigd blijft werken. Dit uniform is PER ONDODE (niet gedeeld
    zoals `RIM_UNIFORMS`), want elke ondode heeft zijn eigen windup-
    timing.
  - **Brander-kern:** blijft een LOSSE, kleine mesh (net als V1) — dit is
    de bronopdracht se eigen uitzondering (§9: "2 draw calls = zeer goed,
    3 = alleen met duidelijke visuele reden"). De reden is hier concreet:
    `raakOndode()` schaalt `delen.kern` onafhankelijk voor de kernpuls-
    animatie, en het schalen van een REGIO binnen één samengestelde
    `SkinnedMesh` (in plaats van een los object) is niet mogelijk via
    object-transforms. Brander is bovendien het enige type met dit
    detail — de kostenpost geldt niet voor de andere vier types. Blijft
    op `kernMateriaal` (gedeeld, zoals nu), GEEN `PointLight` (invariant
    2).
- **Acceptatie:** een V2-ondode heeft precies 1 draw call (normale/Loper/
  Sjouwer/Sluiper) of 2 (Brander, kern meegerekend) — gemeten, niet
  aangenomen; `RIM_UNIFORMS`-writes werken nog steeds globaal op alle
  ondoden tegelijk (V1 én V2 gemengd, mocht de toggle ooit per-spawn
  variëren tijdens testen); `delen.oogMateriaal.emissiveIntensity = x`
  verandert zichtbaar en uitsluitend DIE ene ondode se ogen; de
  T88-visuele-basislijn blijft binnen band (dit raakt licht/materiaal,
  dus die test hoort bij dit ticket te draaien — invariant uit ronde 8,
  nog steeds geldig).
- **Test:** `test-rimlight.mjs`/T89-emissietests uitgebreid met een
  V2-tak; nieuwe check dat de oog-facade het bestaande T31-contract
  (lezen ÉN schrijven van `.emissiveIntensity`) volledig dekt; Brander-
  kernpuls-test (bestaande `delen.kern`-assert) blijft ongewijzigd groen.
- **Niet veranderen:** `RIM_STERKTE_BASIS`, `OOG_INTENSITEIT_BASIS`,
  `EMISSIE_BRON_MAX`, de alarm-/Signaal-opschaling uit T89 — dit ticket
  verhuist waar de emissie vandaan komt, niet de waarden zelf.

### Ticket 123 — Normal-map A/B-test (verplicht, apart)
- **Context:** §18 van de bronopdracht eist dit EXPLICIET als eigen,
  losstaande stap — nooit stilzwijgend meegenomen in T121/T122. Met 28
  lichten kan fragmentkosten van een extra textuursample per licht
  relevant zijn (waarschuwing 60 uit ronde 8 geldt hier onverkort: deze
  scene is fragment-bound, niet draw-call-bound).
- **Doel:** normal maps op de plekken die de bronopdracht noemt (§18):
  huidplooien, ribben, littekens, wonden, scheuren. Puur een detaillaag
  bovenop het T121/T122-materiaal — geen nieuwe geometrie, geen nieuwe
  draw call.
- **Stappen:** bouw exact twee varianten van hetzelfde V2-materiaal (A:
  zonder normal map, B: met), zelfde scene/camera/zombies/pixelRatio/
  verlichting voor allebei — geen enkel ander verschil. Meet, met de
  overlay uit T117: gemiddelde frametijd, p95, calls, triangles, voor
  beide varianten, in minimaal het 18-zombies-scenario.
- **Acceptatie:** als de visuele winst duidelijk is EN de frametime-
  impact klein: normal map behouden, met het gemeten verschil
  gedocumenteerd in `ZOMBIE_V2_BASELINE.md`. Als de kosten opvallend
  zijn: vereenvoudigen (bijv. alleen op het hoofd, niet op de hele
  romp) of weglaten — met de reden erbij, niet stilzwijgend.
- **Test:** de A/B-meting zelf is het testplan van dit ticket (geen
  aparte assert-suite nodig bovenop de bestaande visuele/render-tests,
  die blijven vanzelf groen zolang de materiaalstructuur niet breekt).
- **Niet veranderen:** niets buiten het materiaal van T121/T122 — dit
  ticket voegt precies één laag toe of laat 'm expliciet weg.

---

### Fase 5 — Types

### Ticket 124 — Loper en Sjouwer op de V2-basis
- **Context:** §14 van de bronopdracht: types moeten VISUEEL duidelijker
  worden, ZONDER gameplaystats te veranderen (`ONDODE_TYPES.loper`/
  `.sjouwer` blijven letterlijk ongewijzigd — snelheid/HP/geld/schaal).
  V1 differentieert nu via `typeInfo.vorm` (`rompBreedte`, `voorover`,
  `bochel`) op `mesh.scale` — dat mechanisme blijft grotendeels bruikbaar
  op de V2-bones (scale werkt op een Bone net als op een Group).
- **Doel:** Loper (mager, pezig, smallere torso, voorovergebogen, diepe
  oogkassen — via de T121-anatomie plus bone-scale) en Sjouwer (brede
  torso, dikke nek, grote schouders, gebogen rug, bochel, lager
  zwaartepunt) herkenbaar op de nieuwe basis. De Sjouwer-bochel: zelfde
  afweging als de Brander-kern in T122 — losse mesh of vertexregio? Hier
  is het antwoord waarschijnlijk ANDERS, want de bochel heeft geen eigen
  onafhankelijke animatie nodig (in tegenstelling tot de kernpuls) — meet
  of een vertexregio-aanpak (mesh-geometrie, geen apart object) volstaat
  vóór je een losse mesh bouwt.
- **Stappen:** bouw beide types, vergelijk per type een V1- en
  V2-screenshot vanaf hetzelfde standpunt/dezelfde pose; laat een
  onbevooroordeelde blik (of jezelf, koud, zonder de code erbij) binnen
  1 seconde het type benoemen — dat is de facto-acceptatietest uit §14
  ("moet onmiddellijk zwaar/snel voelen").
- **Acceptatie:** `ONDODE_TYPES.loper`/`.sjouwer` ongewijzigd (diff-check
  op die twee object-literals); beide types binnen hetzelfde draw-call-
  budget als de normale V2-ondode uit T121/T122 (tenzij de bochel-keuze
  hierboven een 2e draw call rechtvaardigt — dan expliciet beargumenteerd
  zoals bij de Brander-kern).
- **Test:** bestaande varianten-/typetests (`test-varianten.mjs`-stijl)
  uitgebreid met een V2-tak; geen nieuwe balans-asserts (die bestaan al
  en moeten ONGEWIJZIGD groen blijven — dat IS de test dat gameplay niet
  is veranderd).
- **Niet veranderen:** `ONDODE_TYPES.loper`/`.sjouwer`, `ONDODE_TYPE_MIN_GOLF`.

### Ticket 125 — Brander en Sluiper op de V2-basis
- **Context:** zelfde opzet als T124, voor de resterende twee types.
  Brander leunt zwaar op T122's kernmesh-beslissing; Sluiper is vooral
  een houdings-/silhouetvraag (ingedoken kop, schouders omhoog) die al
  grotendeels in `vorm.ingedokenKop` bestaat.
- **Doel:** Brander (vervormde buik, gebarsten/verbrande huid via de
  vertexregio-aanpak uit T122, kern ongewijzigd als losse mesh) en
  Sluiper (zeer mager, ingedoken torso, opvallende nekhouding, leesbare
  ogen — de oog-facade uit T122 maakt "leesbaar" hier makkelijk: hogere
  basis-`emissiveIntensity` voor dit type, geen nieuwe techniek nodig).
- **Stappen/Acceptatie/Test:** zelfde structuur als T124, toegepast op
  deze twee types. Brander-explosiegedrag (`BRANDER_EXPLOSIE_*`) blijft
  volledig ongewijzigd — dit ticket raakt alleen hoe hij eruitziet vóór
  hij ontploft, nooit de explosie zelf.
- **Niet veranderen:** `ONDODE_TYPES.brander`/`.sluiper`,
  `BRANDER_EXPLOSIE_RADIUS`/`_SCHADE_SPELER`/`_SCHADE_ONDODE`,
  de Sluiper-gating in `ondodeTypeGewichten()` (uitsluitend tijdens een
  Mistgolf).

### Ticket 126 — Cosmetische variatieprofielen op de V2-basis
- **Context:** §15 van de bronopdracht vraagt expliciet om variatie via
  bone-scaling/-positionering en vertexkleuren, NIET via unieke geometrie
  per ondode — precies hoe `VARIATIE_PROFIELEN` (T19) en `kiesOndodeTraits()`
  vandaag al werken (`rompFactor`, `armDikteFactor`, `lengteMin/Max`,
  `mistArmL`, plus de losse traits `kromme`/`slepend`/`armVerschil`/
  `strompelt`). Dit mechanisme verhuist grotendeels 1:1 naar V2 omdat het
  al op `.scale`/`.rotation` werkt, niet op geometrie-parameters (T69
  heeft dat al zo gebouwd).
- **Doel:** alle zeven profielen (standaard/mager/breed/gebocheld/lang/
  kort/eenarmig) + de vier losse traits (kromme houding, slepend been,
  armlengteverschil, strompelen) werken op de V2-bones met exact dezelfde
  kansverdeling en hetzelfde zichtbare effect als V1. `eenarmig`
  (`mistArmL`) is de enige die een BONE laat ontbreken i.p.v. een mesh —
  controleer dat een `Skeleton` met een bone die geen enkele vertex bindt
  (of helemaal afwezig is) geen renderfout geeft.
- **Acceptatie:** `VARIATIE_PROFIELEN`/`kiesOndodeTraits()`/
  `GOLF_PROFIEL_*` ongewijzigd; 200-samples-kansverdelingstest (zelfde
  patroon als T2/T19) blijft groen voor beide versies; screenshot-reeks
  van alle zeven profielen, V1 naast V2.
- **Test:** bestaande `test-varianten.mjs`/profieltests uitgebreid met
  een V2-tak, GEEN nieuwe kansverdeling.
- **Niet veranderen:** `VARIATIE_PROFIELEN`, `kiesOndodeTraits()`,
  `GOLF_PROFIEL_BUFFER_LENGTE`/`_MAX_HERLOTINGEN`.

---

### Fase 6 — Eindbeoordeling

### Ticket 127 — Volledig benchmarkprotocol + eindrapport
- **Context:** §33–§35/§41 van de bronopdracht. Dit is het
  beslismoment: haalt V2 de acceptatiecriteria, en zo ja/nee, waarom.
- **Doel:** de zeven scenario's uit de bronopdracht (§35: 1 ondode
  dichtbij; 10; 18; 18 + snel schieten; 18 in representatieve
  binnenomgeving; zware binnenplaats-scene met T110-lichtkegels; zware
  gracht-scene met T114-water) elk gemeten voor V1 én V2, met de overlay
  uit T117, deterministisch (zelfde camera/posities/types/lighting/
  pixelRatio/postprocessing/gameplaystate per paar — zie het
  benchmarkprotocol in §34: opwarmen, dan minimaal enkele honderden
  frames meten, meerdere runs waar praktisch).
- **Stappen:** vul EXACT de rapportstructuur uit §41 van de bronopdracht
  in `ZOMBIE_V2_BASELINE.md` (secties "Zombie V1"/"Zombie V2" met meshes/
  draw calls/triangles/vertices/materialen/geometrieën/transformnodes-of-
  bones/raycast-targets/texture memory; een "Benchmark"-tabel met alle
  zeven scenario's × FPS/frametime/p95/calls/triangles voor beide
  versies; "CPU"/"GPU"-secties met wat goedkoper/duurder/gelijk is
  geworden; "Visuele verbetering"; "Performancekosten per visuele
  feature" met de classificatie vrijwel-gratis/goedkoop/merkbaar/
  bewust-afgewezen; "Conclusie" die letterlijk de vragen uit §41
  beantwoordt). Pas de interpretatieregels uit §5 van de bronopdracht toe
  (gelijke frametime + duidelijk mooier = succes; enkele procenten kost
  bij duidelijke visuele winst = kan acceptabel zijn; ~10% = eerst de
  oorzaak analyseren; ~20-30% = STOP en niet verder bouwen voordat het
  begrepen is).
- **Acceptatie:** alle acceptatiecriteria uit §40 van de bronopdracht
  langsgelopen met een expliciet ja/nee per punt (visueel, rendering,
  gameplay, performance, resources — inclusief geen memory-leak over
  herhaalde spawn/kill-cycles, zie T70-discipline). Het rapport bevat een
  expliciete aanbeveling: V2 vervangt V1 (→ T131), of V2 heeft nog een
  gerichte optimalisatieronde nodig (→ terug naar het relevante eerdere
  ticket, niet naar T131).
- **Test:** `run-all.mjs` volledig groen op zowel `'v1'` als `'v2'`.
- **Niet veranderen:** niets in `amsterdam-undead.html` — dit ticket
  meet, speelt en schrijft (zelfde discipline als T116).

### Ticket 128 — Volledige regressietestsuite
- **Context:** §38 van de bronopdracht somt een brede lijst scenario's
  op die dit project al grotendeels als losse testscripts heeft (T18/
  T30/T94/T95-tests) — dit ticket is het uitbreiden van die bestaande
  scripts met een V2-tak, geen herschrijven.
- **Doel:** elk item uit §38 gedekt, met de toggle op `'v2'`: alle vijf
  types, alle zeven variatieprofielen + vier losse traits, bodyshot/
  headshot/attack/flinch/death, Brander-explosie, Kerninslag/powerup-
  kills, Mistgolf, Stroomuitval, cleanup/respawn, 18 zombies (+ schieten),
  resource-cleanup/memory-groei over herhaalde golven, fog/bloom/
  lichtkegels/postprocessing-interactie.
- **Acceptatie:** elk item uit de lijst heeft een aanwijsbare test (bestaand,
  uitgebreid, of — waar er echt geen precedent is — nieuw); geen enkel
  item is stilzwijgend overgeslagen.
- **Test:** dit ticket IS de test-uitbreiding; `run-all.mjs` volledig
  groen als resultaat.
- **Niet veranderen:** gameplaygedrag — puur testdekking.

---

### Fase 7 — Opschonen

### Ticket 129 — V1 verwijderen
- **Context:** alleen uitvoeren met een expliciete opdracht bovenop het
  groene licht uit T127/T128 — dit is de onomkeerbare stap.
- **Doel:** `maakOndodeModelV1()`, de `ZOMBIE_RENDER_VERSIE`-toggle en elk
  V1-only codepad verwijderen; V2 wordt de enige renderarchitectuur.
- **Stappen:** verwijder in één commit (zelfde discipline als ronde 3's
  "nooit oud+nieuw tegelijk"): geen dode V1-functie laten hangen "voor de
  zekerheid". Werk `ARCHITECTURE_NOTES.md`/`ROADMAP.md` bij met de
  nieuwe zombie-architectuur (nieuwe sectie, zelfde patroon als §10 voor
  ronde 8).
- **Acceptatie:** `run-all.mjs` volledig groen; geen enkele referentie
  naar `maakOndodeModelV1`/`ZOMBIE_RENDER_VERSIE` meer in de codebase
  (`grep`-controle); het spel is functioneel en visueel identiek aan de
  laatst goedgekeurde V2-staat uit T127.
- **Niet veranderen:** niets aan V2 zelf — dit ticket ruimt uitsluitend
  V1 op.

---

### Extra waarschuwingen ronde 9

80. **De bronopdracht van de eigenaar is een methode, geen kant-en-klaar
    ontwerp.** Elke concrete architectuurkeuze hierboven (platte
    botstructuur, oog-facade, Brander-kern als losse mesh, welke
    triangle-range) is AFGELEID en tegen de actuele code gecontroleerd,
    niet overgenomen. Waar een ticket hierboven "meet eerst" zegt, is dat
    letterlijk bedoeld — de opdracht verbiedt zelf het verzinnen van
    performancewinst, en dat geldt evenzeer voor Sonnet als voor de
    architect die dit plan schreef.
81. **`Bone` is drop-in-compatibel met de bestaande `delen.*`-writes,
    maar alleen zolang de botstructuur PLAT blijft.** Zodra een latere
    wijziging een echte ouder-kind-keten introduceert (bijv. armen onder
    `chest` hangen), gaan bestaande onafhankelijke rotatiewrites in
    `updateOndoden()` zich anders gedragen (ze stapelen dan op de
    chest-rotatie). Dat is precies waarom T119 expliciet plat blijft —
    verander dat niet zonder elke bestaande animatie-aanroep opnieuw te
    doorlopen.
82. **Eén materiaal per ondode is GOEDKOPER dan V1's tot 9, niet duurder
    — zolang het per-instance blijft.** De verleiding is om het
    materiaal (net als `RIM_UNIFORMS`) te DELEN tussen ondoden voor nog
    minder GL-state-switches. Doe dat niet voor de huidkleur/oog-uniform:
    die zijn per ondode verschillend, en een gedeeld materiaal zou (net
    als `RIM_UNIFORMS` bewust wél doet voor de rim) één schrijf op alle
    ondoden tegelijk laten inwerken — voor huidkleur/oogpuls is dat een
    zichtbare bug, geen optimalisatie.
83. **`SkinnedMesh`/`Skeleton` zijn een nieuwe dispose-categorie.** T70's
    bestaande contract (`ruimGroepOp()`) is geschreven vóór dit project
    ooit een `Skeleton` had. Controleer in T118 expliciet of
    `skeleton.dispose()` nodig is naast de gebruikelijke geometrie-/
    materiaaldispose, en of `geoCache`/`matMetVertexKleur`-achtige
    gedeelde-resource-markeringen (`userData.gedeeld`) van toepassing
    zijn op iets in de nieuwe structuur (de samengestelde geometrie is
    PER ONDODE uniek qua skin-data, dus vermoedelijk NIET gedeeld/
    gecachet zoals `geoCache`'s basisvormen — maar meet/controleer dat,
    verzin het niet).
84. **De hitbox-/raycastwijziging (T120) is de gevoeligste van de hele
    ronde, gevoeliger dan T118.** T118 kan fout zijn en "alleen" lelijk
    renderen; T120 kan fout zijn en headshots stil laten missen — een bug
    die een speler pas na tientallen frustrerende schoten opmerkt en
    nooit aan de renderarchitectuur zal wijten. De bewegingsstaten-matrix
    in T120's testplan (lopen/bukken/aanval/flinch/dood) is daarom geen
    "nice to have" maar de kern-acceptatie-eis van dat ticket.
85. **Geen enkel ticket in deze ronde voegt een `Light` toe — ook niet
    voor de Brander-kern of de ogen.** Dezelfde waarschuwing als ronde 8
    se nummer 61, hier extra relevant omdat "een klein lichtje voor de
    gloed" precies de intuïtieve, foute eerste ingeving is die §21/§20
    van de bronopdracht al preventief afwijst.
86. **T131 (V1 verwijderen) is de enige stap in deze ronde die geen weg
    terug heeft binnen de ronde zelf.** Alles daarvoor kan door de
    V1/V2-toggle worden teruggedraaid zonder code-archeologie. Wacht op
    een aparte, expliciete opdracht bovenop het groene licht uit T127/
    T128 — "de tests zijn groen" is niet hetzelfde als "de eigenaar wil
    nu dat V1 weg is".


---

# Ronde 10 (v0.24) — Arsenaal-herstructurering

Architectuur: `ARCHITECTURE_NOTES.md` §12. Ontwerpbeslissingen 95-99.

**Volgorde is bindend.** T132 t/m T136 (Fix 6) volledig af vóór T137 begint
(Fix 7) — de tier-visuals uit Fix 7 bouwen op modellen die Fix 6 introduceert.

### Ticket 132 — Wapendatamodel: één arsenaal, twee schakelklassen

> **UITGEBREID IN RONDE 11 — lees dat eerst.** Alles hieronder blijft gelden,
> maar er komen vier gedragsneutrale toevoegingen bij, waarvan één
> **verplicht**: zonder de `inHandGroep`-indirectie (ontwerpbeslissing 100)
> crasht T134 op frame 1. Zie `ARCHITECTURE_NOTES.md` §13.3 en het
> T132-amendement in de Ronde 11-sectie hieronder.

**Doel.** De drie invarianten uit §12.2 opheffen zonder één gram
gedragsverandering. Na dit ticket start de speler nog steeds met de AMSTEL-9
in de hand en werkt alles exact zoals nu — alleen de structuur eronder is
nieuw en klaar voor het mes.

**Werk.**
- `ARSENAAL`-definitie invoeren met een `klasse`-veld (`'mes'` /
  `'vuurwapen'`) per wapen (§12.3).
- `wisselWapen()` de expliciete gate "bezit ik twee vuurwapens" geven in
  plaats van de huidige `if (!ratelaarGekocht) return;`. Nog steeds een
  pure toggle tussen de twee vuurwapens.
- `wapenStaten` voorbereiden op een `drukspuit: null`-startwaarde zonder
  die al te zetten: elke lezer die nu aanneemt dat de staat bestaat moet
  daar tegen kunnen. Inventariseer die lezers expliciet in de
  ticket-afronding.
- `tests/helpers.mjs`: `geefSpelerVuurwapen(page)` toevoegen (§12.8) —
  nog geen enkel testbestand gebruikt 'm in dit ticket.

**Acceptatie.**
- De volledige suite is groen zonder dat één assertie is aangepast of
  versoepeld. Dat is de kern-acceptatie-eis: dit ticket is gedragsneutraal.
- `AmsterdamUndeadDebug` exporteert het nieuwe arsenaal-model zodat T133+
  erop kan testen.

**Valkuil.** De verleiding is om hier al `drukspuit: null` te zetten "want
dat komt toch". Niet doen — dan debug je in T134 een half-verbouwde kern.

---

### Ticket 133 — Het mes: mechaniek, schade en de V-actie

**Doel.** Het mes bestaat en werkt, met de speler nog steeds startend met de
AMSTEL-9. Zo is het mes te testen zonder dat de start-staat al verbouwd is.

**Werk.**
- `mesStaat = { cooldownTimer }` (§12.3, beslissing 95) — bewust géén entry
  in `wapenStaten`.
- Constanten met de onderbouwing uit §12.4 als codecommentaar:
  `MES_SCHADE = 1`, `MES_BEREIK = 1.2`, `MES_COOLDOWN = 0.6`.
- `steekMes()`: korte raycast vanuit het camera-midden met
  `raycaster.far = MES_BEREIK`, tegen `ondodenGroep` — hergebruikt de
  bestaande hitbox-proxy-infrastructuur (layers, `userData.lichaamsdeel`)
  zodat er geen tweede trefferpad ontstaat.
- `raakOndode()` krijgt een optionele `geldAlsKop`-parameter (§12.4), in
  exact dezelfde stijl als Fix 5's `schadeFactor`: default `false`,
  verandert alleen de geld-multiplier, nooit de schade of de hitmarker-tier.
- `V`-handler met het bestaande `!e.repeat` + pointer-lock-patroon.
- Mesmodel + een korte steek-animatie. Voorlopig model — T137/T138 herzien
  het uiterlijk.
- Eigen geluid via Web Audio (geen bestand), in de stijl van de bestaande
  `speel*`-functies.

**Acceptatie.**
- Nieuw `tests/test-mes.mjs`: schade exact `MES_SCHADE`; 1-hit-kill op een
  normale ondode t/m golf 4 en **niet** meer op golf 5; treffer buiten
  `MES_BEREIK` mist; cooldown blokkeert een tweede steek binnen
  `MES_COOLDOWN`; een mes-kill levert `GELD_PER_KILL * HEADSHOT_GELD_MULTIPLIER`
  op; een mes-treffer op de kop geeft **geen** `HEADSHOT_EXTRA` (beslissing 97).
- Geen mondingsvlam, tracer of munitieverbruik bij een steek —
  `test-mondingsvlam.mjs` blijft ongewijzigd groen.

---

### Ticket 134 — AMSTEL-9 als kooppunt; de speler start met het mes

**Doel.** De eigenlijke Fix 6-omslag.

**Werk.**
- `wapenStaten.drukspuit` start op `null`; `actiefWapenNaam` start op
  `'mes'`.
- `koopAmstel9()` — zelfde patroon als `koopRatelaar()`: prijscheck, geld
  af, `nieuweWapenStaat(WAPEN_DRUKSPUIT)`, en meteen naar dat wapen wisselen
  (gebruikerseis: na aankoop is het je actieve wapen).
- **Na de eerste vuurwapen-aankoop komt `actiefWapenNaam` nooit meer op
  `'mes'`** — dat is een harde eis, geen bijeffect. Leg 'm vast in de test.
- Wapenrek tegen de westmuur (§12.5): `AMSTEL9_X = -HALF_BREEDTE + 0.6`,
  `AMSTEL9_Z = 0`, `AMSTEL9_PRIJS = 450`. Zelfde opbouw als het Canal
  Ripper-rek, X-as gespiegeld, met AMSTEL-9-silhouetdelen. **Geen collision**
  (net als het Ratelaar-rek).
- `WINKEL_STIJLEN.amstel9` + `winkelMarkering` + interactiepunt.
- De 21 testbestanden migreren volgens §12.8: het merendeel via
  `geefSpelerVuurwapen()`, de vijf wapensysteem-tests inhoudelijk.

**Acceptatie.**
- Bij het laden: `actiefWapenNaam === 'mes'`, `wapenStaten.drukspuit === null`,
  HUD toont `Mes` en `0 / 0`.
- Kooppad: te weinig geld doet niets; met €450 wordt de AMSTEL-9 het actieve
  wapen; nogmaals kopen is een no-op.
- Na aankoop schakelt `V` niet meer het *actieve* wapen — het steekt alleen.
- `Q` doet niets met één vuurwapen, en wisselt correct zodra de Canal Ripper
  er ook is.
- `test-visuele-basislijn.mjs`: `interactiePunten` 13 → 14 bijgewerkt **met
  onderbouwing**; `obstakels` blijft 58 (rek zonder collision). Verschuift de
  helderheidsbasislijn door het nieuwe HUD-label of het mesmodel in beeld,
  werk 'm dan bij mét gemeten waarden en reden — zie de HUD-tekst-precedent
  in §12.7.

---

### Ticket 135 — Randgevallen: Smederij, Auto loader, HUD, reset

**Doel.** De tabel uit §12.6 volledig implementeren en vastleggen.

**Werk + acceptatie (één test per rij).**
- `koopSmederij()` met alleen een mes: weigert met een melding, schrijft geen
  geld af.
- Auto loader gekocht terwijl je alleen een mes hebt: geen effect, en de vlag
  werkt alsnog zodra je een vuurwapen koopt.
- HUD met mes: `0 / 0`, label `Mes`, geen ★ en geen ⟳.
- Game over → nieuwe run: terug naar alleen het mes, `wapenStaten.drukspuit`
  weer `null`.
- `V` tijdens herladen werkt; `V` binnen de cooldown wordt genegeerd.

---

### Ticket 136 — Golf-1-balans meten en bijstellen

**Doel.** De vraag die je pas kúnt beantwoorden als T132-T135 draaien: hoe
lang duurt het om met alleen een mes €450 bij elkaar te krijgen, en is dat
leuk of frustrerend?

**Werk.**
- Meet in een headless run: gemiddeld aantal golven en verstreken tijd tot
  €450, en hoeveel schade de speler daarbij oploopt.
- Weeg af tegen de bestaande beloningen (`GELD_PER_KILL` 20,
  `HEADSHOT_GELD_MULTIPLIER` 2, `WAVE_BONUS_BASIS` 75 +
  `WAVE_BONUS_PER_GOLF` 15).
- Stel bij via `AMSTEL9_PRIJS` of de mes-constanten — **niet** via de
  HP-trap (ontwerpbeslissing 10).

**Acceptatie.** Een gemeten, in het ticket vastgelegd antwoord op "in welke
golf heeft een gemiddelde speler de AMSTEL-9?", plus de onderbouwing van
een eventuele prijsbijstelling. Als er niets bijgesteld hoeft: leg dát vast,
met de meting.

---

### Ticket 137 — Visuele spec en budget voor de tier-visuals

> **UITGEBREID EN VERPLAATST IN RONDE 11.** Alle scope hieronder blijft
> gelden. Toegevoegd: de animeerbare onderdelen per tier, de rustpositie per
> tier, en of de recoil-amplitude per tier meeschaalt. **Nieuwe positie: ná
> T144** (de gunfeel-implementatie), zodat de animatie-eisen niet alleen
> gespecificeerd maar bewezen zijn — zie ontwerpbeslissing 102 en
> `ARCHITECTURE_NOTES.md` §13.5. De bindende Fix 6-vóór-Fix 7-volgorde uit
> §12.9 blijft daarbij gerespecteerd.

**Doel.** Vóór er één model gebouwd wordt: vastleggen hoe basis / 1x gesmeed
/ 2x gesmeed er per wapen uitzien, en wat dat mag kosten.

**Werk.**
- Vormtaal per tier per wapen (AMSTEL-9, Canal Ripper, en de keuze of het
  mes tiers krijgt — het mes kán niet gesmeed worden, dus waarschijnlijk
  één vaste look).
- Budget per `smederijVisuals*`-Group binnen de bestaande grens van **≤ 5
  meshes en 0 lichten** (§12.7 vangrail 1). Tier 2 moet binnen datzelfde
  budget passen, óf het budget wordt met onderbouwing verruimd en
  `test-smederij.mjs` mee bijgewerkt.
- Vooraf begroten wat dit met `test-visuele-basislijn.mjs` doet (§12.7
  vangrail 4): welke standpunten kunnen verschuiven, en met hoeveel.
- Bevestigen dat de `vlam`-structuur (Group van exact 2 `PlaneGeometry`)
  intact blijft.

**Acceptatie.** Een spec waar T138/T139 rechtstreeks uit te bouwen zijn,
zonder dat er nog ontwerpkeuzes open staan.

---

### Ticket 138 — AMSTEL-9 in drie tiers

> **VERPLAATST IN RONDE 11, scope volledig ongewijzigd.** Volgt T137 op zijn
> nieuwe positie (ná T144). Eén extra acceptatiecriterium: elke tier levert de
> in T140/T141 afgesproken `userData.onderdelen`-sleutels.

Bouwt de spec uit T137 voor de AMSTEL-9. Additief per tier (beslissing 98).
Acceptatie: de drie tiers zijn visueel duidelijk te onderscheiden;
mesh-/lichtbudget gehaald; `test-smederij.mjs` en `test-mondingsvlam.mjs`
groen; basislijn bijgewerkt mét gemeten onderbouwing als hij verschuift.

---

### Ticket 139 — Canal Ripper in drie tiers

> **VERPLAATST IN RONDE 11, scope volledig ongewijzigd.** Direct na T138.
> Zelfde extra acceptatiecriterium als T138 (onderdeel-sleutels per tier).

Idem voor de Canal Ripper, plus de mes-look als T137 daartoe besloot.
Afsluitend: volledige regressiesuite + een voor/na-beeldverslag van alle
tiers naast elkaar, in de stijl van de eerdere fase-beeldverslagen.

---

# Ronde 11 (v0.25) — Gunfeel, de finale, vijandanimatie en audio

Architectuur: `ARCHITECTURE_NOTES.md` §13. Ontwerpbeslissingen 100-106.

Deze ronde is geschreven vóórdat T132 was uitgevoerd. Ze bevat naast de
nieuwe tickets T140-T155 ook **amendementen op vier Ronde 10-tickets**
(T132, T137, T138, T139). Geen enkele Ronde 10-requirement vervalt of
verhuist naar een ander nummer — zie `ARCHITECTURE_NOTES.md` §13.12.

**Uitvoeringsvolgorde.**

```
[Fase 1, Ronde 10] T132* → T133 → T134 → T135 → T136 → M1
[Fase 2] T140 → T141 → T142 → T143 → T144 → M2
[Fase 3] T137* → T138* → T139*
[Fase 4] T145 → T146 → T147
[Fase 5] T148 → T149 → T150                        → M3
[Fase 6] T151   (vrij plaatsbaar, geen dependencies)
[Fase 7] T152 → T153 → T154                        → M4
[Fase 8] T155
```
`*` = Ronde 10-ticket, geamendeerd in deze ronde.

**"Parallel" bestaat hier niet letterlijk.** Alle gamecode staat in één
bestand; twee gelijktijdige branches conflicteren gegarandeerd, ook bij
logisch onafhankelijke features. Waar hieronder "vrij plaatsbaar" staat,
betekent dat **herordenbaar**, niet **gelijktijdig** (§13.9).

---

## Amendement op Ticket 132 — vier gedragsneutrale toevoegingen

De bestaande T132-specificatie blijft **volledig** gelden, inclusief
ontwerpbeslissing 99: gedragsneutraal, hele suite groen, **nul** aangepaste of
versoepelde asserties. Alle vier toevoegingen hieronder vallen onder diezelfde
eis.

**Werk (aanvullend).**
- **A — `inHandGroep`-indirectie (verplicht).** Voer een module-let
  `inHandGroep` in die altijd naar de Group wijst die aan de camera hangt.
  Laat de vier cosmetische blokken uit §13.2 daaruit lezen in plaats van uit
  `wapenStaat.definitie.groep`. In dit ticket wijst hij naar hetzelfde object
  als voorheen — nul gedragsverandering. Zonder deze wijziging crasht T134 op
  frame 1 (§13.3). Respecteert ontwerpbeslissing 95: het gameplaypad houdt
  `wapenStaat`, het presentatiepad krijgt alleen een Group.
- **B — gereserveerde runtimevelden.** `nieuweWapenStaat()` krijgt
  `spreadOpbouw: 0` en `recoilFase: 0`. Nergens gelezen, nergens geschreven.
  Consumenten zijn T142/T143.
- **C — `presentatie`/`audio`-subobjecten.** Elke ARSENAAL-entry krijgt een
  `presentatie: {}` en `audio: {}`, in dit ticket gevuld met verwijzingen naar
  de bestaande waarden. Consumenten zijn T140, T137 en T153.
- **D — de null-inventaris wordt testbaar.** Het bestaande ticket zegt
  "Inventariseer die lezers expliciet in de ticket-afronding". Leg de
  §13.3-lijst vast als commentaarblok bij `wapenStaat`, en voeg aan
  `tests/test-wapen-identiteit.mjs` een check toe die `wapenStaat = null` zet,
  één frame draait en verifieert dat er **geen** console-error valt.

**Acceptatie (aanvullend).**
- `inHandGroep` is nooit `null`/`undefined`, ook niet vóór de eerste frame.
- Grep bevestigt: geen enkele cosmetische wapen-write leest nog
  `wapenStaat.definitie.groep`.
- Met `wapenStaat = null` draait één frame zonder console-error.
- `spreadOpbouw`/`recoilFase` bestaan, staan op 0, en grep bevestigt nul lezers.
- Debug-hook exporteert `inHandGroep` en het ARSENAAL-model.

**Valkuil.** De verleiding is om nu ook al `drukspuit: null` te zetten. Niet
doen — dat blijft T134, en de bestaande T132-waarschuwing geldt onverkort.

**Uitgevoerd.** Alle vier toevoegingen zijn geland, gedragsneutraal: geen
enkele bestaande assertie is aangepast of versoepeld (ontwerpbeslissing 99).
`test-wapen-identiteit.mjs` ging van 16 naar 25 checks, allemaal nieuw.

Twee dingen die de uitvoering aan het licht bracht:

1. **De null-contract-test vond meteen een lezer die in de architectuur fout
   geclassificeerd stond.** `WINKEL_STIJLEN.smederij.status()` is via
   `updateWinkelMarkeringen()` een **per-frame** lezer van `wapenStaat`, niet
   "op aanroep" zoals §13.3 eerst zei. Hij is nu null-veilig (geeft `'nvt'`
   zonder wapen, dezelfde grijze weergave als de watertap bij volle HP);
   `smederijPunt.prompt()` kreeg dezelfde behandeling. §13.3 is gecorrigeerd,
   mét de les: bij een callback in een datatabel is "draait dit per frame?"
   niet af te lezen aan de definitieplek — zoek de aanroeper.
2. **`test-resources.mjs` was al kapot vóór dit ticket** (geverifieerd op de
   committed baseline met de gamecode gestasht). Apart gefixt vóór T133 — zie
   "Losse fix" hieronder. Het bleek een dood testscript, geen echt lek.

**Uitvoeringsadvies.** Opus 5 · xhigh · extended thinking On.
14-plekken-brede dereference-audit plus een hot-path-splitsing, volledig
gedragsneutraal, met een 2%-pixelvangrail eromheen — en fout gaan maakt twaalf
vervolgtickets ongeldig. *Escaleer naar Opus 5 Max* alleen wanneer de suite ná
de refactor rood blijft zonder aanwijsbare oorzaak: dan klopt de aanname
"gedragsneutraal" niet en is dát belangrijker dan het ticket. Review: Sonnet 5
High, na ticket (grep-audit). Vertrouwen in dit advies: hoog.

---

## Losse fix — `test-resources.mjs` was dood sinds Ticket 122

**Geen eigen ticket; gevonden én gefixt tijdens T132, vóór T133.**

`test-resources.mjs` crashte bij het opstarten en had dus **geen enkele van
zijn checks gedraaid**:

```
page.evaluate: TypeError: Cannot read properties of null (reading '__origDispose')
    at test-resources.mjs:41
```

**Oorzaak.** De test patcht `Material.prototype.dispose` om dispose-calls te
tellen, en kwam daar via twee vaste prototype-stappen vanaf
`proefOndode.delen.oogMateriaal`. Sinds **Ticket 122** (Zombie V2) is dat geen
`THREE.Material` meer maar een plat shim-object met alleen een
`emissiveIntensity`-setter naar de shader-uniform. Twee stappen vanaf een plat
object komen uit op `null` — script dood, vóór check 1.

**Waarom dit meer was dan een kapot script.** Dit is de enige test die
geheugenlekken bewaakt: geometrie-/materiaalgroei over 100 spawn/kill-cycli,
Brander-explosies, powerup-drops, DOM-node-groei, de T71/T72-write-tellers en
de 25-golven-stabiliteitsloop. Al die vangrails stonden een hele ronde uit.

**Fix.** Twee wijzigingen, allebei in het testscript — de gamecode was niet
kapot:
1. Haal een **echt** materiaal uit de mesh-tree (`traverse()` naar de eerste
   `isMesh` met `material.isMaterial`) in plaats van uit `delen`, zodat een
   shim daar dit nooit meer kan breken.
2. Zoek de prototype die `dispose` als **eigen property** heeft, in plaats van
   een vast aantal stappen te tellen.

Punt 2 is subtieler dan het lijkt, en de eerste fixpoging liep er zelf in.
De gemeten keten is:

```
MeshStandardMaterial.prototype   (geen eigen dispose)
Material.prototype               (eigen dispose)   <- doel
EventDispatcher.prototype        (geen eigen dispose)
Object.prototype
```

In three.js geldt `class Material extends EventDispatcher`. Zowel "twee
stappen omhoog" als "klim tot vlak vóór `Object.prototype`" landt dus
**ernaast**: die laatste komt op `EventDispatcher.prototype` uit, waar een
toegevoegde `dispose` door `Material.prototype.dispose` wordt geschaduwd. De
patch lijkt dan te werken maar telt stil 0 calls — precies het symptoom dat
één tussenversie liet zien.

**Uitkomst: 18 OK, 0 FAIL.** Alle asserties die sinds T122 stillagen slagen,
inclusief `Material.dispose()` met **101 calls** over 100 spawn/kill-cycli.
Het T69/T70-dispose-contract is dus intact — er was geen echt geheugenlek,
alleen een blinde vangrail.

**Les.** Een testscript dat crasht vóór zijn eerste `check()` telt in
`run-all.mjs` als één rood script tussen 82 groene, zonder één `[FAIL]`-regel.
Dat is makkelijk te lezen als ruis. Waard om bij een rode suite altijd te
controleren of het aantal gedraaide checks klopt, niet alleen het aantal
groene scripts.

### Twee flaky tests, gevonden bij dezelfde regressieronde — nu gefixt

Allebei **pre-existing** en niet door T132 veroorzaakt — bewezen door twee
volledige suite-runs op byte-identieke gamecode die verschillende scripts
rood gaven. Beide zijn inmiddels opgelost en geverifieerd met 10× herhaalde
volledige runs (0 FAIL) plus een schone `run-all.mjs` (83/83 groen).

**1. `test-camerabeweging.mjs`, sectie 7 — "reset-garantie".** De assertie
eist een EXACTE gelijkheid na `d.speler.positie.set(1.5, 0, -2.5);
d.updateSpeler(0);`. `updateSpeler()` roept sinds Fix 3 ook
`duwSpelerWegVanOndoden()` aan; staat er op dat moment een levende ondode
binnen `SPELER_ONDODE_BOTSING_STRAAL`, dan schuift de speler een fractie weg.
Of dat gebeurt hangt af van of het golfsysteem tijdens de vele rAF-waits
eerder in het script al zombies gespawnd heeft — niet deterministisch.
**Fix:** de ondoden vóór de check echt verwijderen. Eerste poging
(`d.ondoden.length = 0`) loste dít symptoom volledig op (30/30), maar bleek
zelf een nieuwe bug te introduceren (zie punt 3).

**2. `test-vijand-leesbaarheid.mjs` — grom-globale-cap.** Niet, zoals eerst
vermoed, `klok`-drift (`klok` blijft in dit testbestand altijd 0, want
`simuleerPointerLock` staat hier nooit aan). De echte oorzaak: de twee
testondoden staan op ~0,7 m van de speler, binnen `AANVAL_START_BEREIK`
(1,4 m), en krijgen van `spawnOndode()` een willekeurige
`aanvalVertraging` (0 – `AANVAL_START_JITTER` = 0,35 s). Rolt die ≤ dt
(0,05 s) — ~14,3% kans per ondode, dus ~2% kans dat het BEIDE overkomt —
dan start `updateOndoden()` in dezelfde tick een windup en `continue`t vóór
de grom-code (die verderop in de functie staat) ooit bereikt wordt. Bij
beide ondoden tegelijk: `tellerNa: 0` i.p.v. 1. **Fix:** `aanvalVertraging`
expliciet op 999 zetten voor de twee testondoden — dezelfde soort
determinisme-fix als `NEUTRALE_TRAITS` elders in de suite. 40/40 herhalingen
groen.

**3. Bijvangst: `d.ondoden.length = 0` is de VERKEERDE manier om ondoden uit
een test te verwijderen.** Ontdekt tijdens het verifiëren van fix 1: die
loste de reset-garantie-check op (30/30), maar de daaropvolgende sectie in
hetzelfde bestand ("Alle schoten raakten…", een realistische
schiet-integratietest) bleef daarna in ~10-20% van de runs falen met
`hpVoor === hpNa` — alle 20 schoten misten volledig.

Oorzaak: `.length = 0` leegt alleen de JS-trackingarray `ondoden`, niet de
Three.js-scènegraaf `ondodenGroep`. `schiet()`'s raycast doorloopt
`ondodenGroep` rechtstreeks (`raycaster.intersectObject(ondodenGroep, true)`)
— een "gecleared" zombie-mesh blijft daar gewoon fysiek staan en kan een
latere raycast blokkeren als hij tussen de camera en het echte testdoel
staat. De reset-garantie-check zelf raycast niet, dus die zag het probleem
niet — maar de scène bleef wél gecorrumpeerd voor de eropvolgende sectie.

**Definitieve fix, op beide plekken:** `for (const o of [...d.ondoden])
d.doodOndode(o);` in plaats van `.length = 0`. `doodOndode()` doet wél
`ondodenGroep.remove(ondode.groep)` — precies het bestaande patroon dat de
rest van de testsuite al gebruikt (`test-aanval-machine.mjs`,
`test-vliering.mjs`, `test-waypoint-navigatie.mjs`, …). Na deze correctie:
`test-camerabeweging.mjs` 10/10 volledige runs groen (was eerst 9/10 met de
array-only fix).

**Les.** Een array-veld op de debug-hook (`d.ondoden`) en de Three.js-
scènegraaf die het spiegelt (`ondodenGroep`) zijn twee aparte stukken staat
die met de hand synchroon gehouden moeten worden. Alleen `doodOndode()`
garandeert dat; direct aan de array knutselen in een test is een val die
zich pas toont in een LATERE sectie van hetzelfde bestand, niet in de sectie
waar de manipulatie plaatsvindt.

**Waarschijnlijke aanleiding dat ze aan het licht kwamen.** Met
`test-resources.mjs` gerepareerd draait dat script weer volledig (100
spawns, 30 explosies, 25 golven) in dezelfde gedeelde browser. Dat maakt de
suite merkbaar zwaarder, en timinggevoelige/RNG-gevoelige asserties elders
driften daardoor eerder naar het oppervlak. De flakes zaten er al langer; ze
werden nu pas zichtbaar.

---

### Ticket 140 — Wapenpresentatielaag: één eigenaar, benoemde onderdelen

**Doel.** Eén functie wordt eigenaar van álle cosmetische transform-writes op
het wapen-in-de-hand, en elk wapenmodel krijgt benoemde, adresseerbare
onderdelen. Gedragsneutraal: na dit ticket ziet en voelt het spel exact
hetzelfde.

**Werk.**
- `updateWapenPresentatie(dt)` — één functie, aangeroepen vanuit de bestaande
  cosmetische gameLoop-zone, die herlaad-dip, wisseldip, terugslag, sway en
  lean toepast als **optelling van offsets op één basispositie**. Eén write
  per property per frame. Bestaande decay-formules en amplitudes worden
  **letterlijk overgenomen**, niet hergetuned.
- De herlaad-dip verhuist uit `updateWapen()`; die functie houdt alleen nog de
  herlaadtimer en de munitie-overheveling.
- **Onderdelenconventie:** elk wapenmodel legt zijn onderdelen vast in
  `groep.userData.onderdelen` met semantische namen. `meterDrukspuit` en
  `tandwielRatelaar` verhuizen daarheen. Welke sleutels er minimaal in moeten,
  bepaalt T141 — houd de conventie hier open genoeg.
- `WAPEN_BASIS_X`/`WAPEN_BASIS_Y` verhuizen naar de ARSENAAL-`presentatie`-
  entry (uit T132 toevoeging C), met vandaag voor beide wapens dezelfde waarde.
- Het mes doet mee: `inHandGroep` kan de mes-Group zijn en krijgt dezelfde
  sway/lean.

**Buiten scope.** Nieuwe animaties (T142-T144). Nieuwe modelonderdelen bouwen
(T138/T139). Camera-effecten (`cameraKick`, bob, lean op de camera zelf).
`speler.pitch` blijft onaangeraakt.

**Acceptatie.**
- Grep bevestigt: precies één plek schrijft `inHandGroep.position.*` en
  `.rotation.*`.
- `test-wapen-identiteit.mjs`, `test-camerabeweging.mjs`,
  `test-mondingsvlam.mjs` groen zonder aangepaste asserties.
- `test-visuele-basislijn.mjs` blijft binnen de 2%-band op alle acht
  standpunten. **Verschuift hij, dan is de refactor niet gedragsneutraal en
  moet de oorzaak gevonden worden — niet de basislijn bijgewerkt.**
- Herladen tijdens sway/lean eindigt exact op `WAPEN_BASIS_Y`.
- `groep.userData.onderdelen` bestaat op beide wapens en het mes.
- Rustpositie komt uit ARSENAAL, niet uit een gedeelde module-constante.
- Nieuwe test: een geforceerd gelijktijdige herlaad-dip en wisseldip geeft een
  voorspelbare, gedocumenteerde uitkomst in plaats van een race.
- F3: p95 frametijd niet gestegen.
- Handmatige speeltest van vijf minuten (schieten, herladen, wisselen,
  strafen): er mag **niets** merkbaar veranderd zijn.

**Valkuil.** Het wapenmodel hangt op `(0.26, -0.22, -0.5)` aan de camera en
valt binnen het meetvenster van `pixelstats()`. Een sway-offset met `cos()` in
plaats van `sin()` staat in rust niet op 0 en verschuift de vliering-mediaan
met bijna 5% — dat is in dit project al gemeten; lees de toelichting bij de
bestaande sway-write vóór je 'm aanraakt. Tweede valkuil: `position.y` heeft
vandaag twee schrijvers die alleen niet botsen door
`if (wapenStaat.herladen) return;` in `wisselWapen()`. Die impliciete
invariant moet expliciet worden, niet stilzwijgend overgenomen.

**Uitvoeringsadvies.** Opus 5 · xhigh · extended thinking On.
Cross-cutting refactor van een per-frame hot path met vier bestaande
schrijvers, een niet-uitgesproken invariant ertussen en een pixelvangrail
eromheen — en de uitkomst bepaalt of T137-T144 zonder modelherbouw kunnen.
*Escaleer naar Opus 5 Max* alleen wanneer de basislijn verschuift en de
oorzaak na een serieuze xhigh-poging onduidelijk blijft. Review: Opus 5 High,
na ticket. Vertrouwen: hoog.

---

### Ticket 141 — Gunfeel-spec en meetbare basislijn

**Doel.** Vastleggen wat "precies en gecontroleerd" (AMSTEL-9) en "agressief
met oplopende straf" (Canal Ripper) **in getallen en curves** betekenen, meten
waar het spel vandaag staat, en vastleggen welke modelonderdelen moeten kunnen
bewegen. Dat laatste is de input voor T137.

**Werk.**
- **Meten** (headless, reproduceerbaar, als `tests/meet-gunfeel.mjs` in de
  stijl van de bestaande `meet-*.mjs`):
  - Time-to-kill per wapen per HP-trap (1/2/3/4), lichaam en kop, per
    Smederij-tier (0/1/2) — 2 × 4 × 2 × 3 = 48 cellen.
  - Effectieve schotcadans en magazijnduur.
  - Huidige spreidingskegel in graden (uit `spreadNdc` en de camera-FOV).
  - Recoil-hersteltijd tot binnen 5%.
- **Specificeren per wapen:** recoil impulse (eerste schot) en eventueel
  patroon; recovery-curve en -tijd; verdeling camera-recoil vs. model-recoil
  met amplitudes; first-shot accuracy; spread-opbouw per volgehouden schot en
  afbouwsnelheid; cadans en animatietiming.
- **De output die T137 consumeert:** welke `userData.onderdelen`-sleutels per
  wapen moeten bewegen, en waarvoor.

**Randvoorwaarden.** `speler.pitch` wordt nooit gemuteerd. De AMSTEL-9 houdt
`spreadNdc = 0` bij schot 1 — dat is zijn hele identiteit. `schiet()` loopt in
dezelfde tick vóór de cosmetische zone, dus geen recoil-effect mag de
raycast-oorsprong raken. De HP-trap blijft ongemoeid (ontwerpbeslissing 10).

**Buiten scope.** Implementatie. Dit ticket levert een document en een
meetscript, geen gameplaywijziging.

**Acceptatie.**
- TTK-tabel van 48 cellen gemeten en vastgelegd.
- Per wapen een spec met concrete getallen en curves voor elk punt hierboven.
- Lijst van animeerbare onderdelen per wapen, direct bruikbaar als T137-input.
- Expliciet vastgelegd waarin de twee wapens **meetbaar** verschillen.
- Meetscript herbruikbaar zodat T142/T143 hun eigen resultaat kunnen aftoetsen.
- Handmatige toets: beide wapens vijf minuten spelen met de meetwaarden erbij,
  om te controleren of de getallen overeenkomen met wat je voelt.

**Valkuil.** Een spec die alleen adjectieven bevat ("voelt zwaarder") maakt
T142/T143 onbouwbaar. Dwing getallen af.

**Uitvoeringsadvies.** Opus 5 · High · extended thinking On.
Puur decision complexity: wapenidentiteit vertalen naar curves en beoordelen
welke onderdelen bewegen. Bepaalt vier vervolgtickets (T142, T143, T144,
T137); het meetwerk zelf is triviaal, het oordeel niet. Geen escalatie
verwacht. Review: milestone M2 (achteraf, samen met het resultaat).
Vertrouwen: hoog.

---

### Ticket 142 — AMSTEL-9 behaviour: de precisie-identiteit

**Doel.** De AMSTEL-9 laten aanvoelen als precies, gecontroleerd en
doelbewust, met bevredigende headshots. Goed richten wordt beloond.

**Werk.**
- First-shot accuracy vastleggen als **contract** in plaats van als
  toevalligheid (bij `spreadNdc = 0` is die er al).
- Recoil impulse en recovery volgens de T141-curve, gesplitst over camera-kick
  en model-kick (`rotation.x` via de T140-laag).
- Cadans en animatietiming afstemmen op de recovery, zodat "zo snel mogelijk
  klikken" **meetbaar** minder oplevert dan wachten op het herstel — dat is
  wat skill-based betekent.
- Muzzle-feedback en reload-pacing per T141-spec.
- Headshot-feedback aanscherpen binnen de bestaande hitmarker-tiers.

**Buiten scope.** `speler.pitch` muteren (nooit). Nieuwe modelonderdelen
(T138). De Canal Ripper (T143). Schadewaarden of de HP-trap.

**Acceptatie.**
- Gemeten waarden binnen de T141-doelbanden, aangetoond met `meet-gunfeel.mjs`.
- `test-wapen-identiteit.mjs`'s "20 identieke raakpunten"-check blijft groen.
- `speler.pitch` ongemoeid na 20 schoten (bestaande check groen).
- Model-recoil is zichtbaar en keert exact terug naar de rustpositie.
- `test-smederij.mjs` groen — de Fix 5-explosie- en Doorboringtakken in
  `schiet()` blijven ongemoeid.
- Basislijn binnen band, of bijgewerkt mét gemeten onderbouwing.
- Handmatige toets: golf 5-10 met alleen de AMSTEL-9. Voelt een headshot als
  een beloning? Is snel klikken meetbaar slechter dan getimed vuren?
- Geen nieuwe allocaties in `schiet()` (hot-path-regel §7.9).

**Valkuil.** `schiet()` draagt sinds Fix 5 al drie vertakkingen. Extra logica
daar moet die takken letterlijk ongemoeid laten.

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On.
Requirements liggen na T141 vast — dit is execution. Maar het raakt `schiet()`
(drie bestaande takken), de nieuwe presentatielaag en een pixelvangrail.
*Escaleer naar Opus 5 High* wanneer de T141-doelwaarden in de praktijk niet
blijken te werken en er opnieuw een designoordeel nodig is. Review: milestone
M2. Vertrouwen: gemiddeld — herzien zodra T141 laat zien hoeveel er werkelijk
verandert.

---

### Ticket 143 — Canal Ripper behaviour: agressie met oplopende straf

**Doel.** Korte bursts blijven beheersbaar, volgehouden vuur wordt steeds
moeilijker. Handling die onmiskenbaar anders is dan de AMSTEL-9.

**Werk.**
- `spreadNdc` wordt de **basis**; `wapenStaat.spreadOpbouw` (gereserveerd in
  T132) telt per schot op en bouwt af met een eigen snelheid, per T141-curve.
- Sustained-fire recoil: de kick loopt op met `spreadOpbouw` in plaats van per
  schot constant te zijn.
- Burst recovery: een expliciete drempel waaronder de opbouw snel terugvalt,
  zodat korte bursts belonend blijven.
- Model movement: continue, ritmische beweging tijdens vuren, via de T140-laag.
- Penetration feedback: de Doorboring uit Fix 5 tier 2 mag hoorbaar/zichtbaar
  anders zijn dan een gewone treffer — vandaag is die alleen in schade merkbaar.
- Reload pacing per T141.

**Buiten scope.** `speler.pitch`. De AMSTEL-9. De Doorboring-**schade**
(Fix 5-waarden blijven). Nieuwe modelonderdelen.

**Acceptatie.**
- Spread bij schot 1 gelijk aan de vastgelegde basiswaarde; spread na een vol
  magazijn meetbaar groter, binnen de T141-band.
- Spread bouwt aantoonbaar af tijdens een vuurpauze.
- `test-wapen-identiteit.mjs`'s "Ratelaar geeft meer dan 1 unieke x-waarde"
  blijft groen.
- `test-smederij.mjs`'s Doorboring-tests groen.
- Meetbaar verschil in handling t.o.v. de AMSTEL-9, vastgelegd met
  `meet-gunfeel.mjs`.
- Handmatige toets: golf 8+ met alleen de Canal Ripper. Voelt een burst van
  4-5 schoten beheersbaar en een vol magazijn wild?

**Valkuil.** De Doorboring-lus in `schiet()` doet een tweede
`raycaster.intersectObject(wereld, true)`. Een gewijzigde spread verandert de
straal en dus die tweede raycast. `test-smederij.mjs` is hier al bekend
fragiel geweest (vaste spawn-traits, camera-pitch -0.3) — lees die toelichting
vóór je iets wijzigt.

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On.
Zelfde profiel als T142, plus een bekend fragiel raakvlak met de
Doorboringtests. *Escaleer naar Opus 5 High* bij een niet-verklaarbare
wisselwerking tussen progressive spread en de Doorboring-raycast. Review:
milestone M2. Vertrouwen: gemiddeld.

---

### Ticket 144 — Treffer-, kill- en headshotfeedback per wapen

**Doel.** Hit-, headshot- en killfeedback die per wapen anders leest, zodat de
identiteit ook in de terugkoppeling zit en niet alleen in de handling.

**Werk.** Differentieer per wapen **binnen de bestaande pools en tiers**:
muzzle-feedback, impact-karakter, hitmarker-timing, kill-burst. Hergebruikt
`HITMARKER_TIERS`/`HITMARKER_RANG`/`HITMARKER_SAMENVAL_VENSTER`,
`speelRaakTik`/`speelKopTik`/`speelKillKnak` met `pitchVariatie()`,
`spawnImpact`/`spawnRook`/`spawnTracer`, `KILL_BURST_AANTAL_GROOT/KLEIN`.

**Buiten scope.** Nieuwe effect-pools of -slots (`TRACER_MAX` 8, `IMPACT_MAX`
24, `ROOK_MAX` 8 blijven). Extra `PointLight`s. Audio-samples (T154).
Schadewaarden.

**Acceptatie.**
- `test-effecten-pool.mjs`, `test-inslagen-rijker.mjs`,
  `test-hitmarker-audio.mjs` groen.
- `test-resources.mjs` groen: geen geometrie-/materiaalgroei over 25 golven.
- Poolgroottes ongewijzigd; aantal lichten blijft 28.
- De twee wapens zijn blind aan hun trefferfeedback te onderscheiden — toets
  met de ogen dicht op het geluid, en met het geluid uit op het beeld.
- F3 tijdens een drukke golf: geen poolverzadiging.

**Valkuil.** De effect-pools zijn eindig en gedeeld. Een fellere kill-burst
per wapen kan de 24-slots `impactPool` sneller leegtrekken bij een
Brander-kettingreactie — `KILL_BURST_SAMENVAL_VENSTER` bestaat precies
daarvoor en moet blijven werken.

**Uitvoeringsadvies.** Sonnet 5 · High · extended thinking Default.
Visuele/audiopolish met een heldere spec en bestaande, goed getestte pools.
Geen escalatie verwacht. Review: milestone M2. Vertrouwen: hoog.

---

### Ticket 145 — Finale-ontwerp op de bestaande escape-flow

**Doel.** Vastleggen hoe de aankomende boot een climax van 20-45 seconden
wordt, **als uitbreiding van de bestaande machine** (ontwerpbeslissing 103) —
niet als nieuw encounter-systeem.

**Werk — de zes beslissingen die dit ticket moet nemen.**
1. **Wat doet `T`?** Aanbevolen richting: `T` (met €2500) start de
   **instapfase** in plaats van meteen te winnen. Dat hergebruikt het hele
   bestaande aankomst-/vertrekapparaat en voegt één state toe.
2. **Duur.** Aanbevolen ~30 s, met onderbouwing tegen de bestaande ritmes
   (`GOLF_RUST_TIJD` 8 s, `ONTSNAPPING_AANKONDIGING_DUUR` 5 s,
   `effectiefSpawnInterval()` 1,1 s, `effectiefMaxActief()` max 26).
3. **Faalgedrag.** Aanbevolen: geen aparte faalstaat — doodgaan is gewoon game
   over. Wél te beslissen: wat gebeurt er als de speler het instapgebied
   verlaat (timer doorlopen, pauzeren, of instap afbreken)?
4. **Escalatiebronnen.** Welke bestaande kanalen meelopen:
   `spelStaat.budget`-injectie, `scene.fog`, `OOG_INTENSITEIT_*`,
   `dreigingsGainNode`, `lampDipFactor`, `vignetFlits`, boothoornfrequentie.
5. **Objective-UI.** Hoe de resterende tijd getoond wordt, hergebruikend
   `#ontsnappingVensterUI` en `toonGolfBanner()`.
6. **Golfgrens.** Wat er gebeurt als de golf afloopt tijdens de instapfase —
   vandaag sluit de wave-complete-tak van `updateGolf()` het venster.

**Buiten scope.** Implementatie. Een generieke encounter-engine. Wijzigingen
aan het golf-/budgetsysteem zelf. Nieuwe vijandtypen.

**Acceptatie.**
- Elk van de zes beslissingen expliciet vastgelegd met onderbouwing.
- Aangetoond welke bestaande functies hergebruikt worden en welke nieuwe state
  er precies bijkomt (minimaal).
- Vooraf begroot: `interactiePunten`-invariant, aantal lichten, poolgebruik.
- Testimpact geïnventariseerd over `test-ontsnapping.mjs`,
  `test-ontsnapping-vensters.mjs`, `test-boot-aankondiging.mjs`,
  `test-vluchtroute.mjs`, `test-eventgolven.mjs`.
- Expliciet beantwoord waarom hier géén nieuwe encounter-engine nodig is.

**Valkuil.** Te veel willen. Bouw geen generieke encounter-engine als één
kleine uitbreiding volstaat — dat is de expliciete opdracht.

**Uitvoeringsadvies.** Opus 5 · High · extended thinking On.
Zes samenhangende ontwerpbeslissingen die de climax van het hele spel bepalen,
met over-engineering als grootste risico. Oordeelsvraag, geen
uitvoeringsvraag. Geen escalatie verwacht. Review: milestone M3 (achteraf, met
T146/T147). Vertrouwen: hoog.

---

### Ticket 146 — Instap-holdout: finale-state-machine en objective-UI

**Doel.** De state-machine en de UI van de finale, zonder escalatie. Na dit
ticket werkt de instapfase mechanisch: `T` start 'm, de timer loopt, hij
eindigt in winst, en de speler ziet in beeld wat er gebeurt.

**Werk.**
- De finale-state en -timer, in de stijl van de bestaande
  `ontsnappingAankondigingActief`/`-Timer` (spelActief-gated, dus pauzeerbaar).
- `probeerOntsnapping()` splitsen in "start instapfase" en "voltooi
  ontsnapping".
- Objective-UI met resterende tijd via `#ontsnappingVensterUI`.
- Het randgeval uit T145-beslissing 6 (golf eindigt tijdens de instapfase).
- Het gedrag uit T145-beslissing 3 (instapgebied verlaten).
- `toonWinScherm()` blijft ongewijzigd het eindpunt.

**Buiten scope.** Escalatie (T147). Nieuwe geluiden — gebruik hier de
bestaande `piep()`-geluiden.

**Acceptatie.**
- `T` met €2500 start de instapfase; geld wordt op het juiste, gedocumenteerde
  moment afgeschreven.
- Timer loopt alleen tijdens `spelActief` (pauze werkt).
- Fase eindigt in `toonWinScherm()` met ongewijzigde score- en statsberekening.
- Doodgaan tijdens de fase geeft normale game over.
- Golf-einde tijdens de fase gedraagt zich zoals T145 vastlegde.
- Nieuw `tests/test-finale.mjs`; `test-ontsnapping.mjs`,
  `test-ontsnapping-vensters.mjs`, `test-boot-aankondiging.mjs`,
  `test-vluchtroute.mjs` groen (bijgewerkt waar het gedrag bewust wijzigt).
- `interactiePunten`-invariant bijgewerkt mét onderbouwing als hij wijzigt.
- Handmatige toets: volledige run tot golf 10 met 3/3 en €2500. Is duidelijk
  wat er gebeurt en hoeveel tijd er nog is?

**Valkuil.** De wave-complete-tak van `updateGolf()` sluit vandaag het venster.
Een instapfase die over een golfgrens heen loopt raakt precies die code.
`test-ontsnapping-vensters.mjs` (432 regels) is de vangrail — lees 'm vóór je
begint.

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On.
Nieuwe state-machine die aanhaakt op golf-, boot-, HUD- en win-logica
tegelijk, met randgevallen rond golfgrenzen. Requirements liggen na T145 vast.
*Escaleer naar Opus 5 xhigh* wanneer de interactie met de wave-complete-tak
conflicten oplevert die niet lokaal op te lossen zijn. Review: Sonnet 5 High,
na ticket. Vertrouwen: hoog.

---

### Ticket 147 — Finale-escalatie en vertrek

**Doel.** De instapfase van T146 laten oplopen tot een climax: meer druk, meer
geluid, meer beeld, en een vertrek dat als een ontsnapping voelt.

**Werk.**
- Budget-injectie voor de finale-surge, via het bestaande spawnpad
  (`spelStaat.budget` + `golfSpawnStap()`) — **geen** nieuw spawnsysteem.
- Audio-escalatie via de bestaande dreigingslaag en boothoorn.
- VFX-escalatie via de bestaande fog-, oog-, vignet- en lampkanalen.
- De laatste kritieke seconden als expliciet herkenbaar moment.
- Vertrek via het bestaande `updateBootPositie()`-uitvaarpad.

**Buiten scope.** Nieuwe vijandtypen. Nieuwe effect-pools of lichten. Nieuwe
audio-**assets** (T154). Permanente wijzigingen aan het golfsysteem.

**Acceptatie.**
- Spawn-surge loopt volledig via `golfSpawnStap()`/`spelStaat.budget`; grep
  bevestigt nul nieuwe spawnpaden.
- `ondoden.length` overschrijdt nooit `effectiefMaxActief()`.
- Aantal lichten blijft 28; poolgroottes ongewijzigd.
- **Alle escalatiekanalen keren na afloop exact terug naar hun rustwaarde**
  (fog, ogen, dreigingsgain, `lampDipFactor`, vignet) — ook bij game over
  midden in de fase.
- `test-resources.mjs` groen; `test-finale.mjs` uitgebreid met escalatie- én
  herstelasserties.
- F3 tijdens de piek: p95 binnen het bestaande budget, vastgelegd in het ticket.
- Handmatige toets: drie volledige finales. Bouwt de spanning op, en is het
  einde een opluchting?

**Valkuil.** Escalatiekanalen die niet herstellen. `scene.fog` heeft dit
precedent al: de Mistgolf moest een expliciete restore in `gameOver()` krijgen
omdat het death-scherm anders in de mist hing (§1). Elk kanaal dat dit ticket
aanraakt heeft datzelfde probleem, op élk exitpad.

**Uitvoeringsadvies.** Sonnet 5 · High · extended thinking On.
Uitbreiding op bestaande, goed gedocumenteerde kanalen met een duidelijke spec
uit T145; het risico (herstelpaden) is bekend en heeft een precedent om te
volgen. *Escaleer naar Sonnet 5 xhigh* wanneer meer dan drie kanalen tegelijk
op meerdere exitpaden moeten herstellen. Review: Sonnet 5 High, milestone M3.
Vertrouwen: hoog.

---

### Ticket 148 — Locomotion-kwaliteit: gewichtsoverdracht en voetslip

**Doel.** Ondoden laten lopen alsof ze gewicht hebben: minder voetslip,
zichtbare gewichtsoverdracht, meer torso-beweging.

**Werk.**
- **Voetslip dichten.** `loopFase` loopt op tijd, de root beweegt op afstand;
  die twee zijn niet gekoppeld, dus voetslip is structureel. Koppel `loopFase`
  aan werkelijk afgelegde afstand — exact zoals `bobFase` bij de speler al
  doet. Grootste kwaliteitswinst per regel code in dit ticket, en het lost
  meteen op dat een geblokkeerde ondode ter plekke doorloopt.
- **Gewichtsoverdracht.** Lichte zijwaartse verschuiving van pelvis naar het
  steunbeen, in fase met de bestaande `faseL`. Hergebruikt de bestaande
  pelvis-write.
- **Torso-beweging** verder uitwerken op de bestaande `chest`-sway.

**Buiten scope.** `AnimationMixer` of keyframes — de procedurele architectuur
blijft (ontwerpbeslissing 104). Nieuwe botten. Aanvals- en flinchstaten
(T149). Het transform-budget verhogen.

**Acceptatie.**
- Transform-writes per ondode per frame blijven **≤ 10**, geteld en vastgelegd.
- Een tegen een muur geblokkeerde ondode beweegt zijn benen niet of nauwelijks.
- Gemeten voetslip (voetpositie t.o.v. grondverplaatsing) meetbaar kleiner dan
  de nulmeting.
- `test-ondode-animatie.mjs` en `test-ondode-model-v2.mjs` groen, uitgebreid
  met de loopFase-koppeling en de write-telling.
- F3 met 26 actieve ondoden: p95 ongewijzigd.
- Alle vijf typen (normaal/loper/sjouwer/brander/sluiper) blijven herkenbaar.

**Valkuil.** `loopFase` voedt óók de arm-, hoofd-, knie-, elleboog- en
bob-writes. Hem anders voeden verandert het ritme van alles tegelijk;
`gang.pasFactor` per type moet daarna nog steeds het bedoelde verschil geven.
`test-vijand-leesbaarheid.mjs` is de vangrail.

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On.
Eén wijziging (de loopFase-bron) plant door in acht afgeleide writes en vijf
vijandtypen, met een hard writes-budget. Veel regressieoppervlak, maar de
aanpak is bekend (het speler-`bobFase`-patroon bestaat al). *Escaleer naar
Opus 5 High* wanneer de afstandskoppeling het per-type gang-ritme onherkenbaar
maakt. Review: geen apart moment — automatische tests + F3. Vertrouwen: hoog.

---

### Ticket 149 — Gevecht-leesbaarheid: anticipatie, impact, hitreacties

**Doel.** De aanvals- en trefferstaten leesbaarder en zwaarder maken:
duidelijkere anticipatie, hardere impact, betere hitreacties, herkenbare
headshot-reacties en overtuigender neervallen.

**Werk.** Anticipatie in de windup (aanloop naar de arm-heffing in plaats van
lineair), zwaardere impact op het slagmoment, duidelijker herstel, kop- versus
lichaamsflinch sterker onderscheiden, meer variatie in de valstijlen.

**Buiten scope — hard.** De **timings** van de state-machine
(`AANVAL_PROFIELEN`: windup/herstel per type) zijn getuned en geborgd door
`test-aanval-machine.mjs`. Dit ticket verandert alleen de presentatie *binnen*
bestaande timings. Ook buiten scope: schade, bereik, raakhoek, `MAX_AANVALLERS`.

**Acceptatie.**
- Alle timings uit `AANVAL_PROFIELEN` ongewijzigd; `test-aanval-machine.mjs`
  groen zonder aangepaste asserties.
- `test-aanval-tells.mjs`, `test-ondode-hitreacties.mjs`,
  `test-ondode-doodsanimaties.mjs`, `test-vijand-leesbaarheid.mjs` groen.
- Oogintensiteit keert exact terug op `ondode.oogBasisIntensiteit` (bestaand
  randgeval).
- Transform-budget ≤ 10 per ondode per frame gehandhaafd.
- Kop- en lichaamstreffer zijn zonder HUD van elkaar te onderscheiden — toets
  met een golf alleen op lichamen en een golf alleen op koppen.
- F3 met volle kaart tijdens meerdere gelijktijdige windups.

**Valkuil.** `test-ondode-hitreacties.mjs` is 418 regels en bekend gevoelig
(de knockback-tegen-een-muur-tests gebruiken een synthetische speler op 0,1 m).
De flinch-code heeft recent al een `if (!ondode.flinch)`-guard nodig gehad om
niet met de nadering-klem te vechten. Lees die toelichting in `updateOndoden()`
vóór je de flinch aanraakt.

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On.
Raakt de aanvals-state-machine en de flinch-code — allebei gebieden met een
geschiedenis van subtiele interacties en de grootste testsuite van het
project. Duidelijke spec, dus geen Opus, maar de hoogste zorgvuldigheid.
*Escaleer naar Opus 5 xhigh* wanneer de flinch opnieuw met de nadering-klem of
de knockback-muurklaring blijkt te interfereren. Review: Sonnet 5 High, na
ticket. Vertrouwen: hoog.

---

### Ticket 150 — Type-persoonlijkheid via ONDODE_TYPES

**Doel.** De vijf typen sterker van elkaar onderscheiden — puur via parameters
in de bestaande tabel, zonder per type een eigen animatiesysteem
(ontwerpbeslissing 104).

**Werk.** De `gang`-parameterset uitbreiden met wat T148/T149 hebben
toegevoegd (gewichtsoverdracht-amplitude, anticipatie-curve,
flinch-gevoeligheid) en per type invullen. De Sluiper blijft stil — stilte is
zíjn tell.

**Buiten scope.** Nieuwe vijandtypen. Gameplaywaarden (snelheid, HP, geld,
`hpMax`). `ondodeTypeGewichten()` en de introductiegolven.

**Acceptatie.**
- Elk type is aan zijn beweging herkenbaar zonder kleur of grootte te zien.
- Nul nieuwe animatiecodepaden — grep bevestigt dat de verschillen uit
  `ONDODE_TYPES` komen.
- Alle gameplaymultipliers ongewijzigd.
- `test-varianten.mjs`, `test-ondode-vormen.mjs`,
  `test-golf-variatielimiter.mjs` groen.
- Transform-budget ≤ 10 gehandhaafd.

**Valkuil.** `spawnOndode()` spawnt standaard `'normaal'` voor tests en
debug-tools — dat contract niet breken (§1 waarschuwt hier expliciet voor).

**Uitvoeringsadvies.** Sonnet 5 · High · extended thinking Default.
Data invullen in een bestaande, goed begrepen tabel, met de mechaniek al
gebouwd in T148/T149. Geen escalatie verwacht. Review: alleen automatische
tests. Vertrouwen: hoog.

---

### Ticket 151 — Wereldmateriaal-pas: vocht, slijtage, schade

**Doel.** De Amsterdamse grachtenpand-identiteit versterken in de materialen:
natte oppervlakken, slijtage, vuil en schade — binnen de bestaande texturenset.

**Positie.** Bewust **vrij plaatsbaar**: dit ticket heeft geen dependencies en
raakt geen ander ticket in deze ronde. Schuif 'm naar voren wanneer er na twee
zware technische tickets iets zichtbaars nodig is.

**Werk.**
- **De `pleister`-familie daadwerkelijk uitrollen.** Die is in T107 gebouwd
  maar wordt nergens aangeroepen — de `GANG_PLEISTER`-muren zijn de beoogde
  afnemer. Goedkoopste zichtbare winst in dit ticket, want de tekenaar bestaat
  al.
- Vocht-, slijtage- en schadevariatie binnen de bestaande tekenaars
  (`CANVAS_TEXTUUR_TEKENAARS`, `bakDecorVuil()` + `VUIL_*`).

**Buiten scope.** Nieuwe fullscreen shaders. Nieuwe realtime lichten (blijft
28). Nieuwe materiaalfamilies zonder aantoonbare noodzaak. Wapenmaterialen
(die horen uitsluitend in T138/T139 — rework-trap 5).

**Acceptatie.**
- Aantal unieke materialen groeit met een vooraf begroot, klein aantal;
  `test-resources.mjs` groen.
- Draw calls binnen de 25%-RENDER_BAND; aantal lichten blijft 28.
- `test-visuele-basislijn.mjs` bijgewerkt mét gemeten onderbouwing per
  verschoven zone.
- `test-materiaal-families.mjs`, `test-texturenset.mjs`,
  `test-normal-maps.mjs`, `test-vuil-slijtage.mjs` groen.
- Handmatige toets: alle acht standpunten aflopen. Leest het als een oud,
  vochtig Amsterdams pand?

**Valkuil.** Materiaalwijzigingen raken de helderheidsbasislijn direct — T107
verschoof vijf van de acht standpunten. Verwacht basislijnwerk en begroot het
vooraf.

**Uitvoeringsadvies.** Sonnet 5 · High · extended thinking Default.
Visuele polish op een bestaande, data-driven materiaallaag met duidelijke
budgetten en een bestaande meetprocedure. *Escaleer naar Sonnet 5 xhigh*
wanneer meer dan vier standpunten buiten de band vallen — dan is de ingreep
groter dan bedoeld. Review: automatische tests + basislijn. Vertrouwen: hoog.

---

### Ticket 152 — Audio-audit, classificatie en de assetregel-beslissing

**Doel.** Elk bestaand geluid classificeren als **SYNTH KEEP** / **SAMPLE** /
**HYBRID**, en de projectregelvraag beantwoorden die daaronder ligt
(ontwerpbeslissing 105).

**Positie.** Bij voorkeur ná T147, zodat de finale-audio al bestaat en
meegeclassificeerd kan worden (rework-trap 6).

**Werk.**
1. **Inventaris** van elk geluid met aanroeppad, frequentie, en of er een
   testteller aan hangt.
2. **Classificatie** per geluid, met reden. Uitgangspunt: de procedurele stijl
   is een bewuste keuze, geen tekortkoming — de bewijslast ligt bij "dit móét
   een sample worden".
3. **De assetbeslissing, met gemeten getallen.** Meet de werkelijke
   base64-omvang van een representatief sample in OGG en MP3 op enkele
   bitrates; zet die af tegen de huidige bestandsgrootte (~785 KB) en de
   laadtijd. Formuleer de keuze expliciet als **projectregelwijziging die de
   eigenaar moet goedkeuren**, met minstens twee alternatieven ernaast (alles
   procedureel houden; alleen de hoogste-impact geluiden samplen; hybride).
4. **Architectuurbehoefte bepalen, niet bouwen:** welke van registry, preload,
   categorie-gains, concurrency, voice-limits, variants, pitch-variatie,
   positional audio, fallback en autoplay-afhandeling werkelijk nodig zijn —
   en expliciet welke **niet**.

**Buiten scope.** Elke implementatie. Dit ticket levert een document en een
meting.

**Acceptatie.**
- Elk bestaand geluid geclassificeerd met onderbouwing.
- Gemeten bestandsgroottes voor minstens twee codecs en twee bitrates.
- De projectregelvraag expliciet gesteld, met aanbeveling en alternatieven.
- Lijst van benodigde audio-architectuuronderdelen, elk met reden — en
  expliciet welke niet nodig zijn.
- Alle 13 testtellers geïnventariseerd met hun testbestand.

**Valkuil.** Een classificatie die te makkelijk "SAMPLE" zegt en daarmee een
projectregel omver duwt voor marginale winst. Over-engineering van de
architectuurlijst is de tweede valkuil — de opdracht waarschuwt daar expliciet
voor.

**Uitvoeringsadvies.** Opus 5 · High · extended thinking On.
De kernvraag is een projectregelbeslissing met een
kwaliteits-versus-omvang-afweging, plus een classificatie waarbij de
verleiding groot is om de bestaande, bewuste stijl weg te gooien. Puur
oordeelswerk. *Geen escalatie* — leg de regelvraag bij de eigenaar neer in
plaats van te escaleren. Review: milestone M4 (achteraf). Vertrouwen: hoog.

---

### Ticket 153 — Audioregistry: data-driven en gedragsneutraal

**Doel.** De ~40 `speel*()`-functies achter één data-driven `GELUIDEN`-tabel
en één `speelGeluid(naam, opties)` brengen, **zonder één hoorbaar verschil**
en zonder één testteller te breken.

**Werk.**
- `GELUIDEN`-tabel: per geluid type, frequenties, duur, volume, categorie, en
  optioneel de vervolgtoon die nu via `setTimeout` gaat.
- `speelGeluid(naam, opties)` met optionele `pan` en pitch-variatie.
- Categorie-gains **alleen** als T152 die nodig achtte.
- De bestaande `speel*()`-functies blijven als dunne wrappers bestaan,
  inclusief hun tellers — dat houdt de hele testsuite ongewijzigd geldig.
- De eigen ketens (dreigingslaag, achtergrondmuziek, `speelBootHoornGericht`)
  blijven buiten de tabel tenzij T152 anders concludeerde; ze hebben eigen
  levenscyclus-eisen.

**Buiten scope.** Samples laden. Nieuwe geluiden. De mix veranderen.

**Acceptatie.**
- Alle 13 testtellers tellen exact zoals voorheen; alle audiotests groen
  zonder aangepaste asserties. **Dat ís de acceptatie.**
- `test-geluidsknop.mjs` groen — die rekent op de kale keten
  `osc → gain → masterGainNode` bij `pan === 0`; die vorm moet blijven.
- Elk `piep()`-argument uit de oude functies is één-op-één terug te vinden in
  `GELUIDEN` (diff-audit oud vs. nieuw).
- Geen nieuwe per-frame audio-writes; `dreigingsGainSchrijfTeller` ongewijzigd.
- Audio-node-churn per seconde niet gestegen.
- Handmatige toets: vijf minuten spelen met geluid aan. Er mag niets anders
  klinken.

**Valkuil.** De `setTimeout`-vervolgtonen (`speelExplosie`, `speelGolfStart`,
`speelGolfKlaar`, `speelGameOver`, `speelGrachtklok`, `speelStroomklap`) lopen
door tijdens pauze en zijn in dit project al eerder een bug geweest
(`speelHerlaad` moest daarom in T33 gesplitst worden). De registry moet dat
gedrag exact reproduceren óf het bewust en gedocumenteerd verbeteren.

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On.
Mechanische migratie van 40 functies met 13 tellers als hard contract en zes
bekende `setTimeout`-valkuilen. Execution complexity, geen ontwerpvragen —
maar één gemist argument is een stil hoorbaar verschil dat geen test vangt.
*Escaleer naar Opus 5 High* wanneer T152 concludeerde dat voice-limits of
concurrency-beheer nodig zijn: dan verandert de registry van een tabel in een
resource-manager. Review: Sonnet 5 High, na ticket. Vertrouwen: gemiddeld —
hangt volledig af van T152's uitkomst.

---

### Ticket 154 — Audio-uitrol volgens de T152-classificatie

**Doel.** De geluiden die T152 als SAMPLE of HYBRID classificeerde
daadwerkelijk vervangen of verrijken, en de SYNTH KEEP-geluiden waar nodig
bijstellen.

**Werk.** Volledig bepaald door T152. Concludeerde T152 "alles blijft
procedureel", dan is dit ticket een **kwaliteitspas op de bestaande
synth-geluiden** (wapens, ondoden, omgeving, feedback/objectives) in plaats
van een integratieticket — en dat is een volwaardige, legitieme uitkomst.

**Buiten scope.** De classificatie zelf herzien. Architectuur bouwen die T152
niet nodig achtte.

**Acceptatie.**
- Elke wijziging is te herleiden tot een T152-classificatieregel.
- Alle 13 testtellers intact; volledige audiosuite groen.
- Bestandsgrootte en laadtijd binnen de in T152 vastgelegde grenzen, gemeten
  vóór/ná.
- De geluidsknop dempt alles, inclusief het nieuwe materiaal.
- Handmatige toets: volledige run met koptelefoon. Klinkt het als één
  samenhangende mix, niet als twee stijlen naast elkaar?

**Valkuil.** Mixbalans. De volumes in dit project zijn stuk voor stuk met de
hand afgesteld (er staan letterlijk feedbackpercentages in het commentaar,
bv. "+15%" bij de druppeltik). Nieuw materiaal ertussen zetten verschuift de
hele balans.

**Dependency.** T152, T153. **En, als T152 een regelwijziging voorstelt:
expliciete goedkeuring van de eigenaar vóórdat dit ticket begint.**

**Uitvoeringsadvies.** Sonnet 5 · High · extended thinking Default.
Assetintegratie of tuning met een dichtgetimmerde spec uit T152 en een
bestaande registry uit T153. *Escaleer naar Sonnet 5 xhigh* wanneer de
mixbalans niet met losse volumecorrecties te herstellen blijkt. Review:
Opus 5 High, milestone M4 (een mix hoort als geheel beoordeeld te worden).
Vertrouwen: **laag** — de scope is pas bekend na T152 en kan van "integratie"
naar "tuning" verschuiven. Herzie dit advies dan.

---

### Ticket 155 — ARSENAAL-consolidatie en het wapenregressiepakket

**Doel.** De ARSENAAL-tabel afmaken nu bekend is wat er definitief in moet, en
het wapensysteem afsluiten met één samenhangend regressiepakket.

**Positie.** Bewust laatst (rework-trap 6). Na T144, T139 en T153 is pas
duidelijk welke velden een wapen echt heeft: gameplay, presentatie,
tier-visuals, audio, gunfeel-curves.

**Werk.**
- Alle wapengegevens die nog los rondslingeren naar ARSENAAL brengen.
- Grep-audit: nul overgebleven wapennaam-vergelijkingen buiten de tabel. De
  Fix 5-takken in `schiet()` (`actiefWapenNaam === 'drukspuit'` voor de
  explosie, `=== 'ratelaar'` voor de Doorboring) zijn de meest concrete
  kandidaten om data-driven te maken.
- Eén `tests/test-arsenaal.mjs` dat het volledige contract per wapen vastlegt.
- Debug-hook opschonen volgens de projectregel: elk verwijderd systeem wordt
  daar ook opgeruimd.

**Buiten scope.** Gedragsverandering. Balanswijzigingen. Nieuwe wapens.

**Acceptatie.**
- Volledige suite groen zonder één aangepaste assertie. **Dat is de enige
  slaagvoorwaarde.**
- Grep bevestigt: nul wapennaam-vergelijkingen buiten ARSENAAL en
  `wisselWapen()`.
- `test-arsenaal.mjs` dekt per wapen: gameplay, presentatie, tiers, audio,
  gunfeel.
- `test-visuele-basislijn.mjs` binnen band (gedragsneutraal).
- Debug-hook bevat geen dode wapenexports meer.

**Valkuil.** Scope creep. "Nu we toch bezig zijn" is hier de vijand.

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On.
Brede maar mechanische consolidatie met een objectieve slaagvoorwaarde; zelfde
profiel als T132's kern, maar met de ontwerpvragen al beantwoord. *Escaleer
naar Opus 5 xhigh* wanneer de Fix 5-vertakkingen in `schiet()` niet
data-driven te maken blijken zonder gedragsverandering. Review: Sonnet 5 High,
na ticket. Vertrouwen: gemiddeld — de scope hangt af van wat T137-T144
achterlaten.

---

# Ronde 12 (v0.26) — Leesbaarheid, sporen en economie

Herkomst: de ontwerpsessie ná de performance-audit van Ronde 11 (zie
`PERFORMANCE_AUDIT.md`). Volledige ticketbeschrijvingen staan in
`ROADMAP.md` onder "v0.26 — Ronde 12"; hieronder staat alleen wat een
uitvoerder nodig heeft.

Deze ronde is **niet** de voortzetting van een architectuurlijn. Het zijn
drie losse, onafhankelijke tickets die elk een gat dichten dat `IDEEEN.md`
niet dekt. Er is geen verplichte volgorde en er is geen milestone: elk
ticket is los af te ronden en los te laten vallen.

```
T159 (kwaliteitsinstelling) — geen afhankelijkheden, maar DEBLOKKEERT A3/A4 en T157
T156 (leesbaarheid)         — onafhankelijk
T157 (inslagsporen)         — onafhankelijk, bij voorkeur ná T159
T158 (economie)             — onafhankelijk, deel A en B apart uitvoerbaar
```

T159 staat vooraan omdat het de enige is die iets ontgrendelt: de
auditbevindingen A3 (zone-lichtculling) en A4 (schaduw-throttling) zijn
in Ronde 11 bewust niet uitgevoerd omdat ze de zwaar getunede belichting
raken, en T159 geeft ze een preset waarin dat expliciet toegestaan is.
Wie T159 overslaat, houdt A3 en A4 permanent geblokkeerd.

---

### Ticket 159 — Kwaliteitsinstelling (Laag / Normaal / Hoog)

**Doel.** De speler laten kiezen tussen beeldkwaliteit en soepelheid, en
daarmee een thuis geven aan de auditbevindingen die niet op één vaste
waarde te beslissen zijn.

**Positie.** Eerst van deze ronde. Deblokkeert A3, A4 en (bij voorkeur)
T157.

**Werk.**
- Drie presets in het bestaande instellingen-overlay, naast
  `gevoeligheidSlider`. Verdeling:

  | | Laag | **Normaal (default)** | Hoog |
  | --- | --- | --- | --- |
  | Pixelratio-plafond (A8) | 1 | **2** | 2 |
  | Bloom | uit | **aan** | aan |
  | Schaduwen | uit | **aan** | aan |
  | Lichtculling (A3) | aan | **uit** | uit |
  | MSAA op composer-target (A2 optie B) | uit | **uit** | aan |

- Opslag volgens het `leesGevoeligheid()`-patroon (T74/T75):
  vormvalidatie, onbekende waarden negeren, veilige default Normaal,
  alles in try/catch.
- A3 hoeft **niet** in dit ticket geïmplementeerd te worden — de preset
  mag de vlag aanvankelijk als no-op dragen. Wat dit ticket levert is de
  plek waar A3 mag bestaan.
- **A4 (schaduw-throttling) hoort niet in dit schema.** Op Laag staan de
  schaduwen al volledig uit, dus valt er niets te throttlen; schaduwen-uit
  domineert throttling volledig. A4 blijft open in
  `PERFORMANCE_AUDIT.md`, maar wordt pas relevant bij een eventuele
  vierde, tussenliggende preset — of als losse optimalisatie op Normaal,
  en dan onder de oorspronkelijke voorwaarde: eerst meten op echte
  hardware.

**Buiten scope.** Automatische hardware-detectie (precies de gok die de
audit niet kon maken). Losse schakelaars per effect. De
toegankelijkheidsschakelaars uit **T115** (camerawieg, filmkorrel) — die
blijven een aparte groep met een eigen reden van bestaan, en T115's regel
"geen derde schakelaar omdat het kan" geldt daar onverkort. Kwaliteit en
toegankelijkheid mogen in de UI niet door elkaar lopen.

**Acceptatie.**
- Op **Normaal** is elk T88-standpunt gelijk aan de huidige basislijn
  binnen de bestaande marge, en zijn de `renderer.info`-tellingen
  ongewijzigd. Dit is de kernvoorwaarde.
- Op **Laag** is de drawingBuffer-resolutie aantoonbaar lager en het
  aantal actieve lichten aantoonbaar kleiner.
- De ogen van ondoden blijven op Laag leesbaar tijdens een Stroomuitval,
  gemeten als luminantiecontrast tussen oog en achtergrond.
- De keuze overleeft een herstart; corrupte opslag valt terug op Normaal.
- Wisselen tussen presets lekt geen geometrie/textuur.
- `test-visuele-basislijn.mjs` draait expliciet op Normaal.

**Valkuil.** **Een kwaliteitsinstelling mag het spel nooit moeilijker
maken.** Bloom uitzetten op Laag raakt precies de gloeiende ogen — en
tijdens een Stroomuitval zijn die het enige waarop de speler een ondode
kan zien aankomen. Zonder compensatie (bijvoorbeeld een hogere
emissive-intensiteit op Laag) koopt de speler soepelheid met
oneerlijkheid. Dat is de reden dat dit ticket een speeltoets nodig heeft
en niet alleen een groen vinkje.

Tweede valkuil: `samples` is een constructie-optie van de rendertarget,
geen schakelaar. De MSAA-wissel vereist het opnieuw opbouwen van de
composer-target inclusief `dispose()` van de oude (T70-contract), of
anders een expliciete herstart.

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On. De
instelling, opslag en Normaal-pariteit zijn mechanisch en objectief
toetsbaar; het raakwerk zit in de rendertarget-herbouw en in de
preset-aware basislijntests. *Escaleer naar Opus 5 xhigh* wanneer de
Normaal-pariteit niet exact te halen blijkt — dan zit er een verborgen
afhankelijkheid tussen de renderconfiguratie en de T88-kalibratie die
eerst begrepen moet worden. Review: automatische tests **plus** een
speeltoets door de eigenaar op Laag, met name tijdens een Stroomuitval.
Vertrouwen: hoog voor de infrastructuur, gemiddeld voor de inhoud van
Laag.

---

### Ticket 156 — De Brander leesbaar zonder kleur ✅ uitgevoerd (v0.26)

**Doel.** De Brander herkenbaar maken via een kanaal dat niet op
kleurwaarneming leunt.

**Positie.** Vrij. Geen afhankelijkheden — `delen.kern` en
`KERNPULS_SCHAAL_BONUS` bestaan al sinds T21.

**Werk.**
- De bestaande kernpuls (nu alleen actief bij flinch) uitbreiden naar een
  permanente, zachte rustpuls op de Brander.
- Rustpuls en flinchpuls samenstellen tot **één** schrijfplek naar
  `delen.kern.scale` — geen tweede, concurrerende schrijver.
- Test schrijven vóór de implementatie: de grijswaarden-assertie is het
  hele bewijs van dit ticket.

**Buiten scope.** De kleuren zelf (T88/T89-kalibratie). De schaal van de
Brander (raakt hitboxen). Een volledige kleurenblind-modus. Nieuwe meshes.

**Acceptatie.**
- In **grijswaarden** varieert de luminantie in de borstregio van een
  Brander over de tijd, terwijl die bij een normale ondode vlak blijft —
  op dezelfde afstand, in zowel de normale stand als tijdens een
  Stroomuitval.
- De flinchpuls blijft zichtbaar en onderscheidbaar van de rustpuls.
- `schaal`, hitboxen, schade en explosieradius exact ongewijzigd;
  `test-vijand-leesbaarheid.mjs` en `test-aanval-tells.mjs` groen.
- Draw calls per ondode ongewijzigd; geen nieuwe allocatie in
  `updateOndoden()`.

**Valkuil.** Twee schrijvers naar `delen.kern.scale`. Als de rustpuls en
de flinchpuls elkaar overschrijven, verdwijnt de treffer-feedback — en dat
merk je pas in een speelsessie, niet in een assertie.

**Uitvoeringsadvies.** Sonnet 5 · High · extended thinking Default.
Kleine, goed afgebakende ingreep op bestaande infrastructuur met een
objectieve slaagvoorwaarde. *Escaleer naar Sonnet 5 xhigh* wanneer de
grijswaarden-assertie niet stabiel te krijgen is zonder de puls zo sterk
te maken dat hij de emissie-hiërarchie (§10.5) doorbreekt. Review:
automatische tests. Vertrouwen: hoog.

**Nawoord.** De grijswaarden-assertie bleek inderdaad het lastigste deel,
maar om een andere reden dan voorzien: niet de emissie-hiërarchie, maar
CONTAMINATIE door bestaande animatiesystemen. `ondode.loopFase` loopt op
werkelijk afgelegde afstand binnen één `updateOndoden()`-aanroep (T148),
niet op tijd — een testopstelling die de ondode gewoon laat lopen (of
zelfs teleporteert-en-terugzet) zwaait dus armen door de gemeten crop-
regio, een confound die 80-100% schijnverschil gaf vóórdat de oorzaak
gevonden was. Fix: `ondode.snelheid = 0` tijdens de meting. Zie de lange
toelichting bovenaan `test-brander-leesbaarheid.mjs` voor de volledige
diagnose (inclusief een vergelijkbare valkuil met `stroomFactor`'s eigen
recovery-logica). Verder gevonden: de schrijfplek moest van ná naar vóór
de windup-tak verhuizen (die tak `continue`t, wat de rustpuls tijdens een
aanval liet bevriezen) — zie ROADMAP.md voor de volledige toelichting.

---

### Ticket 157 — De ruimte onthoudt het gevecht ✅ uitgevoerd (v0.26)

**Doel.** Blijvende inslagsporen, zodat een kamer op golf 20 er anders
uitziet dan op golf 1.

**Positie.** Bij voorkeur ná een kwaliteitsinstelling — dit is de eerste
toevoeging sinds de audit die de renderkant echt raakt.

**Werk.**
- Eén vooraf gealloceerde pool (richtwaarde 40) die het oudste slot
  hergebruikt. Bouwen bij het laden, nooit tijdens een golf.
- Aanroepen vanuit het wereld-inslagpad in `schiet()` en vanuit
  `doodOndode()` voor de vloervlek.
- `polygonOffset` (of een offset langs de normaal) tegen z-fighting.

**Buiten scope.** Decals op ondoden. Decals op bewegende objecten.
Collision. Elk effect op pathing, spawn of schade. Opslag tussen runs.

**Acceptatie.**
- Na 25 gesimuleerde golven: `renderer.info.memory.geometries`,
  `.textures` en de mesh-telling ongewijzigd t.o.v. golf 1.
- Het 41e spoor hergebruikt aantoonbaar het 1e slot.
- `obstakels.length` blijft 58.
- Een decal ligt plat op het geraakte vlak, ook op schuine vlakken (dak,
  trap), zonder z-fighting in een screenshot-test.
- `test-resources.mjs` en `test-inslagen-rijker.mjs` groen.

**Valkuil.** De T85-regel: mesh- en materiaaltelling mogen niet meegroeien
met het golfnummer. Dat is letterlijk de bug die beslissing 63 dichtte.
Tweede valkuil: `_tmpVecNormaal` is scratch-ruimte — kopiëren, niet de
referentie bewaren (§7.9).

**Uitvoeringsadvies.** Sonnet 5 · xhigh · extended thinking On. Nieuwe
pool-infrastructuur plus een oriëntatieprobleem in 3D; de niet-groei-
assertie is objectief, de z-fighting-controle niet. *Escaleer naar Opus 5
xhigh* wanneer decals op schuine vlakken niet plat te krijgen zijn zonder
per-vlak special cases. Review: automatische tests **plus** een visuele
beoordeling. Vertrouwen: gemiddeld — de z-fighting-marge is
hardware-afhankelijk.

**Nawoord.** `quaternion.setFromUnitVectors()` op de meegegeven normaal
bleek genoeg voor elk vlak — geen per-vlak special cases nodig, ook niet
voor een schuin vlak. De kaart zelf bleek geen enkel écht schuin
oppervlak te hebben (de trap is gestapelde rechte blokjes, geen hellend
vlak), dus de "dak/trap"-orientatietest uit de acceptatiecriteria is
uitgevoerd op een synthetisch schuin vlak — grondiger dan aan één stuk
bestaand decor gebonden te zijn, en dekt zo ook toekomstig decor. De
z-fighting-screenshotcheck bleek zelf gevoelig voor CPU-belasting
(66px-verschil onder de parallelle 4-shard-run, 5/5 schoon in isolatie)
— exact hetzelfde patroon als de al bekende flakes elders in de suite,
dus geaccepteerd als zodanig i.p.v. de assertie op te rekken. Gekoppeld
aan T159's `inslagsporen`-vlag (uit op `laag`) zoals gepland.

---

### Ticket 158 — Geld houdt betekenis in de late run

**Doel.** Voorkomen dat geld ophoudt een beslissing te zijn, en dat
overschot naar niets converteert.

**Positie.** Deel (A) vrij en veilig. Deel (B) raakt de rondebalans en
hoort ná een speelsessie-oordeel, niet ervoor.

**Werk — deel (A), de veilige basislaag.**
- Restsaldo converteren naar score bij een geslaagde ontsnapping (en
  eventueel bij game over, tegen een lagere koers).
- Koers kalibreren tegen de bestaande scoretermen: een kill is 10, een
  golf is 100. Geld moet per eenheid duidelijk mínder waard zijn.

**Werk — deel (B), de laag die de keuze terugbrengt.**
- Eén herbruikbaar kooppunt met **oplopende** prijs.
- Voorkeursvorm is een *tempo*-aankoop (alle barricades in één keer
  herstellen), geen *kracht*-aankoop — dat houdt de vijandbalans buiten
  schot.
- Volgt het bestaande herbruikbaar-patroon (Watertap/Provisiekast),
  inclusief `status()` in `WINKEL_STIJLEN`.

**Buiten scope.** Geld als apart veld in de highscore-opslag. Prijzen van
bestaande eenmalige aankopen. Het inkomen zelf. Een tweede win-conditie.
Alles wat `golfBudget()` of de spawn-druk aanraakt.

**Acceptatie.**
- Twee runs met identieke kills/headshots/golf maar verschillend
  eindsaldo leveren een **verschillende** score op.
- De conversie kent een vast plafond en wordt nooit de dominante
  scoreterm (harde assertie op een lategame-simulatie).
- Met een complete vluchtroute kan het saldo niet ongewaarschuwd onder
  `ONTSNAPPING_PRIJS` (2500) zakken door de nieuwe geldput.
- De prijs van de herbruikbare put stijgt aantoonbaar per gebruik.
- `obstakels.length` blijft 58; `interactiePunten` groeit met exact 1.
- `test-finale.mjs`, `test-score-stats.mjs` en `test-golf1-economie.mjs`
  groen.

**Valkuil.** `ONTSNAPPING_PRIJS` is een drempel, geen aankoop. Een speler
die zich onder de 2500 uitgeeft terwijl zijn vluchtroute compleet is,
koopt zichzelf uit zijn eigen winst. Tweede valkuil: als "alles
herstellen" altijd de beste zet is, is het geen keuze maar een belasting.

**Uitvoeringsadvies.** Deel (A): Sonnet 5 · High · extended thinking
Default — kleine, geïsoleerde wijziging in `berekenScore()` met een
objectieve assertie. Deel (B): **Opus 5 · xhigh** — een nieuwe geldput
raakt de rondebalans, en de slaagvoorwaarde ("het moet een keuze zijn, geen
belasting") is niet headless te toetsen. Review: deel (A) automatische
tests; deel (B) speelsessie door de eigenaar. Vertrouwen: hoog voor (A),
laag voor (B) tot er een speeltoets is geweest.

---

## Herordenbaarheid — welk ticket mag je verschuiven?

Nogmaals: "parallel" betekent hier **herordenbaar**, niet **gelijktijdig**
(§13.9). Deze tabel beantwoordt één praktische vraag: *mag ik dit ticket naar
voren halen zonder iets kapot te maken?*

| Ticket | Herordenbaar t.o.v. | Niet losmaken van | Codegebied / conflict |
|---|---|---|---|
| T132 | — | alles | `nieuweWapenStaat()`, `wisselWapen()`, gameLoop-cosmetisch |
| T133 | T145, T148, T151, T152 | T132, T134, T140 | `raakOndode()`, raycast, keyhandlers |
| T134 | T145, T148, T151, T152 | T132, T133, T146 | `interactiePunten`, HUD, 21 tests, basislijn |
| T135 | T145, T148, T151, T152 | T134 | HUD, `koopSmederij()`, reset |
| T136 | T145, T148, T151, T152 | — | alleen meting |
| T140 | T145, T148, T151, T152 | T132, T142, T143, T137-T139 | gameLoop-cosmetisch, `updateWapen()`, wapenmodellen |
| T141 | alles | — | alleen meting + document |
| T142 | T145, T148, T151, T152 | T140, T143, T144, T138 | `schiet()`, `updateWapenPresentatie()` |
| T143 | T145, T148, T151, T152 | T142, T144, T139 | `schiet()`, Doorboring-raycast |
| T144 | T145, T148, T151, T152 | T142, T143 | effect-pools, hitmarker |
| T137 | T145, T148, T151, T152 | T140, T138, T139 | alleen document |
| T138 | T145, T148, T151, T152 | T137, T139, T142 | wapenmodel, basislijn, `smederijVisuals*` |
| T139 | T145, T148, T151, T152 | T137, T138, T143 | idem |
| T145 | alles | — | alleen document |
| T146 | T148, T151, T152, arsenaalspoor | T134, T147 | `updateGolf()`, ontsnappingsblok, `interactiePunten` |
| T147 | T148, T151, arsenaalspoor | T146, T152 | budget-injectie, fog/oog/vignet, herstelpaden |
| T148 | alles behalve T149/T150 | T149, T150 | `updateOndoden()`-animatieblok, writes-budget |
| T149 | alles behalve T148/T150 | T148, T150 | aanvalsmachine, flinch |
| T150 | — | T148, T149 | `ONDODE_TYPES` |
| T151 | **alles** | — | `MATERIAAL_FAMILIES`, texturen, basislijn |
| T152 | alles | T147 (wacht op finale-audio) | alleen document |
| T153 | T148-T151, arsenaalspoor | T152, T154, T133, T147 | alle `speel*()`, tellers |
| T154 | T148-T151 | T153 | `GELUIDEN`, mixbalans |
| T155 | — | T142-T144, T137-T139, T153 | ARSENAAL, debug-hook |

**Drie invarianten worden door meerdere tickets geraakt en verdienen
coördinatie:** `test-visuele-basislijn.mjs` (T134, T138, T139, T147, T151), de
`interactiePunten`-telling (T134, T146) en de effect-pools (T144, T147).
Wijzig die **per ticket, met meting** — nooit twee tickets samen.

**T140 is het enige ticket dat toekomstige parallellisatie echt veiliger
maakt:** daarna heeft de cosmetische wapenlaag één eigenaar, waardoor
T142/T143/T144 en T138/T139 elkaar niet meer in dezelfde gameLoop-regels raken.

---

## Execution Model Matrix — Ronde 10 + 11

Bedoeld om vóór elk ticket direct de juiste modelinstelling te kunnen kiezen.

| Ticket | Model | Effort | Review | Vertrouwen | Kernreden |
|---|---|---|---|---|---|
| T132 | **Opus 5** | xhigh | Sonnet 5 High, na ticket | Hoog | 14-plekken dereference-audit + hot-path-splitsing; bepaalt T133-T155 |
| T133 | Sonnet 5 | xhigh | Geen | Hoog | Nieuw wapen raakt raycast, `raakOndode()`, keyhandler; spec ligt vast |
| T134 | Sonnet 5 | xhigh | Sonnet 5 High, na ticket | Hoog | 21 testbestanden + nieuwe start-staat; execution, geen design |
| T135 | Sonnet 5 | High | Geen | Hoog | Zeven dichtgetimmerde randgevallen, één test per rij |
| T136 | **Opus 5** | High | M1 | Hoog | Balansoordeel over de hele openingservaring |
| T140 | **Opus 5** | xhigh | Opus 5 High, na ticket | Hoog | Cross-cutting hot-path-refactor, 4 schrijvers + pixelvangrail |
| T141 | **Opus 5** | High | M2 | Hoog | Wapenidentiteit naar curves; bepaalt T142/T143/T144/T137 |
| T142 | Sonnet 5 | xhigh | M2 | Gemiddeld | Spec ligt vast; raakt `schiet()` met 3 bestaande takken |
| T143 | Sonnet 5 | xhigh | M2 | Gemiddeld | Idem, plus bekend fragiele Doorboringtests |
| T144 | Sonnet 5 | High | M2 | Hoog | Polish binnen bestaande pools en tiers |
| T137 | **Opus 5** | High | M3 | Hoog | Bepaalt T138/T139 volledig, binnen 3 harde budgetten |
| T138 | Sonnet 5 | High | M3 | Hoog | Modelbouw met dichtgetimmerde spec |
| T139 | Sonnet 5 | High | Sonnet 5 High, M3 | Hoog | Idem + beeldverslag; sluit Fix 7 af |
| T145 | **Opus 5** | High | M3 | Hoog | Zes ontwerpbeslissingen; risico is over-engineering |
| T146 | Sonnet 5 | xhigh | Sonnet 5 High, na ticket | Hoog | Nieuwe state-machine op golf/boot/HUD/win tegelijk |
| T147 | Sonnet 5 | High | Sonnet 5 High, M3 | Hoog | Bekende kanalen; risico zit in de herstelpaden |
| T148 | Sonnet 5 | xhigh | Geen | Hoog | Eén wijziging plant door in 8 writes en 5 typen, hard budget |
| T149 | Sonnet 5 | xhigh | Sonnet 5 High, na ticket | Hoog | Raakt aanvalsmachine + flinch, grootste testsuite |
| T150 | Sonnet 5 | High | Geen | Hoog | Data invullen in bestaande tabel |
| T151 | Sonnet 5 | High | Geen | Hoog | Materiaalpolish met bestaande meetprocedure |
| T152 | **Opus 5** | High | M4 | Hoog | Projectregelbeslissing + classificatie-oordeel |
| T153 | Sonnet 5 | xhigh | Sonnet 5 High, na ticket | Gemiddeld | 40 functies, 13 tellers als contract, 6 `setTimeout`-valkuilen |
| T154 | Sonnet 5 | High | Opus 5 High, M4 | **Laag** | Scope pas bekend na T152 |
| T155 | Sonnet 5 | xhigh | Sonnet 5 High, na ticket | Gemiddeld | Mechanische consolidatie; scope hangt af van T137-T144 |

**Verdeling over 24 tickets:** Sonnet 5 High 8 (33%), Sonnet 5 xhigh 9 (38%),
Opus 5 High 5 (21%), Opus 5 xhigh 2 (8%), **Opus 5 Max 0**.

Opus-aandeel **29%** — aan de bovengrens van de 25-30%-richtlijn. Knelt het
budget, dan is **T137 het ticket om naar Sonnet 5 xhigh te degraderen**: de
architectuur legt de vrijheidsgraden daar al zwaar vast (≤5 meshes, 0 lichten,
additief, Bron-niveau emissie), mits T141 de animeerbare onderdelen volledig
heeft dichtgetimmerd. Dat brengt het aandeel op 25%.

**Max staat nergens als startinstelling** — alleen als escalatie op T132 en
T140, allebei met dezelfde voorwaarde: een onopgelost probleem ná een serieuze
xhigh-poging, waarbij een stille aanname (gedragsneutraliteit, write-volgorde)
gebroken blijkt. Dat is de enige categorie waarin Max gerechtvaardigd is.

---

## Milestone reviews

| # | Na | Model | Effort | Waarom en scope |
|---|---|---|---|---|
| **M1** | T136 | Opus 5 | High | Eerste keer dat de openingservaring fundamenteel anders is. Of "eerst messen, dan kopen" leuk is weet je pas door te spelen — en als het niet leuk is, moet dat nú blijken, niet na acht tickets op dit fundament. Scope: speelbaarheid golf 1-8; klopt de T136-meting met wat je voelt; is de mes-naar-vuurwapen-overgang bevredigend; is de start-staat robuust. |
| **M2** | T144 | Opus 5 | High | Twee apart getunede wapens moeten sámen kloppen. Scope: cross-check beide wapens over alle drie Smederij-tiers en vier HP-trappen; T141-doelwaarden tegen de praktijk; voelen Fix 5's explosie en Doorboring nog als een echte tier-2-beloning naast de nieuwe gunfeel? |
| **M3** | T139 + T147 | Opus 5 | High | De game is hier voor het eerst compleet: begin, midden en einde hebben hun definitieve vorm. Scope: één volledige run van golf 1 tot ontsnapping; pacing over de hele run; visuele basislijn integraal nalopen (vijf tickets hebben 'm mogelijk verschoven); F3 tijdens de finale-piek. |
| **M4** | T154 | Opus 5 | High | Een audiomix hoort als geheel beoordeeld te worden, niet per geluid. Scope: volledige run met koptelefoon; mixbalans; klinkt het als één stijl; zijn de handmatig afgestelde volumeverhoudingen nog intact? |

Bewust **géén** apart reviewmoment na T132, T140, T150 en T151: daar volstaan
de grep-audit, de automatische tests en de visuele basislijn als objectieve
poortwachters.

---

## Risicoregister — Ronde 11

| # | Risico | Kans | Impact | Mitigatie |
|---|---|---|---|---|
| R1 | T134 crasht op frame 1 door `wapenStaat === null` | **Hoog** zonder mitigatie | Kritiek | T132 toevoeging A (`inHandGroep`) + de null-frame-test als acceptatiecriterium |
| R2 | T138/T139 leveren modellen die T142-T144 niet kunnen animeren | Hoog in de oude volgorde | Hoog | T140 + T141 vóór T137; onderdelenconventie als acceptatiecriterium in alle drie |
| R3 | Visuele basislijn verschuift door vijf tickets, oorzaak onherleidbaar | Middel | Middel | Per ticket bijwerken mét meting; nooit twee tickets tegelijk; M3 loopt 'm integraal na |
| R4 | Audio-samples breken de "geen externe assets"-projectregel | Middel | Hoog | T152 is een beslissingsticket; eigenaarsgoedkeuring is expliciete dependency van T154 |
| R5 | T153 verandert stilzwijgend een geluid dat geen test dekt | Middel | Middel | Diff-audit van alle `piep()`-argumenten; 13 tellers als hard contract |
| R6 | T148's loopFase-koppeling verpest het per-type gang-ritme | Middel | Middel | `gang.pasFactor` per type hertoetsen; `test-vijand-leesbaarheid.mjs` als vangrail |
| R7 | Finale-escalatiekanalen herstellen niet bij game over midden in de fase | Middel | Middel | Expliciet acceptatiecriterium in T147; het fog-restore-precedent uit `gameOver()` volgen |
| R8 | Progressive spread (T143) breekt de Doorboring-raycast uit Fix 5 | Middel | Middel | `test-smederij.mjs` groen als acceptatiecriterium; de bekende fragiliteit vooraf lezen |
| R9 | T149 raakt de flinch en botst opnieuw met de nadering-klem | Laag | Hoog | De code-toelichting in `updateOndoden()` verplicht lezen; `test-ondode-hitreacties.mjs` als vangrail |
| R10 | Effect-pools raken verzadigd tijdens de finale-piek | Laag | Middel | `KILL_BURST_SAMENVAL_VENSTER` blijft actief; F3-meting verplicht in T147 |
| R11 | T155 scope creep | Middel | Laag | "Suite groen zonder één aangepaste assertie" als enige slaagvoorwaarde |
| R12 | De roadmap wordt te lang vóór er zichtbare waarde is | Laag | Middel | Fase 1 is meteen spelerswaarde; T140/T141 zijn samen de enige twee opeenvolgende niet-zichtbare tickets in het hele plan |

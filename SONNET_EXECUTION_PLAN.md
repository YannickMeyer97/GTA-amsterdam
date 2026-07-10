# SONNET_EXECUTION_PLAN.md — Amsterdam Undead

Handoff van Claude Fable (architect) naar Claude Sonnet (uitvoerder).
Je hoeft alleen dit bestand, `ROADMAP.md` (secties "v0.14+" en "v0.15+"),
`ARCHITECTURE_NOTES.md` en de code te lezen.

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

### Ronde 2 (v0.15+, fases 1–5 zijn afgerond)
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

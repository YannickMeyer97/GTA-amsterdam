# SONNET_EXECUTION_PLAN.md — Amsterdam Undead

Handoff van Claude Fable (architect) naar Claude Sonnet (uitvoerder).
Je hoeft alleen dit bestand, `ROADMAP.md` (sectie "v0.14+"),
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
De headless-testscripts van eerdere sessies stonden in een
sessie-scratchpad en zijn NIET in de repo aanwezig. Het testpatroon staat
in CLAUDE.md: Playwright + `chromium.launch({ executablePath:
'/opt/pw-browsers/chromium' })`, een route-intercept die
`three.module.js` lokaal serveert voor de CDN-url, en pointer lock
simuleren via `Object.defineProperty(document, 'pointerLockElement', …)`.
Bij Ticket 10 leg je de kernchecks vast in een `tests/`-map in de repo;
tot die tijd schrijf je per ticket een klein wegwerp-testscript volgens
dat patroon.

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

### Ticket 11 — Smederij-architectuur (ná fase 4)
- **Doel:** per-wapen `gesmeed`-status + schadeformule
  `schadePerTreffer + smederijbonus(actief wapen) + headshot`, zonder
  zichtbare wijziging (nog geen machine).
- **Stappen:** `smederijConfig` op beide wapendefinities (Drukspuit
  {1, 12}, Ratelaar {0.5, 24}); `gesmeed: false` in `nieuweWapenStaat`;
  één extra term in `raakOndode` (Eliminatiemodus-override blijft
  erboven); debug-exports; 8-combinaties-schadetest + wisselpersistentie
  + volledige regressie (alles identiek zolang niets gesmeed is).
- **Niet veranderen:** `koopUpgrade`/`schadePerTreffer` (blijft het
  early-game pad), `HEADSHOT_EXTRA`.

### Ticket 12 — Smederij-machine
- **Doel:** interactiepunt op de binnenplaats, €3000 per wapen, smeedt
  het ACTIEVE wapen éénmalig: schadebonus actief, magazijn 8→12 / 16→24
  (+ meteen bijvullen), visueel accent + feller vlamlicht + eigen
  koop-piep, HUD-merkteken.
- **Stappen:** volg het `ratelaarPunt`-kooppatroon; positioneer via
  `PLAATS_*`-ankers en verifieer met `isVrijePlek`; decor zonder
  collision (of mét — dan obstakel-test bijwerken); kooppad-tests per
  wapen + dubbele-aankoop-guard + onafhankelijkheid van beide wapens +
  screenshot; balanscheck golf 12–15 zonder smeden haalbaar.
- **Niet veranderen:** wapenwissel-logica, ammo-kist.

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

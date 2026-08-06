# IDEEEN.md: wat ik nog zou bouwen aan Amsterdam Undead

> **Status-update (na de v0.21-planning).** Acht ideeën uit dit document
> zijn inmiddels uitgewerkt tot tickets: E1 → **T87** (met een
> architectuurwijziging, zie hieronder), E6 → **T85**, I1 → **T80**,
> I4 → **T81**, I5 → **T82**, J3 → **T86**, K1 → **T83**, K2 → **T84**.
> Zie ROADMAP.md sectie v0.21 en ARCHITECTURE_NOTES.md §9.
>
> **Eén idee is bij die uitwerking gewijzigd.** E1 beschreef een zolder
> bóven het Atelier. Dat blijkt een load-bearing invariant te breken:
> `berekenKelderY(x, z)` is een pure functie van x en z, en vijf systemen
> leunen daarop (speler-Y, ondode-Y, collision, `zoneVan()`, minimap).
> Twee vloeren over dezelfde x/z maken y een relatie in plaats van een
> functie. T87 bouwt daarom "De Vliering" met een **disjuncte footprint**
> volgens het kelder-precedent; de zware variant staat als **T88** in de
> ROADMAP-backlog. Volledige analyse: ARCHITECTURE_NOTES §9.8.

Dit document beschrijft geen taken en verandert geen code. Het is een verkenning: waar zit
ruimte in dit spel, en wat zou ik daar zelf in bouwen. Alle verwijzingen naar functies,
constanten en regelbereiken zijn gecontroleerd tegen `amsterdam-undead.html` (8197 regels,
v0.20, na Architectuurronde 6) en tegen `ARCHITECTURE_NOTES.md`/`ROADMAP.md`.

---

## 0. Het spel zoals het nu is

### 0.1 Systemen en hoe ze samenhangen

**Wereld en zones.** Vijf combat-zones op een rij: De Woonkamer (start, zone 0) → De Gang
(1) → Het Atelier (2, met een nis) → De Binnenplaats (3) → De Bijkeuken (4, met kelderhals
en de gang naar de gracht). Zes deuren ontgrendelen de kaart: deur 1-3 openen elk een
nieuwe zone, deur 4 is een terugdeur die de kaart tot een lus sluit (bijkeuken → woonkamer,
telt bewust niet als eigen zone, zie `aantalOntgrendeldeZones()`), deur 5 en 6 openen twee
veilige, combat-vrije kelderruimtes onder het atelier. Navigatie loopt over een echte graaf
(`ZONE_GRAAF`, `NAV_VOLGENDE`, herbouwd in `herbouwNavTabel()`) met een aparte
waypoint-laag voor intra-zone-obstakels (`ZONE_WAYPOINTS`, `zoekWaypoint()`) zoals de
trapopening en het chokepoint bij de gracht.

**Speler en beweging.** Vaste snelheid 4.5 m/s (`speler.snelheid`), geen sprint, geen
crouch, geen jump, geen dash. Puur WASD plus muiskijk. HP 100, regenereert 5/s na 4s zonder
schade (`SPELER_REGEN_VERTRAGING`/`SPELER_REGEN_PER_SEC`).

**Wapens en combat.** Twee vuurwapens met een uitgesproken tegenover elkaar gezette
identiteit (§5.6 in ARCHITECTURE_NOTES): de Drukspuit is de precisiekeuze (8 mag, 0.2s
cooldown, grote kick, geen spread), De Ratelaar het volume-alternatief (16 mag, 0.1s
cooldown, kleine kick, vaste lichte spread). Beide upgraden via een globaal schadepad
(`schadePerTreffer`, max 1.5) en een per-wapen eindtrap, De Smederij (`smederijConfig`,
€3000 per wapen). Geen melee, geen granaat, geen derde wapen.

**Ondode-types en gedrag.** Vijf types in `ONDODE_TYPES`, elk met een duidelijke
mechanische rol: normaal (de baseline), loper (snel, breekbaar, weinig geld, snelheid
2.205 m/s), sjouwer (traag, taai, blokkeert een doorgang, HP-plafond 8, expliciet
begrensd zodat hij geen bullet sponge wordt, zie `hpMultiplier`/`hpMax`-commentaar),
brander (ontploft bij overlijden, `ontploiBrander()`, radius 3m, kettingreactie mogelijk),
sluiper (uitsluitend tijdens een Mistgolf, stil, ingedoken). Elk type heeft een eigen
aanvalsprofiel (`AANVAL_PROFIELEN`: windup, herstel, schade, bereik) en een
wind-up-state-machine (`aanvalStaat`: jaag → windup → herstel) met zichtbare/hoorbare
tells (arm omhoog, oogpuls, grom). Cosmetische variatie zit los van het type in
`VARIATIE_PROFIELEN` (mager, gebocheld, eenarmig, ingedokenKop, …) en wordt gecombineerd
via `kiesOndodeTraits()`.

**Golf- en spawnlogica.** Threat-budget in plaats van kill-aantal: `golfBudget(golf) =
round((5 + 1.7·(golf-1)) · moeilijkheidsfactor)`, elk type heeft eigen kosten
(`ONDODE_THREAT_KOSTEN`: normaal 1, loper 1.4, sluiper 1.5, brander 1.8, sjouwer 3).
Spawn-interval 1.1s (`GOLF_SPAWN_INTERVAL`), plafond aan gelijktijdig levende ondoden 14
plus 2 per ontgrendelde zone (`GOLF_MAX_ACTIEF`/`ZONE_MAX_ACTIEF_BONUS`, geclampt op de
3-zones-stand). HP-trap onafhankelijk van het budget: golf 1-4 → 1 HP, 5-10 → 2, 11-15 →
3, 16+ → 4 (hard plafond, `ONDODE_HP_TRAPPEN`). Elke 5e golf is een eventgolf
(`EVENT_GOLF_INTERVAL`), afwisselend Mist (uitsluitend Sluipers) en Stroomuitval.

**Economie en winkel.** Geld per treffer (€5) en per kill (€20, x2 op een dodelijke
headshot). Elke aankoop is eenmalig en permanent: deuren (€500-1200), munitie (€300),
schade-upgrade (€500), Ratelaar (€750), Smederij (€3000/wapen), Snelspanner (€600),
Pantserdrank (€1000), Watertap (€200, herbruikbaar geld→HP). Barricades repareren
(`repareerBarricade()`) levert zelfs geld op (+€20), niet kost het geld. Repareren is dus
een actieve, beloonde keuze, niet een tax.

**Power-ups.** Vier types (`POWERUP_TYPES`), max één drop-slot per golf
(`laatstePowerupDropGolf`), 12% dropkans per kill, 12s om op te rapen. Munitievoorraad,
Dubbele Beloning (20s), Eliminatiemodus (15s, elke treffer is dodelijk), Kerninslag
(doodt alles nu, eigen cooldown van 4 golven).

**Event-golven.** Een klein, generiek framework (`kiesEventType()`, `isEventGolf()`,
`startEventGolf()`/`eindigEventGolf()`) met twee ingevulde types: Mist (fog dichterbij,
uitsluitend Sluipers, oogboost) en Stroomuitval (alle verlichting naar 12% van de basis,
2s lineair herstel, andere spawn-mix, nog fellere oogboost). Beide zijn tijdelijke
regelwijzigingen, geen extra spawns.

**De ontsnappingsroute.** Vanaf golf 10, daarna elke 4 golven (`ONTSNAPPING_START_GOLF`/
`ONTSNAPPING_INTERVAL_GOLVEN`), meert de boot aan met een aankondigingsfase van 5s
(hoorn, banner, lantaarnpuls). Drie vluchtroute-onderdelen moeten eerst gevonden zijn
(Roeispaan vanaf golf 3, Touwbundel vanaf golf 6, Scheepslantaarn vanaf golf 1,
`VLUCHT_ONDERDELEN`), plus €2500. Dit is de enige win-conditie.

**Audio, HUD, minimap, verlichting.** Volledig procedureel Web Audio (`piep()` plus
tientallen specifieke `speel*()`-functies), een achtergrondmuziek-laag en een
dreigingsaudio-drone die met nabijheid meeschaalt. HUD toont HP/geld/golf/schade/
herlaadtijd/wapen/buffs/vluchtroute, met sinds Ticket 71/72 een schrijf-alleen-bij-
wijziging-guard. Minimap draait heading-up mee met de speler
(`tekenMinimap()`/`minimapLokaal()`), met fog-of-war per zone. Verlichting is één
schaduwwerpende lamp (de "schaduw-invariant", zie ARCHITECTURE_NOTES §7.9) plus ~26
niet-schaduwwerpende puntlichten met een subtiele flikker-sinus per lamp, en één
UnrealBloomPass als enige post-processing.

### 0.2 Wat dit spel al goed doet

1. **Vijandleesbaarheid is een systeem, geen bijzaak.** Vijf tickets (Z1-Z6, 18-23) plus
   een aparte tell-ronde (Aanval A1/A2, 30-31) zijn puur hieraan besteed: elk type heeft een
   ander silhouet, een ander looppatroon, een andere windup-tell, en de Sluiper is zelfs
   stil terwijl elke andere ondode een hoorbare grom heeft (`ONDODE_GROM_*`). Dit is
   volwassen ontwerp, geen toevoeging achteraf.
2. **Bewuste weerstand tegen bullet sponges.** De HP-trap heeft een hard plafond (4), de
   Sjouwer heeft een eigen HP-plafond (8) los van zijn multiplier, en moeilijkheid komt
   vanaf golf 16 uitsluitend uit samenstelling/budget, niet uit meer HP. Dat is een expliciet
   vastgelegde ontwerpbeslissing (zie het commentaar bij `ONDODE_HP_TRAPPEN` en
   `ONDODE_TYPES.sjouwer`), niet een gelukkig toeval.
3. **Ruimte als beloning, getemperd door een plafond.** Elke deur is zowel een
   spanningsbron (meer instroomrichtingen) als een winst (meer bewegingsruimte, meer
   winkels). `ZONE_MAX_ACTIEF_BONUS`/`ZONE_SPAWN_INTERVAL_FACTOR` zorgen dat een grotere
   kaart niet ontspoort in overweldigende spawn-druk.
4. **Radicale zuinigheid in middelen, geen zichtbaar offer in variatie.** Alles procedureel:
   geen textures, geen audiobestanden, geen modellen, en sinds Architectuurronde 6 ook geen
   GPU-geheugenlek meer (gedeelde geometrie-cache, dispose-contract). Dat de vijf
   ondode-types, twee wapens en de hele wereld toch visueel gevarieerd aanvoelen binnen die
   restrictie, is een prestatie op zich (PALET-systeem, `matFamilie()`, procedurele
   canvas-texturen).
5. **De technische bodem is nu schoon en bewaakt.** 52 Playwright-scripts, CI op elke push,
   een resource-regressietest die specifiek het GPU-lek had moeten vangen. Dat betekent dat
   nieuwe, ambitieuzere systemen gebouwd kunnen worden zonder voortdurend bang te hoeven zijn
   voor een fundament dat het niet houdt.

### 0.3 Waar de code al ruimte laat (goedkope aangrijpingspunten)

- **`ONDODE_TYPES` + `AANVAL_PROFIELEN` + `VARIATIE_PROFIELEN`.** Een nieuw ondode-type is
  grotendeels een nieuwe data-entry: spawn, HP, snelheid, aanval, model-vorm lopen al
  allemaal generiek via `maakOndodeModel()`/`spawnOndode()`/`updateOndoden()`.
- **`interactiePunten` + `WINKEL_STIJLEN`.** Elk koop-/interactiepunt is al een generiek
  `{ positie, radius, prompt, actie }`-object met een iconenregister erbij. Een nieuwe
  winkel, NPC-achtig punt of doel kost geen nieuw interactiesysteem.
- **Het event-golf-framework (`kiesEventType`/`startEventGolf`/`eindigEventGolf`).** Gebouwd
  voor precies twee types nu, maar de haak voor een derde/vierde ligt al open.
- **`POWERUP_TYPES`.** Eén object met een `effect()`-callback erbij is een nieuwe power-up.
- **`geoCache`/`mat()`/`matFamilie()`.** Gedeelde caches maken nieuwe visuele content
  goedkoop zonder het geheugenlek-patroon terug te halen dat Ticket 69/70 net dichtte.
- **`VLUCHT_ONDERDELEN`.** Een array van vind-objecten met een `drempelGolf`, triviaal uit
  te breiden of te vervangen door een ander soort doelenlijst.
- **De zonegraaf (`ZONE_GRAAF`/`NAV_VOLGENDE`/`zoekWaypoint`).** Generieke pathfinding over
  benoemde zones; een nieuwe zone is een graaf-uitbreiding, geen nieuwe AI.
- **`runStats` + het gevalideerde localStorage-highscore-patroon (Ticket 42/74).** Een
  veilige, al bewezen manier om nieuwe meta-progressie op te slaan.

### 0.4 Wat ik niet kan weten uit de code alleen

Ik kan niet weten hoe een run in de praktijk *aanvoelt*: of golf 8-12 saai wordt, of
spelers de kelderroute vinden zonder de minimap, of de audio op koptelefoon overtuigend
genoeg is, of een sessie van 25 golven (zoals de eigen lategame-pacingtest simuleert)
realistisch is voor een speelsessie, en hoeveel tijd er beschikbaar is om aan dit project
te bouwen. Waar een idee hiervan afhangt, staat dat er expliciet bij.

---

## A. De kernlus

**Waar het spel nu staat.** Golf overleven (`updateGolf()`/`golfSpawnStap()`), geld
verdienen, tussen golven door kopen en planken repareren, GOLF_RUST_TIJD (8s) rust, door.
De rustperiode heeft geen eigen keuzedruk: er is niets dat een speler *kan mislopen* door
niet snel genoeg te zijn, behalve planken die verder afbrokkelen.

**De opening.** De lus zelf is goed: budget-gedreven spawns, een repareerbare barricade,
een winkel die meegroeit. Wat ontbreekt is variatie in het RITME van die lus, elke golf
voelt hetzelfde vanbinnen (spawn, schiet, repareer, koop), ook al verandert de
samenstelling. En de rustperiode is passief in plaats van een eigen beslismoment.

### A1: Het voorraadraam

**Het idee** Bij het begin van elke rustperiode (`GOLF_RUST_TIJD`, nu 8s) verschijnt kort een
keuze: een krat met twee willekeurige, tijdelijke voordelen waarvan de speler er precies één
mag pakken (bijvoorbeeld: dubbele herlaadsnelheid deze golf, of een schild dat de eerste klap
negeert, of gegarandeerd een extra powerup-drop). De rustperiode wordt zo van "wachttijd" naar
een echt momentje van afwegen.
**Waarom dit leuk is** De speler staat elke golf-overgang even stil bij een keuze in plaats
van automatisch naar de winkel te lopen. Het is het moment vlak vóór golf 14 waarop je "schild
tegen de eerste klap" kiest omdat je weet dat je nog geen Pantserdrank hebt.
**Hoe het past** Hangt aan `startGolf()`/de rust-fase, en kan als een nieuw type
`interactiePunt` (of gewoon een korte HUD-keuzelaag zoals het moeilijkheidsscherm) verschijnen.
De tijdelijke effecten zijn hetzelfde patroon als de bestaande power-up-timers
(`dubbeleBeloningTimer`, `eliminatiemodusTimer`).
**Wat het raakt** `startGolf()`, een nieuwe kleine UI-laag, en een nieuwe set tijdelijke
statusvelden naast de bestaande powerup-timers.
**Bouwomvang** Middel. Geen nieuwe systemen nodig, wel een nieuwe UI-flow en drie tot vier
nieuwe effecttypes om mee te beginnen.
**Waar het mis kan gaan** Als de keuze te makkelijk (altijd hetzelfde beste pakken) of te
onbeduidend is, wordt het een extra klik zonder betekenis. De rustperiode moet ook niet te
lang worden onderbroken, anders vertraagt het juist het tempo dat nu goed zit.
**Varianten** Licht: alleen zichtbaar vanaf golf 5, twee simpele opties. Zwaar: het krat kost
geld om te openen, met drie opties waarvan er een negatief is (risico/beloning).

### A2: Beukmoment

**Het idee** Wanneer een barricade voor het eerst tot 0 planken wordt afgebeukt (niet
gerepareerd), krijgt de speler een korte, harde audio-visuele stoot: het scherm schudt, een
extra grom-laag, en de eerstvolgende ondode door dat gat komt met een korte sprint-burst
binnen in plaats van zijn normale tempo. Dit gebeurt per venster, niet per golf.
**Waarom dit leuk is** Nu is een kapotte barricade stil-functioneel: een ondode loopt er
gewoon doorheen. Dit maakt het moment dat een raam het echt begeeft voelbaar, het moment
waarop je van "ik hou dit wel bij" naar "shit, nu" springt.
**Hoe het past** Haakt aan `beukBarricade()` op het moment dat `venster.planken` van 1 naar 0
gaat, en aan de bestaande camera-kick (`cameraKick`) en vignet-flits (`vignetFlits`) die al
voor schade bestaan.
**Wat het raakt** `beukBarricade()`, en een kleine uitbreiding op `spawnOndode()` voor de
eenmalige sprint-burst (een tijdelijke snelheidsmultiplier op die ene ondode).
**Bouwomvang** Klein. Hergebruikt bestaande camera-feedback en het bestaande venster-/
spawnsysteem, één avond werk.
**Waar het mis kan gaan** Als dit te vaak triggert (elk venster, elke golf) verliest het zijn
impact en wordt het ruis. Moet zeldzaam en specifiek blijven, niet een nieuwe standaardregel.
**Varianten** Licht: alleen het schermschudden, geen snelheidsboost. Zwaar: de doorgebroken
ondode krijgt tijdelijk een fellere oogkleur zodat hij ook visueel als "de indringer" herkenbaar
blijft tot hij dood is.

### A3: Het noodrantsoen

**Het idee** Eén keer per run kan de speler, wanneer HP onder de 20 komt, een noodgreep doen:
een korte, gescripte animatie (wapen weg, twee handen tegen de wond) die 3 seconden onkwetsbaar
maar ook weerloos maakt en daarna 30 HP teruggeeft. Geen geld, geen aankoop, gewoon één keer
per run beschikbaar en zichtbaar op de HUD als een klein icoon dat dooft na gebruik.
**Waarom dit leuk is** Het geeft de speler één keer per run een bewust "nu of nooit"-moment:
gebruik ik hem nu, terwijl er nog twee Sjouwers op me af komen, of bewaar ik hem voor de
Ontsnapping? Dat soort beslissingen ontbreken nu helemaal, alles is anders gewoon geld.
**Hoe het past** Een nieuwe toets/actie naast schieten en herladen, met een simpele state
(`noodrantsoenGebruikt`) en dezelfde soort tijdelijke-onkwetsbaarheid-logica als al bestaat
in `spelerSchade()` (die al een `if (spelStaat.gameOver) return;`-guard heeft, uit te breiden
met een onkwetsbaar-veld).
**Wat het raakt** `spelerSchade()`, HUD (nieuw icoon), invoerafhandeling (nieuwe toets).
**Bouwomvang** Klein tot middel. Eén nieuwe state, één nieuwe actie, hergebruik van bestaande
schade-/animatiepatronen.
**Waar het mis kan gaan** Een onkwetsbaarheidsvenster kan zich cheap voelen als het te makkelijk
te herhalen is (vandaar: één keer per run) of juist onzichtbaar als de speler vergeet dat hij
het heeft. Moet duidelijk op de HUD staan vanaf golf 1, niet pas ontdekt worden bij toeval.
**Varianten** Licht: gewoon directe HP-teruggave zonder onkwetsbaarheidsvenster. Zwaar: de
speler kan een tweede noodrantsoen kopen bij de Watertap voor een hoge prijs (bv. €1500),
zodat het ook een economische keuze wordt in plaats van een gratis vangnet.

### A4: Aasplekken

**Het idee** Vanaf golf 6 verschijnt willekeurig, ergens buiten de directe vluchtroute (bv.
in de nis, of achter het schuurtje op de binnenplaats), een korte-termijn geldstapel die
zichtbaar (een gloed) en hoorbaar (een zacht getik) is, maar alleen bereikbaar door een paar
seconden weg te lopen van de dichtste chokepoint. Pakt de speler hem niet binnen ~10s, dan
verdwijnt hij.
**Waarom dit leuk is** Dit is het moment waarop de speler zelf beslist om risico te zoeken
in plaats van het te ondergaan: "ik ren nu naar de nis voor die €150, ook al staat de deur
even onbewaakt." Precies het soort vrijwillig risico dat de opdracht vraagt en dat nu
ontbreekt: de speler wordt alleen naar gevaar geduwd (spawns), nooit uitgenodigd.
**Hoe het past** Bijna identiek aan het bestaande powerup-drop-systeem
(`spawnPowerupDrop()`/`updatePowerups()`/`POWERUP_VERVAL_TIJD`), alleen los van een kill
getriggerd en op een vaste set decor-locaties in plaats van een doodspositie.
**Wat het raakt** Een nieuwe, kleine spawn-timer in de golf-loop, en herbruik van de
powerup-pickup-radius/verval-logica.
**Bouwomvang** Klein. Bijna volledig kopiëren-en-aanpassen van het bestaande powerup-patroon.
**Waar het mis kan gaan** Als de locaties altijd dezelfde zijn, wordt het een uitgekauwd
ritueel in plaats van een keuze. En als de spawnende ondoden niet meebewegen naar waar de
speler nu loopt, voelt het risico nep.
**Varianten** Licht: één vaste locatie per zone, simpel geldbedrag. Zwaar: de aasplek trekt
zelf extra ondoden aan (een kleine, lokale threat-budget-boost) zodra hij verschijnt, zodat
"ernaartoe gaan" een echte, meetbare kostprijs krijgt.

### A5: Wapenwissel onder druk

**Het idee** Beide wapens delen nu reserve-munitie los van elkaar en een globale
`schadePerTreffer`. Voeg een derde resource toe: oververhitting/slijtage die per wapen
oploopt bij aanhoudend vuren (vooral relevant voor De Ratelaar) en die alleen afkoelt als je
niet schiet. Bij volle balk schiet het wapen tijdelijk trager of moet je handmatig
"resetten" (een korte animatie, geen kogel).
**Waarom dit leuk is** Nu is wapenwissel een smaakkeuze zonder consequentie. Dit maakt
"schakel ik naar de Drukspuit terwijl De Ratelaar afkoelt" een besluit dat je midden in een
golf moet nemen, niet alleen bij het begin.
**Hoe het past** Een nieuw veld op `wapenStaat` (naast `magazijn`/`reserve`/`herladen`),
uitgelezen in `schiet()`/`probeerTeSchieten()`, met een balk in de HUD naast de bestaande
ammo-UI.
**Wat het raakt** `wapenStaat`, `schiet()`, `updateWapen()`, HUD, en het schadebalans opnieuw
tunen omdat continu vuren nu een impliciete kostprijs krijgt.
**Bouwomvang** Middel. Raakt de hot path van het schietsysteem, dus zorgvuldig testen tegen
de bestaande DPS-pariteitstest (`test-aanval-machine.mjs` bewaakt DPS al voor vijanden, een
soortgelijke test zou hier nodig zijn voor de speler).
**Waar het mis kan gaan** Dit kan zich als een straf voelen in plaats van een keuze, vooral
tegen een Sjouwer-blokkade waar je juist lang wilt volhouden. Vraagt precieze tuning om niet
frustrerend te worden.
**Varianten** Licht: alleen op De Ratelaar (de volumekeuze, past bij zijn identiteit), de
Drukspuit blijft ongemoeid. Zwaar: oververhitting is per wapen permanent zichtbaar op de HUD
en de Smederij-upgrade vermindert 'm, zodat het ook een late-game beloning wordt.

### A6: Golf-tempo als eigen keuze

**Het idee** Voeg een knop toe waarmee de speler, ZODRA er nog planken/geld te repareren
zijn, de rustperiode vroeg kan beëindigen voor een klein geldbonus (sneller verdergaan =
beloond), of juist kan verlengen (tegen betaling, of gewoon niet interacten met de
"volgende golf"-trigger) om meer voor te bereiden. Nu is `GOLF_RUST_TIJD` een vaste 8
seconden, ongeacht wat de speler wil.
**Waarom dit leuk is** Ervaren spelers die alles al gekocht hebben zitten nu 8 seconden te
wachten. Nieuwe spelers die net drie deuren tegelijk moeten repareren voelen zich gehaast.
Dit geeft beide groepen controle over hun eigen tempo, wat een klein maar continu
frictiepunt wegneemt.
**Hoe het past** `spelStaat.rustTimer` bestaat al als aftellende waarde vóór `startGolf()`
wordt aangeroepen; dit is een kwestie van een UI-knop die 'm direct naar 0 zet, plus een
kleine geldbonus-berekening.
**Wat het raakt** De golf-overgangslogica rond `spelStaat.rustTimer`, een nieuwe HUD-knop.
**Bouwomvang** Klein. Eén UI-element en een paar regels in de bestaande rust-aftelling.
**Waar het mis kan gaan** Als "vroeg starten" altijd de optimale strategie is (extra geld
zonder nadeel), verdwijnt de rust-periode als concept en daarmee het enige rustpunt in de
lus. De bonus moet klein genoeg zijn om een echte afweging te blijven, niet een no-brainer.
**Varianten** Licht: alleen de vroeg-starten-knop, geen verlengoptie. Zwaar: gekoppeld aan
A1 (het voorraadraam) zodat vroeg starten ook betekent dat je die keuze misloopt.

---

## B. Vijanden

**Waar het spel nu staat.** Vijf types (`ONDODE_TYPES`) met elk een duidelijke rol,
gespawned via een threat-budget (`golfBudget()`/`ONDODE_THREAT_KOSTEN`) en een
wind-up-aanvalsmachine (`AANVAL_PROFIELEN`). Geen enkel type verandert de ruimte zelf, geen
enkele vijand is een uitzonderlijk, herkenbaar "dit moment" binnen een golf.

**De opening.** Het fundament (leesbaarheid, tells, silhouetten, `VARIATIE_PROFIELEN` als
kant-en-klare variatielaag) is zo volwassen dat een nieuw type of een golf-mijlpaal-moment
relatief goedkoop is. Wat ontbreekt is een vijand die de speler dwingt om ANDERS te spelen
dan "richt en schiet", en een golf die zich anders voelt dan "meer van hetzelfde budget".

### B1: De Klepper

**Het idee** Een nieuw type dat geen HP heeft in de klassieke zin, maar een schild
(`groep.userData.schild`) dat alleen van voren blokkeert. Frontaal beschadig je 'm niet; je
moet 'm laten passeren en van achteren raken, of hem naar een specifieke hoek lokken. Hij is
niet sneller of trager dan normaal, maar loopt recht op je positie af en draait NIET mee als
je om hem heen beweegt (in tegenstelling tot elk ander type, dat via `richting` zijn
kijkrichting volgt sinds Ticket 73).
**Waarom dit leuk is** Dit is het moment waarop schieten niet werkt en de speler moet
navigeren: een Klepper die de gang blokkeert dwingt je de kamer in te lopen en van opzij te
vuren, terwijl er ondertussen een Loper op je afkomt. Hij creëert ruimtelijke druk in plaats
van alleen tijddruk.
**Hoe het past** Nieuwe entry in `ONDODE_TYPES` plus `AANVAL_PROFIELEN`, een extra
raycast-check in `raakOndode()` die de treffer-hoek vergelijkt met `groep.rotation.y` (een
berekening die al bestaat voor de kijkrichting-logica van Ticket 73), en een eigen silhouet
via het bestaande vorm-systeem (een groot schild-mesh vóór de romp, zoals `vorm.buik` voor de
Brander).
**Wat het raakt** `ONDODE_TYPES`, `AANVAL_PROFIELEN`, `raakOndode()` (hoekcheck), threat-
budget/spawn-gewichten, `maakOndodeModel()` voor het schild-onderdeel.
**Bouwomvang** Middel. Het schild-mechanisme zelf is nieuw (geen bestaand patroon om te
kopiëren), de rest hergebruikt het volledige ondode-framework.
**Waar het mis kan gaan** Een vijand die van voren niet te raken is kan frustrerend aanvoelen
als de speler niet meteen doorheeft waaróm zijn schoten niets doen. Vraagt een heel
duidelijke visuele read (een schild moet er letterlijk als schild uitzien) en een korte
audiocue bij een geblokkeerd schot in plaats van stilte.
**Varianten** Licht: het schild is gewoon 3x zoveel HP van voren in plaats van onkwetsbaar
(subtieler, minder leerdrempel). Zwaar: het schild kan tijdelijk breken bij drie geblokkeerde
schoten op rij, wat een eigen mini-doel binnen het gevecht creëert.

### B2: De Voorman (elite-modifier)

**Het idee** Geen nieuw type, maar een modifier-laag bovenop een bestaand type, vanaf golf 8
met een lage kans. Een "Voorman"-ondode (bijvoorbeeld een normaal- of loper-basis) heeft een
zichtbaar andere kleur/gloed en versterkt elke ondode binnen ~5m: hun aanvalssnelheid gaat
omhoog zolang de Voorman leeft. Doodt de speler hem het eerst, valt de boost weg.
**Waarom dit leuk is** Dit geeft de speler een prioriteitskeuze middenin het gewoel: negeer
ik de Voorman en ruim ik de kleintjes eerst op, of ga ik er meteen op af door een groepje
heen? Dat soort target-prioritering ontbreekt nu volledig, elke ondode is functioneel
inwisselbaar behalve zijn eigen type-rol.
**Hoe het past** Hergebruikt `ONDODE_TYPES` volledig (het is een bestaand type met een
extra `ondode.userData.elite`-vlag), een kleine uitbreiding in `updateOndoden()` die buren
binnen bereik controleert (een patroon dat al bestaat voor de globale grom-cap
`ONDODE_GROM_GLOBALE_CAP`), en een aparte, herkenbare oogkleur/gloed zoals nu al per type
bestaat (`oogKleur`).
**Wat het raakt** `spawnOndode()`/`golfSpawnStap()` (loting van de elite-vlag),
`updateOndoden()` (buffuitdeling), `maakOndodeModel()` (visuele marker), `raakOndode()`
(geen wijziging nodig, sterft als normale ondode van dat type).
**Bouwomvang** Middel. Geen nieuwe geometrie/animatiesystemen nodig, wel een nieuwe
buff-doorgeef-logica in de per-frame loop, die zorgvuldig binnen het frame-budget moet
blijven (zie de bestaande discipline rond `updateOndoden()`'s write-budget).
**Waar het mis kan gaan** Een naburigheids-check per ondode per frame kan duur worden bij
volle golven (tot 14-18 actief); moet gethrottled worden zoals andere per-frame-checks
(`MINIMAP_TEKEN_INTERVAL`-stijl) in plaats van elke frame voor elke ondode te herberekenen.
**Varianten** Licht: de Voorman geeft alleen zichzelf meer HP, geen groepsbuff (simpeler,
geen naburigheids-check nodig). Zwaar: meerdere elite-varianten (Voorman = sneller,
Bewaker = taaier, Op­jager = trekt aandacht van andere ondoden weg) die vanaf golf 8 willekeurig
kunnen verschijnen, met een eigen `ONDODE_THREAT_KOSTEN`-opslag.

### B3: De Verzamelaar

**Het idee** Een langzame, unieke vijand die één keer per 3-4 golven verschijnt (geen deel
van het reguliere budget) en die, als hij een venster of deur bereikt vóórdat de speler hem
doodt, een tijdelijke, extra barricade-laag daar weer opbouwt of een reeds gerepareerd
venster kapot maakt. Hij draagt zichtbaar een balk of net.
**Waarom dit leuk is** Dit is een vijand met een DOEL in plaats van alleen een pad naar de
speler, en dwingt een prioriteitskeuze die niet over DPS gaat maar over TIJD: laat ik de
Sjouwer op me afkomen om eerst de Verzamelaar te onderscheppen voordat hij bij dat net-
gerepareerde raam is?
**Hoe het past** Een eigen navigatiedoel los van `speler.positie` (het dichtstbijzijnde
venster in plaats van de speler), wat een kleine aftakking in de doelPunt-logica van
`updateOndoden()` vraagt maar verder hetzelfde beweeg-/aanvalssysteem gebruikt.
**Wat het raakt** `updateOndoden()` (alternatief navigatiedoel voor dit type),
`beukBarricade()`/`repareerBarricade()` (het omgekeerde effect toevoegen), spawn-planning
buiten het normale budget om (zoals de vluchtroute-onderdelen buiten de normale
economie-loop staan).
**Bouwomvang** Groot. Dit is de eerste vijand die NIET simpelweg naar de speler navigeert,
wat een nieuwe navigatie-tak vraagt en zorgvuldig testen tegen de bestaande
waypoint-/zonegraaf-tests.
**Waar het mis kan gaan** Als hij te vaak verschijnt voelt het als willekeurige sabotage in
plaats van een leesbare dreiging. De speler moet 'm op afstand kunnen herkennen (aparte
vorm/geluid) zodra hij spawnt, anders is de straf oneerlijk.
**Varianten** Licht: hij maakt alleen een venster kapot dat je nog niet gerepareerd had
(minder impact, want geen verlies van eigen investering). Zwaar: hij kan ook een AL open deur
tijdelijk weer barricaderen, wat de zonegraaf-doorgang zelf tijdelijk blokkeert.

### B4: Nachtwachtgolf

**Het idee** Een derde eventgolftype naast Mist en Stroomuitval: alle ondoden in deze golf
spawnen in koppels van twee die letterlijk aan elkaar vastzitten (een korte, zichtbare
ketting-mesh tussen ze) en dezelfde HP-pool delen. Ze bewegen onafhankelijk maar de een kan
niet verder dan ~2m van de ander.
**Waarom dit leuk is** Het verandert de manier waarop een speler doelwitten kiest binnen een
hele golf: twee vijanden die praktisch één HP-balk zijn, maar wel apart kunnen aanvallen,
vraagt om anders mikken dan de rest van het spel. Dit is precies het soort "golf voelt
anders" dat de opdracht vraagt, zonder de basisregels van combat om te gooien.
**Hoe het past** Hangt volledig aan het bestaande event-golf-framework
(`kiesEventType()`/`startEventGolf()`/`eindigEventGolf()`, hetzelfde patroon als Mist/
Stroomuitval), met een gedeeld `hp`-veld tussen twee `ondode`-objecten in plaats van een
eigen HP-multiplier.
**Wat het raakt** `kiesEventType()`, `ondodeTypeGewichten()` (event-specifieke spawnmix,
zoals Mist al doet), `spawnOndode()` (koppels spawnen in plaats van los), `raakOndode()`
(schade op het gedeelde HP-veld toepassen).
**Bouwomvang** Middel. Het event-framework zelf is al klaar voor een derde type; het gedeelde
HP-veld is de enige echt nieuwe mechaniek.
**Waar het mis kan gaan** Gedeelde HP tussen twee onafhankelijk bewegende meshes kan
verwarrend zijn ("waarom stierf DEZE toen ik OP DIE schoot") als de visuele koppeling (de
ketting-mesh) niet overtuigend genoeg is.
**Varianten** Licht: koppels van hetzelfde type (bv. twee Lopers), simpeler te testen. Zwaar:
koppels van verschillende types (een Sjouwer + Loper vastgeketend), wat de spanning tussen
traag/blokkerend en snel/breekbaar in één doelwit samenbalt.

### B5: Golfmijlpaal, de Eerste Nacht

**Het idee** Op golf 13 (bewust net vóór het eerste late-game-plateau op golf 16, zie
`ONDODE_HP_TRAPPEN`) krijgt precies één golf een eigen naam, banner en een uniek
scripted-moment: alle lichten in de al ontgrendelde zones dimmen 30% extra bovenop de normale
flikker, en er verschijnt één enkele, sterk vergrote Sjouwer-variant (dezelfde geometrie,
1.8x schaal via `groep.scale`, geen nieuw model nodig) die zichtbaar meer schade uitdeelt
maar ook meer geld en een gegarandeerde powerup-drop geeft.
**Waarom dit leuk is** Dit is het eerste "onthoud je nog die ene golf"-moment in het spel.
Nu voelen golf 12 en golf 13 identiek behalve het cijfer op de HUD; dit geeft spelers een
concreet verhaal om na te vertellen ("ik heb 'm bijna niet gehaald op de Eerste Nacht").
**Hoe het past** Bijna volledig hergebruik: `groep.scale` voor de vergroting bestaat al
(`typeInfo.schaal`), de dim-laag hergebruikt `stroomFactor`-achtige verlichtingssturing,
`toonGolfBanner()` bestaat al voor aankondigingen.
**Wat het raakt** `startGolf()` (golf-13-detectie), een eenmalige spawn met aangepaste
schaal/schade/beloning buiten `golfSpawnStap()`'s normale loting om, de verlichtingsloop.
**Bouwomvang** Klein. Één golf, hardgecodeerd, met bestaande bouwstenen.
**Waar het mis kan gaan** Eenmalige, hardgecodeerde momenten verouderen snel als er méér
zulke mijlpalen bijkomen zonder een generiek systeem eronder; dit werkt goed als proef-
ballon voor precies één mijlpaal, minder goed als het patroon voor tien mijlpalen wordt
(dan is B4/B2 se generieke aanpak beter).
**Varianten** Licht: alleen de vergrote Sjouwer, geen extra dimming. Zwaar: een generiek
`GOLF_MIJLPALEN`-array met meerdere van dit soort momenten door de hele run heen (golf 7,
13, 19, …), elk met een eigen unieke twist.

### B6: Richtingsgehoor

**Het idee** Geen nieuwe vijand, maar een nieuwe *eigenschap* die op bestaande types kan
zitten: een ondode die de speler nog niet gezien heeft (buiten zicht/gehoor-bereik) beweegt
langzamer en stiller totdat hij een geluidsbron opmerkt: een schot, een kapotte plank, of de
speler die te dicht langsloopt. Dit maakt het huidige, altijd-actieve `speelOndodeGrom()`-
ritme (4-9s, binnen 8m) een indicator van AANDACHT in plaats van alleen sfeer.
**Waarom dit leuk is** Dit beloont voorzichtig spelen (sluipen langs een venster in plaats
van rennen) met een tastbaar voordeel, en straft lawaaierig spelen (blind vuren) met sneller
oplopende druk. Nu is elke ondode altijd even alert; dit geeft de speler een reden om soms
juist NIET te schieten.
**Hoe het past** Een nieuwe `alert`-staat op `ondode` naast de bestaande `aanvalStaat`,
gecontroleerd door de al bestaande `ONDODE_GROM_BEREIK`-achtige afstandschecks en de
schotgeluid-triggers die al overal in het schietsysteem zitten (`schiet()`).
**Wat het raakt** `updateOndoden()` (nieuwe alert-staat, snelheidsmultiplier), `schiet()`/
`beukBarricade()` (geluidsbron-triggers), mogelijk een klein visueel signaal (dovere ogen bij
niet-alerte ondoden, gebruikmakend van `oogBasisIntensiteit` dat al per ondode instelbaar is).
**Bouwomvang** Groot. Dit raakt de kern van `updateOndoden()`'s besluitvormingslogica voor
ELK type tegelijk, wat zorgvuldige regressietests vraagt tegen alle bestaande
gedragstests (`test-ondode-hitreacties.mjs`, `test-aanval-machine.mjs`, enzovoort).
**Waar het mis kan gaan** Dit kan het spel trager laten aanvoelen als spelers de eerste
golven doorbrengen met wachten op een "veilige" aanpak in plaats van het huidige, directe
tempo. Vraagt duidelijke feedback zodat de speler nooit denkt dat het spel kapot is
("waarom beweegt hij niet").
**Varianten** Licht: alleen zichtbaar/relevant tijdens de Nachtwacht-moeilijkheidsgraad
(past goed bij die naam en het bestaande `MOEILIJKHEDEN`-verschil in `regenFactor`). Zwaar:
volledig kernmechaniek vanaf golf 1, met een eigen HUD-indicator voor "hoeveel lawaai maak ik
nu".

---

## C. Wapens en uitrusting

**Waar het spel nu staat.** Twee vuurwapens (`WAPEN_DRUKSPUIT`/`WAPEN_RATELAAR`) met een
scherpe identiteit in kick/spread/cooldown, een globaal schadepad en een per-wapen
Smederij-eindtrap. Geen melee, geen granaat, geen wapen dat de ruimte beïnvloedt in plaats
van schade toebrengt.

**De opening.** De IDENTITEIT-aanpak (precisie vs. volume, letterlijk vastgelegd in
ARCHITECTURE_NOTES §5.6) is sterk genoeg om op door te bouwen zonder 'm te verwateren. De
kans zit in het opvullen van de gaten: een paniekoptie als je zonder munitie zit, een derde
rol die geen van beide bestaande wapens vervult, en verbruiksitems die de speler tijdelijke
tactische keuzes geven zonder het twee-wapens-fundament aan te tasten.

### C1: De Blaker

**Het idee** Een melee-wapen, een oude koperen scheepslantaarn aan een steel (past bij de
gracht-thematiek), altijd beschikbaar zonder munitie, met een korte reikwijdte en een trage
maar hoge schade-slag. Geen aankoop nodig: standaard uitrusting vanaf het begin, een derde
"wapen"-slot naast de twee vuurwapens, gewisseld met een eigen toets.
**Waarom dit leuk is** Dit is het antwoord op "ik ben zonder munitie en er staat een Loper
voor mijn neus": een garantie dat de speler nooit volledig weerloos is, en een reden om soms
bewust te kiezen voor stilte (geen schotgeluid dat andere ondoden alarmeert, zie B6 als dat
ooit gebouwd wordt) in plaats van kogels te verspillen aan een enkele zwakke vijand.
**Hoe het past** Hergebruikt het volledige wapen-wissel-patroon (`wisselWapen()`,
`wisselTimer`, `WISSEL_DUUR`) en de hitreactie-/knockback-logica die al bestaat in
`raakOndode()`. Geen nieuw schade-invoersysteem nodig, alleen een nieuw `wapenStaat`-object
zonder magazijn/reserve-velden.
**Wat het raakt** `wapenStaten`, `wisselWapen()`, `schiet()`/een nieuwe `slaan()`-tegenhanger,
HUD (geen munitie te tonen voor dit wapen), een nieuw model in `maakOndodeModel()`-stijl
maar dan voor de wapen-groep.
**Bouwomvang** Middel. Het patroon bestaat al twee keer (Drukspuit/Ratelaar); een derde,
structureel ander wapen (geen kogels, korte reikwijdte, geen raycast op afstand maar een
kegel-/bolcheck) is een uitbreiding, geen nieuw systeem.
**Waar het mis kan gaan** Als de Blaker te sterk is, ondermijnt hij het hele munitie-
economie-idee (waarom nog munitie kopen). Moet expliciet zwakker zijn dan beide vuurwapens
tegen alles behalve een enkele, zwakke vijand op klem afstand.
**Varianten** Licht: puur een noodoptie, geen upgradepad. Zwaar: eigen Smederij-achtige
upgrade (bijvoorbeeld een langere reikwijdte of een kans op instant-kill tegen Lopers/
Sluipers), wat een derde eindgame-aankoop toevoegt.

### C2: Vlambuis (situationeel derde wapen)

**Het idee** Een derde, koopbaar vuurwapen met een korte-afstand vlam-kegel in plaats van
kogels: geen precisie nodig, constante schade zolang je op een vijand gericht houdt, maar een
oververhittingsbalk (zie A5, of losstaand als dit wapen 'm als enige krijgt) en een klein
effectief bereik. Sterk tegen groepjes dicht op elkaar (bij een dichtgeslibde deur), zwak
tegen een enkel doelwit op afstand.
**Waarom dit leuk is** Dit geeft de speler een derde archetype (gebiedsschade op korte
afstand) naast precisie en volume, en een reden om van wapen te wisselen afhankelijk van de
SITUATIE (een opeengepakte groep bij de deur) in plaats van alleen een DPS-race.
**Hoe het past** Hergebruikt het wapen-identiteit-patroon volledig (`WAPEN_DRUKSPUIT`/
`WAPEN_RATELAAR` als sjabloon), en de vlam-visuals bestaan al deels: `vlamDrukspuit`/
`vlamLichtDrukspuit` zijn al gebouwde mondingsvlam-meshes die als basis kunnen dienen voor
een permanente in plaats van korte flits.
**Wat het raakt** Een nieuw `WAPEN_VLAMBUIS`-object, `schiet()` (continu-vuur-logica in
plaats van cooldown-per-schot), raycast-vervanging door een kegel-/coneheck tegen
`ondoden`, een nieuw koop-/interactiepunt in de winkel.
**Bouwomvang** Groot. Continu-vuur met een kegel-hitcheck is fundamenteel anders dan de
huidige raycast-per-schot-logica en raakt de hot path van `schiet()`/`probeerTeSchieten()`.
**Waar het mis kan gaan** Gebiedsschade-wapens zijn van nature moeilijk te balanceren tegen
raycast-wapens; te sterk en het maakt de Sjouwer-blokkade-rol (B in het huidige ontwerp)
overbodig, te zwak en niemand koopt 'm.
**Varianten** Licht: gewoon een derde, koopbare optie zonder oververhitting, met een simpele
cooldown zoals de bestaande wapens. Zwaar: vervangt A5's oververhittingsidee volledig en
bouwt het als kernmechaniek van dit ene wapen.

### C3: Vluchtige uitrusting

**Het idee** Vier nieuwe, kleine verbruiksitems, koopbaar bij de Ammo-kist voor klein geld,
die de speler kan dragen (max 2 tegelijk) en op elk moment activeert met een eigen toets:
een rookflitser (korte visuele afleiding, ondoden binnen bereik verliezen even hun doel), een
lokaas (een geluidsbron die ondoden ergens anders naartoe trekt), een stimulant (tijdelijk
+50% loopsnelheid, 5s), een noodlicht (tijdelijk een fel licht dat de ogen van ondoden binnen
bereik dooft, ze even "blind" makend voor een aanval).
**Waarom dit leuk is** Dit voegt actieve, spelerinitiatief toe aan momenten die nu puur
reactief zijn (schieten wat voor je staat). Het lokaas is het interessantste: het is de
eerste manier waarop de speler ondoden bewust WEG kan sturen in plaats van ze alleen te
doden of te vermijden.
**Hoe het past** Bijna één-op-één het bestaande power-up-patroon (`POWERUP_TYPES`,
`geefX()`-functies, tijdelijke timers), alleen gekocht in plaats van gedropt, en met een
eigen klein HUD-vakje voor de twee gedragen items.
**Wat het raakt** Nieuwe winkel-entry, nieuwe `POWERUP_TYPES`-achtige effect-definities, een
inventaris-staat (`gedragenItems`, max 2), invoerafhandeling voor activatie.
**Bouwomvang** Middel. Elk los item is klein, maar vier stuks plus een inventaris-UI is
samen een middelgrote uitbreiding.
**Waar het mis kan gaan** Een inventaris met keuzes voegt een laag beslissingsdruk toe die
niet iedereen wil (sommige spelers spelen dit soort spellen juist om NIET te hoeven managen).
Moet optioneel blijven aanvoelen, niet verplicht om competitief te zijn.
**Varianten** Licht: begin met alleen het lokaas en de stimulant, de twee met het duidelijkste
directe effect. Zwaar: alle vier plus een vijfde, dure variant die alleen via de Smederij-
route ontgrendeld wordt.

### C4: Wapenverval en onderhoud

**Het idee** Beide bestaande wapens krijgen een langzaam oplopende "vervuiling"-waarde over
de hele run (niet per golf), die de kick licht vergroot en de herlaadtijd licht verlengt.
Bij de Smederij (of een nieuw, goedkoop interactiepunt) kan de speler het wapen reinigen voor
een klein bedrag, wat de vervuiling terugzet naar 0.
**Waarom dit leuk is** Dit geeft een reden om tussen golven door terug te lopen naar een
vaste plek in de kaart, wat de bestaande winkelroute-loop een extra, herhaalde stop geeft
zonder een nieuwe kaart-locatie te hoeven bouwen (hergebruikt de Smederij-positie).
**Hoe het past** Een nieuw veld op `wapenStaat` naast `magazijn`/`reserve`, uitgelezen in
dezelfde plekken waar `kickSterkte`/`herlaadDuur` nu al gebruikt worden.
**Wat het raakt** `wapenStaat`, `schiet()` (kick-berekening), `herladen()` (duur-berekening),
een nieuwe actie bij de Smederij.
**Bouwomvang** Klein. Eén nieuw veld, twee plekken waar het de bestaande berekening licht
aanpast, één nieuwe actie op een bestaand interactiepunt.
**Waar het mis kan gaan** Als de speler dit niet opmerkt (te subtiel effect) is het een
onzichtbare tax; als het te sterk is, voelt wapengebruik als een boekhoudkundige last in
plaats van plezier. Dit is het risico van bijna elk "onderhoud"-mechaniek: het moet voelbaar
zijn zonder vervelend te worden.
**Varianten** Licht: puur cosmetisch (een roetlaag op het model), geen mechanisch effect.
Zwaar: vervuiling kan een wapen tijdelijk laten haperen (een enkel gemist schot, geen kogel
verbruikt) als 'm niet op tijd gereinigd wordt, wat het een echt risico maakt in plaats van
een geleidelijke degradatie.

### C5: De Ratelklem

**Het idee** Een plaatsbaar, koopbaar object (niet een wapen maar uitrusting): een kleine
automatische klem die de speler op een vloertegel neerzet en die ondoden die eroverheen
lopen tijdelijk vertraagt (geen schade, puur controle). Beperkt aantal gelijktijdig geplaatst
(bijvoorbeeld 2), verplaatsbaar door 'm opnieuw te activeren.
**Waarom dit leuk is** Dit is de eerste vorm van RUIMTE-manipulatie die de speler zelf in de
hand heeft in plaats van alleen doorgangen te openen/dichten via deuren. Het creëert het
moment waarop je vooraf, tijdens de rustperiode, een klem bij een venster legt omdat je weet
dat daar zo een Loper doorheen komt.
**Hoe het past** Een nieuw, klein object-array (zoals `powerups` of `stervenden`) met een
eigen update-loop die de snelheid van ondoden binnen een straal aanpast, hergebruikt de
bestaande `ondode.snelheid`-multiplier-aanpak die nu al voor `AANVAL_HERSTEL_SNELHEIDSFACTOR`
bestaat.
**Wat het raakt** Nieuw koop-item, nieuwe game-loop-array plus update-functie, een kleine
uitbreiding in `updateOndoden()` die checkt of een ondode binnen het bereik van een klem
staat.
**Bouwomvang** Middel. Volgt het bestaande object-array-patroon (spawn/update/opruimen) dat
al drie keer in de codebase voorkomt (powerups, stervenden, effecten), dus geen nieuw
architectuurpatroon nodig.
**Waar het mis kan gaan** Plaatsbare objecten kunnen de kaart rommelig maken of, erger, een
te dominante strategie worden (twee klemmen bij de enige twee ingangen maakt een golf
triviaal). Vraagt een plafond op hoeveel vertraging cumulatief mag optreden.
**Varianten** Licht: één klem tegelijk, kort effect (2s vertraging). Zwaar: een tweede,
duurdere variant die ook een kleine schade-over-tijd geeft, wat 'm van puur controle naar
een hybride controle/schade-tool maakt.

### C6: Het tweede paar handen

**Het idee** Een koopbare upgrade (niet bij de Smederij, een nieuwe, goedkope aankoop vroeg
in het spel) die het herladen sneller maakt als de speler stilstaat, maar even snel blijft
als nu tijdens bewegen. Dit is geen nieuw wapen maar een nieuwe SPEELSTIJL-vraag: sta ik stil
om sneller te herladen, of blijf ik bewegen ten koste van herlaadsnelheid?
**Waarom dit leuk is** Dit voegt een micro-beslissing toe aan elk herlaadmoment (nu een
vaste tijd, ongeacht wat de speler doet) zonder een nieuw systeem: gewoon een voorwaarde op
de bestaande `herlaadDuur`-berekening.
**Hoe het past** `updateWapen()`'s herlaad-tak leest nu al `wapenStaat.herlaadTimer`; een
beweging-check (`speler.positie` vergelijken met de vorige frame, wat al ergens in
`updateSpeler()` gebeurt voor de bob-animatie) is de enige nieuwe logica.
**Wat het raakt** `updateWapen()`, mogelijk een kleine HUD-hint ("stilstaan = sneller
herladen") zodat de speler het ontdekt.
**Bouwomvang** Klein. Eén voorwaarde in een bestaande berekening, geen nieuwe state.
**Waar het mis kan gaan** Onzichtbare mechanieken die de speler nooit ontdekt zijn waardeloos.
Dit vraagt duidelijke, herhaalde feedback (misschien een subtiel geluid of icoon) zodat het
niet een verborgen systeem blijft dat alleen in de code bestaat.
**Varianten** Licht: alleen cosmetisch anders (snellere animatie), geen echte tijdswinst.
Zwaar: gekoppeld aan de Snelspanner-upgrade (die al herlaadsnelheid raakt), zodat stilstaand
herladen met de Snelspanner gekocht een significant, zichtbaar verschil geeft.

---

## D. Wat de speler zelf wordt

**Waar het spel nu staat.** Elke aankoop is een blijvende, generieke versterking: meer
schade, meer magazijn, meer HP, sneller herladen. Twee runs met dezelfde speelvolgorde
voelen mechanisch identiek, ongeacht wat de speler "koos". Er is uiteindelijk maar één
optimale koopvolgorde omdat niets elkaar uitsluit.

**De opening.** Dit is het gebied waar de opdracht zelf het scherpst een gat benoemt: de
speler wordt nooit een ANDER soort speler. Er is geen enkele plek in de huidige economie waar
kiezen voor het één het ander onmogelijk maakt. Dat is de kans: bouw een klein aantal
keuzepunten die zich echt uitsluiten.

### D1: Twee paden bij de Smederij

**Het idee** Als een wapen bij de Smederij gesmeed wordt, kiest de speler niet alleen "gesmeed
ja/nee" maar tussen twee gesmede varianten met een blijvend andere eigenschap: het
Vlammenpad (extra schade, zoals nu, maar de mondingsvlam is groter en trekt zichtbaar meer
aandacht/geluid) of het Stille pad (kleinere schadebonus dan nu, maar geen enkele
alertheidstoename bij nabije ondoden, zie B6 als dat gebouwd wordt, of anders gewoon een
stillere schotToon). Onomkeerbaar per wapen per run.
**Waarom dit leuk is** Dit is de eerste ONOMKEERBARE keuze in het spel die niet puur een
getal is. Een speler die twee keer speelt en twee keer anders kiest, speelt mechanisch een
ander spel, niet alleen een net-iets-anders-getunede versie ervan.
**Hoe het past** `smederijConfig` bestaat al als per-wapen object met `schadeBonus`/
`magazijnMax`; dit breidt het uit naar twee alternatieve configs waartussen bij aankoop
gekozen wordt, met dezelfde `koopSmederij()`-flow.
**Wat het raakt** `smederijConfig`-structuur (twee varianten in plaats van één),
`koopSmederij()` (keuzemoment), `schiet()` (het stille-pad-effect), de winkel-UI bij de
Smederij.
**Bouwomvang** Klein tot middel. Hergebruikt de volledige bestaande Smederij-flow, voegt
alleen een keuzemoment en een tweede configvariant toe.
**Waar het mis kan gaan** Als één pad objectief beter is (wat bij twee opties met genoeg
speeluren snel duidelijk wordt), verdwijnt de keuze en wordt het gewoon "het betere pad
kiezen". Vraagt zorgvuldige balans zodat beide sterk zijn in verschillende situaties.
**Varianten** Licht: het verschil is puur cosmetisch/audio, geen mechanisch effect (veilige
eerste stap, test of spelers de keuze zelf al waarderen). Zwaar: drie paden in plaats van
twee, elk gekoppeld aan een van de drie moeilijkheidsgraden qua thema.

### D2: Vaardigheidspunten uit koppijnschade

**Het idee** Elke headshot-kill (niet elke kill) geeft naast geld ook een klein aantal
"scherpte"-punten, een aparte, zichtbare teller. Bij drie vaste drempels (bijvoorbeeld 15/40/
80 punten) mag de speler één passieve eigenschap kiezen uit een korte lijst van drie, waarvan
er daarna nooit meer een gewijzigd kan worden: kortere windup-herkenning (de tell-animaties
van vijanden beginnen zichtbaar eerder in de HUD/het model), een grotere headshot-hitbox, of
een korting op alle winkelprijzen.
**Waarom dit leuk is** Dit beloont GERICHT spelen (headshots, niet zomaar raken) met een
permanente, herkenbare identiteit voor de rest van de run, en het maakt "hoe speel ik" een
vraag die je vanaf golf 1 beantwoordt in plaats van pas bij het kopen van upgrades.
**Hoe het past** Een nieuwe teller naast `runStats` (die al headshots bijhoudt via
`runStats.headshots`), drie nieuwe permanente vlaggen die her en der uitgelezen worden
(`raakOndode()` voor de hitbox, `updateOndoden()`'s tell-timing voor de vroege herkenning,
prijs-checks voor de korting).
**Wat het raakt** `runStats`, `raakOndode()`, drie verspreide leesplekken voor de gekozen
eigenschap, een nieuwe keuze-UI bij het bereiken van een drempel.
**Bouwomvang** Middel. De teller zelf is triviaal, de drie eigenschappen raken elk een ander
deel van de codebase (combat, AI-tells, economie) en moeten elk apart getest worden.
**Waar het mis kan gaan** Als de drie opties niet gelijkwaardig aanvoelen, kiest iedereen
hetzelfde en verdwijnt de keuze in de praktijk, ook al bestaat hij op papier. De "vroegere
tell-herkenning"-optie is het lastigst te balanceren omdat het effect subtiel is.
**Varianten** Licht: één keuzemoment in plaats van drie, later in de run (bijvoorbeeld pas bij
40 punten). Zwaar: elke drempel geeft een keuze uit VIJF opties in plaats van drie, met echte
overlap in kracht zodat de keuze moeilijker wordt.

### D3: Littekens

**Het idee** Als de speler tijdens een run drie keer onder de 15 HP komt en overleeft, krijgt
hij een blijvend litteken-effect voor de rest van DIE run: het maximale HP zakt licht (-10),
maar de schade-per-treffer stijgt evenredig. Zichtbaar op de speler zelf niet (geen derde-
persoonsview), maar wel in een klein HUD-icoon en in de post-run statistieken.
**Waarom dit leuk is** Dit is een consequentie die uit SPEELGEDRAG voortkomt in plaats van
uit een winkelbezoek: een speler die roekeloos speelt en het overleeft, wordt daadwerkelijk
een andere (agressievere, kwetsbaardere) speler voor de rest van die run. Het is het enige
voorstel in dit document dat de speler kan straffen én belonen tegelijk, precies zoals de
opdracht vraagt ("ontwikkelingen waar je achteraf spijt van kunt hebben").
**Hoe het past** Een simpele teller op `runStats` (bijna-doodmomenten), uitgelezen in
`spelerStaat`/`schadePerTreffer`-berekeningen op het moment dat de drempel wordt bereikt.
**Wat het raakt** `runStats`, `spelerSchade()` (drempeldetectie), `spelerStaat.hpMax`,
`schadePerTreffer`-berekening, HUD, het eindscherm.
**Bouwomvang** Klein. Eén teller, één drempelcheck, twee bestaande waarden die eenmalig
aangepast worden.
**Waar het mis kan gaan** Als het effect netto positief is (meer schade weegt zwaarder dan
minder HP), wordt roekeloos spelen de OPTIMALE strategie in plaats van een risico, wat het
hele idee van "consequentie" ondermijnt. Moet zorgvuldig net-niet-winstgevend getuned worden.
**Varianten** Licht: alleen zichtbaar in de eindstatistieken, geen mechanisch effect (puur
verhalend). Zwaar: meerdere littekenniveaus die zich opstapelen, met een vierde litteken dat
een echt unieke, sterke maar riskante eigenschap geeft.

### D4: De koopvaardersbrief

**Het idee** Bij de start van een run kiest de speler (net als nu bij de moeilijkheidsgraad)
ook een korte, eenmalige "insteek" die twee tot drie startaankopen al doet en twee andere
permanent duurder maakt: de Scherpschutter (start met de schade-upgrade, Ratelaar kost
dubbel), de Loopjongen (start met €300 extra en de Snelspanner, maar geen gratis HP-regen-
boost ooit), de Aannemer (deur 1 en 2 zijn al open bij golf 1, maar alle overige prijzen
+20%).
**Waarom dit leuk is** Dit maakt de EERSTE vijf minuten van elke run al anders, wat nu de
meest identieke fase van het spel is (iedereen begint met niets in de woonkamer). Het geeft
spelers meteen bij het opstarten een reden om te zeggen "deze keer speel ik de Aannemer".
**Hoe het past** Hetzelfde patroon als `MOEILIJKHEDEN` (een object met een paar vaste
multipliers, gekozen op het startscherm, opgeslagen in een `let`), toegepast op prijzen en
startstaat in plaats van op budget/regen/score.
**Wat het raakt** Een nieuw `INSTEKEN`-object naast `MOEILIJKHEDEN`, het startscherm-UI
(uitbreiding van het bestaande moeilijkheidskeuzescherm), prijsberekeningen door de hele
winkel.
**Bouwomvang** Middel. Het patroon is bewezen (identiek aan hoe moeilijkheidsgraden nu al
werken), maar het raakt VEEL plekken omdat prijzen door de hele winkelcode heen los staan
(elke `_PRIJS`-constante moet een multiplier kunnen accepteren).
**Waar het mis kan gaan** Als een insteek strikt beter is dan de andere, verdwijnt de keuze.
Ook: te veel keuzeschermen vóór golf 1 (moeilijkheidsgraad + insteek) kan de start vertragen
en overweldigend aanvoelen voor nieuwe spelers.
**Varianten** Licht: twee insteken in plaats van drie, en optioneel (een "geen insteek"-optie
blijft de standaard, huidige ervaring). Zwaar: insteken zijn combineerbaar met D1/D2/D3, zodat
een build zich over de hele run opbouwt uit meerdere lagen keuzes.

### D5: Het handvest van de Nachtwacht

**Het idee** Een losstaand, opt-in systeem: vóór het starten van een run kan de speler een
of meer zelfgekozen, extra beperkingen aanzetten (geen regeneratie, geen Smederij, altijd op
Nachtwacht-budget) in ruil voor een zichtbare, permanente markering op het eindscherm en de
highscore-lijst ("voltooid zonder regeneratie"). Geen mechanisch voordeel, puur erkenning.
**Waarom dit leuk is** Dit is de goedkoopste vorm van "een run die zich onderscheidt van de
vorige": geen nieuwe content nodig, alleen een expliciete, zichtbare manier om jezelf een
zelfgekozen handicap op te leggen en dat later te kunnen laten zien. Voor spelers die het
spel al goed kennen is dit de reden om nog een keer te spelen zonder dat het spel zelf
groter hoeft te worden.
**Hoe het past** Een simpele set booleans, gecontroleerd op de plekken waar het betreffende
systeem al bestaat (`updateSpelerRegen()` vroeg terugkeren, de Smederij-interactiepunt
verbergen), en meegenomen in de highscore-opslag (`schrijfHighscore()`/`leesHighscore()`,
al gevalideerd sinds Ticket 74).
**Wat het raakt** Startscherm-UI, een paar vroege-return-checks in bestaande functies, het
highscore-opslagformaat (uitbreidbaar veld, zoals `moeilijkheid` al een los veld is).
**Bouwomvang** Klein. Puur schakelaars op bestaand gedrag, geen nieuwe systemen.
**Waar het mis kan gaan** Zonder een manier om dit met anderen te DELEN (geen server, geen
account, zie het kader) blijft de erkenning alleen zichtbaar voor de speler zelf op zijn
eigen scherm. De waarde hangt dus af van hoe belangrijk "ik weet het van mezelf" is zonder
publiek. Dat is iets wat ik niet kan inschatten zonder te weten wie er speelt.
**Varianten** Licht: één vaste, harde modus ("IJskoud": geen regeneratie, geen Watertap) in
plaats van combineerbare losse schakelaars. Zwaar: gekoppeld aan J (redenen om opnieuw te
spelen) met een volledige lijst van dit soort zelfgekozen uitdagingen die elk apart worden
bijgehouden.

---

## E. De ruimte

**Waar het spel nu staat.** Vijf zones plus twee veilige kelders, verbonden door deuren en
een navigatiegraaf (`ZONE_GRAAF`/`NAV_VOLGENDE`), met barricades als enige veranderlijke
staat binnen een zone. De kaart zelf is, eenmaal ontgrendeld, statisch: dezelfde geometrie
van golf 1 tot golf 25.

**De opening.** De navigatie-infrastructuur (een echte graaf, een aparte waypoint-laag voor
chokepoints) is precies het fundament dat nodig is om de ruimte GEDRAG te geven in plaats van
alleen LAYOUT. Wat ontbreekt is verandering over tijd: niets in de kaart is op golf 20 anders
dan op golf 1, behalve welke deuren open zijn.

### E1: De zolderroute

**Het idee** Een nieuwe, verticale route die pas vanaf golf 9 opengaat: een luik in het
plafond van het Atelier (waar al licht van boven valt, zie `ZONE_FLAVOUR[2]`) dat de speler
kan openen en dat een korte, smalle route over een "zolder" biedt die uitkomt boven de
Binnenplaats. Ondoden kunnen deze route ook gebruiken zodra hij open is, van beide kanten.
**Waarom dit leuk is** Dit is het letterlijke voorbeeld uit de opdracht: de speler hoort iets
(een kraak, hergebruik van `speelGangKraak()`-stijl geluid) en beseft dat er nu een nieuwe
weg is, in twee richtingen. Het is de eerste plek in het spel waar VERTICALITEIT een
tactische rol speelt in plaats van alleen de trap naar de kelder (die al bestaat maar altijd
open en veilig is).
**Hoe het past** Hergebruikt `berekenKelderY()`-achtige Y-interpolatie (al bewezen voor de
keldertrap) voor de zolderhoogte, en de zonegraaf/waypoint-laag (`ZONE_WAYPOINTS`) voor de
route zelf, die nu al chokepoints modelleert.
**Wat het raakt** Nieuwe geometrie (zolderruimte), `ZONE_GRAAF`/`NAV_VOLGENDE` (een extra,
voorwaardelijke verbinding tussen Atelier en Binnenplaats), `updateOndoden()`'s
navigatielogica (moet deze route kunnen kiezen), obstakel-registratie.
**Bouwomvang** Groot. Dit is de eerste route die de zonegraaf zelf tijdens een run verandert
(niet alleen een deur open/dicht, maar een heel NIEUWE verbinding), wat zorgvuldig testen
vraagt tegen alle bestaande navigatietests.
**Waar het mis kan gaan** Een tweede route tussen twee zones kan de zorgvuldig getunede
spawn-druk (`ZONE_SPAWN_INTERVAL_FACTOR`) overhoop gooien als ondoden nu ineens van twee
kanten tegelijk kunnen komen zonder dat het budget daarop is afgestemd.
**Varianten** Licht: de route is alleen voor de SPELER bruikbaar, ondoden kunnen er niet
doorheen (puur een vluchtroute/shortcut, geen nieuwe dreigingsrichting). Zwaar: de route is
tijdelijk, sluit na een aantal golven weer (het luik "verzakt"), wat 'm een tijdgebonden kans
maakt in plaats van een permanente aanwinst.

### E2: Verzakking

**Het idee** Vanaf golf 15 kan, willekeurig eens per paar golven, een deel van de vloer in
een REEDS ontgrendelde zone tijdelijk onbegaanbaar worden (een zichtbare, aflopende
verzakking met stof/geluid als waarschuwing 2 seconden vantevoren). Na de golf hersteld hij
zich vanzelf. Ondoden vermijden 'm net als de speler (dezelfde `isVrijePlek()`-check).
**Waarom dit leuk is** Dit is een manier om een BEKENDE, veilig gewaande ruimte tijdelijk
onbetrouwbaar te maken zonder nieuwe content te bouwen: dezelfde kamer die je al twintig
golven kent, gedraagt zich ineens anders. Het beloont spelers die op de waarschuwing letten
en straft spelers die op de automatische piloot door een kamer rennen.
**Hoe het past** Hergebruikt `obstakels`/`registreerRechthoek()` (tijdelijk een obstakel
toevoegen en weer verwijderen) en het bestaande stof-deeltjes-systeem
(`updateStofwolken()`) voor de waarschuwing.
**Wat het raakt** `obstakels`, een nieuwe timer-gedreven trigger in de golf-loop, geluid
(nieuwe `speel*()`-functie voor het gekraak), en `isVrijePlek()` moet de tijdelijke
verzakking meewegen.
**Bouwomvang** Middel. Het obstakel-systeem bestaat al volledig; dit is een tijdelijke,
timer-gedreven toevoeging eraan, geen nieuw ruimtelijk systeem.
**Waar het mis kan gaan** Als een verzakking de speler klem kan zetten (geen uitweg meer in
een zone) is dit game-breaking in plaats van spannend. Moet gegarandeerd altijd een vrije
route openlaten, wat een validatiecheck vraagt bij het kiezen van de verzakkingslocatie.
**Varianten** Licht: alleen decoratief/vertragend (een omweg, geen echte blokkade). Zwaar:
de verzakking doet ook schade als je erop staat wanneer hij instort, wat 'm van een
navigatiepuzzel naar een echte dreiging maakt.

### E3: De vluchtheuvel binnen

**Het idee** Eén klein, vast plekje per zone (een tafel, een kast, een richel) dat de speler
op kan klimmen en van waaruit ondoden hem niet met melee kunnen raken, maar wel omheen blijven
verzamelen. Een verticale, zeer beperkte veilige plek MIDDEN in het gevecht, in
tegenstelling tot de kelders die volledig combat-vrij zijn.
**Waarom dit leuk is** Dit geeft de speler een kort adempauze-moment zonder de golf te
onderbreken: even op de tafel klimmen om te herladen terwijl drie ondoden eronder staan te
grommen, is een heel ander soort spanning dan wegrennen naar de kelder.
**Hoe het past** Een klein aantal vaste, geregistreerde punten (zoals `interactiePunten`
maar dan voor klimmen), met een simpele Y-offset op `speler.positie` zoals de kelder-Y-
interpolatie (`berekenKelderY()`) al doet, en een aanpassing in `AANVAL_START_BEREIK`-checks
zodat melee-aanvallen deze hoogte niet bereiken.
**Wat het raakt** Nieuwe geometrie (klein aantal meshes), speler-Y-logica, `updateOndoden()`'s
aanvalsbereik-check (moet hoogte meewegen, wat nu nergens gebeurt, alle afstandschecks zijn
puur X/Z).
**Bouwomvang** Groot. Dit introduceert Y als factor in combat-berekeningen die nu overal
puur horizontaal zijn (`afstand`, `AANVAL_START_BEREIK`), wat een fundamentelere wijziging is
dan de omvang van de geometrie zelf doet vermoeden.
**Waar het mis kan gaan** Als klimmen een dominante, risicoloze strategie wordt (op de tafel
staan en rustig iedereen wegschieten), verliest elke golf zijn druk. Moet een echte
kwetsbaarheid houden (bijvoorbeeld: een Brander kan je er nog steeds vanaf blazen via zijn
explosieradius, die al 3D werkt via `pos.distanceTo()`).
**Varianten** Licht: alleen op één specifieke, zeldzame plek in de hele kaart (een proef).
Zwaar: elke zone krijgt er een, en een schutter-vaardigheid (D2) kan het effect versterken.

### E4: Wisselwacht

**Het idee** Vanaf golf 11 kan de speler bij een nieuw, goedkoop interactiepunt (de
Wachtpost) een van de twee al-open doorgangen tussen twee zones tijdelijk laten VERGRENDELEN
voor 30 seconden (een zichtbare balk die neervalt), tegen betaling die elke keer hoger wordt.
Dit blokkeert die route volledig, ook voor de speler zelf.
**Waarom dit leuk is** Dit geeft de speler voor het eerst ACTIEVE controle over de
spawn-richting binnen een golf: "ik vergrendel de gang tijdelijk zodat alles via de
binnenplaats moet komen, waar ik met De Ratelaar sta te wachten." Het verschuift de speler
van reactief (schieten wat komt) naar strategisch (bepalen waar het vandaan komt).
**Hoe het past** Hergebruikt de bestaande deur-obstakel-registratie (`deurObstakel`,
`registreerRechthoek()`) tijdelijk toegepast op een AL open doorgang, en de
navigatiegraaf-herbouw (`herbouwNavTabel()`) die al bij elke deuraankoop draait.
**Wat het raakt** Nieuw interactiepunt, tijdelijke obstakel-toggle op bestaande deur-
posities, `herbouwNavTabel()`-aanroep bij elke vergrendeling/ontgrendeling.
**Bouwomvang** Middel. Het obstakel-/navigatiesysteem ondersteunt dit al functioneel; de
uitdaging zit in het herhaaldelijk herbouwen van de navigatietabel zonder een performance-
probleem te introduceren (nu gebeurt dat alleen bij permanente deuraankopen, dus zeldzaam).
**Waar het mis kan gaan** Als de speler zichzelf per ongeluk kan opsluiten (alle routes tegelijk
vergrendeld) is dit een softlock. Vraagt een harde regel: minstens één route moet altijd open
blijven, gevalideerd vóór de vergrendeling wordt toegestaan.
**Varianten** Licht: slechts één vergrendeling tegelijk mogelijk, korte duur (15s). Zwaar:
meerdere Wachtposten door de kaart heen, elk voor een andere doorgang, wat het tot een
volwaardig, spelbepalend systeem maakt in plaats van een noodgreep.

### E5: Een tweede uitweg

**Het idee** Een alternatieve, kleinere ontsnappingsroute die niet via de boot loopt maar via
een dichtgetimmerd raam aan de straatkant van de Woonkamer (de kant die nu volledig decor is).
Vanaf golf 18 kan de speler dit voor een hoge prijs openbreken; het is sneller te bereiken dan
de boot maar geeft een lagere eindscore (geen ontsnappingsbonus van +1000, zie `berekenScore()`).
**Waarom dit leuk is** Dit geeft spelers die het spel willen UITSPELEN zonder perfect te
zijn een geloofwaardige, mindere overwinning, in plaats van het alles-of-niets van de boot.
Het creëert ook een echte afweging laat in de run: "ga ik voor de volle score via de boot, of
neem ik de zekere maar mindere uitweg via de straat."
**Hoe het past** Hergebruikt het volledige ontsnappings-patroon (`ontsnappingsPunt`,
`probeerOntsnapping()`, `toonWinScherm()`) met een andere prijs, andere locatie, en een
aparte scoreberekening.
**Wat het raakt** Nieuwe geometrie (straatkant-uitgang, nu puur decor), een tweede
`ontsnappingsPunt`-achtige staat, `berekenScore()` (lagere bonus voor deze route), het
eindscherm (moet onderscheid maken welke route genomen is).
**Bouwomvang** Middel. Het ontsnappingssysteem zelf is al generiek genoeg om te dupliceren;
de nieuwe geometrie en de tweede scoreformule zijn het echte werk.
**Waar het mis kan gaan** Twee win-condities kunnen de bestaande boot-ontsnapping, die nu het
hele eindspel (H) draagt, verwateren als de straatroute simpelweg de "makkelijke" versie is
die iedereen kiest. Zie ook sectie H voor de bredere afweging hierover.
**Varianten** Licht: de straatroute is puur een vroegtijdig-stoppen-optie zonder eigen
identiteit (gewoon minder score, verder niets bijzonders). Zwaar: de straatroute heeft een
eigen korte, spannende opbouw (bijvoorbeeld een golf ondoden die specifiek daarop afkomt
zodra je 'm begint open te breken), symmetrisch met de boot-aankondiging.

### E6: Etalages

**Het idee** Kleine, cosmetische maar functionele details in elke zone die op golf-mijlpalen
zichtbaar veranderen zonder de plattegrond zelf te wijzigen: kapotte ramen die dichtgetimmerd
raken naarmate de run vordert (ook op plekken zonder spawn-venster), bloedsporen die zich
opstapelen op plekken waar veel gevochten is, een steeds voller wordende ereplank bij de
Smederij met elk gesmeed wapen. Puur registratie, geen nieuwe systemen.
**Waarom dit leuk is** Dit is de goedkoopste manier om een run een eigen GESCHIEDENIS te
geven die zichtbaar is terwijl je erdoorheen loopt, in plaats van alleen in een
statistiekenscherm achteraf. Het atelier waar je net drie golven hebt doorstaan ziet er
anders uit dan toen je binnenkwam.
**Hoe het past** Hergebruikt bestaande decor-bouwfuncties en materiaal-caches (`mat()`/
`matFamilie()`) voor de dichtgetimmerde ramen, en een simpele telling per zone
(vergelijkbaar met `runStats`) voor waar gevochten is.
**Wat het raakt** Kleine decor-toevoegingen door de bestaande zone-bouwfuncties heen, een
nieuwe, lichte per-zone telling.
**Bouwomvang** Klein. Puur cosmetisch, geen nieuwe gameplay-systemen, veilig om incrementeel
uit te breiden.
**Waar het mis kan gaan** Als het te subtiel is, merkt niemand het ooit op en is het
verspilde moeite. Vraagt een paar duidelijk zichtbare momenten (niet alleen bloedvlekken die
niemand bewust bekijkt) om de investering te rechtvaardigen.
**Varianten** Licht: alleen de Smederij-ereplank (één duidelijke, herkenbare plek). Zwaar:
een volledig systeem dat elke zone laat "verouderen" naarmate de run vordert, gekoppeld aan
golfnummer in plaats van aan specifieke gebeurtenissen.

---

## F. Wereldgebeurtenissen

**Waar het spel nu staat.** Twee event-golftypes (Mist, Stroomuitval), beide harde
regelwijzigingen die exact 5 golven duren tot de volgende. Beide zijn STRAF-achtig: minder
zicht, minder licht. Geen enkel event is een beloning, en niets bouwt zich geleidelijk op
over de hele run heen.

**De opening.** Het framework (`kiesEventType`/`startEventGolf`/`eindigEventGolf`) is
duidelijk ontworpen om meer dan twee types te dragen. De kans zit zowel in een derde harde
event als in zachtere vormen: iets dat de speler zelf uitlokt, en iets dat als beloning voelt.

### F1: Klokslag Middernacht

**Het idee** Een derde eventgolf: geen visuele of spawnwijziging, maar een audio-only event.
Gedurende deze golf is de dreigingsaudio (`berekenDreigingsGain()`) twee keer zo gevoelig
(een lagere afstandsdrempel triggert 'm al) en speelt er een zeldzaam, ver galmend
klokgeluid (hergebruik van `speelGrachtklok()`) op onregelmatige intervallen, los van de
Nevelklok. Verder verandert er niets aan spawns of licht.
**Waarom dit leuk is** Dit bewijst dat een event niet altijd de regels van combat hoeft te
raken om anders te voelen. Puur door het geluidslandschap te verschuiven ontstaat een golf
die psychologisch zwaarder aanvoelt zonder mechanisch moeilijker te zijn, precies het soort
"zachtere vorm" dat de opdracht vraagt.
**Hoe het past** Volledig binnen het bestaande event-framework, met alleen aanpassingen aan
al bestaande audioparameterberekeningen (`DREIGINGS_NABIJHEID_BEREIK`, hergebruik van
`speelGrachtklok()`/de Nevelklok-oscillatoropzet).
**Wat het raakt** `kiesEventType()`, `berekenDreigingsGain()` (event-afhankelijke drempel),
een nieuwe timer voor het klokgeluid.
**Bouwomvang** Klein. Zuiver audioparameters aanpassen binnen bestaand framework, geen
nieuwe visuele of AI-systemen.
**Waar het mis kan gaan** Een puur audio-event is het risico waard dat spelers het niet
opmerken als er geen enkele visuele bevestiging is (geen banner-tekst die het uitlegt zou
het te onopvallend maken). Moet op zijn minst een duidelijke aankondigingsbanner hebben, ook
al verandert er verder niets zichtbaars.
**Varianten** Licht: alleen de klok, geen aangepaste dreigingsgevoeligheid. Zwaar: gecombineerd
met een tijdelijke uitschakeling van de achtergrondmuziek (stilte, op de dreigingsdrone na),
wat het contrast nog groter maakt.

### F2: Vloedgolf

**Het idee** Een derde harde event: het water bij de gracht stijgt zichtbaar (de bestaande
`waterMesh` iets omhoog schalen/verplaatsen) en de vlonder/gang-naar-de-gracht wordt
tijdelijk minder begaanbaar (nattere, glibberige vloer die de speler een fractie langzamer
maakt op die ene locatie, zoals de kelder al een eigen Y-beweging heeft). Ondoden die uit die
richting komen zijn tijdens dit event UITSLUITEND Lopers (het water spoelt de snelste,
lichtste types aan).
**Waarom dit leuk is** Dit is het eerste event dat een specifieke ZONE raakt in plaats van de
hele kaart, wat de speler dwingt zijn positie binnen de kaart te heroverwegen voor de duur
van het event: normaal een relatief rustige hoek, nu tijdelijk de gevaarlijkste plek.
**Hoe het past** Volledig het bestaande event-framework, met een event-specifieke
spawn-gewichtenfunctie (zoals Mist al `sluiper: 1` teruggeeft) en een kleine, tijdelijke
snelheidsmultiplier op een vaste locatie (vergelijkbaar met hoe `berekenKelderY()` positie-
afhankelijk gedrag toevoegt).
**Wat het raakt** `kiesEventType()`, `ondodeTypeGewichten()` (event-specifieke mix,
locatie-afhankelijk in plaats van globaal, een nieuwe soort gating), speler-snelheids-
berekening op die ene locatie, de `waterMesh`-visuals.
**Bouwomvang** Middel. Het framework bestaat, maar dit is het eerste event dat een
LOCATIE-afhankelijke in plaats van globale regelwijziging vraagt.
**Waar het mis kan gaan** Als de Gang-naar-de-Gracht buiten dit event nauwelijks bezocht
wordt (die route is vooral relevant vanaf golf 10 voor de boot), kan dit event grotendeels
onopgemerkt voorbijgaan bij spelers die zich daar toch al niet ophouden. Werkt het best als
het de speler actief NAAR die zone toe trekt (bijvoorbeeld gekoppeld aan een aasplek, zie A4).
**Varianten** Licht: alleen de visuele waterstijging, geen spawn-/snelheidswijziging (sfeer
zonder mechaniek). Zwaar: als de speler tijdens dit event bij de gracht blijft en overleeft,
een gegarandeerde extra vluchtroute-onderdeel-vondst als beloning, wat het risico
aantrekkelijk maakt in plaats van alleen bedreigend.

### F3: De Stilte voor de Storm (opbouwend event)

**Het idee** Geen aparte eventgolf, maar een doorlopende, onzichtbare "spanning"-waarde die
over de HELE run langzaam oploopt zolang de speler geen schade oploopt en geen kills mist
(hoge nauwkeurigheid, geen barricades die doorbreken). Bij een piek ontstaat een kort,
eenmalig "Storm"-moment: een korte, extra zware mini-golf van 10-15 seconden met een unieke
banner, waarna de spanning terugvalt naar 0.
**Waarom dit leuk is** Dit is het "iets dat gedurende een hele run opbouwt" dat de opdracht
vraagt: een speler die het spel goed speelt, bouwt onbewust naar een eigen climax toe. Het
beloont indirect goed spelen met meer spektakel, in plaats van dat goed spelen alleen "minder
gevaar" betekent.
**Hoe het past** Een nieuwe, doorlopende teller (zoals `spelStaat.budget` maar dan over de
hele run in plaats van per golf), gevoed door bestaande signalen (`runStats.treffers`/
`raakOndode()`-uitkomsten, `beukBarricade()`-aanroepen), die bij een drempel een eenmalige,
extra spawn-burst triggert los van de normale `golfSpawnStap()`-cadans.
**Wat het raakt** Een nieuwe globale statusvariabele, uitlezingen in `raakOndode()`/
`beukBarricade()`, een nieuwe spawn-burst-functie naast `golfSpawnStap()`.
**Bouwomvang** Middel. Geen nieuwe vijand- of ruimtesystemen nodig, wel een nieuwe,
doorlopende metingslaag over de hele run die zorgvuldig getuned moet worden zodat het niet
te vaak of te zelden triggert.
**Waar het mis kan gaan** Een onzichtbare spanningsmeter die de speler niet kan zien of
beïnvloeden bewust, voelt willekeurig aan als de speler nooit doorheeft WAAROM de Storm nu
komt. Vraagt op zijn minst een subtiele, oplopende audio-hint (een langzaam intensiverende
laag op de bestaande dreigingsaudio) zodat het voelt als iets dat je hebt zien aankomen.
**Varianten** Licht: een simpele, zichtbare balk op de HUD in plaats van een verborgen
mechaniek (minder verrassend, maar eerlijker). Zwaar: de speler kan de opbouw bewust
VERSNELLEN door risicovol te spelen (A4-aasplekken pakken, dicht bij vijanden blijven),
waardoor het een actief keuzemiddel wordt in plaats van een passief gevolg.

### F4: Etentje bij de buren (uitgelokt event)

**Het idee** Een event dat de speler zelf activeert: bij een nieuw, verborgen interactiepunt
(een geheime knop of een specifiek te vernielen object, pas zichtbaar na een aantal golven)
kan de speler bewust een korte, extra zware golf oproepen, met een gegarandeerde, dubbele
powerup-drop en dubbel geld als beloning, maar zonder de rustperiode ervoor of erna.
**Waarom dit leuk is** Dit is de eerste bron van gevaar in het hele spel die de speler zelf
kiest te activeren, in plaats van dat het spel het oplegt. Het beantwoordt direct de vraag uit
de opdracht: "iets dat de speler zelf kan uitlokken."
**Hoe het past** Hergebruikt het `interactiePunten`-patroon voor het activatiepunt en het
event-framework voor de golf-effecten zelf (een eenmalige, opt-in variant van
`startEventGolf()` zonder de vaste 5-golven-cyclus).
**Wat het raakt** Nieuw interactiepunt, een aftakking in `startEventGolf()`/`golfSpawnStap()`
voor een niet-cyclische, handmatig getriggerde variant.
**Bouwomvang** Klein tot middel. Bijna volledig hergebruik van bestaande systemen, met een
nieuw activatiepunt als enige echt nieuwe content.
**Waar het mis kan gaan** Als de beloning duidelijk de moeite waard is, wordt dit een
verplicht ritueel elke run in plaats van een keuze ("waarom zou ik het NIET doen"). Moet een
reëel risico dragen (geen rust ervoor/erna) dat sommige spelers bewust laat afzien.
**Varianten** Licht: eenmalig per run, vaste beloning. Zwaar: herhaalbaar met oplopende
kosten/beloning, zodat het een eigen risicocurve krijgt binnen één run.

### F5: Kraaienmars

**Het idee** Een korte, zeldzame (elke 7-9 golven, buiten de vaste event-cyclus om), puur
cosmetische gebeurtenis van 20-30 seconden: een zwerm kraaien vliegt zichtbaar over de
binnenplaats/gracht, met een eigen geluidslaag (procedureel, korte hoge piepjes/kras-
geluiden), zonder enig mechanisch effect. Puur sfeer, geen regelwijziging.
**Waarom dit leuk is** Niet elk moment hoeft gevaarlijk te zijn om de moeite waard te zijn.
Dit is een klein, herkenbaar wereldmoment dat de indruk van een levende, ademende plek
versterkt, en dat spelers kunnen leren herkennen als "even niets aan de hand" te midden van
een verder onophoudelijk dreigende sfeer.
**Hoe het past** Een simpel deeltjes-/mesh-systeem zoals de bestaande stofwolken
(`updateStofwolken()`), met een eigen timer los van de event-golf-cyclus.
**Wat het raakt** Een nieuw, klein visueel systeem, twee nieuwe geluidjes.
**Bouwomvang** Klein. Puur cosmetisch, geen enkel bestaand systeem hoeft aangepast te worden.
**Waar het mis kan gaan** Zonder mechanisch nut kan dit voelen als tijd die beter aan iets
anders besteed was, zeker in een klein, eenmansproject. Dit is precies het soort idee dat de
opdracht vraagt te vermelden mét eerlijkheid: ik zou dit als LAATSTE bouwen van alle
ideeën in dit document, niet als eerste, ook al staat het hier vermeld.
**Varianten** Licht: eenmalig, hardgecodeerd op een vaste golf, als test. Zwaar: onderdeel
van een breder ambient-events-systeem (regen, verre scheepshoorns, klokgelui van andere
kerken) dat willekeurig door de hele run heen speelt.

---

## G. Doelen binnen de golf

**Waar het spel nu staat.** Elke golf heeft precies één opdracht: overleef tot het budget
op is en alle ondoden dood zijn. `updateGolf()` kent geen ander eindcriterium.

**De opening.** Dit is de plek waar het spel het minst gevarieerd is: golf 3 en golf 23
hebben letterlijk dezelfde structuur. Een klein aantal alternatieve golfdoelen, af en toe
ingezet in plaats van vervangend, kan veel variatie geven voor relatief weinig nieuwe content.

### G1: Verdedig het punt

**Het idee** Om de zoveel golven (bijvoorbeeld elke 6e, verschoven van de bestaande
event-cyclus) is de opdracht niet "overleef", maar "verdedig": een tijdelijk object
(bijvoorbeeld een kist met voorraden, ergens midden in een al ontgrendelde zone) moet een
vaste tijd overleven. Ondoden krijgen voor deze golf een alternatief navigatiedoel (het
object in plaats van de speler) tenzij de speler te dichtbij komt.
**Waarom dit leuk is** Dit dwingt de speler om een POSITIE te verdedigen in plaats van vrij
te bewegen en te kiezen, wat het speelritme van die ene golf echt anders maakt: geen
terugtrekken naar een veilige hoek, wel pal blijven staan.
**Hoe het past** Hergebruikt het alternatieve-navigatiedoel-patroon dat ook voor B3 (De
Verzamelaar) nodig is, en de bestaande object-schade-logica (vergelijkbaar met hoe
barricades HP-achtig planken hebben).
**Wat het raakt** `updateOndoden()` (alternatief doel voor deze golf), een nieuw, tijdelijk
object met een eigen "HP", golf-einde-conditie in `updateGolf()` (nu puur "alle ondoden dood
en budget op", moet een tweede faalconditie krijgen).
**Bouwomvang** Middel. De grootste wijziging zit in `updateGolf()`'s eindcondities, die nu
overal in de codebase als vaststaand worden aangenomen (bijvoorbeeld door tests die golf-
afronding controleren) en dus zorgvuldig uitgebreid moeten worden zonder het bestaande pad
te breken.
**Waar het mis kan gaan** Een faalbare golf (het object kan sneuvelen) introduceert het
eerste PARTIËLE verlies-scenario in het spel, nu is er alleen game over of doorgaan. Wat er
gebeurt bij falen (opnieuw proberen? een strafmaatregel? gewoon doorgaan zonder beloning?)
is een ontwerpvraag die eerst beantwoord moet worden.
**Varianten** Licht: het object kan niet echt "verliezen", alleen meer of minder beschadigd
raken wat de wave-bonus beïnvloedt (geen harde faalstaat). Zwaar: verlies van het object
betekent het verlies van een AL verworven vluchtroute-onderdeel, wat de inzet echt hoog maakt.

### G2: Berg de lading

**Het idee** Een golf-variant waarbij, verspreid over de al ontgrendelde kaart, drie kleine
voorwerpen verschijnen (met een kort, richtinggevend geluid zoals de bestaande druppel-tik)
die de speler moet verzamelen VOORDAT de golf als voltooid telt, zelfs als alle ondoden al
dood zijn. De golf loopt door (nieuwe spawns) totdat alle drie verzameld zijn.
**Waarom dit leuk is** Dit is het spiegelbeeld van G1: in plaats van STAAN, moet de speler
BEWEGEN, door de hele kaart heen, terwijl er nog gevaar actief is. Het breekt het
"sta bij een chokepoint en schiet"-patroon dat een golf anders altijd is.
**Hoe het past** Bijna identiek aan het bestaande `VLUCHT_ONDERDELEN`-patroon (vind-objecten
met een interactiepunt), alleen golf-gebonden in plaats van run-gebonden.
**Wat het raakt** Een nieuwe, golf-lokale variant van het vluchtroute-patroon, `updateGolf()`'s
eindconditie (moet ook op verzamelstatus checken).
**Bouwomvang** Klein tot middel. Zeer hoge hergebruikgraad van een al bestaand,
bewezen patroon.
**Waar het mis kan gaan** Als de golf blijft doorlopen (nieuwe spawns) terwijl de speler ver
van de laatste chokepoint is om het laatste voorwerp te pakken, kan de spawn-druk oplopen tot
oneerlijke niveaus. Moet gekoppeld worden aan een verlaagd spawntempo voor de duur van deze
golfvariant.
**Varianten** Licht: twee voorwerpen in plaats van drie, dichter bij elkaar. Zwaar: de
voorwerpen moeten TERUGGEBRACHT worden naar een vast punt (niet alleen opgeraapt), wat een
retourreis toevoegt en het risico verdubbelt.

### G3: De ondoden onder ons

**Het idee** Een golf waarin één specifieke, willekeurig gekozen ondode (zichtbaar anders
gekleurd, zoals de bestaande oogkleur-differentiatie per type) NIET gedood mag worden voordat
alle andere ondoden dood zijn. Raakt de speler 'm te vroeg, komt er een kleine, extra
spawn-straf. Wordt hij als laatste gedood, een flinke bonus.
**Waarom dit leuk is** Dit dwingt bewuste doelwitselectie af binnen een golf die verder
normaal aanvoelt: de speler moet die ene, opvallende vijand actief VERMIJDEN te raken terwijl
hij tegelijk alle anderen wel moet doden, wat een heel andere soort focus vraagt dan "schiet
wat het dichtst bij is".
**Hoe het past** Een vlag op één, bij spawn gekozen `ondode`-object
(`ondode.userData.laatsteDoelwit` of vergelijkbaar), gecontroleerd in `raakOndode()` vóór de
schade wordt toegepast.
**Wat het raakt** `golfSpawnStap()`/spawnkeuze (markering), `raakOndode()` (vroegtijdige-
treffer-detectie), visuele marker via het bestaande oogkleur-systeem.
**Bouwomvang** Klein. Eén markering, één extra check in een bestaande functie, hergebruik van
bestaande visuele differentiatie.
**Waar het mis kan gaan** In een chaotische golf met 10+ actieve ondoden kan de speler de
gemarkeerde ondode makkelijk per ongeluk raken zonder het door te hebben, wat oneerlijk
aanvoelt. Vraagt een heel duidelijke visuele/audio-marker, niet alleen een subtiel
kleurverschil.
**Varianten** Licht: geen straf bij een vroegtijdige treffer, alleen een gemiste bonus (puur
positieve prikkel, geen risico). Zwaar: meerdere gemarkeerde ondoden tegelijk, elk met een
andere regel (deze niet met De Ratelaar raken, die niet met een headshot), wat het tot een
complexere puzzel maakt.

### G4: Volle magazijnen

**Het idee** Een golfvariant waarbij de speler voorafgaand geen munitie mag bijkopen (de
Ammo-kist is tijdelijk uitgeschakeld voor deze ene golf) en er merkbaar minder power-up-
drops zijn dan normaal, een schaarste-golf. Ter compensatie: dubbele geldopbrengst voor de
duur ervan.
**Waarom dit leuk is** Dit dwingt precisie en spaarzaamheid af in een spel dat verder ruim
met munitie omgaat: de speler moet plotseling elk schot laten tellen, wat de twee-wapens-
identiteit (precisie vs. volume) een nieuwe context geeft. De Drukspuit wordt op zo'n golf
opeens de aantoonbaar verstandigere keuze.
**Hoe het past** Puur parametrisch: een golf-vlag die `AMMO_PRIJS`-aankoop blokkeert en
`POWERUP_DROP_KANS` tijdelijk verlaagt, beide al bestaande, uitleesbare constanten/functies.
**Wat het raakt** `koopAmmo()` (tijdelijke blokkade), `kiesPowerupType()`/`POWERUP_DROP_KANS`
(tijdelijke verlaging), geld-multiplier in `raakOndode()`.
**Bouwomvang** Klein. Volledig parametrisch, geen nieuwe content of systemen.
**Waar het mis kan gaan** Als deze golfvariant een speler treft die toevallig al bijna zonder
munitie zat (door pech, niet door keuze), voelt het onrechtvaardig in plaats van uitdagend.
Werkt het best met een duidelijke, vroege aankondiging (dezelfde banner als event-golven) zodat
spelers zich kunnen voorbereiden.
**Varianten** Licht: alleen de geldbonus, geen echte munitiebeperking (puur een
economie-variant). Zwaar: gecombineerd met C1 (De Blaker), zodat deze golf ook de eerste
natuurlijke, ontworpen aanleiding is om het melee-wapen daadwerkelijk te gebruiken.

---

## H. Het eindspel

**Waar het spel nu staat.** Eén winconditie: de boot, periodiek vanaf golf 10, drie
vluchtroute-onderdelen plus €2500. `probeerOntsnapping()`/`toonWinScherm()` zijn de enige
manier waarop een run eindigt anders dan door de dood.

**De opening.** De opbouw is al goed getimed (D5/D8-tickets: aankondiging, hoorn, banner,
periodieke vensters). De kans zit niet in MEER win-condities per se (zie E5's eigen risico
daarop), maar in het spannender maken van de bestaande boot, en in een eerlijk antwoord op
"wat als je nog één golf blijft."

### H1: Het laatste venster

**Het idee** Vanaf de op-één-na-laatste ontsnappingsgolf die de speler heeft laten
voorbijgaan (bewust niet genomen, bijvoorbeeld voor meer score), wordt elke volgende boot-
aankomst zichtbaar KORTER: de aankondigingsduur (`ONTSNAPPING_AANKONDIGING_DUUR`, nu altijd
5s) daalt met elk overgeslagen venster, tot een minimum, en de prijs stijgt licht. De boot
wordt letterlijk ongeduldiger.
**Waarom dit leuk is** Dit geeft "nog één golf blijven voor meer punten" een echte,
oplopende prijs in plaats van een gratis keuze: elke keer dat je de boot laat gaan, wordt de
volgende kans krapper. Het is het antwoord dat de opdracht expliciet vraagt op "wat gebeurt
er als je besluit nog één golf te blijven."
**Hoe het past** Een simpele teller (`overgeslagenVensters`) die `ONTSNAPPING_AANKONDIGING_
DUUR` en `ONTSNAPPING_PRIJS` bij elk volgend venster aanpast, beide al bestaande, direct
uitleesbare constanten/berekeningen.
**Wat het raakt** `updateOntsnappingsVenster()`/`probeerOntsnappingsVensterTeOpenen()`
(dynamische duur/prijs in plaats van vaste constanten), HUD-tekst (moet de oplopende druk
communiceren).
**Bouwomvang** Klein. Puur een parametrische aanpassing op een al volledig gebouwd systeem.
**Waar het mis kan gaan** Als de duur te snel te kort wordt, voelt het bestraffend in plaats
van spannend, vooral voor spelers die simpelweg nog niet klaar waren (bijvoorbeeld nog geen
3/3 vluchtroute-onderdelen). Moet nooit zo kort worden dat het venster onhaalbaar wordt voor
een gemiddeld tempo.
**Varianten** Licht: alleen de prijs stijgt, de duur blijft vast (minder risico op
onhaalbaarheid). Zwaar: na een X aantal overgeslagen vensters stopt de boot definitief met
terugkomen voor de rest van de run, wat "voor altijd blijven" een echte, onomkeerbare
consequentie geeft.

### H2: Het laatste stuk water

**Het idee** Het daadwerkelijke ontsnappingsmoment (nu: interactiepunt activeren,
`probeerOntsnapping()`, direct winscherm) wordt een kort, gespeeld moment: na betaling begint
de boot zichtbaar weg te varen (de animatie bestaat al, `updateBootUitvaren()`) en de speler
moet nog 8-10 seconden overleven op de vlonder terwijl de boot vertrekt, met een laatste,
geconcentreerde golf ondoden die specifiek op dat moment afkomt.
**Waarom dit leuk is** Nu is het winnen een instant klik, geen climax. Dit maakt het
allerlaatste moment van een succesvolle run net zo gespannen als elke andere golf, in plaats
van een anticlimax na de opbouw van de aankondigingsfase.
**Hoe het past** Hergebruikt `updateBootUitvaren()` volledig (bestaat al voor als een
ontsnappingsvenster sluit zonder gebruikt te zijn), gecombineerd met een eenmalige,
gescripte spawn-burst zoals ook bij F3/F4 nodig is.
**Wat het raakt** `probeerOntsnapping()` (nieuw, tussenliggend "aan boord klimmen"-moment in
plaats van direct winnen), een eenmalige spawn-burst, `toonWinScherm()` (pas na het overleven
van dit venster).
**Bouwomvang** Middel. Grotendeels hergebruik van bestaande boot-animatie en spawn-
infrastructuur, met een nieuwe tussentoestand in de win-flow.
**Waar het mis kan gaan** Als de speler NA betaling van €2500 alsnog kan sterven voordat de
boot weg is, voelt dat als het oneerlijk afpakken van een net gekochte overwinning. Dit moet
zorgvuldig gecommuniceerd worden (de speler moet weten dat dit tussenmoment eraan komt) en de
moeilijkheidsgraad ervan moet mild genoeg zijn om vrijwel altijd haalbaar te zijn voor wie
tot hier is gekomen.
**Varianten** Licht: geen extra spawns, puur de wachttijd en de vertreksfeer (spanning zonder
extra risico). Zwaar: de speler moet tijdens dit venster ook nog een laatste handeling doen
(bijvoorbeeld de loopplank vasthouden/verdedigen), wat het van "wachten" naar "actief
overleven" maakt.

### H3: Volle vracht

**Het idee** Een score-only bonus (geen aparte winconditie) voor spelers die NA het bereiken
van 3/3 vluchtroute-onderdelen en het eerste beschikbare venster, bewust doorspelen: elke
overgeslagen ontsnappingsgolf (zie H1, maar dan als BELONING in plaats van straf) telt mee
voor een aparte "doorzettersbonus" in de eindscore, oplopend maar met afnemend rendement, dus
nooit oneindig aantrekkelijk om voor altijd te blijven.
**Waarom dit leuk is** Dit geeft een POSITIEF antwoord naast H1's negatieve op dezelfde
vraag: doorspelen is geen verspilde moeite, het is een zichtbare, apart getelde prestatie op
het eindscherm, ook al daalt het rendement. Samen met H1 ontstaat een echte spanningsboog
rond "wanneer stop ik precies."
**Hoe het past** Een nieuwe teller op `runStats`, uitgelezen in `berekenScore()` (die al een
aparte ontsnappingsbonus van +1000 optelt, dit wordt een tweede, vergelijkbare term).
**Wat het raakt** `runStats`, `berekenScore()`, eindscherm (nieuwe regel in de statistieken).
**Bouwomvang** Klein. Eén teller, één extra term in een bestaande berekening.
**Waar het mis kan gaan** Als deze bonus te groot wordt naast H1's straf, ontstaat een
verwarrende dubbele boodschap (het spel zegt tegelijk "blijf" en "ga nu"). Beide moeten
samen getuned worden, niet los van elkaar. Vandaar dat ik ze in Stap 3 als een paar
behandel.
**Varianten** Licht: een simpele, vaste bonus per overgeslagen venster zonder plafond. Zwaar:
gekoppeld aan een zichtbare "vrachtmeter" op de HUD, zodat de speler tijdens het spelen al
ziet hoe die afweging zich opbouwt, in plaats van pas op het eindscherm.

### H4: Twee soorten helden

**Het idee** Het eindscherm (`toonWinScherm()`) krijgt, naast de bestaande statistieken, een
expliciete classificatie op basis van speelstijl over de hele run: "Scherpschutter" (hoog
headshot-percentage), "Aannemer" (veel geld besteed aan barricades/reparaties), "Ontdekker"
(veel verschillende zones bezocht relatief vroeg), et cetera, puur op basis van al bestaande
`runStats`-data, geen nieuwe tracking nodig.
**Waarom dit leuk is** Dit geeft elke succesvolle run een eigen, herkenbaar KARAKTER
achteraf, zonder dat er nieuwe gameplay-systemen voor nodig zijn. Puur een interpretatielaag
over data die al verzameld wordt. Het is de goedkoopste manier om elke overwinning uniek te
laten voelen.
**Hoe het past** Volledig gebaseerd op bestaande `runStats`-velden (kills, headshots,
treffers, geldTotaal, powerups) plus eventueel een nieuwe, kleine teller voor zone-bezoek-
volgorde.
**Wat het raakt** `berekenScore()`/`toonWinScherm()` (nieuwe classificatielogica), mogelijk
één nieuwe teller.
**Bouwomvang** Klein. Bijna zuiver een nieuwe blik op bestaande data.
**Waar het mis kan gaan** Als de classificatie te grof is (iedereen krijgt toevallig
hetzelfde label) voelt het willekeurig in plaats van persoonlijk. Vraagt een paar
iteraties op de drempelwaarden om echt onderscheidend te worden.
**Varianten** Licht: één enkel label per run, de duidelijkste match. Zwaar: een volledig
badge-systeem met meerdere, gelijktijdig behaalde labels per run, opgeslagen naast de
highscore zodat ze ook bij verlies (game over) zichtbaar blijven als deel van de
statistieken.

---

## I. Gevoel, sfeer en spektakel

**Waar het spel nu staat.** Volledig procedurele audio (`piep()` plus tientallen specifieke
functies), bloom als enige post-processing, materiaal-families en een PALET-systeem voor
visuele samenhang, flikkerende verlichting per lamp. Geen reverb/nagalm, geen richtingsgeluid
buiten een paar specifieke pan-berekeningen (boot-hoorn), geen dynamische muziekintensiteit
buiten de bestaande drie-laags-mix.

**De opening.** De bouwstenen (Web Audio-oscillators, materiaal-families, bloom) zijn er,
en zijn met zorg gebouwd. De kans zit in RUIMTELIJKHEID (geluid dat van een richting komt,
niet alleen aan/uit) en in het uitbuiten van wat al bestaat maar nog subtiel is
(dreigingsaudio, flikkerlicht) tot iets dat de speler echt in zijn nek voelt.

### I1: Richtinghoren

**Het idee** Elk belangrijk geluid dat nu los van richting speelt (ondode-grom, plankgekraak,
schotgeluiden van andere bronnen dan de speler zelf) krijgt een StereoPannerNode zoals de
boot-hoorn al heeft (`berekenBootHoornPanVolume()`), gebaseerd op dezelfde relatieve-hoek-
berekening die al bestaat voor de schade-richtingsaanwijzer (`berekenSchadeWedgeHoek()`).
**Waarom dit leuk is** Dit is het moment dat de opdracht letterlijk noemt: "wat je hoort als
er iets achter je staat." Nu is een grom achter je akoestisch identiek aan een grom vóór je;
met panning wordt geluid een navigatie- en waarschuwingsmiddel op zichzelf, niet alleen sfeer.
**Hoe het past** De hoekberekening bestaat al twee keer onafhankelijk (`berekenSchadeWedgeHoek()`
voor de richtingsaanwijzer, `berekenBootHoornPanVolume()` voor de boothoorn); dit trekt die
logica één keer generiek en past 'm toe op de bestaande `speelOndodeGrom()`/
`speelPlankBreek()`-aanroepen.
**Wat het raakt** Een nieuwe, gedeelde pan-berekeningsfunctie, en de audio-graph van elk
geluid dat richting moet krijgen (een StereoPannerNode tussenvoegen vóór de bestaande
gain-node in de keten).
**Bouwomvang** Middel. Conceptueel klein (twee bestaande berekeningen samenvoegen tot één
herbruikbare), maar raakt veel losse `speel*()`-functies die elk individueel getest moeten
worden.
**Waar het mis kan gaan** Overdreven panning kan onnatuurlijk of vermoeiend klinken op
koptelefoon. Dit is precies het soort ding dat ik niet kan beoordelen zonder het te horen,
dus markeer ik het expliciet als afhankelijk van het onbekende uit sectie 0.4.
**Varianten** Licht: alleen op de ondode-grom (het belangrijkste signaal), niet op elk
geluid. Zwaar: volledige 3D-positionering via `PannerNode` in plaats van simpele stereo-pan,
inclusief afstandsdemping die al deels bestaat (`DREIGINGS_NABIJHEID_BEREIK`-stijl).

### I2: De laatste ademtocht

**Het idee** Wanneer een golf voltooid is en `spelStaat.golfActief` naar false gaat, ontstaat
nu meteen de rustperiode. Voeg een stilte-moment van 1,5-2 seconden toe vlak daarvoor: alle
lopende geluiden (dreigingsaudio, achtergrondmuziek) faden versneld naar bijna niets, er is
geen banner, geen HUD-verandering, gewoon stilte, voordat de "Golf voltooid"-banner en
-fanfare (`speelGolfKlaar()`) komen.
**Waarom dit leuk is** Dit is exact "de stilte erna" uit de opdracht. Nu gaat een drukke
golf direct over in de volgende geluidslaag zonder adempauze. Een bewust stil moment geeft de
overwinning van elke golf meer gewicht, precies omdat er niets gebeurt.
**Hoe het past** Hangt aan `updateGolf()`'s golf-einde-detectie, met een tijdelijke,
versnelde fade op de al bestaande `muziekGainNode`/`dreigingsGainNode` (beide al
throttled/glijdend aanstuurbaar via `MUZIEK_GLIJTIJD`/`DREIGINGS_GLIJTIJD`).
**Wat het raakt** `updateGolf()` (nieuwe korte staat tussen "golf voorbij" en "banner tonen"),
geen nieuwe audio-infrastructuur nodig.
**Bouwomvang** Klein. Eén nieuwe, korte tussenstaat en hergebruik van bestaande gain-sturing.
**Waar het mis kan gaan** Een geforceerde stilte kan het tempo van de golfovergang vertragen
op een manier die na de vijftigste keer irritant wordt in plaats van indrukwekkend. Moet kort
genoeg blijven en niet elke golf hetzelfde gewicht geven (misschien alleen bij zwaardere
golven, niet bij elke).
**Varianten** Licht: alleen de muziek dempt kort, geen volledige stilte. Zwaar: gecombineerd
met een kort, visueel effect (het licht flikkert even extra rustig, geen flikker-sinus voor
een paar seconden) voor een gecombineerd audiovisueel adempauzemoment.

### I3: Impact die je voelt

**Het idee** Een klap op een Sjouwer (25 schade attack-profiel, de zwaarste in het spel) of
een gemiste, net-ontweken aanval krijgt een aparte, zwaardere audio-laag dan de huidige
generieke `speelSlagRaak()`/`speelSpelerAu()`: een korte, lage sub-boom via een aparte
oscillator, en een kortstondige, sterkere `cameraKick`-achtige schok specifiek voor grote
klappen (nu is de kick-sterkte alleen wapen-afhankelijk, niet schade-afhankelijk).
**Waarom dit leuk is** Nu voelt elke klap van elk type ongeveer hetzelfde. Dit maakt het
verschil tussen "geraakt door een Loper" en "geraakt door een Sjouwer" ook FYSIEK voelbaar in
plaats van alleen zichtbaar op de HP-balk, wat de al zorgvuldig opgebouwde per-type-
identiteit (sectie B) een extra zintuiglijke laag geeft.
**Hoe het past** `spelerSchade(bedrag, bron, ...)` ontvangt het schadebedrag al; een
drempelcheck (bedrag > X) kan een aparte, zwaardere piep-variant en een grotere `cameraKick`
triggeren, zonder de bestaande route te veranderen.
**Wat het raakt** `spelerSchade()`, `speelSpelerAu()` (of een nieuwe, zwaardere variant
ernaast), `cameraKick`-berekening.
**Bouwomvang** Klein. Eén drempelcheck en een nieuwe, zwaardere audio-/kick-variant naast de
bestaande.
**Waar het mis kan gaan** Als de zwaardere feedback te fors is, kan het de speler
desoriënteren op een moment dat hij juist helder moet reageren (schade van een Sjouwer, die
je nog wel wilt kunnen blijven bevechten). Balans tussen impact en bruikbaarheid is precair.
**Varianten** Licht: alleen een zwaardere geluidslaag, geen extra camera-kick. Zwaar:
gekoppeld aan een kort, extra vignet-effect (bovenop de bestaande `vignetFlits`) specifiek
voor zware klappen, zodat het ook visueel zwaarder aanvoelt.

### I4: Levend licht

**Het idee** De bestaande lampflikker (`amp1`/`amp2` sinus per lamp, zie de gameLoop-
flikkerloop) krijgt een zeldzame, extra gebeurtenis: eens in de zoveel golven flikkert één
willekeurige, al bestaande lamp KORT helemaal uit (0,3-0,5s) en weer aan, onafhankelijk van
Stroomuitval-events, puur decoratief maar ontworpen om precies te lijken op het moment vlak
voordat iets ergs gebeurt zonder dat het dat daadwerkelijk hoeft te zijn.
**Waarom dit leuk is** Dit is een goedkope, herbruikbare spanningsopbouw-truc: de speler
leert dat een korte black-out SOMS niets betekent en soms (gekoppeld aan G/F-ideeën)
daadwerkelijk een golf-mijlpaal aankondigt, wat het moment zelf onbetrouwbaar en daarmee
spannend maakt, zonder dat het spel elke keer moet leveren.
**Hoe het past** Een kleine, willekeurige trigger binnen de bestaande flikkerloop
(`lampLichten`-iteratie in de gameLoop), die voor één lamp tijdelijk `intensity` naar 0
forceert.
**Wat het raakt** De lampflikker-loop in de gameLoop, geen nieuwe systemen.
**Bouwomvang** Klein. Eén tijdelijke override binnen een al bestaande, per-frame loop.
**Waar het mis kan gaan** Als het te vaak gebeurt zonder ooit iets te betekenen, leert de
speler het snel negeren (uitgewerkte spanning). Werkt het best spaarzaam en, zoals hierboven
genoemd, soms daadwerkelijk gekoppeld aan iets (zelfs als dat "soms" laag is).
**Varianten** Licht: puur decoratief, willekeurig, zonder ooit een koppeling aan een echte
gebeurtenis. Zwaar: gegarandeerd gekoppeld aan de opbouw van F3 (De Stilte voor de Storm) als
diens eerste, subtiele signaal.

### I5: Het geluid van Amsterdam

**Het idee** Een permanente, zeer zachte, doorlopende geluidslaag (naast de bestaande
achtergrondmuziek) die specifiek stedelijke Amsterdamse achtergrond suggereert zonder
opnames: een verre, onregelmatige scheepshoorn (variatie op de al bestaande boothoorn-
oscillatoropzet), een zeldzame verre fietsbel-achtige piep, kerkklok-galm op een heel lange,
willekeurige cyclus (variant op `speelGrachtklok()`). Alles procedureel, alles zacht genoeg
om nooit de dreigingsaudio te overstemmen.
**Waarom dit leuk is** Dit is de meest directe manier om de Amsterdamse setting SCHERPER te
maken zonder een enkel nieuw gameplaysysteem: het geluidslandschap zelf wordt herkenbaar
Amsterdams in plaats van generiek "verlaten gebouw", wat direct raakt aan sectie K.
**Hoe het past** Hergebruikt de bestaande oscillator-/gain-node-architectuur volledig
(dezelfde soort opzet als de Nevelklok en de achtergrondmuziek-laag), toegevoegd als een
vierde, permanente laag in de audiograaf naast muziek/dreiging/nevelklok.
**Wat het raakt** `initGeluid()` (nieuwe oscillators/gain-nodes), een nieuwe, lichte update-
functie in de gameLoop met een eigen throttle (zoals `MUZIEK_THROTTLE_INTERVAL`).
**Bouwomvang** Klein tot middel. Volledig hergebruik van bewezen patronen, het echte werk zit
in het zorgvuldig ontwerpen van geluiden die "Amsterdams" suggereren met alleen
oscillatoren.
**Waar het mis kan gaan** Té letterlijke suggesties (een simpele piep die moet doorgaan voor
een scheepshoorn) kunnen goedkoop klinken in plaats van sfeervol. Dit hangt sterk af van
zorgvuldig geluidsontwerp, iets wat ik niet volledig kan beoordelen zonder te testen. Dit is
expliciet een onbekende uit sectie 0.4.
**Varianten** Licht: alleen de verre scheepshoorn, de eenvoudigste en meest bewezen variant
(bouwt direct op de bestaande boothoorn-opzet). Zwaar: een volledig, gelaagd "stad op de
achtergrond"-audiobed met vier tot vijf verschillende, willekeurig getimede elementen.

### I6: Schaduwspel

**Het idee** De schaduw-invariant (precies één schaduwwerpende lamp, ARCHITECTURE_NOTES
§7.9) blijft bestaan, maar die ENE lamp krijgt een subtiele, langzame slinger-/drift-
animatie (een hanglamp die net iets beweegt door tocht) waardoor de schaduwen in de kamer
waar hij hangt continu heel licht bewegen, ook zonder dat er iets anders gebeurt.
**Waarom dit leuk is** Bewegende schaduwen in een verder statische scène zijn een goedkope,
krachtige horror-truc: het randbeeld van de speler pikt beweging op die er niet als dreiging
bedoeld is, wat voortdurende, laaggradige onrust geeft zonder dat er iets nieuws hoeft te
spawnen.
**Hoe het past** Een kleine rotatie-/positie-oscillatie op de bestaande schaduwwerpende
`PointLight`, dezelfde soort sinus-gedreven aanpak als de lampflikker maar dan op positie in
plaats van intensiteit.
**Wat het raakt** De ene schaduwwerpende lamp specifiek (geïdentificeerd in
ARCHITECTURE_NOTES §7.9), een paar regels in de bestaande flikkerloop.
**Bouwomvang** Klein. Eén lamp, een paar regels animatie, geen nieuwe systemen.
**Waar het mis kan gaan** Bewegende schaduwen kunnen op sommige hoeken vreemde artefacten
geven (schaduw-acne, flikkerende randen) afhankelijk van hoe de shadow map is ingesteld; dit
moet visueel gecontroleerd worden, niet alleen aangenomen.
**Varianten** Licht: een zeer subtiele, langzame drift (nauwelijks bewust waarneembaar).
Zwaar: de slinger versnelt zichtbaar tijdens Stroomuitval (tocht door een kapotte
raamsluiting), wat het event een extra, gratis sfeerlaag geeft.

---

## J. Redenen om opnieuw te spelen

**Waar het spel nu staat.** Eén highscore (`leesHighscore()`/`schrijfHighscore()`, sinds
Ticket 74 gevalideerd tegen corrupte data), per-run statistieken op het eindscherm, drie
moeilijkheidsgraden. Geen enkele run verschilt structureel van de vorige buiten toeval in
spawn-loting en de eigen keuzes van de speler binnen een vaste structuur.

**De opening.** Zonder server/account (zie het kader) is competitie altijd solitair: de
speler speelt tegen zijn eigen record. Dat is prima, maar de variatie moet dan uit de RUN
zelf komen, niet uit vergelijking met anderen. Sectie D (build-keuzes) draagt al veel van deze
last; hier gaat het specifiek om structurele variatie tussen runs.

### J1: De weerman

**Het idee** Bij het starten van een run kiest de speler (naast moeilijkheidsgraad) uit drie
tot vier "weerpatronen" die de event-cyclus voor de HELE run vastzetten: "Heldere Hemel" (geen
events tot golf 20, dan een zware), "Grillig" (events elke 3 golven in plaats van 5, korter),
"Winter" (alleen Stroomuitval-events, nooit Mist). Dit verandert het RITME van een hele run,
niet alleen losse golven.
**Waarom dit leuk is** Dit geeft een run vanaf de allereerste keuze een eigen, herkenbare
identiteit die hij de hele speelduur volhoudt, zonder dat er één regel nieuwe content voor
nodig is: puur een herschikking van al bestaande events.
**Hoe het past** Hetzelfde patroon als `MOEILIJKHEDEN`, toegepast op `kiesEventType()`/
`EVENT_GOLF_INTERVAL` in plaats van budget/regen/score.
**Wat het raakt** Een nieuw `WEERPATRONEN`-object, `kiesEventType()`, startscherm-UI.
**Bouwomvang** Klein. Bewezen patroon, puur parametrisch op een al bestaand systeem.
**Waar het mis kan gaan** Als één patroon duidelijk makkelijker is (bijvoorbeeld "Heldere
Hemel" voor wie moeite heeft met events), wordt het de enige gekozen optie en verdwijnt de
variatie in de praktijk.
**Varianten** Licht: twee patronen in plaats van vier. Zwaar: combineerbaar met D4
(koopvaardersbrief) voor een volledig gepersonaliseerde run-start.

### J2: Het logboek

**Het idee** Een klein, lokaal bijgehouden overzicht (localStorage, zelfde patroon als de
highscore) van "nog nooit behaald"-doelen die de speler zelf kan afvinken naarmate hij ze
tegenkomt: overleef een golf zonder een schot te missen, ontsnap zonder ooit de Smederij te
bezoeken, dood een Sjouwer met alleen headshots. Geen beloning binnen het spel, puur een
zichtbare, persoonlijke checklist.
**Waarom dit leuk is** Dit geeft doelen die niet over "verder komen" gaan maar over "anders
spelen", wat vooral spelers aanspreekt die het spel al kunnen uitspelen en een nieuwe reden
zoeken om terug te komen. Het kost het spel zelf niets om te bouwen: alle onderliggende
prestaties zijn al meetbaar via `runStats`.
**Hoe het past** Volledig gebaseerd op bestaande `runStats`, opgeslagen via hetzelfde,
gevalideerde localStorage-patroon als de highscore.
**Wat het raakt** Een nieuwe localStorage-sleutel, een nieuw, klein UI-scherm (bijvoorbeeld
vanaf het startscherm bereikbaar).
**Bouwomvang** Klein tot middel. Databewaking is triviaal (bewezen patroon), de lijst met
doelen zelf moet zorgvuldig samengesteld worden zodat ze echt anders spelen vereisen, niet
alleen "speel lang genoeg."
**Waar het mis kan gaan** Een checklist die niemand ooit opent is verspilde moeite. Moet
actief onder de aandacht gebracht worden (bijvoorbeeld een korte melding zodra er een nieuw
doel is afgevinkt), niet alleen passief beschikbaar zijn.
**Varianten** Licht: vijf tot acht simpele doelen om te beginnen. Zwaar: gekoppeld aan H4
(Twee soorten helden) zodat afgevinkte doelen ook meetellen in de eindclassificatie.

### J3: Het stadsarchief

**Het idee** Een permanente, cosmetische ontgrendelingslaag los van elke run: naarmate de
speler over meerdere runs heen mijlpalen haalt (bijvoorbeeld: drie keer ontsnapt, honderd
headshots totaal, een run zonder ooit de Watertap te gebruiken), ontgrendelt hij blijvend
een alternatieve, puur visuele of auditieve variant, zoals een andere huidtint-set voor de
ondoden, een andere kleurtemperatuur voor de mondingsvlam, of een alternatieve intro-
melodie. Nul mechanisch effect, gekozen op het startscherm.
**Waarom dit leuk is** Dit is meta-progressie die niets aan de balans raakt en dus geen
enkel risico op powercreep loopt: de speler bouwt over vele runs heen een eigen, persoonlijke
verzameling op, zonder dat "opnieuw spelen" ooit hoeft te betekenen "sterker worden."
**Hoe het past** Hergebruikt het gevalideerde localStorage-patroon (`schrijfHighscore()`/
`leesHighscore()`) voor een nieuwe, aparte opslagsleutel, en de bestaande `runStats`/
materiaal-familie-systemen (`matFamilie()`) voor de cosmetische varianten zelf.
**Wat het raakt** Nieuwe localStorage-sleutel, startscherm-UI (keuzemenu), een kleine
uitbreiding op `ONDODE_TYPES`/audio-init om een gekozen variant toe te passen.
**Bouwomvang** Middel. De opslag- en ontgrendellogica is klein, maar elke cosmetische
variant kost eigen ontwerptijd (nieuwe kleursets, nieuwe oscillatorparameters).
**Waar het mis kan gaan** Als de mijlpalen te makkelijk zijn, ontgrendelt de speler alles
binnen één run en verliest het zijn waarde als lange-termijn-doel. Als ze te moeilijk zijn,
ontdekt bijna niemand het systeem ooit.
**Varianten** Licht: drie tot vier simpele mijlpalen, puur kleurvarianten. Zwaar: een volledig
rooster van tien-plus ontgrendelingen, gecombineerd met J2's logboek als gedeelde bron van
mijlpalen.

### J4: De datumzaaier

**Het idee** Een optionele, handmatig invoerbare of op de kalenderdatum gebaseerde seed die
de willekeurige loting (`kiesOndodeType()`, `ondodeTypeGewichten()`, event-volgorde) volledig
deterministisch maakt voor die run. Twee spelers die dezelfde seed invoeren, of dezelfde
speler die twee keer dezelfde datum-seed speelt, krijgen exact dezelfde spawn-volgorde en
event-cyclus.
**Waarom dit leuk is** Zonder server kan dit spel nooit direct tegen anderen concurreren,
maar een gedeelde seed maakt "vergelijk je resultaat" wel mogelijk buiten het spel om (een
gesprek, een screenshot): twee spelers die dezelfde precieze uitdaging hebben gehad, kunnen
hun aanpak alsnog eerlijk vergelijken.
**Hoe het past** Vervangt `Math.random()`-aanroepen in de spawn-/event-loting door een
seeded pseudo-random-generator, geïnitialiseerd vanuit een nieuw invoerveld op het
startscherm, met de datum van vandaag als standaardwaarde.
**Wat het raakt** Elke plek die nu `Math.random()` gebruikt voor spawn-/event-beslissingen
(`kiesOndodeType()`, `kiesEventType()`, `kiesVensterIndex()`), die stuk voor stuk een seeded
variant moeten krijgen zonder de bestaande, ongeseede tests te breken.
**Bouwomvang** Groot. Dit raakt tientallen losse `Math.random()`-aanroepen door de hele
codebase, en vereist zorgvuldig onderscheid tussen wat WEL gezaaid moet worden (spawn-/
event-loting) en wat NIET (cosmetische variatie zoals kleurtint, die de seed niet hoeft te
raken).
**Waar het mis kan gaan** Een halfslachtige seed-implementatie (waarbij sommige willekeur wel
en andere niet gezaaid is) is erger dan geen seed: spelers verwachten dan een exacte
herhaling en krijgen die niet. Dit moet volledig of niet gebouwd worden.
**Varianten** Licht: alleen de event-cyclus (mist/stroomuitval-volgorde) wordt gezaaid, de
spawn-loting blijft vrij (kleiner, veiliger startpunt). Zwaar: de volledige run inclusief
powerup-drops en barricade-beuk-volgorde is deterministisch, wat een "race dezelfde run"-
vergelijking mogelijk maakt.

### Het tegenargument, wat dit ondermijnt

De opdracht vraagt hier expliciet om het tegenargument, en dat verdient een eerlijk antwoord.
Elke vorm van run-naar-run-variatie (J1, D4, D5) voegt een BESLISSING toe vóór golf 1 begint.
De huidige arcade-lus heeft precies één zo'n beslissing (moeilijkheidsgraad) en start daarna
meteen. Elke extra keuze ervoor is een streepje langer wachten tot het spel echt begint, en
voor de speler die dit spel puur wil spelen om vijf minuten lekker te schieten na een lange
dag, is dat pure ruis. Bovendien: hoe meer STRUCTURELE variatie een run heeft (andere
event-cyclus, andere startaankopen, andere permanente eigenschappen via D2/D3), hoe moeilijker
het wordt om de balans van `golfBudget()`/`ONDODE_THREAT_KOSTEN`/`GOLF_MAX_ACTIEF`, nu
zorgvuldig voor ÉÉN vast basisspel getuned, voor elke combinatie overeind te houden. Elke
extra keuzeknop is ook een extra plek waar de balans kan breken. De arcade-zuiverheid van "start,
speel, klaar" is een reële waarde die met elk van deze ideeën een klein beetje afneemt.

---

## K. Het Amsterdam van dit spel

**Waar het spel nu staat.** Grachten, een atelier, een boot, canal-huis-architectuur, een
Nevelklok en een gracht-klok als geluidsdetails, moeilijkheidsgraden genaamd Toerist/
Amsterdammer/Nachtwacht. De setting is aanwezig maar vooral esthetisch: de ondode-types, de
wapens en de doelen zouden mechanisch bijna overal kunnen spelen.

**De opening.** De sterkste Amsterdam-specifieke elementen in het spel nu (de boot-
ontsnapping, de Nevelklok, de moeilijkheidsgraad-namen) zijn precies de plekken waar de
setting NIET decor is maar het ontwerp raakt. Meer daarvan, minder generieke horror-aankleding
met een Amsterdams likje verf erover.

### K1: De Waterschouw

**Het idee** Een nieuw, klein, periodiek publiek moment (los van de ontsnappingsvensters):
elke paar golven vaart, zichtbaar op de minimap en hoorbaar via een eigen hoorntoon (variant
op de boothoorn), een tweede, ONBEREIKBARE boot voorbij op de gracht: een gewone
vrachtschipper die niet stopt. Puur sfeer, maar het bevestigt dat er een wereld buiten het
pand bestaat die gewoon doorgaat.
**Waarom dit leuk is** Dit versterkt het gevoel dat het pand geïsoleerd is TE MIDDEN van een
stad die niet stilstaat, wat scherper is dan een wereld die simpelweg leeg en verlaten is. Het
contrast (leven op de gracht, geen hulp binnen het pand) is een heel Amsterdams soort
eenzaamheid.
**Hoe het past** Hergebruikt de boot-geometrie/animatie-aanpak (`bootGroep`,
`updateBootPositie()`) voor een tweede, simpelere variant die alleen langsvaart in plaats van
aanmeert, en de minimap-marker-aanpak die al voor de escape-boot bestaat.
**Wat het raakt** Nieuwe, simpele geometrie/animatie, minimap (`tekenMinimap()`), een nieuw
geluid.
**Bouwomvang** Klein. Grotendeels hergebruik van bestaande boot-infrastructuur.
**Waar het mis kan gaan** Als het te vaak gebeurt, verwatert het het speciale gewicht van de
ECHTE boot (die stopt en de speler kan redden). Moet duidelijk anders klinken/aanvoelen dan
de escape-boot-aankondiging.
**Varianten** Licht: puur visueel/auditief, geen minimap-marker. Zwaar: incidenteel (zeldzaam,
willekeurig) roept de voorbijvarende boot juist een kleine, extra spawn-golf op (het geluid
trekt ondoden aan), wat 'm een zachte dreiging geeft in plaats van pure sfeer.

### K2: Grachtengordel-namen

**Het idee** De vijf zones hebben nu functionele namen (Woonkamer, Gang, Atelier,
Binnenplaats, Bijkeuken). Geef het pand zelf, en daarmee elke zone, een eigen, verzonnen maar
geloofwaardig Amsterdams identiteit: een fictieve grachtnaam en huisnummer, verwerkt in de
laadscherm-tekst, het eindscherm en misschien een klein naambordje-mesh bij de voordeur. Geen
mechanisch effect, puur wereldopbouw.
**Waarom dit leuk is** Dit is de goedkoopste manier om het pand van "een verlaten gebouw" naar
"een SPECIFIEKE plek" te tillen, wat het verhaal dat spelers er later over vertellen
("ik heb het gehaald bij de [verzonnen naam]gracht") een echt Amsterdams anker geeft.
**Hoe het past** Puur tekstueel/decoratief, raakt het startscherm, laadscherm en eindscherm.
**Wat het raakt** UI-teksten, één klein, nieuw decor-object (naambordje).
**Bouwomvang** Klein. Een middagje schrijfwerk en één simpele mesh.
**Waar het mis kan gaan** Vrijwel geen risico; het enige gevaar is dat het te onopvallend
blijft en niemand het opmerkt als het niet op een paar duidelijke plekken terugkomt.
**Varianten** Licht: alleen op het startscherm. Zwaar: de naam verschijnt ook procedureel in
audio (een AI-omroep-stijl aankondiging is hier niet gepast qua toon, maar een schriftelijke
verwijzing op een brievenbus-decor-object zou wel kunnen).

### K3: Het IJ roept

**Het idee** In plaats van dat de boot-ontsnapping puur een neutrale vluchtroute is, geef 'm
een concreet Amsterdams DOEL: de boot vaart niet zomaar "weg", hij vaart naar een specifiek,
benoemd punt (bijvoorbeeld een verzonnen veerpont-aanlegplaats aan het IJ). Dit verandert
niets mechanisch, maar het winscherm en de aankondigingsteksten krijgen een concrete
bestemming in plaats van een abstracte ontsnapping.
**Waarom dit leuk is** "Ontsnappen" is generiek; "de boot naar de veerpont bij het IJ halen"
is specifiek Amsterdam. Dit soort concreetheid in de tekst kost niets aan systemen maar
verandert hoe het einde van een run VERHAALT.
**Hoe het past** Puur tekstueel, raakt `toonWinScherm()`, de aankondigingsbanners
(`toonGolfBanner()`-aanroepen rond de boot-aankomst).
**Wat het raakt** UI-teksten rond de ontsnapping.
**Bouwomvang** Klein. Schrijfwerk, geen code-systemen.
**Waar het mis kan gaan** Vrijwel geen risico, dit is puur tekst.
**Varianten** Licht: alleen in het winscherm. Zwaar: verwerkt in de volledige
aankondigingsketen (hoorn-tekst, banners, HUD-regels) zodat de bestemming van begin tot eind
consistent terugkomt.

### K4: Winterse Amsterdammer

**Het idee** Een vierde moeilijkheidsgraad-optie (naast Toerist/Amsterdammer/Nachtwacht) die
niet puur een moeilijkheidsknop is maar een JAARGETIJDE-thema: "IJspret". De kaart krijgt een
subtiel andere kleurtemperatuur (koeler, via het bestaande PALET-systeem), de Nevelklok-cyclus
versnelt licht, en er is een kleine kans dat een gracht-oppervlak zichtbaar bevriest (puur
esthetisch, geen ijs-mechaniek). Zelfde onderliggende budgetfactor als Amsterdammer.
**Waarom dit leuk is** Dit geeft een reden om terug te komen die puur SFEERGEDREVEN is,
geloofwaardig geworteld in de setting (winters op de Amsterdamse grachten is een herkenbaar,
sterk beeld) in plaats van in een nieuwe mechaniek. Voor spelers die simpelweg de wereld
nog een keer willen zien op een andere manier.
**Hoe het past** Hergebruikt het `MOEILIJKHEDEN`-patroon en het PALET-systeem
(`bouwCanvasTextuur()`/`matFamilie()`) volledig; de kleurtemperatuur-wisseling is een
kwestie van een alternatieve PALET-set laden.
**Wat het raakt** `MOEILIJKHEDEN`, PALET-systeem (alternatieve kleurset), Nevelklok-timing.
**Bouwomvang** Middel. Het patroon bestaat, maar een volledig alternatief kleurenpalet door
de hele kaart heen consistent doorvoeren is meer werk dan de losse onderdelen doen vermoeden.
**Waar het mis kan gaan** Als het PALET-systeem niet overal even makkelijk een alternatieve
set accepteert (sommige kleuren kunnen hardgecodeerd zijn buiten het systeem om), kan dit
duurder blijken dan verwacht en half afgemaakt aanvoelen (sommige plekken winters, andere
niet).
**Varianten** Licht: alleen de Nevelklok-timing en één, klein visueel accent (rijp op de
ramen), geen volledige kleurwissel. Zwaar: een volledig vierde seizoensthema, met een eigen,
lichtjes aangepaste flikker-signatuur voor de lampen (kouder wit in plaats van warm geel).

### K5: De koopvaarderstaal

**Het idee** Alle winkelinteracties (`toonMelding()`-teksten, prompt-teksten bij
interactiepunten) krijgen een consistente, licht-archaïsche koopvaarders-/ambachtstoon in
plaats van neutrale spelteksten: "Nog €120 te kort" wordt bijvoorbeeld "Nog €120 in de
buidel nodig", de Smederij-teksten refereren aan smeden/hameren in plaats van "upgrade
gekocht". Puur tekstueel, consistent doorgevoerd.
**Waarom dit leuk is** Dit is de goedkoopste, breedst-inzetbare manier om het spel een eigen
stem te geven die verder gaat dan decor: elke interactie, niet alleen de grote setpieces,
ademt dan de setting. Een klein detail dat overal terugkomt heeft vaak meer effect dan één
groot, geïsoleerd setpiece.
**Hoe het past** Puur een tekst-audit over de bestaande `toonMelding()`/prompt-strings
(`interactiePunten[i].prompt`) heen, geen enkele systeemwijziging.
**Wat het raakt** Tientallen losse tekst-strings door de hele codebase, geen logica.
**Bouwomvang** Klein, maar arbeidsintensief door de spreiding: veel kleine, losse plekken
in plaats van één centrale plek.
**Waar het mis kan gaan** Te veel gestileerde taal kan de directheid van een HUD-melding
("nog €120 nodig" moet in een fractie van een seconde leesbaar zijn tijdens combat) in de weg
zitten. Functionele duidelijkheid moet voorgaan op sfeer, altijd.
**Varianten** Licht: alleen de niet-tijdkritische teksten (winkel-prompts buiten combat om),
HUD-tijdens-gevecht blijft neutraal en direct. Zwaar: volledig doorgevoerd, inclusief de
eindscherm-statistieken en de moeilijkheidsgraad-omschrijvingen.

---

## Stap 3: kiezen

### 1. Mijn shortlist: de vijf die ik als eerste zou bouwen

**D1 (Twee paden bij de Smederij).** Dit is de goedkoopste manier om de speler voor het
eerst een ONOMKEERBARE, niet-numerieke keuze te geven, en het hangt aan een systeem
(`smederijConfig`) dat daar al structureel klaar voor staat.

**B2 (De Voorman).** Van alle vijand-ideeën is dit degene die het meeste teruggeeft voor de
minste nieuwe infrastructuur: geen nieuw model, geen nieuwe navigatie, puur een
prioriteringsvraag toegevoegd aan combat dat nu geen enkele targetprioriteit kent.

**C1 (De Blaker).** Het enige idee in dit document dat een structureel gat dicht (geen
melee, dus geen antwoord op "zonder munitie") in plaats van een extra laag toe te voegen aan
iets dat al bestaat. Ik zou dit vroeg bouwen omdat het de speler beschermt tegen het spel op
zijn zwakste punt.

**A1 (Het voorraadraam).** Dit raakt de EIGEN identiteit van het spel (§0.2, punt 1: de
zorgvuldig opgebouwde leesbaarheid en tempo) rechtstreeks door de enige echt passieve fase
van de lus, de rustperiode, actief te maken zonder het tempo te vertragen.

**I1 (Richtinghoren).** Dit is de kleinste ingreep met de grootste kans op een direct
voelbaar verschil: het hertaalt geluid van sfeer naar informatie, wat precies past bij hoe
zorgvuldig dit spel al met zijn tells en leesbaarheid omgaat (§0.2, punt 1) maar dan voor de
oren in plaats van de ogen.

### 2. Drie pakketten

**Pakket "Belegering".** A1, A2, A6, E1, E4, G1, G2, B3. Een richting die de kernlus en de
ruimte samen verdiept: meer keuzes tussen golven, meer manieren om de ruimte actief te
gebruiken (vergrendelen, zolder), golven met een ander doel dan overleven. Het spel dat
hieruit ontstaat is trager, tactischer, meer over POSITIE en MINDER over reflexen dan nu.
Aantrekkelijk voor spelers die van tower-defense-achtige spanning houden: vooruit plannen,
niet alleen reageren.

**Pakket "Prooi".** B1, B6, F1, F3, I1, I2, I4, I6. Een richting die volledig leunt op sfeer
en dreiging in plaats van op nieuwe systemen: het spel wordt enger, stiller, meer
horror-adjacent dan het nu is (dat nu vooral een actie-shooter met horror-aankleding is). De
meeste ideeën hier zijn relatief klein qua bouwomvang maar vereisen precisie in uitvoering.
Aantrekkelijk voor spelers die spanning zoeken boven vuurkracht, en voor wie de huidige,
directe combat-toon iets te arcade is.

**Pakket "Bemanning".** D1, D2, D3, D4, J1, J2, H3, H4. Een richting die volledig om de
speler zelf draait: elke run wordt een andere versie van dezelfde speler, met permanente
consequenties en keuzes die zich opstapelen. Dit is het spel dat het dichtst bij een
lichte roguelite-structuur komt zonder de fundamentele arcade-lus (één leven, één sessie) te
verlaten. Aantrekkelijk voor spelers die meta-progressie en build-experimenten waarderen
boven pure reflexuitdaging.

### 3. Wat elkaar versterkt, wat elkaar bijt

**Versterkt elkaar.** D1/D2/D3 (bouw-keuzes) en B2/B4 (meer vijandvariatie) versterken
elkaar rechtstreeks: hoe meer soorten druk een golf kan geven, hoe meer een gekozen build
er daadwerkelijk toe doet. C1 (melee) en G4 (schaarste-golf) zijn een natuurlijk paar: G4
geeft C1 zijn eerste, ontworpen bestaansreden. H1 en H3 moeten SAMEN gebouwd worden, niet
los: de een is de straf, de ander de beloning op dezelfde vraag, en apart gebouwd geven ze
een verwarrende, eenzijdige boodschap.

**Bijt elkaar.** E5 (tweede uitweg) en het huidige gewicht van de boot-ontsnapping bijten
elkaar potentieel: een tweede win-conditie verdunt het enige, zorgvuldig opgebouwde
eindspel-moment tenzij de nieuwe route duidelijk als de MINDERE optie voelt (zie de
eigen twijfel in E5's beschrijving). D4/D5/J1 (meerdere keuzeschermen vóór golf 1) bijten de
arcade-directheid die nu een sterk punt is (§0.2) als ze allemaal tegelijk gebouwd worden;
kies er hooguit één, niet alle drie. F5 (Kraaienmars) bijt niets, maar concurreert om
bouwtijd met alles wat wél mechanisch effect heeft, expliciet de laagste prioriteit van
alles in dit document.

**Volgorde.** Bouw eerst wat een systeem VERDIEPT zonder het te verbreden (D1, B2, C1,
A1), kleine, veilige stappen op bestaande fundamenten. Bouw pas daarna iets dat een NIEUWE
as toevoegt (E1's verticaliteit, G's alternatieve golfdoelen). Die vragen meer testwerk en
meer balansrisico, en zijn makkelijker te beoordelen als het fundament er al goed bij ligt.

### 4. Wat ik bewust niet zou doen

**Geen procedureel gegenereerde kaart.** De hele pacing (`ZONE_SPAWN_INTERVAL_FACTOR`,
`GOLF_MAX_ACTIEF`, de handgetunede chokepoints en waypoints) is gebouwd op een KAART DIE DE
ONTWERPER KENT. Een generieke kaart per run zou al deze balans onbruikbaar maken en een
volledig nieuw pacing-model vragen. De huidige, hand-ontworpen ruimte is een sterk punt
(§0.2), geen beperking om op te lossen.

**Geen skill tree/talent-web-UI.** Meerdere van de D-ideeën stellen keuzes voor, maar
bewust GEEN grid met tientallen knooppunten. Dat past niet bij een spel dat leeft van
snelle, directe beslissingen (koop, schiet, ren), en het is precies het soort UI-complexiteit
dat zwaar leunt op een build-systeem dat één HTML-bestand niet fijn onderhoudt.

**Geen co-op/multiplayer.** Dit doorbreekt niet alleen de "één speler, geen server"-
randvoorwaarde uit het kader, het is een ander spel: elke balansbeslissing in dit document
(threat-budget, spawn-plafond, aanvalsslot-limiet `MAX_AANVALLERS`) is getuned voor precies
één speler. Zelfs lokale co-op zou het hele budgetmodel opnieuw moeten uitvinden.

**Geen crafting-/inventarisgrid.** C3 (vluchtige uitrusting) stopt bewust bij twee
gedragen items met simpele knoppen. Een volwaardig inventarissysteem met combineren,
stapelen, grids, is overkill voor een arcade wave-survival en zou de directheid van "zie
iets, pak het, gebruik het" vervangen door menu-gedoe.

**Geen tweede taal/lokalisatie.** CLAUDE.md is expliciet: Nederlandstalige namen en
commentaar. Een Engelse (of andere) vertaling zou een string-systeem vragen dat nu nergens
bestaat (teksten staan inline door de hele codebase), puur om een publiek te bedienen
waarvan ik niet weet of het bestaat.

### 5. Vragen aan de eigenaar

**Blijft dit één HTML-bestand zonder buildstap, ook als de scope van dit document serieus
genomen wordt?** Als het antwoord ja is, blijven grote, structurele ideeën (E1's zolderroute,
C2's Vlambuis) prima haalbaar maar wel met discipline; als het antwoord nee is (een
buildstap zou mogen), verandert dat welke ideeën ik als "groot" zou labelen totaal, en
opent het bijvoorbeeld multi-bestand asset-pipelines die nu bewust uitgesloten zijn.

**Hoe lang duurt een gemiddelde speelsessie nu écht, en is dat goed zo?** De eigen
lategame-simulatie test tot golf 24, maar ik weet niet hoe lang dat in de praktijk speelt.
Dat bepaalt of A1/G-ideeën (meer te doen per golf) de sessie te lang maken, of juist precies
vullen wat nu ontbreekt.

**Is er ruimte om een idee eerst KLEIN te bouwen en pas te verzwaren als het werkt, of moet
elk idee in één keer compleet zijn?** Vrijwel elk idee in dit document heeft een lichte en
een zware variant met opzet. Het antwoord bepaalt of ik zou adviseren om bijvoorbeeld D1 met
twee identieke-maar-cosmetisch-verschillende paden te LANCEREN en pas later mechanisch te
laten divergeren, of meteen de volle versie te bouwen.

### 6. Mijn oordeel

Als ik er één mag bouwen, bouw ik **D1: Twee paden bij de Smederij**.

Niet omdat het het meest spectaculaire idee in dit document is, dat is het niet. Ik kies het
omdat het precies op de plek zit waar dit spel het duidelijkst een gat heeft ten opzichte van
hoe goed de rest ervan is. Sectie 0.2 van dit document beschrijft een spel dat serieus,
volwassen werk heeft gestoken in vijandleesbaarheid, in het vermijden van bullet sponges, in
zuinig maar rijk procedureel bouwen. Diezelfde zorgvuldigheid is nergens te vinden in wat de
speler zelf wordt: elke aankoop is een getal omhoog, zonder uitzondering, van golf 1 tot de
Smederij aan toe. Dat is de enige plek in het hele spel waar "vooruitgang" en "identiteit"
volledig hetzelfde ding zijn geworden.

D1 kost weinig: `smederijConfig` bestaat al precies in de vorm die nodig is (een object met
een schadebonus en een magazijnaanpassing per wapen), `koopSmederij()` is de enige
aanroepplek die moet weten van een keuze, en er is geen enkel nieuw architectuurpatroon
nodig. Het risico is klein en goed te beheersen (de twee paden moeten in balans zijn, dat is
tuning, geen systeemrisico). En het effect raakt de LAATSTE, meest bepalende aankoop van elke
run: het moment waarop een speler voor het eerst een wapen smeedt is al een emotioneel
hoogtepunt (eigen geluid, `speelSmeed()`, een visuele upgrade via de Smederij-visuals), en nu
gooi je dat hoogtepunt weg op een uitkomst die toch al vaststond zodra je genoeg geld had.

Vergelijk dat met bijvoorbeeld B2 (De Voorman) of C1 (De Blaker): allebei sterke ideeën, maar
beide voegen iets TOE aan een gebied dat al goed is (vijanden, wapens). D1 repareert
daarentegen het enige gebied waar de vergelijking met de rest van het spel het spel zelf in
zijn nadeel uitvalt. Als ik één ding mag bouwen om dit spel dichter bij zijn eigen ambitie te
brengen, bouw ik niet meer van wat al sterk is. Ik bouw het stuk dat nu nog het zwakst is.

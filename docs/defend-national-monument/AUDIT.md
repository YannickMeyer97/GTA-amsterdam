# Audit Defend National Monument — na fase P

*Stand: na D60 (fase P gebouwd, speeltest M4 open). Alleen
`defend-national-monument.html` en zijn documentatie en tests.*

> **Stand van de punten** (na M4): 1, 2 en 3 zijn uitgevoerd in D61, D62
> en D63; de naam "Defend National Monument" staat overal (D61), en er is
> een volumeregelaar (D64, uit punt 12). Punt 4 is door de speeltest
> bevestigd en aangepakt met een derde poort vanaf wave 11 (D67) en
> elite-robots (D68); de run is daarbij 20 waves geworden met een vierde
> baas (D69). De telefoonversie (punt 13) komt later.
>
> **Na D80:** alle punten zijn verwerkt:
> - 5 wavebanner (D71), 6 Klokslag onder X (D74), 7 Stroomval op bazen
>   (D75);
> - 8 Dijkbreker 75 HP (D70), 9 bereikcirkels (D73), 10 één naamset (D72);
> - 11 voortgang wissen en 12 camera-schok (D76; volume al in D64);
> - 13 een melding op apparaten zonder muis (D77; de telefoonversie zelf
>   staat in de backlog), 14 Zware kogels (D78);
> - 15–17 onderhoud en een test die een run speelt (D79).
>
> Herijkt in D80; de speeltest M5 staat open.

## Hoe er gekeken is

- **De code gelezen**, met de nadruk op wat de speler ziet (startscherm,
  hulpbalk, menu's, banners) en op de systemen die in fase M en P zijn
  bijgekomen.
- **Hele runs automatisch gespeeld** met het nieuwe meetscript
  `tests/defend-national-monument/meet-dnm-run.mjs`. Een gesimuleerde
  speler aan de monumentrand schiet met de echte vuur- en warmtefuncties,
  raapt munten meteen op en koopt volgens een strategie ("goed": torens op
  de actieve poorten tot niveau 3, upgrades, drukpers, repareren onder
  60%; "zwak": één geschuttoren per poort). Hij mikt nooit mis en loopt
  niet: in het echt duurt een run dus langer.
- **De HUD** met alles tegelijk in beeld (baas, menu, prompt, combo,
  Kerkklok, oververhit, banner met tip, minimap) op 1920×1080, 1280×720 en
  1024×640, en de piekscene (11 robots, 6 torens) op draw calls.
- De volledige regressiesuite: groen (153/154; de uitvaller is de bekende
  timinggevoelige Undead-test, los groen).

## Uitkomst van de automatische runs

| Strategie | Uitkomst | Duur | Monument na wave 14 | Bazen |
|---|---|---|---|---|
| goed | gewonnen, 2 sterren | 13:11 | 60% (€872 op zak) | Dijkbreker door met 22/90 |
| goed | gewonnen, 2 sterren | 12:46 | 69% | Dijkbreker door met 21/90 |
| goed | verloren in wave 15 | 12:16 | 60% | Stoomwals door met 9/180 → game over |
| zwak | verloren in wave 15 | 14:53 | 52% (€5.691 ongebruikt) | Dijkbreker en Stoomwals door |

In de goede runs doen de torens 80–82% van de kills. De speler vuurt maar
~340 schoten in 13 minuten, de hoogste combo is 6–8, en buiten de
baaswaves loopt het monument **geen enkele schade** op.

**Technisch schoon:**
- geen console-fouten in vijf hele runs;
- geen vastgelopen robots en geen ongeldige posities;
- geheugen begrensd (~280–305 geometrieën aan het eind van een run);
- 277 draw calls in de drukke scene;
- ~120 geluiden per minuut.

## Wat goed is (houden zo)

- De run heeft een kop en een staart en duurt ongeveer de gekozen 15
  minuten.
- De drie bazen zijn duidelijk anders en vragen elk iets anders.
- De economie haalt het D16-doel.
- Geen lekken meer (D42), en een prestatiebudget met test.
- Een uitgebreide testsuite (37 DNM-scripts) en meetscripts voor
  afstanden, economie, prestaties, bazen en nu hele runs.
- Documentatie per ticket, met metingen.

## Verbeterpunten

Per punt: wat er is, waarom het telt, en een voorstel. Prioriteit 1 raakt
het spelplezier direct; 2 is afwerking; 3 is onderhoud.

### Prioriteit 1

**1. De uitleg klopt niet meer, en het belangrijkste staat er niet in.**
- *Wat er is:*
  - Het startscherm zegt "druk bij een bordje op T voor upgrades"; sinds
    D45 opent het menu vanzelf.
  - Het noemt niet: torens en bouwplekken, de run van 15 waves met bazen,
    G (volgende wave), X (special), de cijfertoetsen, oververhitting of
    sterren.
  - De hulpbalk mist X en de cijfers.
  - De README-sectie beschrijft een oudere game: munten van €5–25,
    upgrades met toetsen 1/2/3, robots die "recht op het monument
    aflopen", een rijdende tram, een straatmuzikant en een levend
    standbeeld (bestaan niet).
- *Waarom:* een nieuwe speler ontdekt de kern van de game (bouwen) alleen
  door toeval.
- *Voorstel:*
  - een kort startscherm (vijf regels: doel, lopen/schieten, bouwen bij de
    gouden cirkels, 15 waves en drie bazen, Esc);
  - een complete hulpbalk;
  - in de eerste run een paar eenmalige hints op het juiste moment:
    eerste bouwplek, eerste bouwfase, eerste oververhitting, eerste baas;
  - de README herschrijven.

**2. Sterren zijn te koop.**
- *Wat er is:* repareren kost €100 voor +25% en kan onbeperkt. Aan het eind
  van een run heeft een goede speler genoeg geld (in de meting €872 bij
  60%). Twee reparaties vlak voor het eind geven 3 sterren.
- *Waarom:* sterren tellen voor de ontgrendelingen (6 en 12). Ze moeten
  goed spel belonen, niet een laatste aankoop.
- *Voorstel (kies één):*
  - sterren naar de totale schade over de hele run (bijvoorbeeld 3 sterren
    bij ≤ 10% opgelopen schade, ongeacht reparaties);
  - of reparatie beperken: duurder per keer (€100, €150, €200, …) of
    alleen in de bouwfase.

**3. De eindbaas maakt een hele run in één klap ongedaan.**
- *Wat er is:* de Stoomwals doet 100 schade: altijd game over, ook als hij
  met 9 van zijn 180 HP aankomt en het monument nog op 60% staat.
- *Waarom:* 13 minuten spelen verloren op de laatste seconden voelt als
  pech, niet als verliezen.
- *Voorstel:*
  - schade 60–75, zodat hij alleen een gehavend monument afmaakt;
  - of: bij aankomst een laatste gevecht van een paar seconden aan de
    voet van het monument, waarin je hem nog kunt neerhalen.

**4. Tussen de bazen is er geen dreiging meer, en de torens nemen het over.**
- *Wat er is:* met 4–6 torens loopt het monument in waves 6–9 en 11–14
  niets op. Torens doen 80% van de kills. Combo en special komen daardoor
  nauwelijks op gang: de hoogste combo is 6–8, tegen 38 in de zwakke run,
  waar de speler zelf moet schieten.
- *Waarom:* dit is waarschijnlijk wat eerder "basic" aanvoelde. Na je
  opbouw wacht je vooral op de volgende baas.
- *Voorstel (ontwerpkeuze voor de eigenaar):*
  - de waves na de eerste baas echt zwaarder: een derde poort vanaf
    wave 11, of "elite"-robots met een eigen trucje (een tank die torens
    beschiet, een zwerm die splitst);
  - of iets dat alleen de speler kan (een schild alleen met het wapen te
    breken, munten die je moet halen voordat een robot ze pakt);
  - of torens die slijten en onderhoud vragen, zodat geld schaars blijft.

**5. De wavebanner staat over het richtkruis.**
- *Wat er is:* op 1280×720 en 1024×640 valt de banner (sinds D54 met een
  tipregel en 4 s in beeld) over het richtkruis. Op 1024×640 ook over het
  menu en de warmtemeter. Banners als "De Stoomwals wordt woedend!"
  verschijnen midden in een gevecht.
- *Voorstel:* de banner hoger (rond 20% van de hoogte in plaats van 38%) of
  kleiner op lage schermen, en tijdens een wave korter.

### Prioriteit 2

**6. De special (X) voelt niet als beloning.** Hij start de Kerkklok Boost:
dubbel geld, maar robots worden ook sneller. X staat nergens uitgelegd.
*Voorstel:* een eigen special, bijvoorbeeld alle robots binnen het
wapenbereik 3 s vertragen, of een salvo zonder oververhitting. Of in ieder
geval uitleg in de hulpbalk.

**7. De Stroomval vertraagt ook bazen, zonder grens.** Hij vuurt om de 1,3 s
en vertraagt 3 s, dus een baas in bereik loopt permanent half zo snel.
Zodra hij ontgrendeld is, wordt het waarschijnlijk de standaardkeuze tegen
bazen. *Voorstel:* op bazen het halve effect, en meten met
`meet-dnm-bazen`.

**8. De Dijkbreker haalt het in elke goede run** (met 21–22 van 90 HP
over; −40%). Samen met punt 2 betekent dat: 3 sterren kan alleen via
repareren. *Voorstel:* na punt 2 opnieuw meten; eventueel 75 HP of het
schild iets korter dicht.

**9. Geen bereik zichtbaar bij bouwen.** Je ziet niet wat 11 m (geschut) of
22 m (Scherpschutter) betekent, en ook niet welk stuk route een toren
dekt. *Voorstel:* een bereikcirkel op de straat zolang het bouwmenu open
is, ook voor het volgende niveau en voor beide richtingen.

**10. Namen lopen door elkaar.**
- Het eindscherm noemt robots Grunt, Runner, Bomber en Shield Bot; de
  banners zeggen Sprinters en Bommenwerpers.
- Het startscherm heet "DAM CHAOS", het menu en de README "Defend National
  Monument".

*Voorstel:* één Nederlandse naamset en één titel.

**11. Geen manier om voortgang of highscore te wissen.** *Voorstel:* in het
ontgrendelpaneel "Voortgang wissen", met bevestiging.

**12. Instellingen.**
- Geluid kan alleen aan of uit.
- De camera-schok staat vast aan.

*Voorstel:* een volumeschuif en een schakelaar voor de schok.

**13. Op een telefoon of tablet is de game onspeelbaar, zonder dat iets dat
zegt.** Touch is bewust geschrapt (D23–D26). Op zo'n apparaat staat de
kwaliteit wel op Laag, maar "Klik om te spelen" doet niets bruikbaars.
*Voorstel:* op een grof-pointer-apparaat een melding "Deze game vraagt
toetsenbord en muis", en hetzelfde bij de knop in `index.html`.

**14. Geld stapelt op zonder bestemming** zodra je torens op niveau 3 staan
(€872 bij wave 14; in de zwakke run zelfs €5.691). *Voorstel:* hangt af
van punt 4; bijvoorbeeld een extra bouwplek per poort die je kunt kopen,
of een monumentversterking.

### Prioriteit 3 (onderhoud)

**15. Dode en verouderde code.**
- `updateBewegendeTrams` wordt aangeroepen achter een `typeof`-bewaking,
  maar bestaat niet.
- De standaardsnelheid in `maakRobot` wordt altijd overschreven.
- De debugnamen `activeerBijenkorfUpgradeShop` en `bijenkorfShopOpenStand`
  zijn van vóór D35.
- In ARCHITECTURE_NOTES staat boven §15 nog "nog niet gebouwd".

*Voorstel:* opruimen in één ticket, tests mee.

**16. Torens worden bij verkopen of slopen niet opgeruimd** (geen
`dispose`). Het blijft begrensd (~300 geometrieën aan het eind van een
run), maar komt net boven het D42-budget, dat alleen bij het laden wordt
gemeten. *Voorstel:* gedeelde torengeometrie (zoals bij robots), of
`dispose` in `verwijderToren`; `test-dnm-prestaties` laten meten na een
hele run.

**17. Geen test die een hele run speelt.** `meet-dnm-run` doet dat nu als
meetscript. *Voorstel:* een lichte variant als test (één run tot wave 6,
geen fouten, geen vastlopers), zodat een wijziging die een run breekt
meteen opvalt.

## Voorgestelde volgorde

1. Punten 1 (uitleg), 2 (sterren) en 3 (eindbaas): klein, en ze raken
   meteen hoe eerlijk en begrijpelijk de game voelt.
2. Punt 4 (dreiging tussen de bazen) na de speeltest M4: dat is een
   ontwerpkeuze, en jouw ervaring weegt daar het zwaarst.
3. Punten 5–14 als afwerking, 15–17 als één onderhoudsticket.

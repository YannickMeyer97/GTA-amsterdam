# AUDIO.md — audit, classificatie en de assetregel-beslissing

Ticket 152 (Ronde 11, fase 7). Dit document inventariseert en classificeert
elk geluid in Amsterdam Undead, meet wat samples werkelijk zouden kosten, en
legt **de projectregelvraag bij de eigenaar neer**: mag `CLAUDE.md`'s verbod
op externe assets wijken voor audio, ja of nee.

Het levert geen code. Het is de directe input voor T153 (audioregistry) en
T154 (uitrol) — die twee tickets hebben pas een scope zodra §5 beantwoord is.

Zelfde rol als `FINALE.md` voor T146/T147 en `GUNFEEL.md` voor T142-T144.

Meetscripts: `tests/meet-audio-budget.mjs` (laadtijd + stemmen, browserkant),
`tests/meet-audio-codecs.py` (codec-bytes, vereist `pip install numpy
soundfile lameenc`). Alle getallen hieronder komen daaruit — ontwerpbeslissing
105 schatte ~11 KB/s en zette er zelf bij dat dat gemeten hoorde te worden.

---

## 0. Waar we vandaan komen

De klankwereld van Amsterdam Undead bestaat uit **41 bronnen**: 38
`speel*()`-functies en drie permanente lagen. Alles loopt via Web Audio, geen
enkel byte audio staat in het bestand.

Bijna alles wordt gemaakt door precies één bouwsteen, `piep()`:

```js
function piep(type, startHz, eindHz, duur, volume, pan) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startHz, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(eindHz, audio.currentTime + duur);
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duur);
  …
}
```

Eén oscillator, één exponentiële toonhoogtesweep, één exponentieel
volumeverval. 30 van de 38 functies zijn letterlijk één of twee
`piep()`-aanroepen.

**De belangrijkste bevinding van deze audit staat in die functie, en het is
niet "er zitten geen samples in":**

> Er is in het hele spel **geen enkele ruisbron**. Geen `createBufferSource`,
> geen `AudioBuffer`, nergens. Elk van de 41 geluiden is een zuivere,
> getoonde golfvorm. Er zijn precies twee filters in het spel (de lowpass in
> `speelOndodeGrom()`), en verder niets.

Dat verklaart in één keer waarom een schot als "piew" klinkt en niet als een
knal, waarom een windvlaag twee sinussen zijn, en waarom brekend hout een
sawtooth-sweep is: **een breedbandige transiënt is met een enkele oscillator
principieel niet te maken.** Niet omdat het procedureel niet kan — Web Audio
kan het prima — maar omdat deze codebase die bouwsteen nooit heeft gekregen.

Dat onderscheid draagt de rest van dit document. De vraag is niet "synth of
sample", de vraag is "welke procedurele gereedschappen ontbreken er".

Wat er wél al goed zit, en waar deze audit niets aan wil veranderen:

| aanwezig | waar |
|---|---|
| Eén master-mute-gain, alles loopt erdoorheen | `masterGainNode`, Fix 4 |
| Drie permanente sfeerlagen met eigen gain en throttle | dreigingsdrone (T49), akkoordbed (T66), stadsbed (T82) |
| Richtinghoren via `StereoPannerNode` | T80, `hoekNaarPan()` / `berekenRelatieveHoek()` |
| Afstandsafhankelijk volume | `berekenBootHoornPanVolume()` |
| Pitch-variatie tegen monotonie | `pitchVariatie()`, ±5% op de trefferklanken |
| Per-wapen klankidentiteit als data | `schotToon`/`raakToon`/`kopToon`/`killToon` (T34, T144) |
| Per-type gromprofielen als data | `GROM_PROFIELEN` (T31, T110) |
| Handmatig uitgebalanceerde mix | de +15%/+20%-rondes staan in de bron gedocumenteerd |
| 26 testtellers over 23 testbestanden | zie §2 |

Dat is meer audio-architectuur dan de roadmap veronderstelde. De twee
data-tabellen (`GROM_PROFIELEN`, de per-wapen tonen) zijn feitelijk al
miniatuur-registries — T153 generaliseert een patroon dat er al staat.

---

## 1. Inventaris

Kolom **teller** is de debug/test-haak; kolom **klank** is wat de code
vandaag daadwerkelijk produceert. Classificatie: zie §3.

### 1.1 Wapens en treffers (11)

| geluid | klank vandaag | wanneer | teller | klasse |
|---|---|---|---|---|
| `speelSchot` | sawtooth-sweep, per wapen (`schotToon`: 480→120 Hz / 0,09 s resp. 620→210 Hz / 0,06 s) | elk schot; tot 10/s met de Canal Ripper | — | **SYNTH+** |
| `speelDroogKlik` | square 200→180 Hz, 0,04 s | leeg magazijn | — | **SYNTH+** |
| `speelHerlaad` | sine 300→500 Hz, 0,15 s | start herladen | `herlaadStartTeller` | **SYNTH+** |
| `speelHerlaadKlaar` | sine 500→700 Hz, 0,12 s | einde herladen | `herlaadKlaarTeller` | **SYNTH+** |
| `speelWissel` | triangle 260→420 Hz, 0,08 s | wapenwissel | `wisselTeller` | SYNTH KEEP |
| `speelMesSteek` | sawtooth 380→90 Hz, 0,08 s | messteek | `mesSteekTeller` | **SYNTH+** |
| `speelRaakTik` | per wapen (`raakToon`), ±5% pitch | lichaamstreffer | `raakTikTeller` | **SYNTH+** |
| `speelKopTik` | per wapen (`kopToon`), ±5% pitch | koptreffer | `kopTikTeller` | **SYNTH+** |
| `speelKillKnak` | per wapen (`killToon`) + sine 95→42 Hz / 0,26 s onderlaag (T149) | kill | `killKnakTeller` | **SYNTH+** |
| `speelDoorboring` | triangle 620→110 Hz, 0,16 s | Doorboring raakt tweede doel | `doorboringTeller` | SYNTH KEEP |
| `speelPlankBreek` | sawtooth 180→60 Hz, 0,09 s, gepand | barricadeplank breekt | — | **SYNTH+** |

### 1.2 Ondoden (4)

| geluid | klank vandaag | wanneer | teller | klasse |
|---|---|---|---|---|
| `speelOndodeGrom` | 2 ontstemde osc → lowpass met dalende cutoff → optionele panner; per type via `GROM_PROFIELEN` | per ondode elke 4-9 s | `ondodeGromTeller` | **HYBRID-kandidaat** (§3.3) |
| `speelAanvalGrom` | sawtooth, per type eigen register | windup-start, max 2 gelijktijdig | `aanvalGromTeller` | SYNTH KEEP |
| `speelSlagRaak` | square 100→40 Hz, 0,12 s | aanval raakt | `slagRaakTeller` | **SYNTH+** |
| `speelSlagMis` | sine 240→90 Hz, 0,22 s | aanval mist ("whoosh") | `slagMisTeller` | **SYNTH+** |

### 1.3 Speler, wereld en events (6)

| geluid | klank vandaag | wanneer | teller | klasse |
|---|---|---|---|---|
| `speelSpelerAu` | sawtooth 160→60 Hz, 0,18 s | speler krijgt schade | — | **HYBRID-kandidaat** |
| `speelExplosie` | sawtooth 90→30 Hz + na 40 ms square 60→25 Hz | Brander explodeert | — | **SYNTH+** |
| `speelStroomklap` | square 700→380 Hz (0,03 s) + na 30 ms sawtooth 120→40 Hz | stroomuitval begint | `stroomklapTeller` | SYNTH KEEP |
| `speelStroomHerstel` | sine 300→500 Hz, 0,1 s | stroom terug | `stroomHerstelTeller` | SYNTH KEEP |
| `speelGolfStart` | sawtooth 130→260 + na 130 ms square 200→340 | golf begint | — | SYNTH KEEP |
| `speelGolfKlaar` | sine 520→780 + na 150 ms sine 780→1040 | golf klaar | — | SYNTH KEEP |

### 1.4 Meta en economie (6)

| geluid | klank vandaag | wanneer | teller | klasse |
|---|---|---|---|---|
| `speelGameOver` | sawtooth 300→70 (0,5 s) + na 220 ms sine 160→50 (0,7 s) | game over | — | SYNTH KEEP |
| `speelKoop` | triangle 420→900 Hz, 0,1 s | elke aankoop (18 aanroepplekken) | — | SYNTH KEEP |
| `speelGeenGeld` | square 220→120 Hz, 0,12 s | te weinig geld (18 aanroepplekken) | — | SYNTH KEEP |
| `speelSmeed` | sawtooth 180→60 + na 90 ms triangle 700→1100 | Smederij-upgrade | — | SYNTH KEEP |
| `speelIntroMelodie` | vier sines (A4-C#5-E5-A5) via `setTimeout` | 1× per sessie, ontgrendeld via het stadsarchief | `introMelodieTeller` | SYNTH KEEP |
| `speelFinaleLosgooien` | sawtooth 90→260 Hz, 0,35 s | begin instapfase (T147) | `finaleLosgooienTeller` | SYNTH KEEP |

### 1.5 Omgeving en sfeer (7)

| geluid | klank vandaag | wanneer | teller | klasse |
|---|---|---|---|---|
| `speelDruppelTik` | sine 900→500 Hz, 0,05 s | druppel landt, elke 3-6 s binnen 8 m | `druppelTikTeller` | SYNTH KEEP |
| `speelGrachtklok` | sine 440→380 + na 550 ms sine 660→560, elk 0,9 s | zone A, elke 40-80 s | — | SYNTH KEEP |
| `speelGangKraak` | sawtooth 90→40 Hz, 0,35 s | eerste stap de gang in | — | **SYNTH+** |
| `speelBijkeukenKraak` | sawtooth 70→30 Hz, 0,4 s | eerste stap de bijkeuken in | — | **SYNTH+** |
| `speelWindvlaag` | sine 200→260 (1,1 s) + na 300 ms sine 180→140 (1,3 s) | eerste stap de binnenplaats op | — | **SYNTH+** |
| `speelVerreScheepshoorn` | `stadPiep` triangle 92→68 Hz, 1,6 s | elke 50-110 s | `stadHoornTeller` | SYNTH KEEP |
| `speelVerreStadsklok` | `stadPiep` sine 480→450 + na 380 ms sine 640→600 | elke 90-180 s | `stadKlokTeller` | SYNTH KEEP |

### 1.6 Boot en finale (4)

| geluid | klank vandaag | wanneer | teller | klasse |
|---|---|---|---|---|
| `speelBootHoorn` | sine 200→140 Hz, 1,1 s | boot komt aan | `bootHoornTeller` | SYNTH KEEP |
| `speelBootVertrek` | sine 150→100 Hz, 0,8 s | boot vaart weg | `bootVertrekTeller` | SYNTH KEEP |
| `speelBootHoornGericht` | eigen keten osc→gain→panner→master, sine 200→140 Hz, pan+volume naar afstand | elke 7 s (tot 2,5 s in de instapfase) zolang het venster leeft | `bootHoornHerhaalTeller` | SYNTH KEEP |
| `speelNevelklokToon` | envelope op het permanente akkoordbed (lineair op, exponentieel af) | Nevelklok-cadans | `nevelklokTeller` | SYNTH KEEP |

### 1.7 Permanente lagen (3)

| laag | klank vandaag | sturing | teller | klasse |
|---|---|---|---|---|
| Dreigingsdrone | 2 sines op 55/57 Hz (zweving) | `updateDreigingsAudio()`, nabijheid + finale-vloer | `dreigingsGainSchrijfTeller` | SYNTH KEEP |
| Akkoordbed ("Nevelklok") | 3 sines E3/C#4/D4 (halve-toon-wrijving) | `updateAchtergrondmuziek()` | `muziekGainSchrijfTeller` | SYNTH KEEP |
| Stadsbed | permanente gain met plafond 0,0345, draagt hoorn + stadsklok | `updateStadsGeluid()` | `stadGainSchrijfTeller` | SYNTH KEEP |

---

## 2. De testtellers als hard contract

De roadmap sprak van "13 testtellers" en "zes `setTimeout`-valkuilen". Beide
getallen zijn achterhaald; hier de gemeten stand.

**26 audio-tellers, verspreid over 17 testbestanden.** T153 mag geen enkele
ervan van betekenis laten veranderen.

| teller | testbestand(en) |
|---|---|
| `aanvalGromTeller`, `slagRaakTeller`, `slagMisTeller` | `test-aanval-tells.mjs` |
| `raakTikTeller`, `kopTikTeller`, `killKnakTeller`, `herlaadStartTeller`, `herlaadKlaarTeller` | `test-hitmarker-audio.mjs` |
| `doorboringTeller` | `test-ripper-agressie.mjs` |
| `mesSteekTeller` | `test-mes.mjs`, `test-arsenaal-startwapen.mjs` |
| `wisselTeller` | `test-wapen-identiteit.mjs` |
| `ondodeGromTeller` | `test-vijand-leesbaarheid.mjs` |
| `druppelTikTeller` | `test-omgeving-sfeer.mjs` |
| `stroomklapTeller`, `stroomHerstelTeller` | `test-stroomuitval.mjs` |
| `dreigingsGainSchrijfTeller` | `test-dreigingsaudio.mjs` |
| `muziekGainSchrijfTeller`, `nevelklokTeller` | `test-achtergrondmuziek.mjs` |
| `stadGainSchrijfTeller`, `stadHoornTeller`, `stadKlokTeller` | `test-stadsgeluid.mjs` |
| `bootHoornTeller` | `test-boot-aankondiging.mjs`, `test-vluchtroute.mjs`, `test-ontsnapping-vensters.mjs` |
| `bootVertrekTeller` | `test-ontsnapping-vensters.mjs` |
| `bootHoornHerhaalTeller` | `test-boot-aankondiging.mjs` |
| `finaleLosgooienTeller` | `test-finale.mjs` |
| `introMelodieTeller` | `test-stadsarchief.mjs` |

**23 van de 91 testbestanden raken audio.** Naast de tellerbestanden:
`test-geluidsknop.mjs`, `test-richtinghoren.mjs`,
`test-trefferfeedback-per-wapen.mjs`, `test-ontsnapping.mjs`,
`test-resources.mjs`, `test-zone-banners.mjs`.

**Twee bron-regexen zijn een hardere beperking dan de tellers.**
`test-geluidsknop.mjs` leest de *broncode* van `piep()`,
`speelBootHoornGericht()` en `initGeluid()` en eist onder meer:

- `piep()` bevat `connect(masterGainNode)` en géén `connect(audio.destination)`;
- `initGeluid()` bevat **exact drie** keer `GainNode.connect(masterGainNode)`;
- `initGeluid()` bevat **exact één** `connect(audio.destination)` in de hele bron.

Dat derde punt is de reden dat `stadPiep()` een eigen kopie van de
`piep()`-boilerplate is in plaats van dat `piep()` een bus-parameter kreeg —
dat staat zo in de bron gedocumenteerd. **Het is ook de directe reden dat
categorie-gains niet gratis zijn** (§6).

**Tien functies hebben `setTimeout`-vervolgtonen, niet zes.** Twaalf
vervolgtonen in totaal: `speelVerreStadsklok`, `speelIntroMelodie` (3×),
`speelExplosie`, `speelGolfStart`, `speelGolfKlaar`, `speelGameOver`,
`speelGrachtklok`, `speelWindvlaag`, `speelStroomklap`, `speelSmeed`. Ze lopen
allemaal door tijdens pauze — precies de bug die T33 `speelHerlaad` deed
splitsen.

---

## 3. Classificatie

Uitgangspunt uit de opdracht: **de procedurele stijl is een bewuste keuze,
geen tekortkoming; de bewijslast ligt bij "dit móét een sample worden".**

### 3.1 De uitkomst in één regel

**SAMPLE: 0. HYBRID: 0. SYNTH KEEP: 41** — waarvan **13 als SYNTH+**: houden,
maar aantoonbaar onder de maat zolang er geen ruisbron is.

Dat is geen conservatisme uit gemakzucht. Het is de uitkomst van één
vaststelling: elk geluid dat een sample "nodig" leek te hebben, heeft dat
nodig omdát het breedbandig is — en breedbandig is exact wat een
`AudioBufferSourceNode` met een lokaal gevulde ruisbuffer procedureel wél
levert. Nul bytes op schijf, nul externe assets, nul IP-risico.

### 3.2 SYNTH+ — de dertien die de ruisbron nodig hebben

`speelSchot`, `speelDroogKlik`, `speelHerlaad`, `speelHerlaadKlaar`,
`speelMesSteek`, `speelRaakTik`, `speelKopTik`, `speelKillKnak`,
`speelPlankBreek`, `speelSlagRaak`, `speelSlagMis`, `speelExplosie`,
`speelGangKraak` / `speelBijkeukenKraak` / `speelWindvlaag`.

Wat ze delen: in de werkelijkheid is het dominante deel van deze klanken
**ruis**, geen toon. Een schot is een drukgolf; brekend hout is versplintering;
wind ís gefilterde ruis; een "whoosh" ís gefilterde ruis met een bewegende
cutoff. Ze klinken vandaag als een fluitje omdat ze een fluitje zíjn.

Het recept per geluid is hetzelfde en kost geen enkele byte:

```
ruisbuffer (1× bij init, ~1 s, hergebruikt)
  → BufferSource (playbackRate randomiseerbaar)
  → BiquadFilter met gescheduelde cutoff-envelope
  → gain met envelope
+ de bestaande getoonde laag eronder (body/pitch — die draagt de identiteit)
```

De T149-bijstelling op `speelKillKnak` — een lage sine ónder de bestaande
per-wapen `killToon` — is precies dit patroon, alleen dan met een toon in
plaats van ruis. Het werkte, en de speeltoets bevestigde het. Dat is het
sterkste bewijs in dit project dat lagen stapelen wérkt.

### 3.3 De twee eerlijke SAMPLE-kandidaten

Twee geluiden zijn menselijke stem, en daar loopt procedurele synthese
werkelijk tegen een plafond aan:

**`speelOndodeGrom`.** Nu al het meest geavanceerde geluid in het spel: twee
ontstemde oscillators door een lowpass met dalende cutoff, per type
geparametriseerd. Een echte opname zou onmiskenbaar beter klinken. Twee
argumenten wegen daar tegenop, en ze zijn allebei zwaar:

1. **Herhaling.** Twaalf ondoden grommen elk om de 4-9 s; over een run van
   tien golven zijn dat honderden grommen. Procedureel krijg je variatie
   gratis (detune, cutoff, duur, playbackRate randomiseren). Met samples
   betaal je per variant: gemeten **4,4 KB raw / 5,9 KB base64** per
   0,5 s-variant op mp3 64 kbps. Acht varianten per type × vier types = 32
   bestanden ≈ 140 KB raw. Te weinig varianten en het wordt een loop die je
   ná drie golven doorhebt — erger dan de huidige klank.
2. **Herkomst.** Elke opname heeft een verifieerbare licentie nodig. De
   IP-regels in `CLAUDE.md` zijn voor dit project hard; "een zombiegrom van
   internet" is precies wat ze uitsluiten.

**`speelSpelerAu`.** Ook stem, maar hier is de huidige abstracte toon
verdedigbaar: hij functioneert als schadefeedback naast het vignet en de
richtingspijl (T68), niet als personage-uiting. Laten staan.

### 3.4 Waarom de rest ongewijzigd SYNTH KEEP is

Twee groepen, allebei met een positief argument in plaats van "kan geen
kwaad":

**Abstracte signalen** (`speelKoop`, `speelGeenGeld`, `speelSmeed`,
`speelGolfStart`, `speelGolfKlaar`, `speelGameOver`, `speelWissel`,
`speelDoorboring`, `speelStroomklap`, `speelStroomHerstel`,
`speelFinaleLosgooien`): dit zijn UI-tonen. Ze moeten *leesbaar* zijn, niet
*realistisch*. Een gesynthetiseerde toon is hier het juiste medium, niet een
compromis — precies zoals een pictogram beter werkt dan een foto.

**Klanken die in werkelijkheid al tonaal zijn** (`speelDruppelTik`, de
klokken, alle vier de boot-/scheepshoorns, de drie permanente lagen,
`speelIntroMelodie`): een scheepshoorn ís een aangehouden harmonische toon,
een druppel ís een "plink". Hier is de synth niet de goedkope variant maar de
directe. De klokken zouden hooguit inharmonische partialen kunnen gebruiken —
dat is een tuning-detail voor T154, geen sample-argument.

---

## 4. De meting

Alle getallen uit `tests/meet-audio-codecs.py` en
`tests/meet-audio-budget.mjs`. Bronmateriaal: vijf synthetische maar qua
spectrum representatieve geluiden (schot, grom, klik, hoorn, voetstap). Dat
spectrum is essentieel — een pure sinus comprimeert oneerlijk goed.

### 4.1 Bytes per geluid (raw / base64)

| geluid | duur | mp3 48 | mp3 64 | mp3 96 | mp3 128 | ogg q0.3 | ogg q0.5 | ogg q0.8 |
|---|---|---|---|---|---|---|---|---|
| schot | 0,35 s | 2376/3168 | 3134/4180 | 4702/6272 | 6269/8360 | 8714/11620 | 7923/10564 | 6357/8476 |
| grom | 0,50 s | 3240/4320 | 4388/5852 | 6583/8780 | 8777/11704 | 11409/15212 | 9706/12944 | 7462/9952 |
| klik | 0,15 s | 1296/1728 | 1462/1952 | 2194/2928 | 2925/3900 | 6073/8100 | 5750/7668 | 4660/6216 |
| hoorn | 1,60 s | 9936/13248 | 13165/17556 | 19749/26332 | 26331/35108 | 6962/9284 | 6735/8980 | 5808/7744 |
| voetstap | 0,40 s | 2808/3744 | 3552/4736 | 5329/7108 | 7105/9476 | 8889/11852 | 7957/10612 | 6474/8632 |

### 4.2 De verrassing: Vorbis kost ~4 KB per bestand aan headers

Gemeten met stilte, dus alleen de headers:

| duur | ogg q0.5 | mp3 64 |
|---|---|---|
| 0,01 s | 3993 | 417 |
| 0,10 s | 4001 | 1044 |
| 0,50 s | 4035 | 4388 |
| 1,00 s | 4079 | 8359 |
| 2,00 s | 4165 | 16300 |

Vorbis draagt een codebook-setup-header van **~4,0 KB per bestand**, die niet
meeschaalt met duur of samplerate. MP3 heeft die vaste kost niet.

**Voor dít project is dat beslissend.** De sample-kandidaten zijn bijna
allemaal korter dan 0,5 s. Bij 20 korte samples is dat 80 KB aan pure
Vorbis-overhead — meer dan de complete audio-inhoud. Alleen bij lange,
tonale klanken (de hoorn van 1,6 s) wint OGG, en daar zijn nu net geen
samples nodig. **Zou er ooit gesampled worden, dan MP3, niet OGG** — het
tegenovergestelde van wat je op grond van codec-kwaliteit per bit zou
verwachten.

### 4.3 Base64 kost op schijf +33%, over de lijn niets

| | bytes |
|---|---|
| mp3 raw | 4388 |
| base64 | 5852 (+33%) |
| base64 na gzip -9 | 3952 (−10% t.o.v. raw) |

gzip haalt de base64-expansie er vrijwel helemaal weer uit. Het bestand op
schijf groeit met de volle +33%; het transport (GitHub Pages serveert
gecomprimeerd) met ~0%.

### 4.4 Scenariototalen

Huidig: **886 KB op schijf, 292 KB gzipped.** (Ontwerpbeslissing 105 noemde
785 KB; het bestand is sindsdien gegroeid.)

| scenario | codec | raw | base64 | bestand | gzip |
|---|---|---|---|---|---|
| **A** alles procedureel (huidig) | — | — | — | **886 KB** | **292 KB** |
| **B** kern-set, 18 bestanden | mp3 64 | 60 KB | 80 KB | 966 KB (+9%) | 347 KB (+19%) |
| **B** kern-set, 18 bestanden | mp3 96 | 90 KB | 120 KB | 1006 KB (+14%) | 374 KB (+28%) |
| **B** kern-set, 18 bestanden | ogg q0.5 | 148 KB | 197 KB | 1083 KB (+22%) | 426 KB (+46%) |
| **C** hybride, 28 bestanden | mp3 64 | 137 KB | 183 KB | 1069 KB (+21%) | 417 KB (+43%) |
| **C** hybride, 28 bestanden | ogg q0.5 | 291 KB | 388 KB | 1275 KB (+44%) | 556 KB (+91%) |
| **D** alles samplen, 41 bestanden | mp3 64 | 199 KB | 265 KB | 1152 KB (+30%) | 473 KB (+62%) |
| **D** alles samplen, 41 bestanden | ogg q0.5 | 423 KB | 564 KB | 1451 KB (+64%) | 676 KB (+132%) |

### 4.5 Laadtijd: geen meetbaar effect

Vijf laadbeurten per stap, tot `window.AmsterdamUndeadDebug` bestaat:

| payload | bestand | mediaan | spreiding |
|---|---|---|---|
| +0 KB | 886 KB | 2919 ms | 2821-2988 |
| +120 KB | 1007 KB | 2849 ms | 2799-2998 |
| +250 KB | 1137 KB | 2959 ms | 2933-3066 |
| +600 KB | 1487 KB | 2896 ms | 2871-3047 |

**Het effect ligt onder de ruisvloer.** Zelfs +600 KB — meer dan het meest
extreme sample-scenario — levert geen signaal boven de spreiding tussen
laadbeurten van hetzelfde bestand. De laadtijd wordt gedomineerd door
Three.js en de wereldopbouw, niet door bestandsgrootte.

**Dat is een argument tégen mijn eigen aanbeveling en het hoort hier te
staan.** "Samples maken het bestand te zwaar" is met deze meting *niet* houdbaar
als hoofdargument. De aanbeveling in §5 rust daarom nadrukkelijk niet op
bestandsgrootte.

### 4.6 Gelijktijdige stemmen: geen limiter nodig

Zwaarst denkbare drie seconden — Canal Ripper-vuurtempo (10/s) met op elk
schot de volledige trefferketen (raak + kop + kill + doorboring), plus twee
grommen per 300 ms, plus event-clusters:

- **piek: 16 gelijktijdig levende oscillators** (inclusief de 5 permanente)
- 229 oscillators gestart, ~20/s

Browsers verwerken honderden gelijktijdige `OscillatorNode`s. Een
voice-limiter of concurrency-manager lost hier een probleem op dat niet
bestaat.

---

## 5. De projectregelvraag — BEANTWOORD: optie A

> **Beslissing van de eigenaar (na T152): optie A.** De assetregel in
> `CLAUDE.md` blijft **ongewijzigd** — geen externe assets, ook niet als
> base64 data-URI. Alle audio blijft procedureel.
>
> Daarmee vervalt de goedkeurings-dependency van T154: dat ticket heeft geen
> eigenaarsbesluit meer nodig en wordt een **kwaliteitspas** op de bestaande
> synth-geluiden (scope in §7). De rest van deze paragraaf blijft staan als
> onderbouwing van die keuze en als vindplaats van de afgewezen alternatieven,
> mocht de beslissing ooit heroverwogen worden.

`CLAUDE.md`: *"geen externe assets, geen textures/modellen, alleen Three.js
via de bestaande importmap-CDN"*. Samples zouden base64 data-URI's in
`amsterdam-undead.html` worden — technisch geen extern bestand, maar wel
degelijk een asset. **Dit is een regelwijziging, en die hoort niet impliciet
te gebeuren.**

### De vier opties

**A — Alles blijft procedureel. T154 wordt een kwaliteitspas.**
Regel ongewijzigd. Bestand 886 KB. T154 voegt een ruisbron + filter-envelopes
toe en werkt de dertien SYNTH+-geluiden bij.
*Winst:* alle voordelen van procedureel blijven — gratis variatie, nul
licentievragen, nul laadpad, één bestand dat op een kale `file://` draait.
*Risico:* de grommen blijven het zwakste onderdeel van de mix.

**B — Alleen de hoogste impact samplen (kern-set, 18 bestanden).**
Schoten, kill-impacts, grommen. +80 KB base64, bestand 966 KB (+9%).
*Winst:* de twee geluiden die de speler het vaakst hoort worden hoorbaar
beter. *Kosten:* een loader, `decodeAudioData`, een faalpad (T74's
"zichtbare faalmodi"-contract moet mee), variantbeheer tegen herhaling, en
een licentie-administratie die dit project nu niet heeft.

**C — Hybride: samples voor stem/impact, synth voor de rest (28 bestanden).**
+183 KB base64, bestand 1069 KB (+21%). Alles van B, plus omgevingslagen.
*Winst:* de grootste hoorbare sprong. *Kosten:* idem B, maar op meer plekken;
en de handmatig uitgebalanceerde mix (§0) moet integraal opnieuw — nieuw
materiaal ertussen zetten verschuift de hele balans, zoals T154's eigen
valkuil al waarschuwt.

**D — Alles samplen (41 bestanden).** +265 KB base64, bestand 1152 KB (+30%).
Niet serieus voorgesteld: het zou goedwerkende, bewust abstracte UI-tonen
vervangen door realistische opnamen die *slechter* leesbaar zijn.

### Aanbeveling: A — en dit is ook de gekozen optie

Niet vanwege de bestandsgrootte — §4.5 laat zien dat dat argument niet
houdt. Wel om drie redenen die de meting wél ondersteunt:

1. **De gemeten oorzaak van de kwaliteitskloof is procedureel op te lossen.**
   De dertien zwakke geluiden zijn zwak omdat er geen ruisbron is (§0), niet
   omdat er geen opname is. Die ruisbron kost nul bytes en breekt geen enkele
   regel. Een projectregel omvergooien om een probleem op te lossen dat
   binnen de regel oplosbaar is, is precies de valkuil die T152 benoemt.
2. **Variatie is hier een first-class eis, en die is gratis in synth en duur
   in samples.** Honderden grommen per run; gemeten 5,9 KB base64 per extra
   variant. Het anti-herhalingsbudget, niet de basiskwaliteit, bepaalt de
   werkelijke kosten van optie B/C.
3. **De echte kosten zijn architectuur en herkomst, niet bytes.** Loader,
   `decodeAudioData`, faalpad, mix-herbalancering, licentie-administratie —
   allemaal blijvend onderhoud, voor een spel dat zijn hele testsuite dankt
   aan het feit dat het één bestand zonder buildstap is.

**Met een expliciete uitweg.** Als de grommen ná T154's ruispas nog steeds
tegenvallen in de speeltoets, dan is dát het ene plekje om terug te komen op
deze beslissing: acht gromvarianten ≈ 35 KB raw / 47 KB base64 op mp3 64
(+5% bestand). Dat is een klein, afgebakend voorstel dat op zijn eigen
merites beoordeeld kan worden — geen algemene versoepeling van de assetregel.

**Zou B of C ooit alsnog gekozen worden:** dan mp3 64 kbps mono, niet OGG
(§4.2), en T154 begint pas ná expliciete goedkeuring van de regelwijziging —
dat is al een harde dependency van dat ticket. Met de keuze voor A is die
dependency vervuld zónder regelwijziging.

**Praktische consequentie van B/C die in de afweging meewoog.** Opnames
moeten érgens vandaan komen, en dit project kan ze niet zelf maken of
downloaden: gelicentieerd materiaal zou door de eigenaar aangeleverd moeten
worden. De tussenvorm — geluiden offline synthetiseren en als base64
inbakken — is IP-schoon maar levert nauwelijks iets boven A (Web Audio doet
realtime vrijwel hetzelfde) terwijl je wél de volledige loader-architectuur
betaalt. Afgevallen.

---

## 6. Architectuurbehoefte

Bepalen, niet bouwen. De opdracht waarschuwt expliciet voor
over-engineering, dus de "niet nodig"-lijst is even belangrijk als de andere.

### 6.1 Wél nodig (bij de gekozen optie A)

| onderdeel | reden |
|---|---|
| **Ruisbron** — één `AudioBuffer` (~1 s witte ruis, 1× bij `initGeluid()`), hergebruikt via `AudioBufferSourceNode` | De enige echte kwaliteitshefboom in dit hele document (§0, §3.2). Nul bytes, nul assets. |
| **Filter-envelope-helper** — `BiquadFilter` met gescheduelde cutoff | Bestaat al ad hoc in `speelOndodeGrom()`; moet herbruikbaar worden om de 13 SYNTH+-geluiden te kunnen bedienen. |
| **`GELUIDEN`-registry (T153)** — als *data-tabel*, niet als resource-manager | 38 functies die 30× dezelfde twee regels zijn. `GROM_PROFIELEN` en de per-wapen tonen zijn al bewijs dat het patroon werkt. |
| **Pitch-/timbrevariatie in de registry** | `pitchVariatie()` bestaat al maar wordt maar op 4 geluiden toegepast. Generaliseren is de goedkoopste anti-monotonie-maatregel die er is. |
| **Pauze-veilige vervolgtonen** | 12 `setTimeout`-vervolgtonen in 10 functies (§2) lopen door tijdens pauze. Oplossing: plannen op `audio.currentTime` i.p.v. `setTimeout`, of een expliciete pauze-gate. Bekende bugklasse (T33). |

### 6.2 Expliciet níét nodig

| onderdeel | waarom niet |
|---|---|
| **Preload / loader / buffer-cache** | Er valt niets te laden. Bij optie A blijft dat zo. |
| **`decodeAudioData` / fallback / autoplay-afhandeling** | `initGeluid()` regelt de klik-gate en `audio.resume()` al; zonder samples is er geen decodeerstap en dus geen faalpad om te dekken. |
| **Voice-limits / concurrency-beheer** | Gemeten piek 16 gelijktijdige oscillators onder een kunstmatig maximale belasting (§4.6). Browsers doen er honderden. |
| **Positional audio (`PannerNode`, HRTF)** | `StereoPannerNode` + `hoekNaarPan()` levert de richtingscue al (T80), en `berekenBootHoornPanVolume()` de afstand. Een 3D-panner voegt listener-bookkeeping per bron toe voor nul speelbaar verschil in een grotendeels binnen-, grotendeels horizontale map. |
| **Categorie-gains (wapens/ondoden/omgeving/UI)** | Twee redenen. (1) De mix is al per geluid met de hand uitgebalanceerd; de +15%/+20%-rondes staan gedocumenteerd in de bron. (2) `test-geluidsknop.mjs` eist **exact drie** `GainNode.connect(masterGainNode)` en **exact één** `connect(audio.destination)` in `initGeluid()`; een vierde bus breekt beide regexen. Herzien alleen als T154 aantoont dat per-categorie-tuning nodig is — dan mét een bewuste testaanpassing, niet als bijvangst. |
| **Variants-systeem (arrays van samples)** | Zonder samples niet van toepassing; pitch-/filterrandomisatie vervangt het. |
| **Convolver / reverb** | Verleidelijk voor de kelder, maar een `ConvolverNode` heeft een impulsrespons nodig — of een asset, of een eigen ticket om er procedureel één te synthetiseren. Buiten scope; T151 draagt het ruimtegevoel nu via het beeld. |
| **Modulesplitsing van de audiolaag** | Ontwerpbeslissing 106: data-driven consolidatie binnen het ene bestand, geen modules. |

---

## 7. Wat dit betekent voor T153 en T154

**T153 (audioregistry)** kan onveranderd door: een `GELUIDEN`-tabel plus
dunne `speel*()`-wrappers die hun tellers behouden. Twee aanscherpingen uit
deze audit:

- Het contract is **26 tellers over 17 testbestanden**, niet 13.
- De twee bron-regexen in `test-geluidsknop.mjs` (§2) zijn de scherpste
  randvoorwaarde. `stadPiep()` blijft een aparte kopie; de registry mag
  `piep()`'s keten niet herschrijven.
- De twaalf `setTimeout`-vervolgtonen zijn het natuurlijke moment om
  meteen op `audio.currentTime` te plannen — dat hoort in T153, niet in T154.
- Het uitvoeringsadvies noemde escalatie naar Opus 5 High "wanneer T152
  concludeert dat voice-limits of concurrency-beheer nodig zijn". Dat is
  **niet** de conclusie (§4.6): T153 blijft een tabel, geen resource-manager,
  en het oorspronkelijke advies (Sonnet 5 · xhigh) blijft staan.

**T154 (uitrol)** wordt met de keuze voor A een **kwaliteitspas**, wat het
ticket zelf expliciet als volwaardige uitkomst benoemt. De
goedkeurings-dependency is vervuld: er is geen regelwijziging, dus T154 kan
zonder verder eigenaarsbesluit starten zodra T153 klaar is. Concrete scope:

1. Ruisbron + filter-envelope-helper toevoegen.
2. De dertien SYNTH+-geluiden uit §3.2 een ruislaag geven, met de bestaande
   getoonde laag eronder — die draagt de identiteit en blijft ongemoeid.
3. Pitch-/timbrevariatie generaliseren over de registry.
4. Mix hertoetsen: elk volume in de bron is met de hand afgeregeld en er
   staat een reden bij. Een ruislaag toevoegen verandert de waargenomen
   luidheid; de bestaande verhoudingen zijn het referentiepunt.
5. Handmatige toets met koptelefoon, volledige run — dat criterium blijft
   ongewijzigd, want geen enkele test hoort of dit klopt.

Wat T154 **niet** doet: de mix "opnieuw ontwerpen", categorie-gains
introduceren, of de abstracte UI-tonen realistischer maken.

---

## 8. Uitvoering T153 en T154

Beide uitgevoerd. Wat er daadwerkelijk is gebouwd, en de één fout die daarbij
gemaakt en gecorrigeerd is.

### 8.1 T153 — de registry

`GELUIDEN` bevat **36 geluiden** als data; `speelGeluid(naam, opties)` is de
enige speler. De 35 `speel*()`-functies die erop uitkomen zijn dunne wrappers
geworden, mét hun tellers. Buiten de tabel bleven, zoals gepland, de vier
eigen ketens: dreigingsdrone, akkoordbed/`speelNevelklokToon`,
`speelOndodeGrom` en `speelBootHoornGericht`.

Twee dingen zijn bewust anders gedaan dan "exact reproduceren":

- **De twaalf `setTimeout`-vervolgtonen zijn weg.** `piep()` en `stadPiep()`
  kregen een optionele `startTijd` op de audioklok, en `vervolg[]` in de tabel
  plant erop. Dat maakt de tijdrelatie tussen de tonen van één geluid exact en
  immuun voor frame-jank. Wat het níét doet: een geplande staart stopt niet
  bij pauze — net zomin als de hoofdtoon, die ook gewoon uitklinkt. Bij
  staarten van 30-550 ms is dat het juiste gedrag, en de echte T33-bug (een
  vaste `setTimeout(900)` die niet meer klopte met een variabele herlaadduur)
  is iets anders en blijft opgelost.
- **`categorie` staat wél in de tabel, maar stuurt niets.** Het is een label
  voor documentatie en tests. Geen gain-bus, conform §6.2.

Geborgd door `test-audioregistry.mjs` (18 checks), met als kern een
overgetypte waardetabel van hoe elk geluid vóór T153 klonk. Verandert er ooit
een getal, dan faalt die diff-audit.

### 8.2 T154 — de ruislaag

Eén `AudioBuffer` van 1 seconde witte ruis, gevuld in `initGeluid()`, daarna
hergebruikt door elk ruisgeluid via `speelRuis()`: bufferbron → filter met
frequentie-envelope → gain met volume-envelope → masterGainNode. Vijftien
geluiden kregen een `ruis`-blok in `GELUIDEN`; de drie gromprofielen kregen
`ruisVolume` (keelruis, door hetzelfde filter als de oscillators, dus zonder
tweede panner) plus `GROM_TOONHOOGTE_VARIATIE` van ±7% per grom.

Variatie is er nu op drie plekken: pitch op de trefferklanken (bestond al),
afspeelsnelheid ±8% en een willekeurig startpunt in de ruisbuffer per
afspeling, en toonhoogte per grom.

**Kosten:** bestand 886,5 → 904,0 KB (+17,5 KB, uitsluitend code en
commentaar; nog steeds nul assets). Piek aan gelijktijdige stemmen onder een
kunstmatig maximale gevechtsbelasting: 16 → 22. Dat is nog altijd een orde
van grootte onder wat een browser aankan, dus de conclusie van §6.2 (geen
voice-limits nodig) blijft staan.

### 8.3 De fout die hier gemaakt is, en waarom hij telt

De eerste afstelling zette elk ruisvolume op ongeveer 0,6x het toonvolume,
"duidelijk onder de toon". Dat was fout, en het scheelde **5 tot 23 dB**.

De redenering klopte niet omdat twee ongelijke dingen vergeleken werden.
`piep()`'s `volume` is de piekamplitude van een golfvorm waarvan alle energie
in één smalle band zit. Het `volume` van een ruislaag is de gain vóór een
lowpass die het leeuwendeel van het vermogen wegneemt: een filter op 1300 Hz
laat van witte ruis nog ongeveer 6% van het vermogen door. De ruislaag zat
daardoor bij de meeste geluiden onder de hoorbaarheidsdrempel — hij was er
wel, maar je hoorde hem niet.

**En de test stond groen.** `test-ruislaag.mjs` controleerde precies die
verhouding tussen de twee nominale getallen en gaf daarmee vals vertrouwen.
Dat is de eigenlijke les: een assertie op twee getallen die niet vergelijkbaar
zijn, is erger dan geen assertie.

Gecorrigeerd met een meting in plaats van een schatting.
`tests/meet-ruislaag.mjs` rendert elke ruislaag en zijn toonlaag apart in een
`OfflineAudioContext` — dus met de échte spelcode — en vergelijkt de RMS. De
doelen per geluid volgen uit wat het geluid ís:

| doel | geluiden | waarom |
|---|---|---|
| **+2 dB** | windvlaag | wind ís ruis |
| **0 dB** | slagMis | een whoosh ís ruis |
| **−1 tot −3 dB** | plankBreek, schot, droogKlik, explosie | versplintering en knallen zijn overwegend ruis |
| **−4 tot −5 dB** | herlaad, herlaadKlaar, mesSteek, gangKraak, bijkeukenKraak | mechaniek en krakend hout |
| **−6 dB** | raakTik, kopTik, killKnak, slagRaak, de drie grommen | hier draagt de toon de identiteit (per-wapen `raakToon`/`killToon`, het gromregister per type) |

Alle achttien vallen binnen ±2,5 dB van hun doel. Omdat afspeelsnelheid,
bufferstartpunt en gromtoonhoogte per afspeling gerandomiseerd zijn,
schommelt één meting zo'n 2 dB; het script middelt daarom vier tot vijf
afspelingen per conditie in plaats van de marge op te rekken.

Wat er van de oude assertie over is: een grofmazige vangrail op de absolute
waarden plus een groepscheck dat de gemiddelde ruisgain niet terugzakt naar
de onhoorbare afstelling. De echte verhouding hoort gemeten te worden, niet
afgelezen.

### 8.4 Het geluidsverslag

`tests/maak-geluidsverslag.mjs` rendert elk geluid naar een WAV plus een
manifest met wat het is en wanneer je het hoort. Het bouwt de synthese niet
na — het vervangt `window.AudioContext` door een proxy om een
`OfflineAudioContext` met een stuurbare klok, zodat de spelcode zelf speelt en
elk geluid netjes achter elkaar op één tijdlijn belandt. Voor de negentien
aangepaste geluiden wordt twee keer gerenderd: één keer met de ruislaag uit
(= exact hoe het vóór T154 klonk) en één keer normaal.

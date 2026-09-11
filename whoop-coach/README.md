# WHOOP Trainingsadviseur

Een lokale tool die je WHOOP-data ophaalt en er elke dag een concreet
trainingsadvies uit afleidt: **zwaar trainen, gematigd, rustig aan, of rusten.**

Gericht op algemene conditie en gezondheid, met krachttraining als basis en
hardlopen ernaast. Geen wedstrijdvoorbereiding.

```
WHOOP TRAININGSADVIES VOOR YANNICK  11 Sep 2026
==================================================================
Herstel               84%        groen
Slaap                 93%        8.3 u geslapen, 0.4 u tekort
HRV                   74 ms      12% boven basislijn (66 ms)
Rusthartslag          48         -3 t.o.v. basislijn (51)
Strain week           7.5        gisteren 7.5, week/maand 1.00
Laatste 14 dagen                 6x kracht, 1x hardlopen

==================================================================
VANDAAG: RUIMTE VOOR EEN ZWARE SESSIE
==================================================================

Intensieve duurloop. 10 minuten inlopen, dan 5-6 x 3 minuten in
zone 4 (150-169 slagen) met 2 minuten dribbelen ertussen, 10
minuten uitlopen. Samen ongeveer 45-55 minuten.

Waarom:
  * Herstel 84% is groen: je lichaam staat open voor belasting.
  ^ Weekgemiddelde strain 7.5 is behapbaar naast dit herstel.
  ^ Duwtje richting hardlopen: je liep de afgelopen 14 dagen 1
    keer hard, en voor je algemene conditie is dat de grootste winst.
```

---

## 1. Installeren

Je hebt alleen Python 3.8 of nieuwer nodig. Dat zit standaard op macOS.
Er zijn **geen pakketten om te installeren**: de tool draait volledig op de
standaardbibliotheek van Python.

Controleren of Python er is:

```bash
python3 --version
```

Daarna, in de map `whoop-coach`:

```bash
python3 -m whoop_coach advies --demo
```

Dat draait op verzonnen data en laat zien hoe het eruitziet. Handig om eerst
te kijken of alles werkt, nog voordat je een WHOOP-app aanmaakt.

---

## 2. Je WHOOP developer-app aanmaken

Dit is de enige stap die je zelf moet doen. Eenmalig, ongeveer twee minuten.

1. Ga naar **https://developer.whoop.com** en log in met je gewone
   WHOOP-account.
2. Ga naar je dashboard en kies **Create new app** (of "Create an app").
3. Vul in:

   | Veld | Wat je invult |
   |------|---------------|
   | **App name** | Bijvoorbeeld `Mijn trainingsadviseur` |
   | **Redirect URI** | `http://localhost:8765/callback` |
   | **Scopes** | zie hieronder, zet ze **allemaal** aan |
   | Contacts / e-mail | je eigen e-mailadres |
   | Privacy policy URL | mag je eigen site zijn, of laat leeg als het mag |

   > **Let op bij de Redirect URI.** Die moet er *letterlijk* zo staan,
   > inclusief `http://` (niet https), de poort `8765` en het pad `/callback`.
   > Wijkt er een teken af, dan weigert WHOOP het koppelen.
   >
   > Wil je een andere poort, gebruik dan
   > `python3 -m whoop_coach koppel --poort 9000` en vul in WHOOP
   > `http://localhost:9000/callback` in.

4. Zet deze **scopes** aan:

   ```
   read:recovery
   read:cycles
   read:sleep
   read:workout
   read:profile
   read:body_measurement
   offline
   ```

   `offline` is niet optioneel: zonder die scope krijg je geen refresh token
   en moet je elk uur opnieuw inloggen.

5. Sla op. Je krijgt nu een **Client ID** en een **Client Secret**. Kopieer die
   allebei; het secret krijg je meestal maar een keer te zien.

---

## 3. Koppelen

```bash
python3 -m whoop_coach koppel --client-id <JOUW_CLIENT_ID> --client-secret <JOUW_SECRET>
```

Wat er dan gebeurt:

1. De tool start kort een servertje op `127.0.0.1:8765`, alleen om de
   terugkoppeling van WHOOP op te vangen.
2. Je browser opent het toestemmingsscherm van WHOOP.
3. Je geeft toestemming; WHOOP stuurt je terug naar dat servertje.
4. De tool ruilt de code om voor tokens, slaat die op en sluit het servertje.

Daarna is het klaar. De tool vernieuwt je toegang vanzelf, dus dit hoef je
niet nog eens te doen (tenzij je de toegang intrekt in de WHOOP-app).

**Eenmalig daarna:** laat de tool uitzoeken welke sporten bij jou kracht en
hardlopen zijn.

```bash
python3 -m whoop_coach sporten
```

Dit kijkt naar je eigen trainingshistorie van de afgelopen 180 dagen en deelt
elke sport in. Het resultaat komt in `~/.whoop-coach/sports.json` te staan,
waar je het kunt corrigeren als er iets niet klopt. Jouw keuze wint altijd.

---

## 4. Dagelijks gebruiken

```bash
python3 -m whoop_coach advies
```

Of korter, want `advies` is het standaardcommando:

```bash
python3 -m whoop_coach
```

**Dubbelklikken kan ook.** In Finder: dubbelklik op `whoop-advies.command`.
Werkt dat de eerste keer niet, geef het bestand dan uitvoerrechten:

```bash
chmod +x whoop-advies.command whoop-koppelen.command
```

**Nog makkelijker:** zet een afkorting in je shell. Voeg dit toe aan
`~/.zshrc` (pas het pad aan naar waar deze map staat):

```bash
alias whoop='python3 -m whoop_coach --datamap ~/.whoop-coach'
```

Dan is het voortaan gewoon `whoop`.

### Alle commando's

| Commando | Wat het doet |
|----------|--------------|
| `advies` | Het advies van vandaag (standaard) |
| `koppel` | Eenmalig koppelen aan WHOOP |
| `sporten` | Welke sporten bij jou kracht en hardlopen zijn |
| `status` | Werkt de koppeling nog? |
| `ontkoppel` | Opgeslagen tokens weggooien |

### Handige opties bij `advies`

| Optie | Wat het doet |
|-------|--------------|
| `--json` | Uitvoer als JSON, om zelf mee door te rekenen |
| `--demo [situatie]` | Verzonnen data, zonder koppeling. Situaties: `normaal`, `groen`, `geel`, `rood`, `overbelast`, `geen-data` |
| `--datum 2026-09-11` | Doe alsof het een andere dag is |
| `--dagen 42` | Meer of minder historie meewegen |
| `--geen-kleur` | Platte tekst, handig in een logbestand |

---

## 5. Hoe het advies tot stand komt

Het advies wordt in drie stappen opgebouwd. Elke stap noteert waarom hij iets
doet; dat is precies wat je onder "Waarom:" terugziet.

### Stap 1: het basisniveau uit je herstelscore

| Herstel | Basisniveau |
|---------|-------------|
| 67% en hoger (groen) | Ruimte voor een zware sessie |
| 34 tot 67% (geel) | Gematigd trainen |
| 25 tot 34% (rood) | Actief herstel |
| Onder 25% (diep rood) | Rust |
| Geen meting | Gematigd, met een melding erbij |

### Stap 2: de remmen

Elke waarschuwing legt een **plafond** op. Het laagste plafond wint, dus een
groen herstel na een slechte nacht levert alsnog geen zware sessie op.

| Signaal | Plafond |
|---------|---------|
| Slaapprestatie onder 60% | Actief herstel |
| Slaapprestatie onder 75%, of meer dan 2 uur slaaptekort | Gematigd |
| HRV meer dan 25% onder je basislijn | Actief herstel |
| HRV meer dan 15% onder je basislijn | Gematigd |
| Rusthartslag 7 slagen of meer boven je basislijn | Actief herstel |
| Rusthartslag 4 slagen of meer boven je basislijn | Gematigd |
| Gisteren al zwaar getraind | Gematigd |
| 2 zware dagen op rij | Gematigd |
| 3 of meer zware dagen op rij | Actief herstel |
| Weekgemiddelde strain 13 of hoger | Gematigd |
| Laatste 3 dagen samen strain 40 of hoger | Gematigd |
| Deze week 30% zwaarder dan je maandgemiddelde | Gematigd |
| WHOOP kalibreert nog, of je herstelscore is 2+ dagen oud | Gematigd |

Basislijnen voor HRV en rusthartslag zijn de **mediaan van de afgelopen 14
dagen**, zonder de meting van vandaag: anders vergelijk je de dag met zichzelf.
De mediaan in plaats van het gemiddelde, zodat een enkele uitschieter (een
feestje, een verkoudheid) de basislijn niet scheeftrekt.

### Stap 3: kracht of hardlopen?

Bij "gematigd" en "zwaar" wordt gekozen wat je gaat doen:

- Heb je de **afgelopen 14 dagen minder dan 2 keer hardgelopen**, dan gaat het
  duwtje naar hardlopen. Voor algemene conditie is dat de grootste winst.
- Heb je deze week al **3 of meer krachtsessies** gedaan, dan ook hardlopen,
  om de belasting te spreiden.
- Anders krachttraining, want dat is je hoofdmoot.

Er staat altijd een alternatief onder het advies, dus je kunt ook het andere
kiezen zonder te gokken op de intensiteit.

Hartslagzones worden berekend uit je **werkelijke maximale hartslag** uit
WHOOP (`read:body_measurement`). Lukt dat niet, dan zegt de tool dat en
gebruikt hij een schatting die je zelf kunt overschrijven.

### De regels aanpassen

Alle getallen hierboven staan in **`~/.whoop-coach/rules.json`**. Dat bestand
wordt bij de eerste run aangemaakt en bij elke run opnieuw gelezen. Vind je de
tool te voorzichtig, zet dan bijvoorbeeld de groen-grens lager:

```json
{
  "herstel": { "groen_vanaf": 60 },
  "balans": { "hardloop_doel_per_14_dagen": 3 }
}
```

Je hoeft alleen te noemen wat je wilt veranderen; de rest blijft de
standaardwaarde. Verwijder het bestand om terug te gaan naar de
standaardinstellingen.

Wil je de logica zelf veranderen in plaats van alleen de getallen: die staat
in `whoop_coach/advies.py`, in functies met namen als `_rem_slaap` en
`_rem_belasting`. Elke rem is een losse functie van een paar regels.

---

## 6. Waar je gegevens staan

Alles staat in `~/.whoop-coach/`, een map die alleen jij mag lezen:

| Bestand | Inhoud |
|---------|--------|
| `config.json` | Je client id en secret (mode 0600) |
| `tokens.json` | Access en refresh token (mode 0600) |
| `sports.json` | Welke sporten kracht of hardlopen zijn |
| `rules.json` | De drempelwaarden van het advies |

Er gaat niets naar een server van iemand anders: de tool praat alleen met
`api.prod.whoop.com`.

**Tokens liever in de Sleutelhanger?** Koppel dan met
`python3 -m whoop_coach koppel --sleutelhanger`. Ze staan dan versleuteld in
de macOS Keychain in plaats van in een bestand. Is de Sleutelhanger niet
beschikbaar, dan zegt de tool dat en gebruikt hij alsnog het bestand.

---

## 7. Als er iets misgaat

De tool stopt nooit met een kale foutmelding; je krijgt altijd uitleg en een
suggestie. De meest voorkomende gevallen:

| Melding | Wat er aan de hand is |
|---------|----------------------|
| "Nog niet gekoppeld aan WHOOP" | Draai eerst `koppel`. |
| "Kan WHOOP niet bereiken" | Geen internet, of WHOOP is uit de lucht. De tool probeert het zelf al drie keer met oplopende wachttijd. |
| "Het verversen van je WHOOP-token mislukte" | Je hebt de toegang ingetrokken in de WHOOP-app, of het refresh token is te oud. Draai `koppel` opnieuw. |
| "WHOOP staat dit verzoek niet toe" | Er mist een scope. Controleer je app op developer.whoop.com en koppel opnieuw. |
| "WHOOP's snelheidslimiet is geraakt" | Meer dan 100 verzoeken in een minuut. Wacht een minuut. In normaal gebruik haalt de tool er hooguit een stuk of tien op. |
| "Geen herstelscore beschikbaar" | Je hebt je band niet gedragen, of je bent nog niet wakker volgens WHOOP. Je krijgt gewoon advies, maar voorzichtiger en met een melding. |
| "Kan poort 8765 niet openen" | Er draait al iets op die poort. Gebruik `--poort` en pas de redirect-URI in je WHOOP-app aan. |

Werkt de koppeling nog? Dat controleer je met:

```bash
python3 -m whoop_coach status
```

---

## 8. Tests

```bash
python3 tests/draai_tests.py
```

Er draaien 106 tests. Ze gebruiken een **nagebootste WHOOP-server**
(`tests/mock_whoop.py`), dus er is geen internet en geen echte koppeling voor
nodig. Gedekt zijn onder andere:

- de volledige OAuth-flow, inclusief een afgewezen `state` en een geweigerde
  toestemming;
- het verversen van tokens en het roulerende refresh token;
- paginering over meer dan 25 records;
- 401, 403, 429, 500 en een server die helemaal niet antwoordt;
- ontbrekende data: geen band gedragen, `PENDING_SCORE`, geen trainingen;
- elke tak van de adviesmotor, met een test per regel.

---

## 9. Over de API

Gebouwd op de **WHOOP Developer API v2**:

- Basis: `https://api.prod.whoop.com/developer/v2`
- Autorisatie: `https://api.prod.whoop.com/oauth/oauth2/auth`
- Tokens: `https://api.prod.whoop.com/oauth/oauth2/token`
- Gebruikte endpoints: `/cycle`, `/recovery`, `/activity/sleep`,
  `/activity/workout`, `/user/profile/basic`, `/user/measurement/body`
- Limiet: 100 verzoeken per minuut, 10.000 per dag. De tool remt zichzelf op
  90 per minuut af en gebruikt er in de praktijk ongeveer tien per run.

Let op een verschil met v1: **v2 geeft bij trainingen `sport_name` terug (tekst,
bijvoorbeeld `"running"`), waar v1 een numerieke `sport_id` gaf.** De tool leest
allebei, zodat oudere data ook blijft werken.

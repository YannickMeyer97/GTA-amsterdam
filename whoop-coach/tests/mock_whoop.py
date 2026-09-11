"""Een nagebootste WHOOP-server om de adviseur tegenaan te testen.

Bootst na wat de echte API doet: de OAuth-flow, gepagineerde collecties,
score_state, tijdzone-offsets en de foutsituaties die we moeten overleven
(401, 429, 500, lege collecties).
"""

import datetime as dt
import json
import http.server
import threading
import urllib.parse
import uuid

TIJDZONE = "+02:00"
ZONE = dt.timezone(dt.timedelta(hours=2))


def _iso(moment):
    return moment.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


class Scenario(object):
    """De data en het gedrag van een testrun."""

    def __init__(self, vandaag=None, dagen=30):
        self.vandaag = vandaag or dt.date(2026, 9, 11)
        self.dagen = dagen
        self.cycli = []
        self.herstel = []
        self.slaap = []
        self.trainingen = []
        self.profiel = {"user_id": 12345, "email": "test@example.com",
                        "first_name": "Yannick", "last_name": "Meyer"}
        self.lichaamsmaten = {"height_meter": 1.85, "weight_kilogram": 84.0,
                              "max_heart_rate": 189}
        # Gedrag dat we kunnen aanzetten om foutpaden te testen.
        self.faal_eenmalig_met_401 = False
        self.faal_eenmalig_met_429 = False
        self.faal_endpoints_met = {}       # pad -> statuscode
        self.token_geldigheid = 3600
        self.weiger_refresh = False
        self.weiger_autorisatie = None     # bijvoorbeeld "access_denied"
        self.stuur_verkeerde_state = False
        self.paginagrootte = 25
        self.uitgegeven_refresh = set()
        self.verzoeken = []

    # -- data opbouwen -------------------------------------------------------

    def voeg_dag_toe(self, dagen_geleden, strain=None, herstelscore=None,
                     hrv=None, rhr=None, slaapprestatie=None, slaapuren=None,
                     score_state="SCORED"):
        datum = self.vandaag - dt.timedelta(days=dagen_geleden)
        cycle_id = 900000 + (self.vandaag - datum).days
        start = dt.datetime.combine(datum, dt.time(4, 0), tzinfo=ZONE)
        eind = start + dt.timedelta(days=1)

        cyclus = {
            "id": cycle_id, "user_id": 12345,
            "created_at": _iso(start), "updated_at": _iso(eind),
            "start": _iso(start), "end": _iso(eind),
            "timezone_offset": TIJDZONE, "score_state": score_state,
        }
        if score_state == "SCORED":
            cyclus["score"] = {"strain": strain if strain is not None else 9.0,
                               "kilojoule": 8200.0, "average_heart_rate": 68,
                               "max_heart_rate": 152}
        self.cycli.append(cyclus)

        slaap_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, "slaap-%s" % datum))
        herstel_record = {
            "cycle_id": cycle_id, "sleep_id": slaap_id, "user_id": 12345,
            "created_at": _iso(eind), "updated_at": _iso(eind),
            "score_state": score_state,
        }
        if score_state == "SCORED":
            herstel_record["score"] = {
                "user_calibrating": False,
                "recovery_score": herstelscore if herstelscore is not None else 65,
                "resting_heart_rate": rhr if rhr is not None else 52,
                "hrv_rmssd_milli": hrv if hrv is not None else 62.0,
                "spo2_percentage": 96.0, "skin_temp_celsius": 33.5,
            }
        self.herstel.append(herstel_record)

        uren = slaapuren if slaapuren is not None else 7.5
        bed_start = dt.datetime.combine(
            datum - dt.timedelta(days=1), dt.time(23, 0), tzinfo=ZONE)
        in_bed = (uren + 0.5) * 3600000
        slaap_record = {
            "id": slaap_id, "user_id": 12345,
            "created_at": _iso(bed_start), "updated_at": _iso(bed_start),
            "start": _iso(bed_start),
            "end": _iso(bed_start + dt.timedelta(hours=uren + 0.5)),
            "timezone_offset": TIJDZONE, "nap": False,
            "score_state": score_state,
        }
        if score_state == "SCORED":
            slaap_record["score"] = {
                "stage_summary": {
                    "total_in_bed_time_milli": int(in_bed),
                    "total_awake_time_milli": int(0.5 * 3600000),
                    "total_no_data_time_milli": 0,
                    "total_light_sleep_time_milli": int(uren * 0.5 * 3600000),
                    "total_slow_wave_sleep_time_milli": int(uren * 0.2 * 3600000),
                    "total_rem_sleep_time_milli": int(uren * 0.3 * 3600000),
                    "sleep_cycle_count": 5, "disturbance_count": 8,
                },
                "sleep_needed": {
                    "baseline_milli": int(8.0 * 3600000),
                    "need_from_sleep_debt_milli": int(0.3 * 3600000),
                    "need_from_recent_strain_milli": int(0.2 * 3600000),
                    "need_from_recent_nap_milli": 0,
                },
                "respiratory_rate": 14.2,
                "sleep_performance_percentage": (
                    slaapprestatie if slaapprestatie is not None else 85),
                "sleep_consistency_percentage": 72,
                "sleep_efficiency_percentage": 91.0,
            }
        self.slaap.append(slaap_record)
        return cycle_id

    def voeg_training_toe(self, dagen_geleden, sport_name, minuten=55,
                          strain=12.0, afstand_km=None, uur=17):
        datum = self.vandaag - dt.timedelta(days=dagen_geleden)
        start = dt.datetime.combine(datum, dt.time(uur, 0), tzinfo=ZONE)
        score = {"strain": strain, "average_heart_rate": 132,
                 "max_heart_rate": 168, "kilojoule": 1800.0,
                 "percent_recorded": 100.0}
        if afstand_km:
            score["distance_meter"] = afstand_km * 1000.0
        self.trainingen.append({
            "id": str(uuid.uuid4()), "user_id": 12345,
            "created_at": _iso(start), "updated_at": _iso(start),
            "start": _iso(start),
            "end": _iso(start + dt.timedelta(minutes=minuten)),
            "timezone_offset": TIJDZONE, "sport_name": sport_name,
            "score_state": "SCORED", "score": score,
        })


def standaard_scenario(vandaag=None, **overschrijf):
    """Een gemiddelde maand: 3x kracht per week, af en toe hardlopen."""
    scenario = Scenario(vandaag=vandaag)
    for dagen_geleden in range(29, -1, -1):
        datum = scenario.vandaag - dt.timedelta(days=dagen_geleden)
        weekdag = datum.weekday()
        kracht = weekdag in (0, 2, 4)
        hardlopen = weekdag == 6 and dagen_geleden > 7
        strain = 8.0 + (4.5 if kracht else 0.0) + (5.0 if hardlopen else 0.0)
        scenario.voeg_dag_toe(
            dagen_geleden,
            strain=strain,
            herstelscore=overschrijf.get("herstelscore", 68),
            hrv=overschrijf.get("hrv", 62.0),
            rhr=overschrijf.get("rhr", 52),
            slaapprestatie=overschrijf.get("slaapprestatie", 86),
            slaapuren=overschrijf.get("slaapuren", 7.6),
        )
        if kracht:
            scenario.voeg_training_toe(dagen_geleden, "weightlifting",
                                       minuten=58, strain=11.5)
        if hardlopen:
            scenario.voeg_training_toe(dagen_geleden, "running", minuten=38,
                                       strain=13.0, afstand_km=6.5)
    return scenario


class _Afhandelaar(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    @property
    def scenario(self):
        return self.server.scenario

    def log_message(self, *_args):
        pass

    # -- hulp ----------------------------------------------------------------

    def _json(self, status, nuttig):
        data = json.dumps(nuttig).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _fout(self, status, code, extra_headers=None):
        data = json.dumps({"error": code}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        for sleutel, waarde in (extra_headers or {}).items():
            self.send_header(sleutel, waarde)
        self.end_headers()
        self.wfile.write(data)

    def _pagineer(self, records, vraag):
        """Bootst WHOOP's paginering met next_token na."""
        limiet = min(int(vraag.get("limit", [25])[0]), self.scenario.paginagrootte)
        begin = 0
        token = vraag.get("nextToken", [None])[0]
        if token:
            try:
                begin = int(token)
            except ValueError:
                return self._fout(400, "invalid_next_token")

        start_filter = vraag.get("start", [None])[0]
        eind_filter = vraag.get("end", [None])[0]
        gefilterd = [
            r for r in records
            if _binnen(r, start_filter, eind_filter)
        ]
        deel = gefilterd[begin:begin + limiet]
        volgende = begin + limiet
        self._json(200, {
            "records": deel,
            "next_token": str(volgende) if volgende < len(gefilterd) else None,
        })

    def _bearer_ok(self):
        kop = self.headers.get("Authorization", "")
        return kop.startswith("Bearer ") and kop[7:] in self.server.geldige_tokens

    # -- routes --------------------------------------------------------------

    def do_GET(self):  # noqa: N802
        ontleed = urllib.parse.urlparse(self.path)
        vraag = urllib.parse.parse_qs(ontleed.query)
        pad = ontleed.path
        self.scenario.verzoeken.append((pad, dict(vraag)))

        if pad == "/oauth/oauth2/auth":
            return self._autoriseer(vraag)

        if not pad.startswith("/developer/v2"):
            return self._fout(404, "not_found")

        api_pad = pad[len("/developer/v2"):]

        if self.scenario.faal_eenmalig_met_401:
            self.scenario.faal_eenmalig_met_401 = False
            return self._fout(401, "unauthorized")
        if self.scenario.faal_eenmalig_met_429:
            self.scenario.faal_eenmalig_met_429 = False
            return self._fout(429, "rate_limited", {"Retry-After": "0"})
        if api_pad in self.scenario.faal_endpoints_met:
            return self._fout(self.scenario.faal_endpoints_met[api_pad], "fout")

        if not self._bearer_ok():
            return self._fout(401, "unauthorized")

        if api_pad == "/user/profile/basic":
            return self._json(200, self.scenario.profiel)
        if api_pad == "/user/measurement/body":
            return self._json(200, self.scenario.lichaamsmaten)
        if api_pad == "/cycle":
            return self._pagineer(self.scenario.cycli, vraag)
        if api_pad == "/recovery":
            return self._pagineer(self.scenario.herstel, vraag)
        if api_pad == "/activity/sleep":
            return self._pagineer(self.scenario.slaap, vraag)
        if api_pad == "/activity/workout":
            return self._pagineer(self.scenario.trainingen, vraag)
        return self._fout(404, "not_found")

    def do_POST(self):  # noqa: N802
        ontleed = urllib.parse.urlparse(self.path)
        lengte = int(self.headers.get("Content-Length", 0))
        ruw = self.rfile.read(lengte).decode("utf-8") if lengte else ""
        formulier = {k: v[0] for k, v in urllib.parse.parse_qs(ruw).items()}
        self.scenario.verzoeken.append((ontleed.path, formulier))

        if ontleed.path != "/oauth/oauth2/token":
            return self._fout(404, "not_found")

        if formulier.get("client_id") != self.server.client_id or \
                formulier.get("client_secret") != self.server.client_secret:
            return self._fout(401, "invalid_client")

        soort = formulier.get("grant_type")
        if soort == "authorization_code":
            if formulier.get("code") != self.server.uitgegeven_code:
                return self._fout(400, "invalid_grant")
            if formulier.get("redirect_uri") != self.server.redirect_uri:
                return self._fout(400, "invalid_redirect_uri")
            return self._geef_tokens()
        if soort == "refresh_token":
            if self.scenario.weiger_refresh:
                return self._fout(400, "invalid_grant")
            if formulier.get("refresh_token") not in self.server.geldige_refresh:
                return self._fout(400, "invalid_grant")
            # WHOOP rouleert het refresh token: het oude vervalt.
            self.server.geldige_refresh.discard(formulier["refresh_token"])
            return self._geef_tokens()
        return self._fout(400, "unsupported_grant_type")

    def _geef_tokens(self):
        access = "access-" + uuid.uuid4().hex
        refresh = "refresh-" + uuid.uuid4().hex
        self.server.geldige_tokens.add(access)
        self.server.geldige_refresh.add(refresh)
        self._json(200, {
            "access_token": access,
            "refresh_token": refresh,
            "expires_in": self.scenario.token_geldigheid,
            "token_type": "bearer",
            "scope": "read:recovery read:cycles read:sleep read:workout "
                     "read:profile read:body_measurement offline",
        })

    def _autoriseer(self, vraag):
        """Bootst het toestemmingsscherm na: meteen terugsturen met een code."""
        redirect = vraag.get("redirect_uri", [None])[0]
        state = vraag.get("state", [None])[0]
        if self.scenario.stuur_verkeerde_state:
            state = "dit-is-niet-de-juiste-state"
        if self.scenario.weiger_autorisatie:
            doel = "{}?error={}&error_description=geweigerd&state={}".format(
                redirect, self.scenario.weiger_autorisatie, state)
        else:
            doel = "{}?code={}&state={}".format(
                redirect, self.server.uitgegeven_code, state)
        self.send_response(302)
        self.send_header("Location", doel)
        self.send_header("Content-Length", "0")
        self.end_headers()


def _binnen(record, start, eind):
    """Filter op het start-veld, net als de echte API grofweg doet."""
    if not start and not eind:
        return True
    tijd = record.get("start") or record.get("created_at")
    if not tijd:
        return True
    if start and tijd < start:
        return False
    if eind and tijd > eind:
        return False
    return True


class MockWhoop(object):
    """Draait de nagebootste server in een achtergronddraad."""

    def __init__(self, scenario=None, client_id="test-client",
                 client_secret="test-secret",
                 redirect_uri="http://localhost:8799/callback"):
        self.scenario = scenario or standaard_scenario()
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Afhandelaar)
        self.server.scenario = self.scenario
        self.server.client_id = client_id
        self.server.client_secret = client_secret
        self.server.redirect_uri = redirect_uri
        self.server.uitgegeven_code = "test-autorisatiecode"
        self.server.geldige_tokens = set()
        self.server.geldige_refresh = set()
        self._draad = None

    @property
    def poort(self):
        return self.server.server_address[1]

    @property
    def basis(self):
        return "http://127.0.0.1:{}".format(self.poort)

    @property
    def api_basis(self):
        return self.basis + "/developer/v2"

    @property
    def token_url(self):
        return self.basis + "/oauth/oauth2/token"

    @property
    def autorisatie_url(self):
        return self.basis + "/oauth/oauth2/auth"

    def geef_token_uit(self):
        """Maak direct een geldig tokenpaar, zonder de browserstap."""
        access = "access-" + uuid.uuid4().hex
        refresh = "refresh-" + uuid.uuid4().hex
        self.server.geldige_tokens.add(access)
        self.server.geldige_refresh.add(refresh)
        return access, refresh

    def start(self):
        self._draad = threading.Thread(target=self.server.serve_forever,
                                       kwargs={"poll_interval": 0.05})
        self._draad.daemon = True
        self._draad.start()
        return self

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        if self._draad:
            self._draad.join(timeout=5)

    def __enter__(self):
        return self.start()

    def __exit__(self, *_uitzondering):
        self.stop()

"""Gedeelde hulp voor de tests."""

import os
import shutil
import sys
import tempfile

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if WORTEL not in sys.path:
    sys.path.insert(0, WORTEL)
if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from whoop_coach.config import Instellingen, schrijf_prive_json  # noqa: E402


class TijdelijkeOmgeving(object):
    """Een wegwerp-datamap plus instellingen die naar de mockserver wijzen."""

    def __init__(self, mock=None):
        self.map = tempfile.mkdtemp(prefix="whoop-coach-test-")
        self.mock = mock
        self.instellingen = Instellingen(self.map)
        self.instellingen.zet("client_id", "test-client")
        self.instellingen.zet("client_secret", "test-secret")
        if mock is not None:
            self.instellingen.zet("api_basis", mock.api_basis)
            self.instellingen.zet("token_url", mock.token_url)
            self.instellingen.zet("autorisatie_url", mock.autorisatie_url)
        self.instellingen.bewaar_config()

    @property
    def tokens_pad(self):
        return self.instellingen.tokens_pad

    def schrijf_tokens(self, access, refresh, verloopt_over=3600):
        import time
        schrijf_prive_json(self.tokens_pad, {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "expires_in": verloopt_over,
            "verloopt_op": time.time() + verloopt_over,
            "opgehaald_op": time.time(),
        })

    def opruimen(self):
        shutil.rmtree(self.map, ignore_errors=True)

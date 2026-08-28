#!/usr/bin/env python3
"""Ticket 152 — meetscript voor de audio-audit (codec-kant).

Beantwoordt de vraag uit T152-werkpunt 3: *wat kost een sample nou werkelijk
als base64 in het HTML-bestand?* Meet echte encoder-output, geen schatting —
ontwerpbeslissing 105 in ARCHITECTURE_NOTES.md noemde ~11 KB/s en zette daar
zelf bij dat dat gemeten hoort te worden.

Gemeten wordt op vijf synthetische maar qua spectrum representatieve
geluiden: een schot (breedbandige transiënt), een grom (stemachtig, ruisrijk),
een klik (korte transiënt), een boothoorn (tonaal, lang) en een voetstap
(gefilterde ruis). Dat spectrum is wat telt: een pure sinus comprimeert
oneerlijk goed en zou het antwoord vertekenen.

Waarom dit geen .mjs is: er is een echte MP3- en Vorbis-encoder voor nodig.
De browserkant van de meting zit in `meet-audio-budget.mjs`.

Draaien:
    pip install numpy soundfile lameenc
    python3 meet-audio-codecs.py
"""

import base64
import gzip
import io

import lameenc
import numpy as np
import soundfile as sf

SR = 44100
HUIDIG_RAW = 907745    # amsterdam-undead.html, momentopname bij T152
HUIDIG_GZIP = 299374   # gzip -9 van datzelfde bestand

rng = np.random.default_rng(7)


# --- Bronmateriaal ---------------------------------------------------------

def _env(n, aanzet=0.005, verval=0.1):
    t = np.arange(n) / SR
    return np.minimum(t / aanzet, 1) * np.exp(-t / verval)


def schot(duur=0.35):
    n = int(SR * duur)
    x = np.convolve(rng.normal(0, 1, n), np.ones(8) / 8, 'same')
    body = np.sin(2 * np.pi * np.linspace(120, 45, n) * np.arange(n) / SR)
    return (0.8 * x + 0.6 * body) * _env(n, 0.001, 0.06)


def grom(duur=0.5):
    n = int(SR * duur)
    t = np.arange(n) / SR
    faseloop = 2 * np.pi * np.cumsum(np.linspace(95, 60, n)) / SR
    y = np.sign(np.sin(faseloop)) * 0.5 + np.sin(faseloop * 2) * 0.2
    y += rng.normal(0, 0.15, n)                 # keelruis
    y *= 1 + 0.15 * np.sin(2 * np.pi * 6 * t)   # golving
    return y * _env(n, 0.025, 0.25)


def klik(duur=0.15):
    n = int(SR * duur)
    y = rng.normal(0, 1, n) * _env(n, 0.0005, 0.02)
    y += np.sin(2 * np.pi * np.linspace(1800, 700, n) * np.arange(n) / SR) * _env(n, 0.001, 0.03) * 0.5
    return y


def hoorn(duur=1.6):
    n = int(SR * duur)
    faseloop = 2 * np.pi * np.cumsum(np.linspace(92, 68, n)) / SR
    y = np.sin(faseloop) + 0.4 * np.sin(2 * faseloop) + 0.2 * np.sin(3 * faseloop)
    return y * _env(n, 0.08, 0.9)


def voetstap(duur=0.4):
    n = int(SR * duur)
    return np.convolve(rng.normal(0, 1, n), np.ones(20) / 20, 'same') * _env(n, 0.002, 0.05)


def genormaliseerd(y):
    return (y / (np.max(np.abs(y)) * 1.05)).astype(np.float32)


# --- Encoders --------------------------------------------------------------

def enc_mp3(y, bitrate):
    e = lameenc.Encoder()
    e.set_bit_rate(bitrate)
    e.set_in_sample_rate(SR)
    e.set_channels(1)
    e.set_quality(2)
    e.silence()
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    return e.encode(pcm) + e.flush()


def enc_ogg(y, kwaliteit):
    b = io.BytesIO()
    sf.write(b, y, SR, format='OGG', subtype='VORBIS', compression_level=kwaliteit)
    return b.getvalue()


def b64_lengte(n):
    return ((n + 2) // 3) * 4


CODECS = [
    ('mp3 48',  lambda y: enc_mp3(y, 48)),
    ('mp3 64',  lambda y: enc_mp3(y, 64)),
    ('mp3 96',  lambda y: enc_mp3(y, 96)),
    ('mp3 128', lambda y: enc_mp3(y, 128)),
    ('ogg q0.3', lambda y: enc_ogg(y, 0.3)),
    ('ogg q0.5', lambda y: enc_ogg(y, 0.5)),
    ('ogg q0.8', lambda y: enc_ogg(y, 0.8)),
]


# --- 1. Per geluid ---------------------------------------------------------

SAMPLES = {
    'schot': genormaliseerd(schot()),
    'grom': genormaliseerd(grom()),
    'klik': genormaliseerd(klik()),
    'hoorn': genormaliseerd(hoorn()),
    'voetstap': genormaliseerd(voetstap()),
}

print('--- 1. Bytes per geluid (raw / base64) ---')
kop = f"{'geluid':10s} {'duur':>5s} " + ' '.join(f'{n:>13s}' for n, _ in CODECS)
print(kop)
for naam, y in SAMPLES.items():
    cellen = []
    for _, coder in CODECS:
        raw = len(coder(y))
        cellen.append(f'{raw:5d}/{b64_lengte(raw):6d}')
    print(f'{naam:10s} {len(y) / SR:5.2f} ' + ' '.join(f'{c:>13s}' for c in cellen))

# --- 2. Vaste overhead per bestand ----------------------------------------

print('')
print('--- 2. Vaste overhead per bestand (stilte, dus alleen headers) ---')
print(f"{'duur':>6s} {'ogg q0.5':>10s} {'mp3 64':>8s}")
for d in (0.01, 0.1, 0.5, 1.0, 2.0):
    stilte = np.zeros(int(SR * d), dtype=np.float32)
    print(f'{d:6.2f} {len(enc_ogg(stilte, 0.5)):10d} {len(enc_mp3(stilte, 64)):8d}')
print('  -> Vorbis draagt een setup-header (codebooks) van ~4,0 KB PER BESTAND;')
print('     MP3 heeft die vaste kost niet. Bij korte geluiden domineert dat alles.')

# --- 3. Base64 door gzip heen ---------------------------------------------

print('')
print('--- 3. Wat base64 kost na gzip (GitHub Pages serveert gecomprimeerd) ---')
proef = enc_mp3(genormaliseerd(grom()), 64)
b64 = base64.b64encode(proef)
gz = gzip.compress(b64, 9)
print(f'  mp3 raw        : {len(proef):6d} bytes')
print(f'  base64         : {len(b64):6d} bytes ({len(b64) / len(proef) * 100 - 100:+.0f}%)')
print(f'  base64 na gzip : {len(gz):6d} bytes ({len(gz) / len(proef) * 100 - 100:+.0f}% t.o.v. raw)')
print('  -> op schijf betaal je de volle +33% van base64, over de lijn vrijwel niets.')

# --- 4. Scenariototalen ----------------------------------------------------

# (aantal bestanden, duur per bestand) — zie AUDIO.md §5 voor de opbouw.
SCENARIOS = {
    'B  kern-set (18 bestanden)':      [(6, 0.35), (6, 0.30), (6, 0.50)],
    'C  hybride (28 bestanden)':       [(6, 0.35), (6, 0.30), (6, 0.50), (4, 0.60), (6, 1.20)],
    'D  alles samplen (41 bestanden)': [(20, 0.35), (12, 0.50), (9, 1.20)],
}


def ruis(duur):
    n = int(SR * duur)
    y = np.convolve(rng.normal(0, 1, n), np.ones(10) / 10, 'same')
    y *= np.exp(-(np.arange(n) / SR) / (duur * 0.25))
    return genormaliseerd(y)


print('')
print('--- 4. Scenariototalen ---')
print(f"{'scenario':32s} {'codec':10s} {'raw KB':>7s} {'b64 KB':>7s} {'bestand KB':>11s} {'gzip KB':>8s}")
for naam, spec in SCENARIOS.items():
    for cnaam, coder in [('mp3 64', lambda y: enc_mp3(y, 64)),
                         ('mp3 96', lambda y: enc_mp3(y, 96)),
                         ('ogg q0.5', lambda y: enc_ogg(y, 0.5))]:
        raw = sum(aantal * len(coder(ruis(d))) for aantal, d in spec)
        b64 = b64_lengte(raw)
        # base64 na gzip ≈ 91% van raw, gemeten in blok 3 hierboven.
        gz = int(raw * 0.907)
        print(f'{naam:32s} {cnaam:10s} {raw / 1024:7.0f} {b64 / 1024:7.0f} '
              f'{(HUIDIG_RAW + b64) / 1024:11.0f} {(HUIDIG_GZIP + gz) / 1024:8.0f}')
print(f"{'A  alles procedureel (huidig)':32s} {'-':10s} {'-':>7s} {'-':>7s} "
      f'{HUIDIG_RAW / 1024:11.0f} {HUIDIG_GZIP / 1024:8.0f}')

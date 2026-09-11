"""Zodat ``python3 -m whoop_coach`` werkt."""

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Draai de hele testsuite.

    python3 tests/draai_tests.py
"""

import os
import sys
import unittest

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HIER))
sys.path.insert(0, HIER)


def main():
    lader = unittest.TestLoader()
    suite = lader.discover(HIER, pattern="test_*.py")
    resultaat = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if resultaat.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEBSITE_DIR = ROOT / "website"

from website.getEarnings import getEarnings

print(getEarnings("8947998229867728285"))
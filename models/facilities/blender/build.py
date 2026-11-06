"""Build the facility models in Blender and export them as GLB for the game.

usage: Blender -b -P models/facilities/blender/build.py -- <out dir> [model ...]   (no names: all)

Each family module (lifts, stations, signs, buildings, props, nature) lists its models in MODELS.
"""
import importlib, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

FAMILIES = ["lifts", "stations", "signs", "buildings", "props", "nature", "signature", "signature2"]
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
lib.OUT = ARGS[0] if ARGS else "."
MODELS = {}
for f in FAMILIES:
    if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), f + ".py")): MODELS.update(importlib.import_module(f).MODELS)
for name in ARGS[1:] or list(MODELS):
    lib.reset(); MODELS[name]()

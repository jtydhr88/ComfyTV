import ast
import json
import math

import numpy as np

from .procedural import perm_table, perlin3, fbm3

_MASK64 = (1 << 64) - 1

EXPRESSION_FIELDS = ('v', 'scale', 'opacity', 'x', 'y', 'rotation')


def _mix64(z):
    z = (z + 0x9E3779B97F4A7C15) & _MASK64
    z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
    z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & _MASK64
    return (z ^ (z >> 31)) & _MASK64


def _hash01(*args):
    h = 0x243F6A8885A308D3
    for a in args:
        bits = np.float64(a).view(np.uint64).item()
        h = _mix64(h ^ bits)
    return h / float(_MASK64 + 1)


def _boxstep(x, a):
    return 0.0 if x < a else 1.0


def _linearstep(x, a, b):
    if a >= b:
        return _boxstep(x, a)
    return min(1.0, max(0.0, (x - a) / (b - a)))


def _smoothstep(x, a, b):
    t = _linearstep(x, a, b)
    return t * t * (3.0 - 2.0 * t)


def _gaussstep(x, a, b):
    t = 1.0 - _linearstep(x, a, b)
    return math.pow(2.0, -8.0 * t * t)


def _remap(x, source, range_, falloff, interp=0):
    d = abs(x - source)
    if d < range_:
        return 1.0
    if falloff <= 0:
        return 0.0
    t = (d - range_) / falloff
    if t >= 1.0:
        return 0.0
    if int(interp) == 0:
        return 1.0 - t
    if int(interp) == 1:
        return _smoothstep(1.0 - t, 0.0, 1.0)
    return math.pow(2.0, -8.0 * t * t)


class _ExprContext:

    def __init__(self, seed=0):
        self._perm = perm_table(int(seed) or 1)

    def noise(self, x, y=0.0, z=0.0):
        v = perlin3(np.float64(x), np.float64(y), np.float64(z), self._perm)
        return float(v) * 0.5 + 0.5

    def snoise(self, x, y=0.0, z=0.0):
        return float(perlin3(np.float64(x), np.float64(y), np.float64(z),
                             self._perm))

    def fbm(self, x, y=0.0, z=0.0, octaves=6, lacunarity=2.0, gain=0.5):
        return float(fbm3(np.float64(x), np.float64(y), np.float64(z),
                          self._perm, octaves=int(octaves),
                          lacunarity=float(lacunarity), gain=float(gain)))

    def turbulence(self, x, y=0.0, z=0.0, octaves=6, lacunarity=2.0,
                   gain=0.5):
        return float(fbm3(np.float64(x), np.float64(y), np.float64(z),
                          self._perm, octaves=int(octaves),
                          lacunarity=float(lacunarity), gain=float(gain),
                          turbulence=True))

    def cellnoise(self, x, y=0.0, z=0.0):
        return _hash01(math.floor(x), math.floor(y), math.floor(z))

    def pnoise(self, x, period):
        p = max(1e-6, float(period))
        return self.noise(x - p * math.floor(x / p))

    def random(self, frame, seed=0):
        return _hash01(float(frame), float(seed))

    def functions(self):
        return {
            'boxstep': _boxstep, 'linearstep': _linearstep,
            'smoothstep': _smoothstep, 'gaussstep': _gaussstep,
            'remap': _remap,
            'mix': lambda x, y, a: x * (1.0 - a) + y * a,
            'clamp': lambda x, lo, hi: min(max(x, lo), hi),
            'hash': _hash01,
            'noise': self.noise, 'snoise': self.snoise,
            'fbm': self.fbm, 'turbulence': self.turbulence,
            'cellnoise': self.cellnoise, 'pnoise': self.pnoise,
            'random': self.random,
            'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
            'asin': lambda x: math.asin(min(1.0, max(-1.0, x))),
            'acos': lambda x: math.acos(min(1.0, max(-1.0, x))),
            'atan': math.atan, 'atan2': math.atan2,
            'exp': lambda x: math.exp(min(80.0, x)),
            'log': lambda x: math.log(max(1e-12, x)),
            'sqrt': lambda x: math.sqrt(max(0.0, x)),
            'pow': lambda x, y: math.copysign(
                math.pow(min(abs(x), 1e12), y), x) if x < 0 else
                math.pow(min(x, 1e12), y),
            'abs': abs, 'floor': math.floor, 'ceil': math.ceil,
            'round': round, 'min': min, 'max': max,
            'sign': lambda x: (x > 0) - (x < 0),
            'degrees': math.degrees, 'radians': math.radians,
        }


_ALLOWED_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Call, ast.Name,
    ast.Constant, ast.Compare, ast.BoolOp, ast.IfExp, ast.Load,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
    ast.USub, ast.UAdd, ast.Not,
    ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq,
    ast.And, ast.Or,
)


class SafeExpression:

    def __init__(self, source: str, seed: int = 0):
        text = (source or '').strip()
        if not text:
            raise RuntimeError("expression: empty expression")
        if len(text) > 2000:
            raise RuntimeError("expression: too long (max 2000 chars)")
        try:
            tree = ast.parse(text, mode='eval')
        except SyntaxError as exc:
            raise RuntimeError(f"expression: syntax error: {exc.msg}")
        for node in ast.walk(tree):
            if not isinstance(node, _ALLOWED_NODES):
                raise RuntimeError(
                    f"expression: {type(node).__name__} is not allowed")
            if isinstance(node, ast.Constant) and not isinstance(
                    node.value, (int, float, bool)):
                raise RuntimeError("expression: only numeric constants")
            if isinstance(node, ast.Call):
                if not isinstance(node.func, ast.Name):
                    raise RuntimeError(
                        "expression: only plain function calls")
                if node.keywords:
                    raise RuntimeError(
                        "expression: keyword arguments are not supported")
        self._code = compile(tree, '<expression>', 'eval')
        self._funcs = _ExprContext(seed).functions()
        names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
        known = set(self._funcs) | {'frame', 't', 'duration', 'fps', 'pi',
                                    'e', 'True', 'False'}
        unknown = names - known
        if unknown:
            raise RuntimeError(
                f"expression: unknown name {sorted(unknown)[0]!r}")

    def evaluate(self, frame: float, t: float, duration: float,
                 fps: float) -> float:
        env = dict(self._funcs)
        env.update({'frame': float(frame), 't': float(t),
                    'duration': float(duration), 'fps': float(fps),
                    'pi': math.pi, 'e': math.e,
                    '__builtins__': {}})
        try:
            val = eval(self._code, env)
        except ZeroDivisionError:
            return 0.0
        except (ValueError, OverflowError) as exc:
            raise RuntimeError(f"expression: math error: {exc}")
        v = float(val)
        if math.isnan(v) or math.isinf(v):
            return 0.0
        return v


def expression_samples(expr: str, *, duration: float, fps: float = 24.0,
                       rate: float = 10.0, seed: int = 0):
    safe = SafeExpression(expr, seed=seed)
    dur = max(0.05, min(3600.0, float(duration)))
    fr = max(1.0, min(120.0, float(fps)))
    rt = max(1.0, min(60.0, float(rate)))
    n_keys = max(2, int(dur * rt) + 1)
    out = []
    for i in range(n_keys):
        t = i / rt
        out.append((round(t, 4),
                    round(safe.evaluate(t * fr, t, dur, fr), 5)))
    return out


def expression_keyframes(expr: str, *, field: str = 'v', duration: float,
                         fps: float = 24.0, rate: float = 10.0,
                         seed: int = 0, progress=None) -> str:
    fname = (field or 'v').strip() or 'v'
    samples = expression_samples(expr, duration=duration, fps=fps, rate=rate,
                                 seed=seed)
    keys = [{'t': t, fname: v, 'interp': 'linear'} for t, v in samples]
    return json.dumps(keys)


__all__ = ['SafeExpression', 'expression_samples', 'expression_keyframes',
           'EXPRESSION_FIELDS']

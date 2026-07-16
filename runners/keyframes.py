
import json
import math
from bisect import bisect_right

INTERP_TYPES = ('constant', 'linear', 'smooth', 'catmull-rom', 'cubic',
                'horizontal', 'free', 'broken')
_NONE = 'none'


def hermite_to_cubic_coeffs(p0, p0pr, p3pl, p3):
    c0 = p0
    c1 = p0pr
    c2 = 3 * (p3 - p0) - 2 * p0pr - p3pl
    c3 = -2 * (p3 - p0) + p0pr + p3pl
    return c0, c1, c2, c3


def cubic_eval(c0, c1, c2, c3, t):
    t2 = t * t
    t3 = t2 * t
    return c0 + c1 * t + c2 * t2 + c3 * t3


def cubic_integrate(c0, c1, c2, c3, t):
    t2 = t * t
    t3 = t2 * t
    t4 = t3 * t
    return c0 * t + c1 * t2 / 2.0 + c2 * t3 / 3.0 + c3 * t4 / 4.0


def cubic_derive(c1, c2, c3, t):
    return c1 + 2 * c2 * t + 3 * c3 * t * t


def interpolate(tcur, vcur, vcur_deriv_right, vnext_deriv_left,
                tnext, vnext, current_time, interp, interp_next):
    p0 = vcur
    p3 = vnext
    p0pr = vcur_deriv_right * (tnext - tcur)
    p3pl = vnext_deriv_left * (tnext - tcur)

    if interp == _NONE:
        p0 = p3 - p3pl
        p0pr = p3pl
        tcur = tnext - 1.0
    elif interp == 'constant':
        p0pr = 0.0
        p3pl = 0.0
        p3 = p0
    if interp_next == _NONE:
        p3pl = p0pr
        p3 = p0 + p0pr
        tnext = tcur + 1.0

    c0, c1, c2, c3 = hermite_to_cubic_coeffs(p0, p0pr, p3pl, p3)
    t = (current_time - tcur) / (tnext - tcur)
    return cubic_eval(c0, c1, c2, c3, t)


def auto_compute_derivatives(interp_prev, interp, interp_next,
                             tprev, vprev, tcur, vcur, tnext, vnext,
                             vprev_deriv_right=0.0, vnext_deriv_left=0.0):
    q0 = vprev
    q3 = vcur
    p0 = vcur
    p3 = vnext

    if interp_prev == _NONE:
        tprev = tcur - 1.0
    if interp_next == _NONE:
        tnext = tcur + 1.0
    q0pr = vprev_deriv_right * (tcur - tprev)
    p3pl = vnext_deriv_left * (tnext - tcur)
    p0pr = 0.0
    q3pl = 0.0

    if interp_prev == _NONE and interp_next == _NONE:
        return 0.0, 0.0

    keyframe_none_same_derivative = False
    if interp != 'horizontal' and (interp_prev == _NONE or interp_next == _NONE):
        keyframe_none_same_derivative = interp in ('catmull-rom', 'cubic')
        interp = 'linear'

    if interp == 'linear':
        if interp_next == _NONE:
            p0pr = 0.0
        elif interp_next == 'linear':
            p0pr = -p0 + p3
        else:
            p0pr = -1.5 * p0 + 1.5 * p3 - p3pl / 2.0

        if interp_prev == _NONE:
            q3pl = 0.0
        elif interp_prev == 'linear':
            q3pl = -q0 + p0
        else:
            q3pl = -1.5 * q0 - q0pr / 2.0 + 1.5 * p0

        if keyframe_none_same_derivative:
            if interp_next == _NONE:
                p0pr = q3pl / (tcur - tprev)
            elif interp_prev == _NONE:
                q3pl = p0pr / (tnext - tcur)

    elif interp == 'catmull-rom':
        deriv = (vnext - vprev) / (tnext - tprev)
        p0pr = deriv * (tnext - tcur)
        q3pl = deriv * (tcur - tprev)

    elif interp == 'smooth':
        if (vprev > vcur and vcur < vnext) or (vprev < vcur and vcur > vnext):
            p0pr = 0.0
            q3pl = 0.0
        else:
            deriv = (vnext - vprev) / (tnext - tprev)
            p0pr = deriv * (tnext - tcur)
            q3pl = deriv * (tcur - tprev)

            p1 = p0 + p0pr / 3.0
            q2 = q3 - q3pl / 3.0

            prev_max = max(vprev, vcur)
            prev_min = min(vprev, vcur)
            if q2 < prev_min or q2 > prev_max:
                q2new = max(prev_min, min(q2, prev_max))
                p1 = p0 + (p1 - p0) * (q3 - q2new) / (q3 - q2)
                q2 = q2new

            next_max = max(vcur, vnext)
            next_min = min(vcur, vnext)
            if p1 < next_min or p1 > next_max:
                p1new = max(next_min, min(p1, next_max))
                q2 = q3 - (q3 - q2) * (p1new - p0) / (p1 - p0)
                p1 = p1new

            p0pr = 3.0 * (p1 - p0)
            q3pl = 3.0 * (q3 - q2)

    elif interp in ('horizontal', 'constant'):
        p0pr = 0.0
        q3pl = 0.0

    elif interp == 'cubic':
        if interp_prev == 'linear' and interp_next == 'linear':
            num = (q0 * tnext * tnext - 2 * q0 * tnext * tcur - 2 * p0 * tcur * tprev
                   + 2 * p3 * tcur * tprev + 2 * p0 * tnext * tcur - p3 * tprev * tprev
                   + p0 * tprev * tprev - p0 * tnext * tnext + q0 * tcur * tcur
                   - p3 * tcur * tcur)
            p0pr = -num / (tcur - tprev) / (tnext - tprev)
            q3pl = num / (-tnext * tnext + tnext * tcur + tprev * tnext - tcur * tprev)
        elif interp_prev == 'linear':
            num = (2 * p3pl * tcur * tcur + 3 * p0 * tcur * tcur - 6 * p3 * tcur * tcur
                   + 3 * q0 * tcur * tcur - 6 * q0 * tnext * tcur
                   - 4 * p3pl * tcur * tprev - 12 * p0 * tcur * tprev
                   + 6 * p0 * tnext * tcur + 12 * p3 * tcur * tprev
                   + 2 * p3pl * tprev * tprev + 3 * q0 * tnext * tnext
                   - 6 * p3 * tprev * tprev + 6 * p0 * tprev * tprev
                   - 3 * p0 * tnext * tnext)
            p0pr = -num / (tcur - tprev) / (tcur - 4 * tprev + 3 * tnext)
            q3pl = num / (2 * tnext * tcur - 4 * tcur * tprev + 4 * tprev * tnext
                          + tcur * tcur - 3 * tnext * tnext)
        else:
            num = (6 * p0 * tcur * tprev - 6 * p3 * tcur * tprev
                   + 12 * q0 * tnext * tcur + 4 * q0pr * tnext * tcur
                   - 12 * p0 * tnext * tcur - 2 * q0pr * tnext * tnext
                   + 3 * p3 * tcur * tcur + 3 * p3 * tprev * tprev
                   - 2 * q0pr * tcur * tcur + 6 * p0 * tnext * tnext
                   + 3 * p0 * tcur * tcur - 3 * p0 * tprev * tprev
                   - 6 * q0 * tnext * tnext - 6 * q0 * tcur * tcur)
            p0pr = -num / (tcur - tprev) / (tcur - 4 * tnext + 3 * tprev)
            q3pl = num / (-5 * tnext * tcur - 3 * tprev * tnext + 3 * tcur * tprev
                          + 4 * tnext * tnext + tcur * tcur)
    else:
        raise ValueError(f"cannot auto-compute derivatives for interp {interp!r}")

    vcur_deriv_right = p0pr / (tnext - tcur)
    vcur_deriv_left = q3pl / (tcur - tprev)
    return vcur_deriv_left, vcur_deriv_right


class KeyframeCurve:

    def __init__(self, keys=None, extrapolate='linear', periodic=False):
        self.extrapolate = extrapolate
        self.periodic = bool(periodic)
        self.keys = []
        for k in keys or []:
            self.keys.append({
                't': float(k['t']),
                'v': float(k['v']),
                'interp': str(k.get('interp', 'smooth')),
                'left_deriv': float(k['left_deriv']) if 'left_deriv' in k else None,
                'right_deriv': float(k['right_deriv']) if 'right_deriv' in k else None,
            })
        self.keys.sort(key=lambda k: k['t'])
        self._times = [k['t'] for k in self.keys]

    @classmethod
    def from_json(cls, raw):
        if raw is None or raw == '':
            return cls([])
        if isinstance(raw, str):
            raw = json.loads(raw)
        return cls(raw)

    @classmethod
    def constant(cls, value):
        return cls([{'t': 0.0, 'v': float(value), 'interp': 'constant'}])

    def to_json(self):
        out = []
        for k in self.keys:
            item = {'t': k['t'], 'v': k['v'], 'interp': k['interp']}
            if k['left_deriv'] is not None:
                item['left_deriv'] = k['left_deriv']
            if k['right_deriv'] is not None:
                item['right_deriv'] = k['right_deriv']
            out.append(item)
        return json.dumps(out)

    def _derivs(self, i, depth=1):
        k = self.keys[i]
        if k['interp'] in ('free', 'broken') and \
                k['left_deriv'] is not None and k['right_deriv'] is not None:
            return k['left_deriv'], k['right_deriv']

        n = len(self.keys)
        prev_k = self.keys[i - 1] if i > 0 else None
        next_k = self.keys[i + 1] if i < n - 1 else None
        interp_prev = prev_k['interp'] if prev_k else _NONE
        interp_next = next_k['interp'] if next_k else _NONE
        if prev_k is not None and i - 1 == 0 and \
                interp_prev not in ('free', 'broken'):
            interp_prev = 'linear'
        if next_k is not None and i + 1 == n - 1 and \
                interp_next not in ('free', 'broken'):
            interp_next = 'linear'
        tprev = prev_k['t'] if prev_k else k['t'] - 1.0
        vprev = prev_k['v'] if prev_k else k['v']
        tnext = next_k['t'] if next_k else k['t'] + 1.0
        vnext = next_k['v'] if next_k else k['v']

        vprev_dr = 0.0
        vnext_dl = 0.0
        if depth > 0:
            if prev_k is not None:
                _, vprev_dr = self._derivs(i - 1, depth - 1)
            if next_k is not None:
                vnext_dl, _ = self._derivs(i + 1, depth - 1)

        interp = k['interp']
        if interp in ('free', 'broken'):
            interp = 'smooth'
        return auto_compute_derivatives(
            interp_prev, interp, interp_next,
            tprev, vprev, k['t'], k['v'], tnext, vnext,
            vprev_deriv_right=vprev_dr, vnext_deriv_left=vnext_dl)

    def value(self, t):
        n = len(self.keys)
        if n == 0:
            raise ValueError("empty curve")
        if n == 1:
            return self.keys[0]['v']
        if self.periodic:
            t0 = self.keys[0]['t']
            period = self.keys[-1]['t'] - t0
            if period > 0 and (t < t0 or t > t0 + period):
                t = math.fmod(t - t0, period) + t0
                if t < t0:
                    t += period
        if t <= self.keys[0]['t']:
            if self.extrapolate == 'linear':
                left, _ = self._derivs(0)
                return self.keys[0]['v'] + (t - self.keys[0]['t']) * left
            return self.keys[0]['v']
        if t >= self.keys[-1]['t']:
            if self.extrapolate == 'linear':
                _, right = self._derivs(n - 1)
                return self.keys[-1]['v'] + (t - self.keys[-1]['t']) * right
            return self.keys[-1]['v']

        i = bisect_right(self._times, t) - 1
        i = max(0, min(i, n - 2))
        cur, nxt = self.keys[i], self.keys[i + 1]
        _, cur_right = self._derivs(i)
        nxt_left, _ = self._derivs(i + 1)
        return interpolate(cur['t'], cur['v'], cur_right, nxt_left,
                           nxt['t'], nxt['v'], t,
                           cur['interp'], nxt['interp'])

    def values(self, times):
        return [self.value(t) for t in times]

    def integrate(self, t1, t2):
        if t2 < t1:
            return -self.integrate(t2, t1)
        n = len(self.keys)
        if n == 0:
            raise ValueError("empty curve")
        if n == 1:
            return self.keys[0]['v'] * (t2 - t1)

        def _ext_integral(v0, t0, slope, a, b):
            return v0 * (b - a) + slope * ((b - t0) ** 2 - (a - t0) ** 2) / 2.0

        total = 0.0
        first_t = self.keys[0]['t']
        last_t = self.keys[-1]['t']
        if t1 < first_t:
            slope = self._derivs(0)[0] if self.extrapolate == 'linear' else 0.0
            total += _ext_integral(self.keys[0]['v'], first_t, slope,
                                   t1, min(t2, first_t))
        if t2 > last_t:
            slope = self._derivs(len(self.keys) - 1)[1] \
                if self.extrapolate == 'linear' else 0.0
            total += _ext_integral(self.keys[-1]['v'], last_t, slope,
                                   max(t1, last_t), t2)

        for i in range(n - 1):
            cur, nxt = self.keys[i], self.keys[i + 1]
            lo = max(t1, cur['t'])
            hi = min(t2, nxt['t'])
            if hi <= lo:
                continue
            _, cur_right = self._derivs(i)
            nxt_left, _ = self._derivs(i + 1)
            dt = nxt['t'] - cur['t']
            p0pr = cur_right * dt
            p3pl = nxt_left * dt
            p0, p3 = cur['v'], nxt['v']
            if cur['interp'] == 'constant':
                p0pr = p3pl = 0.0
                p3 = p0
            c0, c1, c2, c3 = hermite_to_cubic_coeffs(p0, p0pr, p3pl, p3)
            x1 = (lo - cur['t']) / dt
            x2 = (hi - cur['t']) / dt
            total += (cubic_integrate(c0, c1, c2, c3, x2)
                      - cubic_integrate(c0, c1, c2, c3, x1)) * dt
        return total


def resolve_param(raw, default):
    if raw is None or raw == '':
        return KeyframeCurve.constant(default), False
    if isinstance(raw, (int, float)):
        return KeyframeCurve.constant(raw), False
    s = str(raw).strip()
    if s.startswith('['):
        try:
            curve = KeyframeCurve.from_json(s)
            if curve.keys:
                return curve, len(curve.keys) > 1
        except (ValueError, TypeError, KeyError):
            pass
    try:
        return KeyframeCurve.constant(float(s)), False
    except ValueError:
        return KeyframeCurve.constant(default), False


__all__ = [
    'INTERP_TYPES', 'KeyframeCurve', 'resolve_param',
    'interpolate', 'auto_compute_derivatives',
    'hermite_to_cubic_coeffs', 'cubic_eval', 'cubic_derive', 'cubic_integrate',
]

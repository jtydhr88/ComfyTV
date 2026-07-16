"""Tests for runners.keyframes — cross-checked against the formulas in
H:\\Natron\\Engine\\Interpolation.cpp."""
import pytest


def _curve(keys):
    from ComfyTV.runners.keyframes import KeyframeCurve
    return KeyframeCurve(keys)


class TestHermitePrimitives:
    def test_hermite_coeffs_identity(self):
        from ComfyTV.runners.keyframes import hermite_to_cubic_coeffs, cubic_eval
        # P0=0, P3=1, both derivatives = 1 (i.e. the straight line y=x)
        c = hermite_to_cubic_coeffs(0.0, 1.0, 1.0, 1.0)
        assert c == (0.0, 1.0, 0.0, 0.0)
        assert cubic_eval(*c, 0.5) == 0.5

    def test_cubic_derive_and_integrate(self):
        from ComfyTV.runners.keyframes import cubic_derive, cubic_integrate
        # P(t) = 1 + 2t + 3t² + 4t³
        assert cubic_derive(2, 3, 4, 0.5) == 2 + 3 * 1.0 + 12 * 0.25
        # ∫₀¹ = 1 + 1 + 1 + 1 = 4
        assert cubic_integrate(1, 2, 3, 4, 1.0) == pytest.approx(4.0)


class TestLinear:
    def test_midpoint(self):
        c = _curve([{'t': 0, 'v': 0, 'interp': 'linear'},
                    {'t': 10, 'v': 100, 'interp': 'linear'}])
        assert c.value(5) == pytest.approx(50.0)
        assert c.value(2.5) == pytest.approx(25.0)

    def test_hold_outside(self):
        c = _curve([{'t': 1, 'v': 5, 'interp': 'linear'},
                    {'t': 2, 'v': 9, 'interp': 'linear'}])
        assert c.value(-10) == 5
        assert c.value(100) == 9


class TestConstant:
    def test_step(self):
        c = _curve([{'t': 0, 'v': 1, 'interp': 'constant'},
                    {'t': 10, 'v': 2, 'interp': 'constant'}])
        assert c.value(9.99) == pytest.approx(1.0)
        assert c.value(10) == pytest.approx(2.0)


class TestCatmullRom:
    def test_derivative_formula(self):
        """Interpolation.cpp:1017-1023 — deriv = (vnext - vprev)/(tnext - tprev)."""
        from ComfyTV.runners.keyframes import auto_compute_derivatives
        left, right = auto_compute_derivatives(
            'catmull-rom', 'catmull-rom', 'catmull-rom',
            0.0, 0.0, 1.0, 1.0, 2.0, 4.0)
        assert right == pytest.approx((4.0 - 0.0) / (2.0 - 0.0))  # = 2
        assert left == pytest.approx(2.0)

    def test_passes_through_keys(self):
        c = _curve([{'t': 0, 'v': 0, 'interp': 'catmull-rom'},
                    {'t': 1, 'v': 1, 'interp': 'catmull-rom'},
                    {'t': 2, 'v': 4, 'interp': 'catmull-rom'},
                    {'t': 3, 'v': 9, 'interp': 'catmull-rom'}])
        for t, v in [(0, 0), (1, 1), (2, 4), (3, 9)]:
            assert c.value(t) == pytest.approx(v)


class TestSmooth:
    def test_extremum_is_horizontal(self):
        """Interpolation.cpp:1027-1030 — a local max keeps a flat tangent, so
        the curve never overshoots above the key value near it."""
        c = _curve([{'t': 0, 'v': 0, 'interp': 'smooth'},
                    {'t': 1, 'v': 10, 'interp': 'smooth'},
                    {'t': 2, 'v': 0, 'interp': 'smooth'}])
        for t in (0.9, 0.95, 1.05, 1.1):
            assert c.value(t) <= 10.0 + 1e-9

    def test_monotone_no_overshoot(self):
        """The Bezier clamp (Interpolation.cpp:1038-1065) keeps a monotone
        run of keys monotone."""
        c = _curve([{'t': 0, 'v': 0, 'interp': 'smooth'},
                    {'t': 1, 'v': 0.1, 'interp': 'smooth'},
                    {'t': 2, 'v': 10, 'interp': 'smooth'}])
        prev = -1e9
        for i in range(101):
            v = c.value(i * 0.02)
            assert v >= prev - 1e-9
            prev = v


class TestHorizontal:
    def test_flat_tangents(self):
        from ComfyTV.runners.keyframes import auto_compute_derivatives
        left, right = auto_compute_derivatives(
            'linear', 'horizontal', 'linear',
            0.0, 0.0, 1.0, 5.0, 2.0, 10.0)
        assert left == 0.0 and right == 0.0


class TestIntegrate:
    def test_linear_integral(self):
        c = _curve([{'t': 0, 'v': 0, 'interp': 'linear'},
                    {'t': 2, 'v': 2, 'interp': 'linear'}])
        # ∫₀² t dt = 2
        assert c.integrate(0, 2) == pytest.approx(2.0)

    def test_constant_extrapolation(self):
        c = _curve([{'t': 0, 'v': 3, 'interp': 'linear'},
                    {'t': 1, 'v': 3, 'interp': 'linear'}])
        assert c.integrate(-1, 2) == pytest.approx(9.0)


class TestResolveParam:
    def test_plain_number(self):
        from ComfyTV.runners.keyframes import resolve_param
        curve, animated = resolve_param(2.5, 1.0)
        assert not animated
        assert curve.value(123) == 2.5

    def test_numeric_string(self):
        from ComfyTV.runners.keyframes import resolve_param
        curve, animated = resolve_param("0.7", 1.0)
        assert not animated
        assert curve.value(0) == pytest.approx(0.7)

    def test_keyframe_json(self):
        from ComfyTV.runners.keyframes import resolve_param
        curve, animated = resolve_param(
            '[{"t":0,"v":0,"interp":"linear"},{"t":1,"v":1,"interp":"linear"}]', 0)
        assert animated
        assert curve.value(0.5) == pytest.approx(0.5)

    def test_garbage_falls_back(self):
        from ComfyTV.runners.keyframes import resolve_param
        curve, animated = resolve_param("banana", 7.0)
        assert not animated
        assert curve.value(0) == 7.0

    def test_roundtrip(self):
        from ComfyTV.runners.keyframes import KeyframeCurve
        c = KeyframeCurve([{'t': 0, 'v': 1, 'interp': 'smooth'},
                           {'t': 5, 'v': 2, 'interp': 'linear'}])
        c2 = KeyframeCurve.from_json(c.to_json())
        assert c2.value(2.5) == pytest.approx(c.value(2.5))

import math

import numpy as np


def sigma_mad(errors):
    med = np.median(errors)
    return 1.4826 * np.median(np.abs(errors - med))


def solve_translation(x1, x2, weights=None):
    x1 = np.asarray(x1, dtype=np.float64)
    x2 = np.asarray(x2, dtype=np.float64)
    w = np.ones(len(x1)) if weights is None else np.asarray(weights, dtype=np.float64)
    s = w.sum()
    if s <= 0:
        raise ValueError("track solve: all weights zero")
    d = ((x2 - x1) * w[:, None]).sum(axis=0) / s
    return {'tx': float(d[0]), 'ty': float(d[1]), 'rotation': 0.0, 'scale': 1.0}


def solve_similarity(x1, x2, weights=None):
    x1 = np.asarray(x1, dtype=np.float64)
    x2 = np.asarray(x2, dtype=np.float64)
    n = len(x1)
    if n < 2:
        raise ValueError("similarity solve needs >= 2 points")
    w = np.ones(n) if weights is None else np.asarray(weights, dtype=np.float64)
    sw = w.sum()
    if sw <= 0:
        raise ValueError("track solve: all weights zero")

    src_mean = (x1 * w[:, None]).sum(axis=0) / sw
    dst_mean = (x2 * w[:, None]).sum(axis=0) / sw
    src_d = x1 - src_mean
    dst_d = x2 - dst_mean

    src_var = float((w * (src_d ** 2).sum(axis=1)).sum() / sw)
    if src_var < 1e-12:
        raise ValueError("similarity solve: degenerate points")
    sigma = (dst_d * w[:, None]).T @ src_d / sw

    U, D, VT = np.linalg.svd(sigma)
    if np.linalg.det(U) * np.linalg.det(VT) > 0:
        R = U @ VT
        c = (D[0] + D[1]) / src_var
    else:
        U[:, 1] *= -1
        R = U @ VT
        c = (D[0] - D[1]) / src_var
    t = dst_mean - c * (R @ src_mean)

    return {'tx': float(t[0]), 'ty': float(t[1]),
            'rotation': float(math.atan2(c * R[1, 0], c * R[0, 0])),
            'scale': float(math.sqrt((c * R[1, 0]) ** 2 + (c * R[0, 0]) ** 2))}


def solve_homography(x1, x2, weights=None):
    x1 = np.asarray(x1, dtype=np.float64)
    x2 = np.asarray(x2, dtype=np.float64)
    n = len(x1)
    if n < 4:
        raise ValueError("homography solve needs >= 4 points")
    w = np.ones(n) if weights is None else np.asarray(weights, dtype=np.float64)

    def _norm(pts):
        mean = pts.mean(axis=0)
        d = np.sqrt(((pts - mean) ** 2).sum(axis=1)).mean()
        s = math.sqrt(2) / max(d, 1e-12)
        T = np.array([[s, 0, -s * mean[0]], [0, s, -s * mean[1]], [0, 0, 1]])
        return (pts - mean) * s, T

    n1, T1 = _norm(x1)
    n2, T2 = _norm(x2)

    A = []
    for i in range(n):
        sw = math.sqrt(max(w[i], 0.0))
        x, y = n1[i]
        u, v = n2[i]
        A.append(np.array([x, y, 1, 0, 0, 0, -u * x, -u * y, -u]) * sw)
        A.append(np.array([0, 0, 0, x, y, 1, -v * x, -v * y, -v]) * sw)
    A = np.stack(A)
    if np.linalg.matrix_rank(A) < 8:
        raise ValueError("homography solve: degenerate points")
    _, _, VT = np.linalg.svd(A)
    Hn = VT[-1].reshape(3, 3)
    H = np.linalg.inv(T2) @ Hn @ T1
    if abs(H[2, 2]) > 1e-12:
        H = H / H[2, 2]
    return H


def _apply_model(model, pts):
    if isinstance(model, dict):
        c, s = math.cos(model['rotation']), math.sin(model['rotation'])
        sc = model['scale']
        R = np.array([[c, -s], [s, c]]) * sc
        return pts @ R.T + np.array([model['tx'], model['ty']])
    p = np.concatenate([pts, np.ones((len(pts), 1))], axis=1) @ np.asarray(model).T
    return p[:, :2] / np.clip(p[:, 2:3], 1e-12, None)


def solve_robust(x1, x2, model='similarity', iterations=8):
    solver = {'translation': solve_translation,
              'similarity': solve_similarity,
              'perspective': solve_homography}[model]
    min_pts = {'translation': 1, 'similarity': 2, 'perspective': 4}[model]
    x1 = np.asarray(x1, dtype=np.float64)
    x2 = np.asarray(x2, dtype=np.float64)
    m = solver(x1, x2)
    if len(x1) <= min_pts:
        return m
    for _ in range(iterations):
        res = np.sqrt(((_apply_model(m, x1) - x2) ** 2).sum(axis=1))
        s = sigma_mad(res)
        if s < 1e-9:
            med = float(np.median(res))
            if med < 1e-9:
                break
            s = 1.4826 * med
        r = res / (4.685 * s)
        w = np.where(np.abs(r) < 1.0, (1.0 - r ** 2) ** 2, 0.0)
        if int((w > 0).sum()) < min_pts or w.sum() < 1e-9:
            break
        try:
            m = solver(x1, x2, w)
        except (ValueError, np.linalg.LinAlgError):
            break
    return m


def solve_track_transforms(tracks, model='similarity', w=0, h=0):
    if not tracks:
        raise ValueError("no tracks")
    times = [k['t'] for k in tracks[0]['x']]
    ref = np.array([[tr['x'][0]['v'], tr['y'][0]['v']] for tr in tracks])
    min_pts = {'translation': 1, 'similarity': 2, 'perspective': 4}[model]
    if len(tracks) < min_pts:
        raise ValueError(
            f"{model} solve needs at least {min_pts} track points, got {len(tracks)}")

    out = []
    corners0 = np.array([[0.0, 0.0], [w, 0.0], [w, h], [0.0, h]])
    fc = np.array([w / 2.0, h / 2.0])
    for i, t in enumerate(times):
        cur = np.array([[tr['x'][i]['v'], tr['y'][i]['v']] for tr in tracks])
        conf = np.array([tr.get('confidence', [{'v': 1.0}] * len(times))[i]['v']
                         for tr in tracks])
        good = conf >= 0.15
        p_ref = ref[good] if good.sum() >= min_pts else ref
        p_cur = cur[good] if good.sum() >= min_pts else cur
        if model == 'perspective':
            H = solve_robust(p_ref, p_cur, 'perspective')
            moved = _apply_model(H, corners0)
            out.append({'t': t, 'corners': [[round(float(px), 2), round(float(py), 2)]
                                            for px, py in moved]})
        else:
            g = p_ref.mean(axis=0)
            m = solve_robust(p_ref - g, p_cur - g, model)
            c_, s_ = math.cos(m['rotation']), math.sin(m['rotation'])
            cr = np.array([[c_, -s_], [s_, c_]]) * m['scale']
            tp = np.array([m['tx'], m['ty']]) + (cr - np.eye(2)) @ (fc - g)
            out.append({'t': t,
                        'x': round(float(tp[0]), 2),
                        'y': round(float(tp[1]), 2),
                        'rotation': round(math.degrees(m['rotation']), 3),
                        'scale': round(m['scale'], 4)})
    return out


__all__ = ['solve_translation', 'solve_similarity', 'solve_homography',
           'solve_robust', 'solve_track_transforms', 'sigma_mad']

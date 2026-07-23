import numpy as np

FACE_MODES = ['blur', 'pixelate', 'box']
FACE_SHAPES = ['rect', 'ellipse']
SPOT_METHODS = ['edge_blend', 'inpaint']


def _iou(a, b):
    ax0, ay0, ax1, ay1 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx0, by0, bx1, by1 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    ix = max(0, min(ax1, bx1) - max(ax0, bx0))
    iy = max(0, min(ay1, by1) - max(ay0, by0))
    inter = ix * iy
    union = a[2] * a[3] + b[2] * b[3] - inter
    return inter / max(1e-6, union)


def _apply_face_mask(arr, box, mode, shape, strength):
    import cv2
    h, w = arr.shape[:2]
    x, y, bw, bh = [int(round(v)) for v in box]
    pad = int(max(bw, bh) * 0.15)
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(w, x + bw + pad)
    y1 = min(h, y + bh + pad)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return
    roi = arr[y0:y1, x0:x1]
    if mode == 'pixelate':
        cells = max(2, int(min(roi.shape[0], roi.shape[1])
                           / max(2, strength)))
        small = cv2.resize(roi, (cells, cells),
                           interpolation=cv2.INTER_AREA)
        filled = cv2.resize(small, (roi.shape[1], roi.shape[0]),
                            interpolation=cv2.INTER_NEAREST)
    elif mode == 'box':
        filled = np.zeros_like(roi)
    else:
        k = max(3, (int(max(3, strength)) // 2) * 2 + 1)
        filled = cv2.GaussianBlur(roi, (k, k), 0)
        filled = cv2.GaussianBlur(filled, (k, k), 0)
    if shape == 'ellipse':
        mask = np.zeros(roi.shape[:2], dtype=np.uint8)
        cv2.ellipse(mask,
                    ((roi.shape[1]) // 2, (roi.shape[0]) // 2),
                    ((roi.shape[1]) // 2, (roi.shape[0]) // 2),
                    0, 0, 360, 255, -1)
        mask = cv2.GaussianBlur(mask, (15, 15), 0)
        m = (mask.astype(np.float32) / 255.0)[..., None]
        arr[y0:y1, x0:x1] = (filled * m + roi * (1 - m)).astype(arr.dtype)
    else:
        arr[y0:y1, x0:x1] = filled


def face_blur_video(view_url: str, *, mode='blur', shape='ellipse',
                    strength=24.0, recheck=12, search_scale=1.2,
                    neighbors=4, min_size=24, progress=None) -> str:
    import cv2
    import torch
    from .media_torch import torch_process_video

    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    if cascade.empty():
        raise RuntimeError("face blur: OpenCV haar cascade not found")
    state = {'faces': [], 'frame': 0}
    recheck = max(1, int(recheck))

    def fn(img, t):
        arr = (img.clamp(0, 1) * 255).byte().cpu().numpy()
        idx = state['frame']
        state['frame'] += 1
        if idx % recheck == 0:
            gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
            found = cascade.detectMultiScale(
                gray, scaleFactor=max(1.05, float(search_scale)),
                minNeighbors=max(1, int(neighbors)),
                minSize=(int(min_size), int(min_size)))
            found = [tuple(float(v) for v in f) for f in found]
            merged = []
            for f in found:
                prev = next((p for p in state['faces']
                             if _iou(p, f) > 0.2), None)
                if prev is not None:
                    merged.append(tuple(
                        0.6 * pv + 0.4 * fv for pv, fv in zip(prev, f)))
                else:
                    merged.append(f)
            state['faces'] = merged
        for box in state['faces']:
            _apply_face_mask(arr, box, mode, shape, float(strength))
        return torch.from_numpy(arr.astype(np.float32) / 255.0).to(img.device)

    return torch_process_video(view_url, fn, progress=progress)


def spot_remove_video(view_url: str, *, rect=(0.42, 0.42, 0.16, 0.16),
                      method='edge_blend', feather=0.15,
                      progress=None) -> str:
    import cv2
    import torch
    from .media_torch import torch_process_video

    def fn(img, t):
        h, w = img.shape[0], img.shape[1]
        x0 = int(max(0, min(1, rect[0])) * w)
        y0 = int(max(0, min(1, rect[1])) * h)
        x1 = min(w, x0 + max(2, int(rect[2] * w)))
        y1 = min(h, y0 + max(2, int(rect[3] * h)))
        if x1 - x0 < 2 or y1 - y0 < 2:
            return img
        arr = (img.clamp(0, 1) * 255).byte().cpu().numpy()
        if method == 'inpaint':
            mask = np.zeros((h, w), dtype=np.uint8)
            mask[y0:y1, x0:x1] = 255
            filled = cv2.inpaint(arr, mask, 5, cv2.INPAINT_TELEA)
        else:
            filled = arr.copy()
            rw = x1 - x0
            rh = y1 - y0
            xs = np.arange(rw, dtype=np.float32)[None, :, None]
            ys = np.arange(rh, dtype=np.float32)[:, None, None]
            left = arr[y0:y1, max(0, x0 - 1)][:, None, :].astype(np.float32)
            right = arr[y0:y1, min(w - 1, x1)][:, None, :].astype(np.float32)
            top = arr[max(0, y0 - 1), x0:x1][None, :, :].astype(np.float32)
            bottom = arr[min(h - 1, y1), x0:x1][None, :, :].astype(np.float32)
            wx = (xs + 0.5) / rw
            wy = (ys + 0.5) / rh
            horiz = left * (1 - wx) + right * wx
            vert = top * (1 - wy) + bottom * wy
            filled[y0:y1, x0:x1] = ((horiz + vert) / 2).astype(np.uint8)
        if feather > 0:
            mask = np.zeros((h, w), dtype=np.float32)
            mask[y0:y1, x0:x1] = 1.0
            k = max(3, (int(min(w, h) * feather * 0.2) // 2) * 2 + 1)
            mask = cv2.GaussianBlur(mask, (k, k), 0)[..., None]
            out = filled.astype(np.float32) * mask \
                + arr.astype(np.float32) * (1 - mask)
        else:
            out = filled.astype(np.float32)
        return torch.from_numpy(out / 255.0).to(img.device)

    return torch_process_video(view_url, fn, progress=progress)


__all__ = ['FACE_MODES', 'FACE_SHAPES', 'SPOT_METHODS',
           'face_blur_video', 'spot_remove_video']

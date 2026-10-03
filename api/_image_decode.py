"""Private, one-shot pixel validator; stdin bytes, exit status only.

Run in a fresh interpreter, not in the ComfyUI process: third-party nodes may
change Pillow's global LOAD_TRUNCATED_IMAGES concurrently. Never toggle that
host flag (a thread lock would not protect other Pillow users).
"""
import io
import sys

from PIL import Image, ImageFile


def main():
    max_bytes, max_pixels = int(sys.argv[1]), int(sys.argv[2])
    data = sys.stdin.buffer.read(max_bytes + 1)
    if not data or len(data) > max_bytes:
        return 1
    ImageFile.LOAD_TRUNCATED_IMAGES = False  # private process, no other readers
    try:
        with Image.open(io.BytesIO(data)) as image:
            if (image.width * image.height > max_pixels
                    or getattr(image, 'n_frames', 1) != 1
                    or image.format not in {'PNG', 'JPEG', 'WEBP', 'GIF', 'BMP', 'TIFF'}):
                return 1
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            image.load()  # decode pixels only; never resize, encode or write them
    except Exception:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

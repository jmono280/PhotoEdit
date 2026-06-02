import io

import piexif
from PIL import Image
from PIL.PngImagePlugin import PngInfo

from app.core.config import settings


def _to_rational(value: float) -> tuple:
    d = int(value)
    m = int((value - d) * 60)
    s = round(((value - d) * 60 - m) * 60 * 10000)
    return (d, 1), (m, 1), (s, 10000)


def embed_metadata(image_bytes: bytes) -> bytes:
    needs_resize = settings.META_RESCALE and bool(settings.META_OUTPUT_WIDTH and settings.META_OUTPUT_HEIGHT)
    if not needs_resize and not any([
        settings.META_BUSINESS_NAME, settings.META_WEBSITE, settings.META_GPS_LAT
    ]):
        return image_bytes

    img = Image.open(io.BytesIO(image_bytes))

    if needs_resize:
        from PIL import ImageColor
        target_w = settings.META_OUTPUT_WIDTH
        target_h = settings.META_OUTPUT_HEIGHT

        img.thumbnail((target_w, target_h), Image.LANCZOS)

        pad_color = ImageColor.getcolor(settings.META_PAD_COLOR, img.mode)
        canvas = Image.new(img.mode, (target_w, target_h), pad_color)
        canvas.paste(img, ((target_w - img.width) // 2, (target_h - img.height) // 2))
        img = canvas

    info = PngInfo()
    if settings.META_BUSINESS_NAME:
        info.add_text("Author", settings.META_BUSINESS_NAME)
        info.add_text("Copyright", settings.META_COPYRIGHT or settings.META_BUSINESS_NAME)
    if settings.META_WEBSITE:
        info.add_text("Source", settings.META_WEBSITE)
    if settings.META_DESCRIPTION:
        info.add_text("Description", settings.META_DESCRIPTION)

    exif_bytes = None
    if settings.META_GPS_LAT and settings.META_GPS_LON:
        lat = abs(float(settings.META_GPS_LAT))
        lon = abs(float(settings.META_GPS_LON))
        lat_ref = b"N" if float(settings.META_GPS_LAT) >= 0 else b"S"
        lon_ref = b"E" if float(settings.META_GPS_LON) >= 0 else b"W"
        gps = {
            piexif.GPSIFD.GPSLatitudeRef:  lat_ref,
            piexif.GPSIFD.GPSLatitude:     _to_rational(lat),
            piexif.GPSIFD.GPSLongitudeRef: lon_ref,
            piexif.GPSIFD.GPSLongitude:    _to_rational(lon),
        }
        exif_bytes = piexif.dump({"GPS": gps})

    out = io.BytesIO()
    save_kwargs: dict = {"format": "PNG", "pnginfo": info}
    if exif_bytes:
        save_kwargs["exif"] = exif_bytes
    img.save(out, **save_kwargs)
    return out.getvalue()

import argparse
from pathlib import Path

import cv2
import numpy as np

from .layout import CLIENT_RADIUS, ZONE_RECTS


def _point_in_rect(point, rect):
    x, y = point
    x1, y1, x2, y2 = rect
    return x1 <= x <= x2 and y1 <= y <= y2


def _empty_result():
    return {
        "clients_count": 0,
        "employees_count": 0,
        "zone_1_clients": 0,
        "zone_2_clients": 0,
        "zone_3_clients": 0,
        "zone_4_clients": 0,
    }


def detect_agency_occupancy(image_path):
    """Detect black client dots and simple colored employee outline symbols."""
    image_path = Path(image_path)
    image = cv2.imread(str(image_path))
    if image is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    result = _empty_result()

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, black_mask = cv2.threshold(gray, 45, 255, cv2.THRESH_BINARY_INV)
    black_mask = cv2.medianBlur(black_mask, 3)

    contours, _ = cv2.findContours(black_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = np.pi * (CLIENT_RADIUS - 3) ** 2
    max_area = np.pi * (CLIENT_RADIUS + 5) ** 2

    for contour in contours:
        area = cv2.contourArea(contour)
        if not (min_area <= area <= max_area):
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter == 0:
            continue

        circularity = 4 * np.pi * area / (perimeter * perimeter)
        if circularity < 0.65:
            continue

        moments = cv2.moments(contour)
        if moments["m00"] == 0:
            continue

        center = (int(moments["m10"] / moments["m00"]), int(moments["m01"] / moments["m00"]))
        for zone_id, rect in ZONE_RECTS.items():
            if _point_in_rect(center, rect):
                result[f"zone_{zone_id}_clients"] += 1
                result["clients_count"] += 1
                break

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    colored_mask = cv2.inRange(hsv, (5, 40, 40), (179, 255, 245))
    colored_mask = cv2.morphologyEx(
        colored_mask,
        cv2.MORPH_CLOSE,
        np.ones((3, 3), dtype=np.uint8),
        iterations=1,
    )
    employee_contours, _ = cv2.findContours(
        colored_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    for contour in employee_contours:
        area = cv2.contourArea(contour)
        if 80 <= area <= 2200:
            x, y, w, h = cv2.boundingRect(contour)
            if 18 <= w <= 45 and 18 <= h <= 45:
                result["employees_count"] += 1

    return result


def _parse_args():
    parser = argparse.ArgumentParser(description="Detect clients in a schematic agency image.")
    parser.add_argument("image_path", help="Path to a generated agency PNG image.")
    return parser.parse_args()


def main():
    args = _parse_args()
    result = detect_agency_occupancy(args.image_path)
    print(
        "[AI] Total clients: "
        f"{result['clients_count']} | "
        f"Zone 1: {result['zone_1_clients']} | "
        f"Zone 2: {result['zone_2_clients']} | "
        f"Zone 3: {result['zone_3_clients']} | "
        f"Zone 4: {result['zone_4_clients']} | "
        f"Employees: {result['employees_count']}"
    )


if __name__ == "__main__":
    main()

import argparse
import hashlib
import random
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

from .layout import CLIENT_RADIUS, EXIT_RECT, IMAGE_HEIGHT, IMAGE_WIDTH, ZONE_RECTS


DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "generated_images"


def _seed_for(timestamp, agency_id):
    raw = f"{agency_id}-{timestamp.isoformat()}".encode("utf-8")
    return int(hashlib.sha256(raw).hexdigest()[:12], 16)


def _safe_filename(timestamp, agency_id):
    stamp = timestamp.strftime("%Y%m%d_%H%M")
    return f"agency_{agency_id}_{stamp}.png"


def _zone_centers_for_clients(total_clients, rng):
    zone_weights = [0.32, 0.27, 0.18, 0.23]
    counts = [int(total_clients * weight) for weight in zone_weights]

    while sum(counts) < total_clients:
        counts[rng.randrange(4)] += 1
    while sum(counts) > total_clients:
        index = rng.randrange(4)
        if counts[index] > 0:
            counts[index] -= 1

    return {zone_id: counts[zone_id - 1] for zone_id in ZONE_RECTS}


def _random_point_in_rect(rect, rng, margin=22):
    x1, y1, x2, y2 = rect
    return (
        rng.randint(x1 + margin, x2 - margin),
        rng.randint(y1 + margin, y2 - margin),
    )


def _draw_agency_layout(image):
    image[:] = (248, 248, 244)

    cv2.rectangle(image, (25, 25), (875, 660), (210, 210, 205), 2)
    cv2.line(image, (450, 305), (450, 585), (220, 220, 215), 2)
    cv2.line(image, (120, 305), (780, 305), (220, 220, 215), 2)

    for zone_id, (x1, y1, x2, y2) in ZONE_RECTS.items():
        cv2.rectangle(image, (x1, y1), (x2, y2), (125, 125, 125), 2)
        cv2.putText(
            image,
            f"ZONE {zone_id}",
            (x1 + 14, y1 + 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (95, 95, 95),
            2,
            cv2.LINE_AA,
        )

        desk_y = y1 + 58
        cv2.rectangle(image, (x1 + 28, desk_y), (x2 - 28, desk_y + 30), (188, 188, 180), -1)
        cv2.rectangle(image, (x1 + 28, desk_y), (x2 - 28, desk_y + 30), (125, 125, 118), 1)
        for chair_x in range(x1 + 64, x2 - 45, 78):
            cv2.rectangle(image, (chair_x, y2 - 48), (chair_x + 24, y2 - 26), (205, 205, 198), -1)
            cv2.rectangle(image, (chair_x, y2 - 48), (chair_x + 24, y2 - 26), (145, 145, 140), 1)

    x1, y1, x2, y2 = EXIT_RECT
    cv2.rectangle(image, (x1, y1), (x2, y2), (70, 135, 70), 3)
    cv2.line(image, (x1 + 25, y1), (x1 + 25, y2), (70, 135, 70), 2)
    cv2.line(image, (x2 - 25, y1), (x2 - 25, y2), (70, 135, 70), 2)
    cv2.putText(
        image,
        "EXIT",
        (x1 + 65, y1 + 43),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (70, 135, 70),
        2,
        cv2.LINE_AA,
    )
    cv2.arrowedLine(image, (450, 570), (450, y1 + 10), (70, 135, 70), 2, tipLength=0.25)


def _draw_clients(image, zone_counts, rng):
    points = []
    for zone_id, count in zone_counts.items():
        rect = ZONE_RECTS[zone_id]
        for _ in range(count):
            point = None
            for _attempt in range(80):
                candidate = _random_point_in_rect(rect, rng)
                if all(
                    (candidate[0] - existing[0]) ** 2 + (candidate[1] - existing[1]) ** 2
                    >= (CLIENT_RADIUS * 3) ** 2
                    for existing in points
                ):
                    point = candidate
                    break
            if point is None:
                point = _random_point_in_rect(rect, rng)
            points.append(point)
            body_top = (point[0] - 9, point[1] + CLIENT_RADIUS - 1)
            body_bottom = (point[0] + 9, point[1] + CLIENT_RADIUS + 14)
            cv2.ellipse(
                image,
                (point[0], point[1] + 15),
                (12, 8),
                0,
                180,
                360,
                (92, 92, 92),
                -1,
                cv2.LINE_AA,
            )
            cv2.rectangle(image, body_top, body_bottom, (105, 105, 105), -1)
            cv2.circle(image, point, CLIENT_RADIUS, (0, 0, 0), -1, cv2.LINE_AA)
    return points


def _employee_specs_for_agency(agency_id):
    layouts = {
        1: [
            (1, "advisor", 0.22, 0.43),
            (1, "manager", 0.78, 0.43),
            (2, "cashier", 0.50, 0.43),
            (3, "security", 0.50, 0.42),
            (4, "cashier", 0.50, 0.42),
        ],
        2: [
            (1, "manager", 0.50, 0.43),
            (2, "cashier", 0.22, 0.43),
            (2, "advisor", 0.78, 0.43),
            (3, "advisor", 0.28, 0.42),
            (3, "security", 0.72, 0.42),
            (4, "cashier", 0.50, 0.42),
        ],
        3: [
            (1, "advisor", 0.50, 0.43),
            (2, "cashier", 0.50, 0.43),
            (3, "security", 0.50, 0.42),
            (4, "advisor", 0.22, 0.42),
            (4, "manager", 0.78, 0.42),
        ],
    }
    return layouts.get(
        agency_id,
        [
            (1, "advisor", 0.22, 0.43),
            (1, "manager", 0.78, 0.43),
            (2, "cashier", 0.22, 0.43),
            (2, "advisor", 0.78, 0.43),
            (3, "security", 0.50, 0.42),
            (4, "cashier", 0.50, 0.42),
        ],
    )


def _draw_employees(image, rng, agency_id):
    employee_specs = _employee_specs_for_agency(agency_id)
    color = (30, 110, 210)

    for zone_id, symbol, rel_x, rel_y in employee_specs:
        x1, y1, x2, y2 = ZONE_RECTS[zone_id]
        jitter_x = rng.randint(-6, 6)
        jitter_y = rng.randint(-5, 5)
        x = int(x1 + (x2 - x1) * rel_x) + jitter_x
        y = int(y1 + (y2 - y1) * rel_y) + jitter_y

        cv2.rectangle(image, (x - 16, y - 18), (x + 16, y + 18), color, 3)
        cv2.circle(image, (x, y - 6), 6, color, 2, cv2.LINE_AA)
        cv2.ellipse(image, (x, y + 11), (10, 7), 0, 180, 360, color, 2, cv2.LINE_AA)

        if symbol == "manager":
            cv2.line(image, (x - 8, y + 18), (x + 8, y + 18), color, 2, cv2.LINE_AA)
        elif symbol == "cashier":
            cv2.line(image, (x - 12, y - 18), (x + 12, y - 18), color, 2, cv2.LINE_AA)
        elif symbol == "security":
            cv2.circle(image, (x + 10, y - 12), 3, color, -1, cv2.LINE_AA)


def generate_agency_image(
    timestamp,
    clients_count,
    agency_id=1,
    output_dir=DEFAULT_OUTPUT_DIR,
):
    """Generate a schematic agency image and return its saved path."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    rng = random.Random(_seed_for(timestamp, agency_id))
    image = np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH, 3), dtype=np.uint8)

    _draw_agency_layout(image)
    zone_counts = _zone_centers_for_clients(clients_count, rng)
    _draw_employees(image, rng, agency_id)
    _draw_clients(image, zone_counts, rng)

    path = output_dir / _safe_filename(timestamp, agency_id)
    cv2.imwrite(str(path), image)
    return path


def _parse_args():
    parser = argparse.ArgumentParser(description="Generate a schematic BH Bank agency image.")
    parser.add_argument("--timestamp", default=None, help="Timestamp in YYYY-MM-DD HH:MM format.")
    parser.add_argument("--clients", type=int, default=18, help="Number of client dots to draw.")
    parser.add_argument("--agency-id", type=int, default=1, help="Agency identifier.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for PNG output.")
    return parser.parse_args()


def main():
    args = _parse_args()
    timestamp = (
        datetime.strptime(args.timestamp, "%Y-%m-%d %H:%M")
        if args.timestamp
        else datetime.now()
    )
    path = generate_agency_image(
        timestamp=timestamp,
        clients_count=max(0, args.clients),
        agency_id=args.agency_id,
        output_dir=args.output_dir,
    )
    print(f"[AI] Generated image: {path}")


if __name__ == "__main__":
    main()

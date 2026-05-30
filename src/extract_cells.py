import cv2
import numpy as np
import os
import pytesseract
import base64

from flask import Flask, request, jsonify

app = Flask(__name__)

MIN_LINE_LENGTH_RATIO = 0.2



@app.route("/api/extractCells", methods=["POST"])
def extract_cells():

    result = []

    data = request.json
    img_base64 = data["base64"]

    img_bytes = base64.b64decode(img_base64)

    img_nparray = np.frombuffer(img_bytes, np.uint8)

    img = cv2.imdecode(img_nparray, cv2.IMREAD_COLOR)

    if img is None:
        raise Exception("Image not found")

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    binary_img = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        21,
        10
    )

    def is_image_cell(crop):

        text = pytesseract.image_to_string(crop).strip()
        return len(text) < 3


    h, w = binary_img.shape

    # Kernels that detect horizontal + vertical lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, w // 30), 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(20, h // 30)))

    # Extracts horizontal + vertical lines from the image
    horizontal = cv2.morphologyEx(binary_img, cv2.MORPH_OPEN, horizontal_kernel)
    vertical = cv2.morphologyEx(binary_img, cv2.MORPH_OPEN, vertical_kernel)

    # Optional: strengthen broken lines a little
    horizontal = cv2.dilate(
        horizontal,
        cv2.getStructuringElement(cv2.MORPH_RECT, (15, 3)),
        iterations=1
    )

    vertical = cv2.dilate(
        vertical,
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, 15)),
        iterations=1
    )

    grid = cv2.add(horizontal, vertical)


    def merge_close_positions(values, tolerance=10):

        # Values are coordinates 
        if not values:
            return []

        values = sorted(values)

        # Start with 1st group
        groups = [[values[0]]]

        # Loop through remaining
        for value in values[1:]:

            # Check if value is close to last value added to current group
            if abs(value - groups[-1][-1]) <= tolerance:
                groups[-1].append(value)
            
            # If not close, add new group
            else:
                groups.append([value])

        return [sum(group) // len(group) for group in groups]
    
    def trim_whitespace(crop, threshold=245, padding=20, min_area=20):

        # Convert to grayscale
        gray_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

        # If pixel brightness > threshold, treat as white background
        mask = (gray_crop < threshold).astype(np.uint8) * 255

        # Find connected blobs of content that we need to keep
        contours, _ = cv2.findContours(
            mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )

        boxes = []

        for contour in contours:
            if cv2.contourArea(contour) < min_area:
                continue

            x, y, w, h = cv2.boundingRect(contour)
            boxes.append((x, y, x + w, y + h))

        # If no blobs found return original crop
        if not boxes:
            return crop

        # Combine all boxes
        x1 = min(box[0] for box in boxes)
        y1 = min(box[1] for box in boxes)
        x2 = max(box[2] for box in boxes)
        y2 = max(box[3] for box in boxes)

        # Adds padding for breathing room (in case of overcropping)
        y1 = max(y1 - padding, 0)
        x1 = max(x1 - padding, 0)
        y2 = min(y2 + padding, crop.shape[0])
        x2 = min(x2 + padding, crop.shape[1])

        return crop[y1:y2, x1:x2]


    # ----- FIND HORIZONTAL LINE POSITIONS -----
    horizontal_contours, _ = cv2.findContours(
        horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    horizontal_lines = []

    for contour in horizontal_contours:
        x, y, bw, bh = cv2.boundingRect(contour)

        # keep long enough horizontal lines
        if bw > w * MIN_LINE_LENGTH_RATIO:
            horizontal_lines.append(y)
            horizontal_lines.append(y + bh)

    horizontal_lines = merge_close_positions(
        horizontal_lines,
        tolerance=max(5, h // 150)
    )


    vertical_contours, _ = cv2.findContours(
        vertical, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    vertical_lines = []

    for contour in vertical_contours:
        x, y, bw, bh = cv2.boundingRect(contour)

        # keep tall enough vertical lines
        if bh > h * MIN_LINE_LENGTH_RATIO:
            vertical_lines.append(x)
            vertical_lines.append(x + bw)

    vertical_lines = merge_close_positions(
        vertical_lines,
        tolerance=max(5, w // 150)
    )


    # ----- BUILD CELLS FROM ADJACENT LINE PAIRS -----
    cells = []
    pad = 2

    # Builds list of all cells in table
    for row_index in range(len(horizontal_lines) - 1):
        y1 = horizontal_lines[row_index]
        y2 = horizontal_lines[row_index + 1]

        # Skip tiny row gaps
        if y2 - y1 < 20:
            continue

        for column_index in range(len(vertical_lines) - 1):
            x1 = vertical_lines[column_index]
            x2 = vertical_lines[column_index + 1]

            # Skip tiny column gaps
            if x2 - x1 < 20:
                continue

            crop = img[y1 + pad:y2 - pad, x1 + pad:x2 - pad]

            if crop.size == 0:
                continue

            cells.append((row_index, column_index, x1, y1, x2 - x1, y2 - y1, crop))


    # --------- SAVE OUTPUT ---------
    os.makedirs("table_output/cells", exist_ok=True)
    os.makedirs("table_output", exist_ok=True)

    debug = img.copy() 

    image_cells = []

    for row_index, column_index, x, y, bw, bh, crop in cells:

        if not is_image_cell(crop):
            continue

        cv2.rectangle(
            debug,
            (x, y),
            (x + bw, y + bh),
            (0, 0, 255),
            2
        )

        trimmed_crop = trim_whitespace(crop)

        _, buffer = cv2.imencode(".png", trimmed_crop)
        b64 = base64.b64encode(buffer).decode()

        image_cells.append({
            "raw_row": row_index,
            "col": column_index,
            "image": b64
        })

    # Removes duplicate row numbers using set
    unique_rows = sorted(set(cell["raw_row"] for cell in image_cells))

    # Takes the raw row numbers, converts them to 0 ... n in a dict
    row_map = {
        raw_row: clean_row
        for clean_row, raw_row in enumerate(unique_rows)
    }

    result = []

    for cell in image_cells:
        result.append({
            "clean_row": row_map[cell["raw_row"]],
            "raw_row": cell["raw_row"],
            "col": cell["col"],
            "image": cell["image"]
        })

    # Save debug/intermediate images
    
    #cv2.imwrite("table_output/binary.png", binary_img)
    #cv2.imwrite("table_output/grid.png", grid)
    #cv2.imwrite("table_output/debug.png", debug)

    #print("Saved debug image → table_output/debug.png")
    #print("Saved cells → table_output/cells/")

    return jsonify(result)

if __name__ == "__main__":
    app.run(port=5051, debug=True)
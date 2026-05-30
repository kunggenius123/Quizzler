import cv2
import numpy as np
import os

img = cv2.imread("images/molecules.png")

if img is None:
    raise Exception("Image not found")

# Convert to grayscale
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

threshold, binary_img = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)

h, w = binary_img.shape

# Kernels that detect horizontal + vertical lines
horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, w // 30), 1))
vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(20, h // 30)))

# Extracts horizontal + vertical lines from the image
horizontal = cv2.morphologyEx(binary_img, cv2.MORPH_OPEN, horizontal_kernel)
vertical = cv2.morphologyEx(binary_img, cv2.MORPH_OPEN, vertical_kernel)

grid = cv2.add(horizontal, vertical)

# Contours: list of shapes
contours, hierarchy = cv2.findContours(grid, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

boxes = []

for contour in contours:
    x, y, bw, bh = cv2.boundingRect(contour)

    # Ignore tiny noise
    if bw < 80 or bh < 40:
        continue

    # Ignore giant outer border
    if bw > w * 0.95 and bh > h * 0.95:
        continue

    boxes.append((x, y, bw, bh))

# Sort by y (top to bottom), then x (left to right)
boxes = sorted(boxes, key=lambda b: (b[1], b[0]))


#-----GROUP INTO ROWS------
rows = []

# How close in y value 2 boxes need to be considered in the same row
row_tolerance = h // 100

for box in boxes:
    x, y, bw, bh = box

    # If box was put into existing row
    placed = False

    for row in rows:

        # Compare y position
        if abs(y - row[0][1]) < row_tolerance:
            row.append(box)
            placed = True
            break

    if not placed:
        rows.append([box])


# Sort rows left-right
for row in rows:
    row.sort(key=lambda b: b[0])

# --------- SAVE OUTPUT ---------
os.makedirs("table_output/cells", exist_ok=True)
os.makedirs("table_output", exist_ok=True)

debug = img.copy()

for r_idx, row in enumerate(rows):
    for c_idx, (x, y, bw, bh) in enumerate(row):

        # Crop cell
        crop = img[y:y+bh, x:x+bw]

        filename = f"table_output/cells/row_{r_idx:02d}_col_{c_idx:02d}.png"
        cv2.imwrite(filename, crop)

        # Draw debug rectangle
        cv2.rectangle(
            debug,
            (x, y),
            (x + bw, y + bh),
            (0, 0, 255),
            2
        )

# Save debug image
cv2.imwrite("table_output/debug.png", debug)

print("Threshold used:", threshold)
print("Rows found:", len(rows))

for i, row in enumerate(rows):
    print(f"Row {i}: {len(row)} cells")

print("Saved debug image → table_output/debug.png")
print("Saved cells → table_output/cells/")
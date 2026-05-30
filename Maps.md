Connects key to value

Subclasses of Map:

**HashMap**
- O(1)
- No order

**LinkedHashMap**
- O(log n)
- Keeps insertion order

**TreeMap**
- Slowest
- Map implementation that stores key in sorted order
- Sorted keys (sorts itself using BST rule)
	- Left subtree = smaller
	- Right subtree = bigger
- Key type must implement Comparable

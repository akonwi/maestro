export function isEmpty(list: any[] | null | undefined): boolean {
	if (list == null) return true;
	return list.length === 0;
}

export function partition<T>(
	items: T[],
	predicate: (i: T) => "left" | "right",
): { left: T[]; right: T[] } {
	const left: T[] = [];
	const right: T[] = [];

	for (const item of items) {
		if (predicate(item) === "left") {
			left.push(item);
		} else {
			right.push(item);
		}
	}

	return { left, right };
}

export function formatMatchDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString();
}

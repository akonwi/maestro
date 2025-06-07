export function isEmpty(list: any[] | null | undefined): boolean {
	if (list == null) return true;
	return list.length === 0;
}

export function formatMatchDate(dateString: string): string {
	const [year, month, day] = dateString.split('-');
	return `${month}/${day}/${year}`;
}

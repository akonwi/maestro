export function isEmpty(list: any[] | null | undefined): boolean {
	if (list == null) return true;
	return list.length === 0;
}

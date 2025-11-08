import { createContext, useContext } from "solid-js";

export const INITIAL_VALUE = {
	token: null,
	isReadOnly: true,
	headers: {},
};

export const AuthContext = createContext(INITIAL_VALUE);

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

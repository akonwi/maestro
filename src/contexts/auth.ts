import { Accessor, createContext, useContext } from "solid-js";

type IAuthContext = {
	token: Accessor<string>;
	isReadOnly: Accessor<boolean>;
	headers: Accessor<Record<string, string>>;
	setToken: (token: string) => void;
};

export const AuthContext = createContext<IAuthContext>();

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

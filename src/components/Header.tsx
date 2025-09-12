import { Link, useLocation } from "react-router";

export function Header() {
  const { pathname: url } = useLocation();

  return (
    <div className="navbar bg-base-100 border-b border-base-300">
      <div className="navbar-start">
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4.75 5.75H19.25"
              ></path>
              <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4.75 18.25H19.25"
              ></path>
              <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4.75 12H19.25"
              ></path>
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 bg-base-100 border border-base-300 rounded-box w-52"
          >
            <li>
              <Link to="/maestro/teams" className={url === "/" ? "active" : ""}>
                Teams
              </Link>
            </li>
            <li>
              <Link
                to="/maestro/matches"
                className={url === "/matches" ? "active" : ""}
              >
                Matches
              </Link>
            </li>
            <li>
              <Link
                to="/maestro/"
                className={url === "/betting" ? "active" : ""}
              >
                Betting
              </Link>
            </li>
            <li>
              <Link
                to="/maestro/value-bets"
                className={url === "/value-bets" ? "active" : ""}
              >
                Value Bets
              </Link>
            </li>
            <li>
              <Link
                to="/maestro/settings"
                className={url === "/settings" ? "active" : ""}
              >
                Settings
              </Link>
            </li>
          </ul>
        </div>
        <Link to="/maestro/" className="btn btn-ghost normal-case text-xl">
          Maestro
        </Link>
      </div>
      <div className="navbar-end hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li>
            <Link to="/maestro/teams" className={url === "/" ? "active" : ""}>
              Teams
            </Link>
          </li>
          <li>
            <Link
              to="/maestro/matches"
              className={url === "/matches" ? "active" : ""}
            >
              Matches
            </Link>
          </li>
          <li>
            <Link
              to="/maestro/betting"
              className={url === "/betting" ? "active" : ""}
            >
              Betting
            </Link>
          </li>
          <li>
            <Link
              to="/maestro/value-bets"
              className={url === "/value-bets" ? "active" : ""}
            >
              Value Bets
            </Link>
          </li>
          <li>
            <Link
              to="/maestro/settings"
              className={url === "/settings" ? "active" : ""}
            >
              Settings
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

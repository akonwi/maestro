import { useLocation } from "preact-iso";

export function Header() {
  const { url } = useLocation();

  return (
    <div className="navbar bg-base-100 shadow-lg">
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
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
          >
            <li>
              <a href="/" className={url === "/" ? "active" : ""}>
                Teams
              </a>
            </li>
            <li>
              <a href="/matches">Matches</a>
            </li>
          </ul>
        </div>
        <a href="/" className="btn btn-ghost normal-case text-xl">
          Soccer Stats
        </a>
      </div>
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li>
            <a href="/" className={url === "/" ? "active" : ""}>
              Teams
            </a>
          </li>
          <li>
            <a href="/matches">Matches</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
